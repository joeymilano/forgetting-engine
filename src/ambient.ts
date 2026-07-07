/* =====================================================================
   ambient.ts — 沉浸式背景氛围
   - 粒子尘埃场:常驻飘浮微光(像被风吹散的灰烬/记忆碎屑)
   - 鼠标视差:近粒子大幅跟随,远粒子小幅,营造深度(柔和不抽搐)
   - 鼠标引力:靠近时粒子被轻微吸引(范围克制,避免突变)
   - 三主题色调:星河暖白 / 雾海冷青 / 极光青绿(setAmbientTheme 切换)
   - 标签页隐藏时停 rAF,可见时恢复
   ===================================================================== */

import type { ParticleField } from './modes';

export type AmbientTheme = 'stardust' | 'mist' | 'aurora';

/** 三主题粒子色调(径向渐变三段) */
const THEME_TINTS: Record<AmbientTheme, [string, string, string]> = {
  // 星河:暖白琥珀(烛火 / 暮色灰烬)
  stardust: ['rgba(255,242,222,1)', 'rgba(255,236,205,0.45)', 'rgba(255,232,200,0)'],
  // 雾海:冷青白(晨雾 / 冰湖)
  mist: ['rgba(228,240,248,1)', 'rgba(198,224,238,0.45)', 'rgba(188,218,236,0)'],
  // 极光:青绿透粉(北光 / 流光)
  aurora: ['rgba(222,250,232,1)', 'rgba(158,240,202,0.5)', 'rgba(140,224,190,0)'],
};

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
let currentTheme: AmbientTheme = 'stardust';
let currentField: ParticleField = 'embers';
let lastPx = '';
let lastPy = '';

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

// 火花迸发:Stardust 每口的仪式反馈 —— 从点击点迸出、上升、渐隐的短命余烬
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number; // 1 → 0
}
let sparks: Spark[] = [];

/** 在 (x,y) 迸发一簇上升的余烬火花(Stardust 推进仪式) */
export function emitEmberBurst(x: number, y: number): void {
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
    const sp = 0.7 + Math.random() * 2.4;
    sparks.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 0.9, // 整体偏上升
      size: 1.1 + Math.random() * 2.4,
      life: 1,
    });
  }
}

function velocityForField(field: ParticleField, depth: number): Pick<Particle, 'vx' | 'vy'> {
  const vx =
    field === 'fog'
      ? (Math.random() - 0.5) * 0.18
      : field === 'streams'
        ? 0.16 + Math.random() * 0.2
        : (Math.random() - 0.5) * 0.1 * (0.5 + depth);
  const vy =
    field === 'fog'
      ? (Math.random() - 0.5) * 0.035
      : field === 'streams'
        ? -0.02 - Math.random() * 0.08
        : -0.03 - Math.random() * 0.16 * (0.6 + depth);
  return { vx, vy };
}

// 软圆点精灵(预生成径向渐变),按主题切换色调
let sprite: HTMLCanvasElement;
function makeSprite(tint: [string, string, string] = THEME_TINTS.stardust): HTMLCanvasElement {
  const s = document.createElement('canvas');
  s.width = s.height = 32;
  const c = s.getContext('2d')!;
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, tint[0]);
  g.addColorStop(0.35, tint[1]);
  g.addColorStop(1, tint[2]);
  c.fillStyle = g;
  c.fillRect(0, 0, 32, 32);
  return s;
}

/** 主题切换:重新生成对应色调的粒子精灵 */
export function setAmbientTheme(theme: AmbientTheme): void {
  currentTheme = theme;
  sprite = makeSprite(THEME_TINTS[theme]);
}

export function setAmbientField(field: ParticleField): void {
  if (currentField === field) return;
  currentField = field;
  for (const particle of particles) {
    const { vx, vy } = velocityForField(field, particle.depth);
    particle.vx = vx;
    particle.vy = vy;
  }
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
    const { vx, vy } = velocityForField(currentField, depth);
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx,
      vy,
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

  // 鼠标平滑跟随(更柔,避免背景跟随时抖动)
  mx += (tmx - mx) * 0.05;
  my += (tmy - my) * 0.05;
  const px = (mx / W - 0.5) * 2; // -1..1
  const py = (my / H - 0.5) * 2;
  // 视差量写入 CSS 变量,供背景图层位移使用。
  // 仅在值真正变化时写入::root 自定义属性每帧重写会让全文档样式
  // 失效重算,并每帧重启所有模糊背景层的 transform 过渡 —— 转场期间
  // 与粒子 canvas 叠加,是黑块闪烁的诱因之一。
  const pxs = px.toFixed(3);
  const pys = py.toFixed(3);
  if (pxs !== lastPx || pys !== lastPy) {
    document.documentElement.style.setProperty('--px', pxs);
    document.documentElement.style.setProperty('--py', pys);
    lastPx = pxs;
    lastPy = pys;
  }

  ctx.clearRect(0, 0, W, H);
  const time = t * 0.0005;
  for (const p of particles) {
    // 风(sin 扰动,幅度克制)+ 上升
    p.x += (p.vx + Math.sin(time + p.phase) * 0.08) * dt;
    p.y += p.vy * dt;

    // 鼠标引力(轻微吸引,范围小、力度柔,避免粒子被"吸过去"的突变)
    const dx = mx - p.x;
    const dy = my - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 16000 && d2 > 4) {
      const f = 16 / d2;
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
    const par = (1 - p.depth) * 16;
    const ox = -px * par;
    const oy = -py * par;

    ctx.globalAlpha = p.alpha;
    const s = p.size * 2;
    ctx.drawImage(sprite, p.x + ox - p.size, p.y + oy - p.size, s, s);
  }
  ctx.globalAlpha = 1;

  // 火花迸发(Stardust 仪式):上升 + 重力回落 + 渐隐
  if (sparks.length) {
    for (const sp of sparks) {
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vy += 0.05 * dt; // 轻微重力,先升后落
      sp.vx *= 0.97;
      sp.life -= 0.02 * dt;
      if (sp.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, sp.life) * 0.92;
      const ss = sp.size * 2 * (0.5 + sp.life * 0.7);
      ctx.drawImage(sprite, sp.x - ss / 2, sp.y - ss / 2, ss, ss);
    }
    sparks = sparks.filter((s) => s.life > 0);
    ctx.globalAlpha = 1;
  }

  requestAnimationFrame(tick);
}

function onResize() {
  resize();
  seed();
}

export function initAmbient() {
  sprite = makeSprite(THEME_TINTS[currentTheme]);
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
