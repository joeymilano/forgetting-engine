/* =====================================================================
   main.ts — 入口:状态机 + 流程编排
   状态:IDLE → WRITING → SEALING → STAGE_1..6(孟婆汤六口）→ EPILOGUE
   全程无导航、无 logo、无 spinner。任何时刻可点元素 ≤ 1。
   ===================================================================== */

import { STAGES, type StageVisual } from './stages';
import { SIP_COUNT, type ExperienceResult } from './experience';
import { typewriter } from './typewriter';
import { generateExperience } from './llm';
import { Weathering, type LayerSpec } from './weathering';
import {
  initAmbient,
  emitEmberBurst,
  setAmbientField,
  setAmbientTheme,
  setEmotionTint,
} from './ambient';
import { PACING_DURATION_SCALE, PACING_TIMING } from './emotion-visuals';
import {
  type AmbientMode,
  type AuroraDirection,
  directionFromDelta,
  getModeBehavior,
  isMistReady,
  mistHoldProgress,
  nextAmbientMode,
  normalizeAmbientMode,
} from './modes';
import {
  appendPoint,
  isStrokeCommitted,
  resampleStroke,
  strokeLength,
  strokeNetDirection,
  syntheticPathFor,
  SYNTHETIC_PATH_LENGTH_PX,
  type PathSample,
  type StrokePoint,
} from './stroke';
import { applyLang, getLang, t, toggleLang, type Lang } from './i18n';
import { initMusic } from './music';
import { initMemoryStars, addMemoryStar } from './memory-stars';
import { initOnboarding } from './onboarding';

// ---------- DOM ----------
const app = document.getElementById('app')!;
const writingView = document.querySelector<HTMLElement>('[data-view="writing"]')!;
const stageView = document.querySelector<HTMLElement>('[data-view="stage"]')!;
const epilogueView = document.querySelector<HTMLElement>('[data-view="epilogue"]')!;
const memoryInput = document.getElementById('memory-input') as HTMLTextAreaElement;
const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
const charCount = document.getElementById('char-count')!;
const stageText = document.getElementById('stage-text') as HTMLElement;
const stageBtn = document.getElementById('stage-btn') as HTMLButtonElement;
const loadingLine = document.getElementById('loading-line') as HTMLElement;
const aiAcknowledgment = document.getElementById('ai-acknowledgment') as HTMLElement;
const stageWhisper = document.getElementById('stage-whisper') as HTMLElement;
const epiloguePrimary = document.getElementById('epilogue-primary')!;
const epilogueSecondary = document.getElementById('epilogue-secondary')!;
const resetLink = document.getElementById('reset-link') as HTMLAnchorElement;
const progressEl = document.getElementById('progress')!;
const noiseLayer = document.getElementById('noise-layer')!;
const particleCanvas = document.getElementById('particle-canvas') as HTMLCanvasElement;

// ---------- 状态 ----------
type State =
  | 'IDLE'
  | 'WRITING'
  | 'SEALING'
  | 'STAGE_1'
  | 'STAGE_2'
  | 'STAGE_3'
  | 'STAGE_4'
  | 'STAGE_5'
  | 'STAGE_6'
  | 'EPILOGUE';

let state: State = 'IDLE';
let stages: string[] = [];
let currentIdx = 0; // 1..SIP_COUNT(6）
let isTransitioning = false;
let musicController: ReturnType<typeof initMusic> | null = null;
let currentExperience: ExperienceResult | null = null;
let onboardingController: ReturnType<typeof initOnboarding> | null = null;
let mistHoldStart = 0;
let mistHoldFrame = 0;
let mistHolding = false;
let auroraDirection: AuroraDirection = 'none';
let auroraStroke: StrokePoint[] = [];
let auroraStrokeActive = false;
let auroraStrokePointerId: number | null = null;
let auroraHintTimer: ReturnType<typeof setTimeout> | null = null;
let pendingAuroraPath: PathSample[] | null = null;
let pendingAuroraPathLengthPx = 0;
let sealingTimers: ReturnType<typeof setTimeout>[] = [];
let epilogueTimers: ReturnType<typeof setTimeout>[] = [];

const weathering = new Weathering(particleCanvas);

// 测量用 canvas(文字换行计算,与 weathering 内部一致)
const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d')!;
const FONT_FAMILY_EN = `'Cormorant Garamond','EB Garamond',Georgia,'Times New Roman',serif`;
const FONT_FAMILY_ZH = `'LXGW WenKai','Songti SC','Noto Serif SC','Source Han Serif SC','PingFang SC',serif`;
const FONT_WEIGHT = '400';

/** 字体族随当前语言切换(英文衬线 / 中文手写体) */
function fontFamilyOf(): string {
  return getLang() === 'zh' ? FONT_FAMILY_ZH : FONT_FAMILY_EN;
}

/** 基准字号:英文衬线体 x-height 偏小,字号放大以保持视觉体量 */
function baseFontSize(): number {
  const small = window.innerWidth < 768;
  if (getLang() === 'zh') return small ? 17 : 20;
  return small ? 19 : 23;
}

// ---------- 工具 ----------
function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isCJK(ch: string): boolean {
  const c = ch.codePointAt(0)!;
  return (
    (c >= 0x4e00 && c <= 0x9fff) ||
    (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0x3000 && c <= 0x30ff) ||
    (c >= 0xff00 && c <= 0xffef) ||
    (c >= 0x3040 && c <= 0x309f)
  );
}

/** 文字换行:返回含 \n 的字符串。CJK 与空格均可断行。 */
function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
  lsPx: number,
  wsPx: number,
): string {
  measureCtx.font = `${FONT_WEIGHT} ${fontSize}px ${fontFamilyOf()}`;
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = '';
  let lineW = 0;
  let lastBreak = -1;
  let lastBreakLineW = 0;
  const adv = (ch: string) =>
    ch === ' '
      ? measureCtx.measureText(ch).width + wsPx
      : measureCtx.measureText(ch).width + lsPx;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '\n') {
      lines.push(line);
      line = '';
      lineW = 0;
      lastBreak = -1;
      lastBreakLineW = 0;
      continue;
    }
    line += ch;
    lineW += adv(ch);
    if (ch === ' ' || isCJK(ch)) {
      lastBreak = line.length;
      lastBreakLineW = lineW;
    }
    if (lineW > maxWidth && lastBreak > 0 && line.length > 1) {
      const before = line.slice(0, lastBreak);
      const after = line.slice(lastBreak);
      lines.push(before);
      line = after;
      // 在 after 中重算可断点
      let w = 0;
      let lb = -1;
      let lbw = 0;
      for (let j = 0; j < after.length; j++) {
        w += adv(after[j]);
        if (after[j] === ' ' || isCJK(after[j])) {
          lb = j + 1;
          lbw = w;
        }
      }
      lineW = w;
      lastBreak = lb;
      lastBreakLineW = lbw;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

function containerWidth(): number {
  return Math.max(200, Math.min(560, window.innerWidth - 56));
}

function stageMetrics(stage: StageVisual) {
  const base = baseFontSize();
  const fontSize = base * stage.fontSizeScale;
  const lineHeight = fontSize * stage.lineHeight;
  const lsPx = stage.letterSpacing === 'normal' ? 0 : parseFloat(stage.letterSpacing) * fontSize;
  const wsPx = stage.wordSpacing === 'normal' ? 0 : parseFloat(stage.wordSpacing) * fontSize;
  return { base, fontSize, lineHeight, lsPx, wsPx };
}

/** 把第 idx 层应用到 stageText(换行 + CSS 变量 + dataset) */
function applyStage(idx: number) {
  const stage = STAGES[idx - 1];
  const { base, fontSize, lsPx, wsPx } = stageMetrics(stage);
  stageText.style.setProperty('--ls', stage.letterSpacing);
  stageText.style.setProperty('--blur', stage.blur);
  stageText.style.setProperty('--op', String(stage.opacity));
  stageText.style.setProperty('--ws', stage.wordSpacing);
  stageText.style.setProperty('--fs-scale', String(stage.fontSizeScale));
  stageText.style.setProperty('--lh', String(stage.lineHeight));
  stageText.dataset.stage = String(idx);
  const wrapped = wrapText(stages[idx - 1] ?? '', fontSize, containerWidth(), lsPx, wsPx);
  stageText.textContent = wrapped;
  // 兼容字号
  stageText.style.fontSize = `${base * stage.fontSizeScale}px`;
}

/** 显示原文(SEALING 阶段,base 样式) */
function applyRawText(text: string) {
  const base = baseFontSize();
  stageText.style.setProperty('--ls', '0.02em');
  stageText.style.setProperty('--blur', '0px');
  stageText.style.setProperty('--op', '1');
  stageText.style.setProperty('--ws', 'normal');
  stageText.style.setProperty('--fs-scale', '1');
  stageText.style.setProperty('--lh', '2.1');
  stageText.dataset.stage = '0';
  stageText.style.fontSize = `${base}px`;
  stageText.textContent = wrapText(text, base, containerWidth(), base * 0.02, 0);
}

/** 从当前 stageText 读取几何 + 排版,构造 LayerSpec */
function specFromEl(): LayerSpec {
  const rect = stageText.getBoundingClientRect();
  const cs = getComputedStyle(stageText);
  const fontSize = parseFloat(cs.fontSize);
  return {
    text: stageText.textContent || '',
    fontSize,
    lineHeight: parseFloat(cs.lineHeight) || fontSize * 2.1,
    letterSpacing: parseFloat(cs.letterSpacing) || 0,
    wordSpacing: parseFloat(cs.wordSpacing) || 0,
    fontFamily: cs.fontFamily || fontFamilyOf(),
    fontWeight: cs.fontWeight || FONT_WEIGHT,
    width: rect.width,
    left: rect.left,
    top: rect.top,
  };
}

// ---------- 噪点氛围层 ----------
function buildNoise() {
  const c = document.createElement('canvas');
  c.width = 120;
  c.height = 120;
  const cx = c.getContext('2d')!;
  const img = cx.createImageData(120, 120);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  noiseLayer.style.backgroundImage = `url("${c.toDataURL()}")`;
}

// ---------- 进度点 ----------
function buildProgress() {
  progressEl.innerHTML = '';
  for (let i = 0; i < SIP_COUNT; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    progressEl.appendChild(dot);
  }
}

function updateProgress(idx: number) {
  const dots = progressEl.querySelectorAll<HTMLElement>('.dot');
  dots.forEach((d, i) => {
    const n = i + 1;
    d.classList.remove('current', 'passed');
    if (n < idx) d.classList.add('passed');
    else if (n === idx) d.classList.add('current');
  });
}

// ---------- 视图切换 ----------
function showOnly(view: 'writing' | 'stage' | 'epilogue') {
  writingView.hidden = view !== 'writing';
  stageView.hidden = view !== 'stage';
  epilogueView.hidden = view !== 'epilogue';
}

function setState(next: State) {
  state = next;
  app.dataset.state = next;
}

// ---------- IDLE / WRITING ----------
function enterIdle() {
  setState('IDLE');
  showOnly('writing');
  progressEl.classList.remove('active');
  memoryInput.value = '';
  updateCharCount();
  submitBtn.disabled = true;
  stageBtn.hidden = true;
  loadingLine.hidden = true;
  setTimeout(() => memoryInput.focus(), 100);
}

function updateCharCount() {
  const len = memoryInput.value.trim().length;
  charCount.textContent = `${len} / 300`;
  charCount.classList.toggle('ok', len >= 30 && len <= 300);
  charCount.classList.toggle('bad', len > 0 && len < 30);
  submitBtn.disabled = !(len >= 30 && len <= 300);
  if (len > 0 && state === 'IDLE') setState('WRITING');
  else if (len === 0 && state === 'WRITING') setState('IDLE');
}

// ---------- 封缄记忆:每段放下的记忆化作星 + 留存面板 ----------
const sealedMemories: { preview: string; full: string; lang: Lang }[] = [];
let lastMemory = '';
let lastMemoryLang: Lang = 'en';

function memoryPreview(s: string): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > 42 ? clean.slice(0, 42) + '…' : clean;
}

function renderMemoryList(): void {
  const ul = document.getElementById('memory-list');
  const count = document.getElementById('mp-count');
  if (count) count.textContent = String(sealedMemories.length);
  if (!ul) return;
  ul.innerHTML = '';
  sealedMemories
    .slice()
    .reverse()
    .forEach((m) => {
      const li = document.createElement('li');
      li.className = 'ml-item';
      const head = document.createElement('div');
      head.className = 'ml-head';
      const dot = document.createElement('span');
      dot.className = 'ml-dot';
      const prev = document.createElement('span');
      prev.className = 'ml-preview';
      prev.textContent = m.preview;
      head.append(dot, prev);
      const full = document.createElement('div');
      full.className = 'ml-full';
      full.textContent = m.full;
      li.append(head, full);
      li.addEventListener('click', () => li.classList.toggle('open'));
      ul.appendChild(li);
    });
}

// ---------- AI 在场:落笔回应 / 情绪视觉 ----------
function showAcknowledgment(text: string): void {
  aiAcknowledgment.textContent = text;
  aiAcknowledgment.hidden = false;
  aiAcknowledgment.classList.add('shown');
}

function hideAcknowledgment(): void {
  aiAcknowledgment.classList.remove('shown');
  aiAcknowledgment.hidden = true;
  aiAcknowledgment.textContent = '';
}

function applyExperienceVisuals(experience: ExperienceResult): void {
  setEmotionTint(experience.emotion);
  weathering.setDurationScale(PACING_DURATION_SCALE[experience.pacing]);
  musicController?.applySuggestedTrack(experience.soundtrack);
}

// ---------- SEALING ----------
async function enterSealing() {
  setState('SEALING');
  const memory = memoryInput.value.trim();
  lastMemory = memory;
  lastMemoryLang = getLang();
  submitBtn.disabled = true;
  currentExperience = null;
  hideAcknowledgment();

  // writing 淡出
  writingView.classList.add('fading-out');
  await wait(600);
  showOnly('stage');
  writingView.classList.remove('fading-out');

  // 原文以 base 样式准备好(先 invisible,等打字机)
  applyRawText(memory);
  const fullText = stageText.textContent || '';
  stageText.textContent = '';
  stageText.style.opacity = '';

  // 加载文案轮播(底部小字,每 2.5s)
  loadingLine.hidden = false;
  const sealingLines = t().sealing;
  let li = 0;
  loadingLine.textContent = sealingLines[0];
  const rotateLoading = () => {
    sealingTimers.push(
      setTimeout(() => {
        li = (li + 1) % sealingLines.length;
        loadingLine.textContent = sealingLines[li];
        rotateLoading();
      }, 2500),
    );
  };
  rotateLoading();

  // 落笔即回应:一旦 AI 结果到达就立刻呈现回应 + 情绪视觉,
  // 不等打字机播完 —— 二者本就并行请求(见下方 Promise.all)。
  let ackShownAt = 0;
  const echoEnabled = onboardingController?.isEchoEnabled() ?? true;
  const experiencePromise = generateExperience(memory, getLang(), echoEnabled).then(
    (experience) => {
      currentExperience = experience;
      applyExperienceVisuals(experience);
      if (experience.acknowledgment) {
        ackShownAt = performance.now();
        showAcknowledgment(experience.acknowledgment);
      }
      return experience;
    },
  );

  // 并行:打字机重现原文 + 一次性请求六口体验(文本 + 低语 + 回应 + 情绪参数)
  const [, experience] = await Promise.all([
    typewriter(stageText, fullText, 50),
    experiencePromise,
  ]);

  stages = experience.stages;
  sealingTimers.forEach((t) => clearTimeout(t));
  sealingTimers = [];
  loadingLine.hidden = true;

  // 回应至少停留可读时长(按 pacing 缩放),再让位给第一口
  if (ackShownAt) {
    const holdMs = PACING_TIMING[experience.pacing].acknowledgmentHoldMs;
    const remaining = holdMs - (performance.now() - ackShownAt);
    if (remaining > 0) await wait(remaining);
  }
  hideAcknowledgment();

  // 进入第 1 层(原文 → 第1层 粒子转场)
  currentIdx = 1;
  progressEl.classList.add('active');
  await gotoStage(1);
  stageBtn.hidden = false;
}

// ---------- 阶段转场 ----------
async function gotoStage(nextIdx: number) {
  isTransitioning = true;
  stageBtn.disabled = true;

  // 旧 spec(当前 stageText)
  const fromSpec = specFromEl();

  // 隐藏正文(粒子接管)。必须用 opacity 而非 visibility:
  // stage-text 带 filter: blur() + will-change,visibility 切换会销毁/重建
  // 它的合成层,Chrome 重建带滤镜的层时会闪黑色矩形(黑块闪烁根因之一)。
  // opacity 只走合成器,层常驻,不触发重栅格化。
  stageWhisper.classList.remove('shown');
  stageText.style.transition = 'none';
  stageText.style.opacity = '0';
  applyStage(nextIdx);
  void stageText.offsetWidth; // 强制 reflow
  const toSpec = specFromEl();

  // 粒子转场:按当前氛围模式选择风化方式(ash / fog / ribbon)。
  // 极光的 ribbon 优先沿本次笔画路径(拖拽织光);无笔画(键盘操作)时退回四方向兜底。
  const behavior = getModeBehavior(activeMode());
  const direction = activeMode() === 'aurora' ? auroraDirection : 'none';
  const path = activeMode() === 'aurora' ? pendingAuroraPath : null;
  const pathLengthPx = activeMode() === 'aurora' ? pendingAuroraPathLengthPx : 0;
  pendingAuroraPath = null;
  pendingAuroraPathLengthPx = 0;
  await weathering.transition(fromSpec, toSpec, {
    kind: behavior.transitionKind,
    direction,
    path: path ?? undefined,
    pathLengthPx,
  });

  // 恢复显示:仍在 transition:none 下瞬时恢复,再解除禁用,
  // 避免触发 1.2s 的 opacity 过渡(与粒子聚合的节奏冲突)。
  stageText.style.opacity = '';
  void stageText.offsetWidth;
  stageText.style.transition = '';
  currentIdx = nextIdx;
  updateStageChrome(nextIdx);
  if (behavior.transitionKind === 'ribbon') resetAuroraDirection();
  isTransitioning = false;
}

function updateStageChrome(idx: number) {
  const label = stageBtn.querySelector<HTMLElement>('.btn-label');
  const actionLabel = t().stageButtons[idx - 1];
  if (label) label.textContent = actionLabel;
  if (activeMode() === 'mist') setMistProgress(0);
  else setStageButtonActionLabel(actionLabel);
  stageBtn.disabled = false;
  updateProgress(idx);
  if (idx >= 4) weathering.startAsh(() => stageText);
  else weathering.stopAsh();

  const whisper = currentExperience?.whispers[idx - 1] ?? t().genericWhispers[idx - 1];
  stageWhisper.textContent = whisper;
  stageWhisper.hidden = false;
  requestAnimationFrame(() => stageWhisper.classList.add('shown'));
}

// ---------- EPILOGUE ----------
async function enterEpilogue() {
  setState('EPILOGUE');
  isTransitioning = true;
  stageBtn.disabled = true;
  weathering.stopAsh();

  const fromSpec = specFromEl();
  // 同 gotoStage:opacity 隐藏,保持合成层常驻,避免闪黑
  stageText.style.transition = 'none';
  stageText.style.opacity = '0';
  stageBtn.hidden = true;

  // 第 7 层文字完全粒子化飘散,不再浮现新文字
  await weathering.disperseOnly(fromSpec);

  // 这段记忆已彻底放下 → 化作一颗星,留存于面板(累积,reset 不清除)
  sealedMemories.push({
    preview: memoryPreview(lastMemory),
    full: lastMemory,
    lang: lastMemoryLang,
  });
  addMemoryStar();
  renderMemoryList();

  // 静默后浮现孟婆点评(AI echo,若不可用则退回固定文案);时长随 pacing 缩放
  const pacing = currentExperience?.pacing ?? 'steady';
  const timing = PACING_TIMING[pacing];
  const primaryLine = currentExperience?.echo ?? t().epiloguePrimary;
  epilogueTimers.push(
    setTimeout(() => {
      epilogueView.hidden = false;
      epiloguePrimary.textContent = primaryLine;
      epiloguePrimary.classList.add('shown');
    }, timing.epilogueSilenceMs),
  );
  // 静默 + 次级延迟后,次级文字 + 重置入口
  epilogueTimers.push(
    setTimeout(
      () => {
        epilogueSecondary.textContent = t().epilogueSecondary;
        epilogueSecondary.classList.add('shown');
        resetLink.hidden = false;
      },
      timing.epilogueSilenceMs + timing.epilogueSecondaryDelayMs,
    ),
  );
  isTransitioning = false;
}

// ---------- 重置:回到 IDLE ----------
async function reset() {
  epilogueTimers.forEach((t) => clearTimeout(t));
  epilogueTimers = [];
  weathering.clear();

  app.classList.add('is-hidden');
  await wait(1200);

  stages = [];
  currentIdx = 0;
  isTransitioning = false;
  currentExperience = null;
  setEmotionTint(null);
  weathering.setDurationScale(1);
  hideAcknowledgment();
  stageWhisper.classList.remove('shown');
  stageWhisper.hidden = true;
  stageWhisper.textContent = '';
  epiloguePrimary.classList.remove('shown');
  epilogueSecondary.classList.remove('shown');
  resetLink.hidden = true;
  epilogueView.hidden = true;
  stageText.textContent = '';
  stageText.style.opacity = '';
  stageText.style.transition = '';
  stageBtn.hidden = true;
  loadingLine.hidden = true;

  stopMistHold(true);
  resetAuroraDirection();
  enterIdle();
  app.classList.remove('is-hidden');
}

// ---------- resize:重新换行当前层 ----------
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (currentIdx >= 1 && currentIdx <= SIP_COUNT && !isTransitioning) {
      applyStage(currentIdx);
    }
  }, 200);
});

// ---------- 事件绑定 ----------
memoryInput.addEventListener('input', updateCharCount);
submitBtn.addEventListener('click', () => {
  if (!submitBtn.disabled && !isTransitioning) enterSealing();
});
stageBtn.addEventListener('click', async (e) => {
  // Mist 走 hold/release,Aurora 走拖拽/键盘,均不在 click 推进;仅 Stardust 点击即推进。
  if (activeMode() === 'mist' || activeMode() === 'aurora') return;
  // Stardust 仪式:从点击点迸出一簇上升的余烬。
  if (activeMode() === 'stardust' && !isTransitioning) {
    const bx = e.clientX || stageBtn.getBoundingClientRect().left + stageBtn.offsetWidth / 2;
    const by = e.clientY || stageBtn.getBoundingClientRect().top + stageBtn.offsetHeight / 2;
    emitEmberBurst(bx, by);
  }
  await advanceStage();
});
stageBtn.addEventListener('pointerdown', (e) => {
  if (activeMode() !== 'mist') return;
  e.preventDefault();
  if (typeof stageBtn.setPointerCapture === 'function') {
    stageBtn.setPointerCapture(e.pointerId);
  }
  startMistHold();
});
stageBtn.addEventListener('pointerup', async (e) => {
  if (activeMode() !== 'mist') return;
  e.preventDefault();
  if (
    typeof stageBtn.hasPointerCapture === 'function' &&
    typeof stageBtn.releasePointerCapture === 'function' &&
    stageBtn.hasPointerCapture(e.pointerId)
  ) {
    stageBtn.releasePointerCapture(e.pointerId);
  }
  await releaseMistHold();
});
stageBtn.addEventListener('pointercancel', () => {
  if (activeMode() !== 'mist') return;
  stopMistHold(true);
});
stageBtn.addEventListener('keydown', (e) => {
  if (activeMode() !== 'mist') return;
  if (e.key !== ' ' && e.key !== 'Enter') return;
  e.preventDefault();
  startMistHold();
});
stageBtn.addEventListener('keyup', async (e) => {
  if (activeMode() !== 'mist') return;
  if (e.key !== ' ' && e.key !== 'Enter') return;
  e.preventDefault();
  await releaseMistHold();
});

// Aurora「拖拽织光」:按住并拖出一道轨迹,文字粒子沿这道笔画汇成光带被牵走;
// 笔画够长才提交推进,太短则松手回弹(反馈式"合拢")。方向键 + Enter/Space 为键盘兜底。
stageView.addEventListener('pointerdown', (e) => {
  if (activeMode() !== 'aurora' || isTransitioning) return;
  // 极光的按钮本身也可作为拖拽起点(它不像雾海那样有自己的按住手势),
  // 这样"点了按钮却毫无反应"的死区就不存在了 —— 从按钮上开始拖也能织光。
  auroraStroke = appendPoint([], { x: e.clientX, y: e.clientY, t: e.timeStamp });
  auroraStrokeActive = true;
  auroraStrokePointerId = e.pointerId;
  if (typeof stageView.setPointerCapture === 'function') {
    stageView.setPointerCapture(e.pointerId);
  }
  weathering.beginStrokePreview();
  weathering.updateStrokePreview(auroraStroke);
});
stageView.addEventListener('pointermove', (e) => {
  if (activeMode() !== 'aurora' || !auroraStrokeActive) return;
  if (auroraStrokePointerId !== null && e.pointerId !== auroraStrokePointerId) return;
  auroraStroke = appendPoint(auroraStroke, { x: e.clientX, y: e.clientY, t: e.timeStamp });
  weathering.updateStrokePreview(auroraStroke);
  setAuroraDirection(strokeNetDirection(auroraStroke, directionFromDelta));
});
stageView.addEventListener('pointerup', async (e) => {
  if (activeMode() !== 'aurora' || !auroraStrokeActive) return;
  if (auroraStrokePointerId !== null && e.pointerId !== auroraStrokePointerId) return;
  const stroke = auroraStroke;
  const committed = !isTransitioning && isStrokeCommitted(stroke, isMobileViewport());
  weathering.endStrokePreview(committed);
  resetAuroraStroke();
  if (!committed) {
    flashAuroraTooShort();
    setAuroraDirection('none');
    return;
  }
  pendingAuroraPath = resampleStroke(stroke);
  pendingAuroraPathLengthPx = strokeLength(stroke);
  await advanceStage();
});
stageView.addEventListener('pointercancel', () => {
  if (!auroraStrokeActive) return;
  weathering.endStrokePreview(false);
  resetAuroraStroke();
  setAuroraDirection('none');
});
stageBtn.addEventListener('keydown', async (e) => {
  if (activeMode() !== 'aurora') return;
  if (e.key === 'ArrowLeft') setAuroraDirection('left');
  else if (e.key === 'ArrowRight') setAuroraDirection('right');
  else if (e.key === 'ArrowUp') setAuroraDirection('up');
  else if (e.key === 'ArrowDown') setAuroraDirection('down');
  else if (e.key === 'Enter' || e.key === ' ') {
    pendingAuroraPath = syntheticPathFor(auroraDirection);
    pendingAuroraPathLengthPx = SYNTHETIC_PATH_LENGTH_PX;
    await advanceStage();
  } else return;
  e.preventDefault();
});
resetLink.addEventListener('click', (e) => {
  e.preventDefault();
  reset();
});

// ---------- 氛围主题(星河 / 雾海 / 极光)----------
const THEME_KEY = 'fe-theme';

function detectTheme(): AmbientMode {
  try {
    return normalizeAmbientMode(localStorage.getItem(THEME_KEY));
  } catch {
    return 'stardust';
  }
}

function applyTheme(theme: AmbientMode): void {
  stopMistHold(true);
  resetAuroraDirection();
  const behavior = getModeBehavior(theme);
  document.body.dataset.theme = theme;
  document.body.dataset.mode = theme;
  document.body.dataset.advance = behavior.advanceKind;
  document.body.dataset.progress = behavior.progressKind;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* no storage permission */
  }
  setAmbientTheme(theme);
  setAmbientField(behavior.particleField);
  document.querySelectorAll<HTMLElement>('.theme-dots i').forEach((el) => {
    el.classList.toggle('active', el.dataset.theme === theme);
  });
  refreshStageButtonAccessibility();
}

function cycleTheme(): void {
  const cur = activeMode();
  applyTheme(nextAmbientMode(cur));
}

function activeMode(): AmbientMode {
  return normalizeAmbientMode(document.body.dataset.theme);
}

function setAuroraDirection(direction: AuroraDirection): void {
  auroraDirection = direction;
  document.body.dataset.auroraDirection = direction;
  stageBtn.dataset.auroraDirection = direction;
  if (activeMode() === 'aurora' && !auroraHintTimer) {
    const label = t().modeHints.aurora;
    stageBtn.setAttribute('aria-label', label);
    stageBtn.setAttribute('title', label);
  }
}

function isMobileViewport(): boolean {
  return window.innerWidth < 768;
}

/** 笔画未达提交阈值时松手:短暂提示"再画长一点",随后恢复常规提示 */
function flashAuroraTooShort(): void {
  if (activeMode() !== 'aurora') return;
  if (auroraHintTimer) clearTimeout(auroraHintTimer);
  const label = t().modeHints.auroraTooShort;
  stageBtn.setAttribute('aria-label', label);
  stageBtn.setAttribute('title', label);
  auroraHintTimer = setTimeout(() => {
    auroraHintTimer = null;
    if (activeMode() === 'aurora') {
      const idleLabel = t().modeHints.aurora;
      stageBtn.setAttribute('aria-label', idleLabel);
      stageBtn.setAttribute('title', idleLabel);
    }
  }, 1200);
}

function resetAuroraStroke(): void {
  auroraStroke = [];
  auroraStrokeActive = false;
  if (
    auroraStrokePointerId !== null &&
    typeof stageView.hasPointerCapture === 'function' &&
    typeof stageView.releasePointerCapture === 'function' &&
    stageView.hasPointerCapture(auroraStrokePointerId)
  ) {
    stageView.releasePointerCapture(auroraStrokePointerId);
  }
  auroraStrokePointerId = null;
}

function resetAuroraDirection(): void {
  if (auroraHintTimer) {
    clearTimeout(auroraHintTimer);
    auroraHintTimer = null;
  }
  if (auroraStrokeActive) weathering.endStrokePreview(false);
  resetAuroraStroke();
  setAuroraDirection('none');
}

function currentStageButtonLabel(): string {
  const idx = currentIdx >= 1 && currentIdx <= SIP_COUNT ? currentIdx : 1;
  return t().stageButtons[idx - 1];
}

function setStageButtonActionLabel(label: string): void {
  stageBtn.setAttribute('aria-label', label);
  stageBtn.setAttribute('title', label);
}

function refreshStageButtonAccessibility(): void {
  if (activeMode() === 'mist') {
    const progress =
      Number.parseFloat(document.body.style.getPropertyValue('--mist-progress')) || 0;
    setMistProgress(progress);
    return;
  }
  setStageButtonActionLabel(currentStageButtonLabel());
}

function setMistVisualProgress(value: number): number {
  const progress = Math.max(0, Math.min(1, value));
  document.body.style.setProperty('--mist-progress', progress.toFixed(3));
  stageBtn.dataset.mistReady = progress >= 1 ? 'true' : 'false';
  return progress;
}

function setMistProgress(value: number): void {
  const progress = setMistVisualProgress(value);
  if (activeMode() !== 'mist') {
    refreshStageButtonAccessibility();
    return;
  }
  const hints = t().modeHints;
  const label =
    progress >= 1 ? hints.mistReady : progress > 0 ? hints.mistHolding : hints.mistIdle;
  stageBtn.setAttribute('aria-label', label);
  stageBtn.setAttribute('title', label);
}

function stopMistHold(resetProgress: boolean): number {
  if (mistHoldFrame) cancelAnimationFrame(mistHoldFrame);
  mistHoldFrame = 0;
  mistHolding = false;
  stageBtn.dataset.mistHolding = 'false';
  const elapsed = mistHoldStart ? performance.now() - mistHoldStart : 0;
  mistHoldStart = 0;
  if (resetProgress) {
    setMistVisualProgress(0);
    refreshStageButtonAccessibility();
  }
  return elapsed;
}

function tickMistHold(): void {
  if (!mistHolding) return;
  const elapsed = performance.now() - mistHoldStart;
  setMistProgress(mistHoldProgress(elapsed));
  mistHoldFrame = requestAnimationFrame(tickMistHold);
}

function startMistHold(): void {
  if (isTransitioning || mistHolding || activeMode() !== 'mist') return;
  mistHolding = true;
  mistHoldStart = performance.now();
  stageBtn.dataset.mistHolding = 'true';
  tickMistHold();
}

async function releaseMistHold(): Promise<void> {
  if (!mistHolding) return;
  const elapsed = mistHoldStart ? performance.now() - mistHoldStart : 0;
  const ready = isMistReady(elapsed);
  stopMistHold(!ready);
  if (!ready || isTransitioning) {
    if (isTransitioning) setMistProgress(0);
    return;
  }
  setMistProgress(1);
  await advanceStage();
  if (activeMode() === 'mist') {
    setMistProgress(0);
  } else {
    refreshStageButtonAccessibility();
  }
}

async function advanceStage(): Promise<void> {
  if (isTransitioning) return;
  if (currentIdx < SIP_COUNT) await gotoStage(currentIdx + 1);
  else await enterEpilogue();
}

// ---------- 启动 ----------
function init() {
  buildNoise();
  buildProgress();

  // 先应用语言:填充所有 data-i18n 文案 + 语言按钮 active 态(默认英文)
  applyLang(getLang());
  const onboarding = initOnboarding();
  onboardingController = onboarding;

  applyTheme(detectTheme());
  initAmbient();
  // cursor-glow 的 mousemove 已绑定 → 此时隐藏系统光标才安全。
  // 若本模块加载/执行失败,html 上无 js-ready,系统光标仍可见(见 style.css 兜底)。
  document.documentElement.classList.add('js-ready');
  musicController = initMusic();
  initMemoryStars();

  // 已封缄记忆面板:展开 / 收起
  const mpToggle = document.getElementById('memory-panel-toggle');
  mpToggle?.addEventListener('click', () => {
    const panel = document.getElementById('memory-panel');
    const collapsed = panel?.classList.toggle('collapsed');
    mpToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  });

  // 氛围主题(星河 / 雾海 / 极光):默认星河,localStorage 记忆
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle?.addEventListener('click', cycleTheme);

  // 语言切换:切换后若正处于某阶段,按新字体度量重排当前层
  const langToggle = document.getElementById('lang-toggle');
  if (langToggle) {
    langToggle.addEventListener('click', () => {
      toggleLang();
      onboarding.refreshLanguage();
      refreshStageButtonAccessibility();
      if (currentIdx >= 1 && currentIdx <= SIP_COUNT && !isTransitioning) {
        applyStage(currentIdx);
      }
    });
  }

  // 字体就绪后才显示正文,避免 FOUT 破坏氛围
  let hasRevealed = false;
  const reveal = () => {
    if (hasRevealed) return;
    hasRevealed = true;
    document.body.classList.add('revealed'); // 触发开场帷幕揭开 + 中心光点 + 内容错峰升入
    app.classList.remove('is-hidden');
    window.dispatchEvent(new Event('fe:revealed'));
  };
  if (document.fonts && document.fonts.ready) {
    // 显式触发关键字体加载,确保 canvas 测量准确
    const loadEn = document.fonts.load?.('400 23px "Cormorant Garamond"');
    const loadZh = document.fonts.load?.('400 20px "LXGW WenKai"');
    Promise.all([loadEn, loadZh])
      .catch(() => {})
      .finally(() => document.fonts.ready.then(reveal));
  }
  // 兜底:最多等 3s
  setTimeout(reveal, 3000);

  // 音乐自动播放:浏览器策略禁止无手势自动放音,只能在首次用户交互时静默触发一次。
  // 只触发一次就移除监听;跳过音乐播放器控件自身的交互,避免和用户主动点播放/暂停打架。
  const tryAutoStartMusic = (e: Event) => {
    document.removeEventListener('pointerdown', tryAutoStartMusic, true);
    document.removeEventListener('keydown', tryAutoStartMusic, true);
    if (!musicController || musicController.getState().playing) return;
    if ((e.target as HTMLElement | null)?.closest('#music-player, #music-toggle')) return;
    void musicController.toggle();
  };
  document.addEventListener('pointerdown', tryAutoStartMusic, true);
  document.addEventListener('keydown', tryAutoStartMusic, true);

  enterIdle();
}

init();
