/* =====================================================================
   main.ts — 入口:状态机 + 流程编排
   状态:IDLE → WRITING → SEALING → STAGE_1..7 → EPILOGUE
   全程无导航、无 logo、无 spinner。任何时刻可点元素 ≤ 1。
   ===================================================================== */

import { STAGES, type StageVisual } from './stages';
import { typewriter } from './typewriter';
import { generateStages } from './llm';
import { Weathering, type LayerSpec } from './weathering';
import { initAmbient, setAmbientTheme, type AmbientTheme } from './ambient';
import { applyLang, getLang, t, toggleLang, type Lang } from './i18n';
import { initMusic } from './music';
import { initMemoryStars, addMemoryStar } from './memory-stars';

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

// ---------- SEALING ----------
async function enterSealing() {
  setState('SEALING');
  const memory = memoryInput.value.trim();
  lastMemory = memory;
  lastMemoryLang = getLang();
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

  // 并行:打字机重现原文 + 一次性请求 7 层(带语言)
  const [, generated] = await Promise.all([
    typewriter(stageText, fullText, 50),
    generateStages(memory, getLang()),
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
  const label = stageBtn.querySelector<HTMLElement>('.btn-label');
  if (label) label.textContent = t().stageButtons[idx - 1];
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

  // 这段记忆已彻底放下 → 化作一颗星,留存于面板(累积,reset 不清除)
  sealedMemories.push({
    preview: memoryPreview(lastMemory),
    full: lastMemory,
    lang: lastMemoryLang,
  });
  addMemoryStar();
  renderMemoryList();

  // 3 秒静默后浮现系统低语
  epilogueTimers.push(
    setTimeout(() => {
      epilogueView.hidden = false;
      epiloguePrimary.textContent = t().epiloguePrimary;
      epiloguePrimary.classList.add('shown');
    }, 3000),
  );
  // 再 4 秒后次级文字 + 重置入口
  epilogueTimers.push(
    setTimeout(() => {
      epilogueSecondary.textContent = t().epilogueSecondary;
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

// ---------- 氛围主题(星河 / 雾海 / 极光)----------
const THEMES: AmbientTheme[] = ['stardust', 'mist', 'aurora'];
const THEME_KEY = 'fe-theme';

function detectTheme(): AmbientTheme {
  try {
    const s = localStorage.getItem(THEME_KEY);
    if (s === 'stardust' || s === 'mist' || s === 'aurora') return s;
  } catch {
    /* 无 localStorage 权限 → 默认星河 */
  }
  return 'stardust';
}

function applyTheme(theme: AmbientTheme): void {
  document.body.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* 静默 */
  }
  setAmbientTheme(theme); // 粒子色调联动
  document.querySelectorAll<HTMLElement>('.theme-dots i').forEach((el) => {
    el.classList.toggle('active', el.dataset.theme === theme);
  });
}

function cycleTheme(): void {
  const cur = (document.body.dataset.theme as AmbientTheme) || 'stardust';
  const idx = THEMES.indexOf(cur);
  applyTheme(THEMES[(idx + 1) % THEMES.length]);
}

// ---------- 启动 ----------
function init() {
  buildNoise();
  buildProgress();

  // 先应用语言:填充所有 data-i18n 文案 + 语言按钮 active 态(默认英文)
  applyLang(getLang());

  initAmbient();
  // cursor-glow 的 mousemove 已绑定 → 此时隐藏系统光标才安全。
  // 若本模块加载/执行失败,html 上无 js-ready,系统光标仍可见(见 style.css 兜底)。
  document.documentElement.classList.add('js-ready');
  initMusic();
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
  applyTheme(detectTheme());

  // 语言切换:切换后若正处于某阶段,按新字体度量重排当前层
  const langToggle = document.getElementById('lang-toggle');
  if (langToggle) {
    langToggle.addEventListener('click', () => {
      toggleLang();
      if (currentIdx >= 1 && currentIdx <= 7 && !isTransitioning) {
        applyStage(currentIdx);
      }
    });
  }

  // 字体就绪后才显示正文,避免 FOUT 破坏氛围
  const reveal = () => {
    document.body.classList.add('revealed'); // 触发开场帷幕揭开 + 中心光点 + 内容错峰升入
    app.classList.remove('is-hidden');
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

  enterIdle();
}

init();
