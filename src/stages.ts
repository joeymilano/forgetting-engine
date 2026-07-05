/* =====================================================================
   stages.ts — 七个阶段的视觉参数 + 按钮文案
   严格对应说明书 §6 的表格。
   main.ts 在进入 STAGE_n 时把这些值写到 .stage-text 的 CSS 变量上。
   ===================================================================== */

export interface StageVisual {
  index: number; // 1..7
  name: string; // 阶段语义名
  letterSpacing: string;
  blur: string; // px
  opacity: number; // 0..1
  wordSpacing: string;
  fontSizeScale: number; // 字号倍数
  lineHeight: number;
  button: string; // 按钮文案
}

export const STAGES: StageVisual[] = [
  {
    index: 1,
    name: '细节脱落',
    letterSpacing: '0.02em',
    blur: '0px',
    opacity: 1.0,
    wordSpacing: 'normal',
    fontSizeScale: 1.0,
    lineHeight: 2.1,
    button: '继续遗忘',
  },
  {
    index: 2,
    name: '名字模糊',
    letterSpacing: '0.05em',
    blur: '0.2px',
    opacity: 0.92,
    wordSpacing: '0.1em',
    fontSizeScale: 1.0,
    lineHeight: 2.1,
    button: '继续遗忘',
  },
  {
    index: 3,
    name: '情绪褪色',
    letterSpacing: '0.09em',
    blur: '0.4px',
    opacity: 0.82,
    wordSpacing: '0.2em',
    fontSizeScale: 1.0,
    lineHeight: 2.1,
    button: '继续',
  },
  {
    index: 4,
    name: '语序松动',
    letterSpacing: '0.14em',
    blur: '0.7px',
    opacity: 0.7,
    wordSpacing: '0.4em',
    fontSizeScale: 1.0,
    lineHeight: 2.1,
    button: '继续',
  },
  {
    index: 5,
    name: '只剩碎片',
    letterSpacing: '0.2em',
    blur: '1px',
    opacity: 0.55,
    wordSpacing: '1.2em',
    fontSizeScale: 1.0,
    lineHeight: 2.4,
    button: '快好了',
  },
  {
    index: 6,
    name: '近乎空白的诗',
    letterSpacing: '0.3em',
    blur: '1.2px',
    opacity: 0.4,
    wordSpacing: 'normal',
    fontSizeScale: 1.4,
    lineHeight: 2.4,
    button: '最后一次',
  },
  {
    index: 7,
    name: '最后的痕迹',
    letterSpacing: '0.5em',
    blur: '1.5px',
    opacity: 0.28,
    wordSpacing: 'normal',
    fontSizeScale: 2.0,
    lineHeight: 2.4,
    button: '放手',
  },
];

/** 加载文案轮播(SEALING 状态,底部小字,每 2.5s 一条) */
export const SEALING_LINES = [
  '正在读取这段记忆…',
  '正在测量它的重量…',
  '风化即将开始…',
];

/** EPILOGUE 文案 */
export const EPILOGUE_PRIMARY = '它已经不在这里了。希望你也轻了一点。';
export const EPILOGUE_SECONDARY = '— 遗忘引擎 The Forgetting Engine';
