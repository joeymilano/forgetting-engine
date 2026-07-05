/* =====================================================================
   main.ts — 入口:状态机 + 流程编排
   状态:IDLE → WRITING → SEALING → STAGE_1..7 → EPILOGUE
   全程无导航、无 logo、无 spinner。任何时刻可点元素 ≤ 1。
   ===================================================================== */

import {
  STAGES,
  SEALING_LINES,
  EPILOGUE_PRIMARY,
  EPILOGUE_SECONDARY,
  type StageVisual,
} from './stages';
import { typewriter } from './typewriter';
import { generateStages } from './llm';
import { Weathering, type LayerSpec } from './weathering';

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
  | 'STAGE_7'
  | 'EPILOGUE';

let state: State = 'IDLE';
let stages: string[] = [];
let currentIdx = 0; // 1..7
let isTransitioning = false;
let sealingTimers: ReturnType<typeof setTimeout>[] = [];
let epilogueTimers: ReturnType<typeof setTimeout>[] = [];

const weathering = new Weathering(particleCanvas);

// 测量用 canvas(文字换行计算,与 weathering 内部一致)
const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d')!;
const FONT_FAMILY = `'LXGW WenKai','Songti SC','Noto Serif SC','Source Han Serif SC','PingFang SC',serif`;
const FONT_WEIGHT = '400';

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
  measureCtx.font = `${FONT_WEIGHT} ${fontSize}px ${FONT_FAMILY}`;
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
  const base = window.innerWidth < 768 ? 17 : 20;
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
  const base = window.innerWidth < 768 ? 17 : 20;
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
    fontFamily: cs.fontFamily || FONT_FAMILY,
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
  for (let i = 0; i < 7; i++) {
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

// ---------- SEALING ----------
async function enterSealing() {
  setState('SEALING');
  const memory = memoryInput.value.trim();
  submitBtn.disabled = true;

  // writing 淡出
  writingView.classList.add('fading-out');
  await wait(600);
  showOnly('stage');
  writingView.classList.remove('fading-out');

  // 原文以 base 样式准备好(先 invisible,等打字机)
  applyRawText(memory);
  const fullText = stageText.textContent || '';
  stageText.textContent = '';
  stageText.style.visibility = 'visible';

  // 加载文案轮播(底部小字,每 2.5s)
  loadingLine.hidden = false;
  let li = 0;
  loadingLine.textContent = SEALING_LINES[0];
  const rotateLoading = () => {
    sealingTimers.push(
      setTimeout(() => {
        li = (li + 1) % SEALING_LINES.length;
        loadingLine.textContent = SEALING_LINES[li];
        rotateLoading();
      }, 2500),
    );
  };
  rotateLoading();

  // 并行:打字机重现原文 + 一次性请求 7 层
  const [, generated] = await Promise.all([
    typewriter(stageText, fullText, 50),
    generateStages(memory),
  ]);

  stages = generated;
  sealingTimers.forEach((t) => clearTimeout(t));
  sealingTimers = [];
  loadingLine.hidden = true;

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
  stageText.style.visibility = 'hidden';

  // 新内容(禁 transition,读准确 rect)
  stageText.style.transition = 'none';
  applyStage(nextIdx);
  void stageText.offsetWidth; // 强制 reflow
  const toSpec = specFromEl();

  // 粒子转场
  await weathering.transition(fromSpec, toSpec);

  // 恢复显示
  stageText.style.transition = '';
  stageText.style.visibility = 'visible';
  currentIdx = nextIdx;
  updateStageChrome(nextIdx);
  isTransitioning = false;
}

function updateStageChrome(idx: number) {
  stageBtn.textContent = STAGES[idx - 1].button;
  stageBtn.disabled = false;
  updateProgress(idx);
  if (idx >= 4) weathering.startAsh(() => stageText);
  else weathering.stopAsh();
}

// ---------- EPILOGUE ----------
async function enterEpilogue() {
  setState('EPILOGUE');
  isTransitioning = true;
  stageBtn.disabled = true;
  weathering.stopAsh();

  const fromSpec = specFromEl();
  stageText.style.visibility = 'hidden';
  stageBtn.hidden = true;

  // 第 7 层文字完全粒子化飘散,不再浮现新文字
  await weathering.disperseOnly(fromSpec);

  // 3 秒静默后浮现系统低语
  epilogueTimers.push(
    setTimeout(() => {
      epilogueView.hidden = false;
      epiloguePrimary.textContent = EPILOGUE_PRIMARY;
      epiloguePrimary.classList.add('shown');
    }, 3000),
  );
  // 再 4 秒后次级文字 + 重置入口
  epilogueTimers.push(
    setTimeout(() => {
      epilogueSecondary.textContent = EPILOGUE_SECONDARY;
      epilogueSecondary.classList.add('shown');
      resetLink.hidden = false;
    }, 7000),
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
  epiloguePrimary.classList.remove('shown');
  epilogueSecondary.classList.remove('shown');
  resetLink.hidden = true;
  epilogueView.hidden = true;
  stageText.textContent = '';
  stageText.style.visibility = 'visible';
  stageText.style.transition = '';
  stageBtn.hidden = true;
  loadingLine.hidden = true;

  enterIdle();
  app.classList.remove('is-hidden');
}

// ---------- resize:重新换行当前层 ----------
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (currentIdx >= 1 && currentIdx <= 7 && !isTransitioning) {
      applyStage(currentIdx);
    }
  }, 200);
});

// ---------- 事件绑定 ----------
memoryInput.addEventListener('input', updateCharCount);
submitBtn.addEventListener('click', () => {
  if (!submitBtn.disabled && !isTransitioning) enterSealing();
});
stageBtn.addEventListener('click', async () => {
  if (isTransitioning) return;
  if (currentIdx < 7) await gotoStage(currentIdx + 1);
  else await enterEpilogue();
});
resetLink.addEventListener('click', (e) => {
  e.preventDefault();
  reset();
});

// ---------- 启动 ----------
function init() {
  buildNoise();
  buildProgress();

  // 字体就绪后才显示正文,避免 FOUT 破坏氛围
  const reveal = () => app.classList.remove('is-hidden');
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(reveal);
  }
  // 兜底:最多等 3s
  setTimeout(reveal, 3000);

  enterIdle();
}

init();
