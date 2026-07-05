/* =====================================================================
   ambient.ts — 沉浸式背景氛围
   - 粒子尘埃场:常驻飘浮的暖白微光(像被风吹散的灰烬/记忆碎屑)
   - 鼠标视差:近粒子大幅跟随,远粒子小幅,营造深度
   - 鼠标引力:靠近时粒子被轻微吸引
   - 标签页隐藏时停 rAF,可见时恢复
   ===================================================================== */

const canvas = document.getElementById('ambient-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// 自定义光标光晕(触屏设备由 CSS 隐藏)
const cursorGlow = document.getElementById('cursor-glow');

let dpr = Math.min(2, window.devicePixelRatio || 1);
let W = 0;
let H = 0;
let particles: Particle[] = [];
let mx = 0;
let my = 0;
let tmx = 0;
let tmy = 0;
let running = false;
let lastT = 0;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  alpha: number;
  depth: number; // 0 近 ~ 1 远
}

// 软圆点精灵(预生成径向渐变,暖白)
let sprite: HTMLCanvasElement;
function makeSprite(): HTMLCanvasElement {
  const s = document.createElement('canvas');
  s.width = s.height = 32;
  const c = s.getContext('2d')!;
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,242,222,1)');
  g.addColorStop(0.35, 'rgba(255,236,205,0.45)');
  g.addColorStop(1, 'rgba(255,232,200,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 32, 32);
  return s;
}

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function seed() {
  const count = W < 768 ? 55 : 130;
  particles = [];
  for (let i = 0; i < count; i++) {
    const depth = Math.random();
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.1 * (0.5 + depth),
      vy: -0.03 - Math.random() * 0.16 * (0.6 + depth), // 缓慢上升,像灰烬
      size: 0.5 + depth * 2.6,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.06 + depth * 0.4,
      depth,
    });
  }
}

function tick(t: number) {
  if (!running) return;
  const dt = Math.min(32, t - lastT) / 16.67;
  lastT = t;

  // 鼠标平滑跟随
  mx += (tmx - mx) * 0.06;
  my += (tmy - my) * 0.06;
  const px = (mx / W - 0.5) * 2; // -1..1
  const py = (my / H - 0.5) * 2;
  // 视差量写入 CSS 变量,供背景图层位移使用
  document.documentElement.style.setProperty('--px', px.toFixed(3));
  document.documentElement.style.setProperty('--py', py.toFixed(3));

  // 光标光晕跟随已移到 mousemove 内,使用实时 tmx/tmy(零延迟)
  // 此处 mx/my 是 lerp 缓动值,仅用于粒子视差的柔和感,不适合光标(会显得拖滞)

  ctx.clearRect(0, 0, W, H);
  const time = t * 0.0005;
  for (const p of particles) {
    // 风(sin 扰动)+ 上升
    p.x += (p.vx + Math.sin(time + p.phase) * 0.14) * dt;
    p.y += p.vy * dt;

    // 鼠标引力(轻微吸引)
    const dx = mx - p.x;
    const dy = my - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 60000 && d2 > 4) {
      const f = 50 / d2;
      p.x += dx * f;
      p.y += dy * f;
    }

    // 回收(从顶部出去→底部重生)
    if (p.y < -14) {
      p.y = H + 14;
      p.x = Math.random() * W;
    }
    if (p.x < -14) p.x = W + 14;
    else if (p.x > W + 14) p.x = -14;

    // 视差位移:近粒子(depth 小)幅度大
    const par = (1 - p.depth) * 22;
    const ox = -px * par;
    const oy = -py * par;

    ctx.globalAlpha = p.alpha;
    const s = p.size * 2;
    ctx.drawImage(sprite, p.x + ox - p.size, p.y + oy - p.size, s, s);
  }
  ctx.globalAlpha = 1;

  requestAnimationFrame(tick);
}

function onResize() {
  resize();
  seed();
}

export function initAmbient() {
  sprite = makeSprite();
  resize();
  seed();
  tmx = mx = W / 2;
  tmy = my = H / 2;

  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', (e) => {
    tmx = e.clientX;
    tmy = e.clientY;
    if (cursorGlow) {
      // 用实时坐标,不经 lerp —— 光标必须零延迟贴住指针
      cursorGlow.style.transform = `translate3d(${tmx}px, ${tmy}px, 0)`;
      const el = e.target as Element | null;
      const onTarget = !!(el && el.closest('button, a, textarea'));
      cursorGlow.classList.toggle('on-target', onTarget);
    }
  });
  window.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches[0]) {
        tmx = e.touches[0].clientX;
        tmy = e.touches[0].clientY;
      }
    },
    { passive: true },
  );

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
