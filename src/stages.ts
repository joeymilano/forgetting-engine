/* =====================================================================
   stages.ts — 六个阶段的视觉参数(与语言无关)
   main.ts 进入 STAGE_n 时把这些值写到 .stage-text 的 CSS 变量上。
   按钮文案 / SEALING / EPILOGUE 已迁至 i18n.ts(支持中英双语)。
   ===================================================================== */

export interface StageVisual {
  index: number; // 1..6
  name: string; // 阶段语义名(内部用,不展示)
  taste: 'sweet' | 'hot' | 'sour' | 'bitter' | 'numb' | 'clear';
  letterSpacing: string;
  blur: string; // px
  opacity: number; // 0..1
  wordSpacing: string;
  fontSizeScale: number; // 字号倍数
  lineHeight: number;
}

export const STAGES: StageVisual[] = [
  {
    index: 1,
    name: '细节脱落',
    taste: 'sweet',
    letterSpacing: '0.02em',
    blur: '0px',
    opacity: 1.0,
    wordSpacing: 'normal',
    fontSizeScale: 1.0,
    lineHeight: 2.1,
  },
  {
    index: 2,
    name: '名字模糊',
    taste: 'hot',
    letterSpacing: '0.05em',
    blur: '0.2px',
    opacity: 0.92,
    wordSpacing: '0.1em',
    fontSizeScale: 1.0,
    lineHeight: 2.1,
  },
  {
    index: 3,
    name: '情绪褪色',
    taste: 'sour',
    letterSpacing: '0.09em',
    blur: '0.4px',
    opacity: 0.82,
    wordSpacing: '0.2em',
    fontSizeScale: 1.0,
    lineHeight: 2.1,
  },
  {
    index: 4,
    name: '语序松动',
    taste: 'bitter',
    letterSpacing: '0.14em',
    blur: '0.7px',
    opacity: 0.68,
    wordSpacing: '0.4em',
    fontSizeScale: 1.0,
    lineHeight: 2.2,
  },
  {
    index: 5,
    name: '只剩碎片',
    taste: 'numb',
    letterSpacing: '0.22em',
    blur: '1px',
    opacity: 0.5,
    wordSpacing: '1.1em',
    fontSizeScale: 1.1,
    lineHeight: 2.4,
  },
  {
    index: 6,
    name: '最后的痕迹',
    taste: 'clear',
    letterSpacing: '0.46em',
    blur: '1.5px',
    opacity: 0.28,
    wordSpacing: 'normal',
    fontSizeScale: 1.8,
    lineHeight: 2.5,
  },
];
