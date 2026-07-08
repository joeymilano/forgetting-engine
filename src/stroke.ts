/* =====================================================================
   stroke.ts — 极光模式「拖拽织光」:笔画路径的采集与几何运算
   纯函数 + 纯数据,不接触 DOM/Canvas。main.ts 负责监听指针事件并调用这里的
   函数;weathering.ts 消费 resampleStroke() 产出的等弧长采样点,沿路径
   驱动粒子。
   ===================================================================== */

import type { AuroraDirection } from './modes';

export interface StrokePoint {
  x: number;
  y: number;
  t: number; // 时间戳(ms),仅用于潜在的速度计算,几何运算不依赖它
}

/** 一次完整笔画重采样后的等弧长路径点(附带切线方向,弧长归一化 0..1) */
export interface PathSample {
  x: number;
  y: number;
  tangentX: number;
  tangentY: number;
  arc: number; // 0..1,沿路径的归一化弧长位置
}

const MIN_POINT_GAP_PX = 4;
const MAX_STROKE_POINTS = 256;
const RESAMPLE_COUNT = 64;
export const AURORA_COMMIT_LENGTH_PX = 140;
export const AURORA_COMMIT_LENGTH_PX_MOBILE = 90;
/** 键盘兜底路径长度(px),与桌面提交阈值同量级,保证转场节奏一致 */
export const SYNTHETIC_PATH_LENGTH_PX = 180;

/** 追加一个笔画点,过近的点被丢弃,超过上限后丢弃最早的点(保留最近的轨迹) */
export function appendPoint(
  path: StrokePoint[],
  point: StrokePoint,
): StrokePoint[] {
  const last = path[path.length - 1];
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < MIN_POINT_GAP_PX) {
    return path;
  }
  const next = [...path, point];
  return next.length > MAX_STROKE_POINTS ? next.slice(next.length - MAX_STROKE_POINTS) : next;
}

/** 折线总弧长(px) */
export function strokeLength(path: StrokePoint[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return total;
}

/** 笔画是否足够长以提交推进(移动端阈值更低,适配更小的可用挥动空间) */
export function isStrokeCommitted(path: StrokePoint[], isMobile = false): boolean {
  const threshold = isMobile ? AURORA_COMMIT_LENGTH_PX_MOBILE : AURORA_COMMIT_LENGTH_PX;
  return strokeLength(path) >= threshold;
}

/** 笔画起点到终点的净方向(供 CSS 四方向倾斜等既有效果复用) */
export function strokeNetDirection(
  path: StrokePoint[],
  directionFromDelta: (dx: number, dy: number) => AuroraDirection,
): AuroraDirection {
  if (path.length < 2) return 'none';
  const first = path[0];
  const last = path[path.length - 1];
  return directionFromDelta(last.x - first.x, last.y - first.y);
}

/**
 * 将笔画折线重采样为等弧长的 RESAMPLE_COUNT 个点,附带归一化切线方向。
 * 采样点数量少于 2 或总长为 0 时返回空数组(调用方应回退到 syntheticPathFor)。
 */
export function resampleStroke(path: StrokePoint[]): PathSample[] {
  if (path.length < 2) return [];
  const total = strokeLength(path);
  if (total <= 0) return [];

  const samples: PathSample[] = [];
  let segIndex = 1;
  let segStart = 0; // 当前线段起点的累积弧长

  for (let i = 0; i < RESAMPLE_COUNT; i += 1) {
    const targetArc = (total * i) / (RESAMPLE_COUNT - 1);
    while (
      segIndex < path.length - 1 &&
      segStart + segmentLength(path, segIndex) < targetArc
    ) {
      segStart += segmentLength(path, segIndex);
      segIndex += 1;
    }
    const a = path[segIndex - 1];
    const b = path[segIndex];
    const segLen = segmentLength(path, segIndex);
    const localT = segLen > 0 ? Math.max(0, Math.min(1, (targetArc - segStart) / segLen)) : 0;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const mag = Math.hypot(dx, dy) || 1;
    samples.push({
      x: a.x + dx * localT,
      y: a.y + dy * localT,
      tangentX: dx / mag,
      tangentY: dy / mag,
      arc: i / (RESAMPLE_COUNT - 1),
    });
  }
  return samples;
}

function segmentLength(path: StrokePoint[], index: number): number {
  const a = path[index - 1];
  const b = path[index];
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** 键盘/无笔画兜底:沿给定方向生成一条合成直线路径,与真实拖拽路径同格式 */
export function syntheticPathFor(direction: AuroraDirection, originX = 0, originY = 0): PathSample[] {
  const dirX = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const dirY = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  const mag = Math.hypot(dirX, dirY);
  const tangentX = mag > 0 ? dirX / mag : 1;
  const tangentY = mag > 0 ? dirY / mag : 0;
  const travel = mag > 0 ? SYNTHETIC_PATH_LENGTH_PX : 0;

  const samples: PathSample[] = [];
  for (let i = 0; i < RESAMPLE_COUNT; i += 1) {
    const arc = i / (RESAMPLE_COUNT - 1);
    samples.push({
      x: originX + tangentX * travel * arc,
      y: originY + tangentY * travel * arc,
      tangentX,
      tangentY,
      arc,
    });
  }
  return samples;
}

/** 在归一化弧长 s(0..1)处取路径上的插值位置与切线,s 超界时钳制到端点 */
export function pointAtArc(samples: PathSample[], s: number): PathSample {
  if (samples.length === 0) {
    return { x: 0, y: 0, tangentX: 1, tangentY: 0, arc: 0 };
  }
  const clamped = Math.max(0, Math.min(1, s));
  if (samples.length === 1) return samples[0];

  const scaled = clamped * (samples.length - 1);
  const lo = Math.floor(scaled);
  const hi = Math.min(samples.length - 1, lo + 1);
  const localT = scaled - lo;
  const a = samples[lo];
  const b = samples[hi];
  return {
    x: a.x + (b.x - a.x) * localT,
    y: a.y + (b.y - a.y) * localT,
    tangentX: a.tangentX + (b.tangentX - a.tangentX) * localT,
    tangentY: a.tangentY + (b.tangentY - a.tangentY) * localT,
    arc: clamped,
  };
}
