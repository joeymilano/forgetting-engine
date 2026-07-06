/* =====================================================================
   weathering.ts — 文字风化粒子系统(说明书 §5,整个项目视觉命脉)
   原理:文字 → 离屏 canvas 像素 → 采样成粒子 → 主 canvas 全屏接管渲染
   时间轴(每次阶段切换,总时长 2.8s):
     t=0–0.4s  松动:原位布朗抖动,alpha 1→0.85
     t=0.4–2.0s 飘散:行尾→行首 依次剥落(delay 与 x 相关),向上向右 + 风场 sin 扰动
     t=1.6–2.8s 浮现:下一层粒子从目标位下方 30px 聚合,easeOutCubic
   STAGE_4 后偶发灰烬(每 4–7s 释放 2–4 个粒子缓慢飘走)。
   空闲时 rAF 必须停止(呼吸效果交给 CSS)。
   ===================================================================== */

/** 一层的几何与排版描述(由 main.ts 计算后传入,weathering 不读 DOM 实时状态) */
export interface LayerSpec {
  text: string; // 已分行的文本(含 \n)
  fontSize: number; // px
  lineHeight: number; // px
  letterSpacing: number; // px
  wordSpacing: number; // px
  fontFamily: string;
  fontWeight: string;
  width: number; // 文字区域宽
  left: number; // 区域在视口的 left
  top: number; // 区域在视口的 top
}

interface Particle {
  x: number;
  y: number;
  ox: number; // 原位/目标位
  oy: number;
  sx: number; // assemble 起始位
  sy: number;
  size: number;
  bsize: number;
  alpha: number;
  vx: number;
  vy: number;
  delay: number; // 启动延迟(s)
  dur: number; // 单粒子动画时长(s)
  phase: number; // 风场 sin 相位
  mode: 0 | 1; // 0=disperse 1=assemble
}

interface Ash {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number; // 0..1, 衰减
  alpha: number;
}

const MAX_PARTICLES = 9000;
const MAX_PARTICLES_MOBILE = 4000;
const TOTAL_DUR = 2.8; // 秒
const DISP_DUR = 1.0; // 单粒子飘散时长
const ASM_DUR = 0.6; // 单粒子聚合时长
const ASM_START = 1.6; // 聚合开始(与飘散尾部重叠 0.4s)

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export class Weathering {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private gap: number;
  private maxP: number;
  private isMobile: boolean;

  private tParticles: Particle[] = [];
  private ashParticles: Ash[] = [];
  private pool: Particle[] = [];

  private rafId = 0;
  private running = false;
  private startT = 0;
  private onDone?: () => void;

  private ashTimer: ReturnType<typeof setTimeout> | null = null;
  private ashGetEl: (() => HTMLElement | null) | null = null;

  private sprite: HTMLCanvasElement;
  private measureCanvas: HTMLCanvasElement;
  private measureCtx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.isMobile = window.innerWidth < 768;
    this.gap = this.isMobile ? 5 : 4;
    this.maxP = this.isMobile ? MAX_PARTICLES_MOBILE : MAX_PARTICLES;

    this.sprite = this.makeSprite();
    this.measureCanvas = document.createElement('canvas');
    this.measureCtx = this.measureCanvas.getContext('2d', {
      willReadFrequently: true,
    })!;

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private makeSprite(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 8;
    const cx = c.getContext('2d')!;
    const g = cx.createRadialGradient(4, 4, 0, 4, 4, 4);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.65)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, 8, 8);
    return c;
  }

  private resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  /** 采样一层文字 → 粒子(粒子 origin 在视口坐标系) */
  private sample(spec: LayerSpec): Particle[] {
    const lines = spec.text.split('\n');
    const width = Math.max(1, Math.ceil(spec.width));
    const height = Math.max(1, Math.ceil(lines.length * spec.lineHeight));

    const off = this.measureCanvas;
    if (off.width !== width || off.height !== height) {
      off.width = width;
      off.height = height;
    }
    const octx = this.measureCtx;
    octx.clearRect(0, 0, width, height);
    octx.fillStyle = '#ffffff';
    octx.textBaseline = 'top';
    octx.font = `${spec.fontWeight} ${spec.fontSize}px ${spec.fontFamily}`;

    const adv = (ch: string) => {
      if (ch === ' ') {
        return octx.measureText(ch).width + (spec.wordSpacing || 0);
      }
      return octx.measureText(ch).width + spec.letterSpacing;
    };
    const lineW = (line: string) => {
      let x = 0;
      for (const ch of line) x += adv(ch);
      return x - spec.letterSpacing; // 末尾不补间距,与 DOM 对齐
    };

    const leading = Math.max(0, (spec.lineHeight - spec.fontSize) / 2);
    lines.forEach((line, li) => {
      const lw = lineW(line);
      let x = (width - lw) / 2;
      const y = li * spec.lineHeight + leading;
      for (const ch of Array.from(line)) {
        octx.fillText(ch, x, y);
        x += adv(ch);
      }
    });

    return this.readPixels(octx, width, height, spec.left, spec.top);
  }

  private readPixels(
    octx: CanvasRenderingContext2D,
    w: number,
    h: number,
    offX: number,
    offY: number,
  ): Particle[] {
    const img = octx.getImageData(0, 0, w, h).data;
    let gap = this.gap;
    let particles = this.extract(img, w, h, gap, offX, offY);
    while (particles.length > this.maxP && gap < 14) {
      gap += 1;
      particles = this.extract(img, w, h, gap, offX, offY);
    }
    return particles;
  }

  private extract(
    img: Uint8ClampedArray,
    w: number,
    h: number,
    gap: number,
    offX: number,
    offY: number,
  ): Particle[] {
    const out: Particle[] = [];
    for (let y = 0; y < h; y += gap) {
      for (let x = 0; x < w; x += gap) {
        const a = img[(y * w + x) * 4 + 3];
        if (a > 128) {
          out.push(this.obtain(offX + x, offY + y));
        }
      }
    }
    return out;
  }

  private obtain(ox: number, oy: number): Particle {
    const p = this.pool.pop();
    const bsize = 1 + ((Math.abs(Math.sin(ox * 12.9898 + oy * 78.233)) * 1.2) % 1.2);
    if (p) {
      p.x = ox;
      p.y = oy;
      p.ox = ox;
      p.oy = oy;
      p.bsize = bsize;
      p.size = bsize;
      p.alpha = 1;
      p.delay = 0;
      p.dur = DISP_DUR;
      p.phase = (ox + oy) * 0.01;
      p.mode = 0;
      return p;
    }
    return {
      x: ox,
      y: oy,
      ox,
      oy,
      sx: ox,
      sy: oy,
      size: bsize,
      bsize,
      alpha: 1,
      vx: 0,
      vy: 0,
      delay: 0,
      dur: DISP_DUR,
      phase: (ox + oy) * 0.01,
      mode: 0,
    };
  }

  /** 主转场:fromSpec 飘散 → toSpec 聚合 */
  transition(fromSpec: LayerSpec, toSpec: LayerSpec): Promise<void> {
    this.stopLoop();
    this.recycleAll();

    const fromP = this.sample(fromSpec);
    const toP = this.sample(toSpec);

    // 飘散粒子:delay 与 x 相关,行尾(x 大)delay 小,先飘
    let xMin = Infinity;
    let xMax = -Infinity;
    for (const p of fromP) {
      if (p.ox < xMin) xMin = p.ox;
      if (p.ox > xMax) xMax = p.ox;
    }
    const xRange = Math.max(1, xMax - xMin);
    for (const p of fromP) {
      const nx = (p.ox - xMin) / xRange; // 0=行首 1=行尾
      p.delay = (1 - nx) * 1.0; // 行尾 delay≈0, 行首 delay≈1.0
      p.dur = DISP_DUR;
      p.mode = 0;
      p.alpha = 1;
      p.size = p.bsize;
      p.x = p.ox;
      p.y = p.oy;
      p.vx = 0.3 + Math.abs(Math.sin(p.phase * 7.1)) * 1.1; // 0.3~1.4 向右
      p.vy = -0.2 - Math.abs(Math.cos(p.phase * 5.3)) * 0.7; // -0.2~-0.9 向上
    }

    // 聚合粒子:从目标位正下方 30px 出发
    let axMin = Infinity;
    let axMax = -Infinity;
    for (const p of toP) {
      if (p.ox < axMin) axMin = p.ox;
      if (p.ox > axMax) axMax = p.ox;
    }
    const axRange = Math.max(1, axMax - axMin);
    for (const p of toP) {
      const nx = (p.ox - axMin) / axRange;
      p.delay = nx * 0.6; // 行首先聚合
      p.dur = ASM_DUR;
      p.mode = 1;
      p.alpha = 0;
      p.size = p.bsize * 0.7;
      p.sx = p.ox;
      p.sy = p.oy + 30; // 下方 30px
      p.x = p.sx;
      p.y = p.sy;
    }

    this.tParticles = fromP.concat(toP);
    this.startT = performance.now();
    this.onDone = undefined;

    return new Promise((resolve) => {
      this.onDone = resolve;
      this.startLoop();
    });
  }

  /** 单纯飘散(第 7 层 → EPILOGUE,无聚合) */
  disperseOnly(fromSpec: LayerSpec): Promise<void> {
    this.stopLoop();
    this.recycleAll();
    const fromP = this.sample(fromSpec);
    let xMin = Infinity;
    let xMax = -Infinity;
    for (const p of fromP) {
      if (p.ox < xMin) xMin = p.ox;
      if (p.ox > xMax) xMax = p.ox;
    }
    const xRange = Math.max(1, xMax - xMin);
    for (const p of fromP) {
      const nx = (p.ox - xMin) / xRange;
      p.delay = (1 - nx) * 1.0;
      p.dur = DISP_DUR * 1.4; // 末次飘散更慢、更抒情
      p.mode = 0;
      p.alpha = 1;
      p.size = p.bsize;
      p.x = p.ox;
      p.y = p.oy;
      p.vx = 0.3 + Math.abs(Math.sin(p.phase * 7.1)) * 1.3;
      p.vy = -0.3 - Math.abs(Math.cos(p.phase * 5.3)) * 0.8;
    }
    this.tParticles = fromP;
    this.startT = performance.now();
    this.onDone = undefined;
    return new Promise((resolve) => {
      this.onDone = resolve;
      this.startLoop();
    });
  }

  // ---------- 主循环 ----------
  private startLoop() {
    if (this.running) return;
    this.running = true;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private stopLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.running = false;
  }

  private tick = () => {
    if (!this.running) return;
    const now = performance.now();
    const elapsed = (now - this.startT) / 1000;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // —— 过渡粒子 ——
    if (this.tParticles.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.tParticles) {
        if (p.mode === 0) {
          this.updateDisperse(p, elapsed);
        } else {
          this.updateAssemble(p, elapsed);
        }
        if (p.alpha > 0.01) {
          ctx.globalAlpha = p.alpha;
          const s = p.size * 2.2;
          ctx.drawImage(this.sprite, p.x - s / 2, p.y - s / 2, s, s);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // —— 灰烬 ——
    if (this.ashParticles.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = this.ashParticles.length - 1; i >= 0; i--) {
        const a = this.ashParticles[i];
        a.life -= 0.0035;
        if (a.life <= 0) {
          this.ashParticles.splice(i, 1);
          continue;
        }
        a.x += a.vx + Math.sin(now * 0.002 + a.y * 0.01) * 0.25;
        a.y += a.vy;
        a.vy += -0.0015; // 缓慢上飘
        a.alpha = a.life * 0.7;
        ctx.globalAlpha = a.alpha;
        const s = a.size * 2.4;
        ctx.drawImage(this.sprite, a.x - s / 2, a.y - s / 2, s, s);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // 过渡粒子是否仍在进行(灰烬是 stage4+ 常驻的独立装饰,不计入转场时长)
    const transitionActive =
      this.tParticles.length > 0 && elapsed < TOTAL_DUR + 0.3;

    // 过渡结束 → 回收过渡粒子,并立即兑现转场 Promise。
    // 关键:onDone 绝不能被灰烬阻塞 —— 否则 stage4+(灰烬常驻)时
    // await weathering.transition() 永不返回,isTransitioning 卡死,
    // 正文永久隐藏、按钮点不动、循环空转导致背景层灰块闪烁。
    if (!transitionActive && this.tParticles.length) {
      this.recycleTransition();
    }
    if (!transitionActive && this.onDone) {
      const cb = this.onDone;
      this.onDone = undefined;
      cb();
    }

    // 转场与灰烬都无事可做时才真正停机并清空画布
    if (!transitionActive && this.ashParticles.length === 0) {
      this.running = false;
      this.rafId = 0;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      return;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  private updateDisperse(p: Particle, elapsed: number) {
    if (elapsed < 0.4) {
      // 松动期:布朗抖动,alpha 1→0.85
      const jitter = (Math.sin(elapsed * 30 + p.phase * 50) * 0.3);
      p.x = p.ox + jitter;
      p.y = p.oy + Math.cos(elapsed * 27 + p.phase * 40) * 0.3;
      p.alpha = 1 - 0.15 * (elapsed / 0.4);
      p.size = p.bsize;
      return;
    }
    const localT = elapsed - 0.4 - p.delay;
    if (localT < 0) {
      // 仍在等待启动:继续轻微抖动
      const jitter = Math.sin(elapsed * 30 + p.phase * 50) * 0.3;
      p.x = p.ox + jitter;
      p.y = p.oy + Math.cos(elapsed * 27 + p.phase * 40) * 0.3;
      p.alpha = 0.85;
      return;
    }
    // 飘散:life 线性衰减
    const life = Math.max(0, 1 - localT / p.dur);
    if (life <= 0) {
      p.alpha = 0;
      return;
    }
    const wind = Math.sin(elapsed * 2.0 + p.y * 0.01) * 0.35; // 风场扰动(关键细节)
    p.x += p.vx * 0.4 + wind * 0.3;
    p.y += p.vy * 0.4;
    p.vx *= 0.992;
    p.alpha = 0.85 * life;
    p.size = p.bsize * (0.3 + 0.7 * life);
  }

  private updateAssemble(p: Particle, elapsed: number) {
    const localT = elapsed - ASM_START - p.delay;
    if (localT < 0) {
      p.alpha = 0;
      p.x = p.sx;
      p.y = p.sy;
      return;
    }
    const t = Math.min(1, localT / p.dur);
    const e = easeOutCubic(t);
    p.x = p.sx + (p.ox - p.sx) * e;
    p.y = p.sy + (p.oy - p.sy) * e;
    p.alpha = t;
    p.size = p.bsize * (0.7 + 0.3 * t);
  }

  // ---------- 灰烬(STAGE_4 后) ----------
  startAsh(getEl: () => HTMLElement | null) {
    // 先清除已有的定时链,避免 stage4→5→6 反复调用导致灰烬定时器叠加、
    // 生成速率成倍累积(越往后灰块越密、越易闪烁)。
    if (this.ashTimer) {
      clearTimeout(this.ashTimer);
      this.ashTimer = null;
    }
    this.ashGetEl = getEl;
    this.scheduleAsh();
  }

  private scheduleAsh() {
    if (!this.ashGetEl) return;
    const delay = 4000 + Math.floor(Math.random() * 3000); // 4–7s
    this.ashTimer = setTimeout(() => {
      this.spawnAsh();
      this.scheduleAsh();
    }, delay);
  }

  private spawnAsh() {
    const el = this.ashGetEl?.();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const count = 2 + Math.floor(Math.random() * 3); // 2–4
    for (let i = 0; i < count; i++) {
      this.ashParticles.push({
        x: rect.left + Math.random() * rect.width,
        y: rect.top + Math.random() * rect.height,
        vx: 0.15 + Math.random() * 0.4,
        vy: -0.15 - Math.random() * 0.35,
        size: 0.8 + Math.random() * 1.0,
        life: 1,
        alpha: 0.7,
      });
    }
    if (!this.running) {
      this.startT = performance.now();
      this.startLoop();
    }
  }

  stopAsh() {
    if (this.ashTimer) {
      clearTimeout(this.ashTimer);
      this.ashTimer = null;
    }
    this.ashGetEl = null;
    this.ashParticles.length = 0;
  }

  // ---------- 回收 / 清理 ----------
  private recycleTransition() {
    for (const p of this.tParticles) this.pool.push(p);
    this.tParticles.length = 0;
  }

  private recycleAll() {
    for (const p of this.tParticles) this.pool.push(p);
    this.tParticles.length = 0;
  }

  clear() {
    this.stopLoop();
    this.stopAsh();
    this.recycleAll();
    this.ashParticles.length = 0;
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}
