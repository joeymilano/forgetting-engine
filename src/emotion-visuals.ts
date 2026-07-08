/* =====================================================================
   emotion-visuals.ts — 情绪(emotion) / 节奏(pacing) → 视觉呈现的映射表
   纯数据 + 纯函数,不接触 DOM。main.ts / ambient.ts / weathering.ts 按需取用。
   ===================================================================== */

import type { Emotion, PacingId } from './experience';

/** 情绪色调:三段径向渐变(与 ambient.ts 的 THEME_TINTS 同一格式,便于混色) */
export const EMOTION_TINTS: Record<Emotion, [string, string, string]> = {
  warmth: ['rgba(255,232,196,1)', 'rgba(255,214,168,0.45)', 'rgba(255,206,158,0)'],
  regret: ['rgba(214,224,236,1)', 'rgba(188,204,224,0.45)', 'rgba(176,196,220,0)'],
  attachment: ['rgba(238,214,224,1)', 'rgba(224,188,206,0.45)', 'rgba(216,176,198,0)'],
  grief: ['rgba(196,204,220,1)', 'rgba(168,180,206,0.45)', 'rgba(152,166,196,0)'],
  weariness: ['rgba(212,208,200,1)', 'rgba(188,182,172,0.45)', 'rgba(176,168,156,0)'],
  release: ['rgba(222,250,232,1)', 'rgba(158,240,202,0.5)', 'rgba(140,224,190,0)'],
};

/** 情绪辉光(用于 --emo-glow,叠加在按钮/正文的柔光上) */
export const EMOTION_GLOW: Record<Emotion, string> = {
  warmth: 'rgba(255,214,168,0.35)',
  regret: 'rgba(188,204,224,0.3)',
  attachment: 'rgba(224,188,206,0.32)',
  grief: 'rgba(168,180,206,0.28)',
  weariness: 'rgba(188,182,172,0.26)',
  release: 'rgba(158,240,202,0.34)',
};

/** 节奏 → 转场/低语/静默时长缩放(1.0 = steady 基准) */
export const PACING_DURATION_SCALE: Record<PacingId, number> = {
  gentle: 0.85,
  steady: 1.0,
  deep: 1.35,
};

export interface PacingTiming {
  /** 落笔回应展示的最短可读停留(ms) */
  acknowledgmentHoldMs: number;
  /** 结语:消散后到主句浮现的静默(ms) */
  epilogueSilenceMs: number;
  /** 结语:主句浮现到次级文字 + 重置入口的延迟(ms) */
  epilogueSecondaryDelayMs: number;
}

const BASE_TIMING: PacingTiming = {
  acknowledgmentHoldMs: 2200,
  epilogueSilenceMs: 3000,
  epilogueSecondaryDelayMs: 4000,
};

export const PACING_TIMING: Record<PacingId, PacingTiming> = {
  gentle: scaleTiming(BASE_TIMING, PACING_DURATION_SCALE.gentle),
  steady: BASE_TIMING,
  deep: scaleTiming(BASE_TIMING, PACING_DURATION_SCALE.deep),
};

function scaleTiming(base: PacingTiming, scale: number): PacingTiming {
  return {
    acknowledgmentHoldMs: Math.round(base.acknowledgmentHoldMs * scale),
    epilogueSilenceMs: Math.round(base.epilogueSilenceMs * scale),
    epilogueSecondaryDelayMs: Math.round(base.epilogueSecondaryDelayMs * scale),
  };
}

function parseRgba(value: string): [number, number, number, number] {
  const match = value.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/,
  );
  if (!match) return [255, 255, 255, 1];
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    match[4] === undefined ? 1 : Number(match[4]),
  ];
}

function mixStop(stopA: string, stopB: string, ratioB: number): string {
  const [ar, ag, ab, aa] = parseRgba(stopA);
  const [br, bg, bb, ba] = parseRgba(stopB);
  const ratioA = 1 - ratioB;
  const r = Math.round(ar * ratioA + br * ratioB);
  const g = Math.round(ag * ratioA + bg * ratioB);
  const bl = Math.round(ab * ratioA + bb * ratioB);
  const alpha = aa * ratioA + ba * ratioB;
  return `rgba(${r},${g},${bl},${Number(alpha.toFixed(3))})`;
}

/** 将情绪色调按 ratio(默认 0.45)混入模式色调,三段各自混色 */
export function blendTintStops(
  modeTint: readonly [string, string, string],
  emotionTint: readonly [string, string, string],
  ratio = 0.45,
): [string, string, string] {
  return [
    mixStop(modeTint[0], emotionTint[0], ratio),
    mixStop(modeTint[1], emotionTint[1], ratio),
    mixStop(modeTint[2], emotionTint[2], ratio),
  ];
}
