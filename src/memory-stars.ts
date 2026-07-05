/* =====================================================================
   memory-stars.ts — 封缄记忆的星
   每段被彻底放下的记忆,在背景化作一颗暖金色的星:
   缓慢淡入(3s)→ 持续呼吸闪烁 → 永久驻留(session 内累积,reset 不清除)。
   星星散布在屏幕四周边缘,不遮挡中央文字舞台。
   「被遗忘的,并未消失,只是成了天上的一颗星。」
   ===================================================================== */

interface MemStar {
  x: number;
  y: number;
  size: number;
  phase: number;
  born: number;
}

const canvas = document.getElementById('memory-stars-canvas') as HTMLCanvasElement | null;
const ctx = canvas?.getContext('2d') ?? null;

let dpr = Math.min(2, window.devicePixelRatio || 1);
let W = 0;
let H = 0;
const stars: MemStar[] = [];
let sprite: HTMLCanvasElement;
let running = false;
let lastT = 0;

function makeSprite(): HTMLCanvasElement {
  const s = document.createElement('canvas');
  s.width = s.height = 64;
  const c = s.getContext('2d')!;
  // 暖金核心
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,244,214,1)');
  g.addColorStop(0.12, 'rgba(255,232,180,0.85)');
  g.addColorStop(0.4, 'rgba(255,210,140,0.22)');
  g.addColorStop(1, 'rgba(255,200,130,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  // 细十字星芒(横 + 纵柔光)
  const lh = c.createLinearGradient(0, 32, 64, 32);
  lh.addColorStop(0, 'rgba(255,240,200,0)');
  lh.addColorStop(0.5, 'rgba(255,240,200,0.5)');
  lh.addColorStop(1, 'rgba(255,240,200,0)');
  c.fillStyle = lh;
  c.fillRect(0, 31, 64, 2);
  const lv = c.createLinearGradient(32, 0, 32, 64);
  lv.addColorStop(0, 'rgba(255,240,200,0)');
  lv.addColorStop(0.5, 'rgba(255,240,200,0.5)');
  lv.addColorStop(1, 'rgba(255,240,200,0)');
  c.fillStyle = lv;
  c.fillRect(31, 0, 2, 64);
  return s;
}

function resize() {
  if (!canvas || !ctx) return;
  W = window.innerWidth;
  H = window.innerHeight;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** 在屏幕边缘区域随机一个位置(避开中央文字舞台) */
function edgePos(): { x: number; y: number } {
  const margin = 64;
  if (Math.random() < 0.55) {
    // 上 / 下带状
    const top = Math.random() < 0.5;
    return {
      x: margin + Math.random() * (W - margin * 2),
      y: top
        ? margin + Math.random() * H * 0.26
        : H * 0.74 + Math.random() * (H * 0.26 - margin),
    };
  }
  // 左 / 右带状
  const left = Math.random() < 0.5;
  return {
    x: left
      ? margin + Math.random() * W * 0.2
      : W * 0.8 + Math.random() * (W * 0.2 - margin),
    y: margin + Math.random() * (H - margin * 2),
  };
}

export function addMemoryStar(): void {
  if (!canvas) return;
  const p = edgePos();
  stars.push({
    x: p.x,
    y: p.y,
    size: 1.4 + Math.random() * 1.6,
    phase: Math.random() * Math.PI * 2,
    born: performance.now(),
  });
}

function tick(t: number) {
  if (!running || !ctx) return;
  lastT = t;
  ctx.clearRect(0, 0, W, H);
  for (const s of stars) {
    const age = (t - s.born) / 1000; // 秒
    const fadeIn = Math.min(1, age / 3); // 3s 缓慢淡入
    const twinkle = 0.5 + 0.5 * Math.sin(t * 0.0018 + s.phase); // 缓慢呼吸
    const alpha = fadeIn * (0.4 + 0.55 * twinkle);
    const sz = s.size * (8 + 4 * twinkle); // 星芒随呼吸微胀
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, s.x - sz / 2, s.y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(tick);
}

export function initMemoryStars(): void {
  if (!canvas || !ctx) return;
  sprite = makeSprite();
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      lastT = performance.now();
      requestAnimationFrame(tick);
    }
  });
  running = true;
  lastT = performance.now();
  requestAnimationFrame(tick);
}
