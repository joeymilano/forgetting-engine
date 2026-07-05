/* =====================================================================
   i18n.ts — 中英文文案中枢
   - 默认英文;localStorage 记忆选择
   - applyLang():写 [data-i18n] 文本 + placeholder + 语言按钮 active 态
   - t():取当前语言整套文案(main.ts / stages 按钮等运行时取用)
   ===================================================================== */

export type Lang = 'en' | 'zh';

export interface Strings {
  brand: string;
  hint: string; // 可含 <br />
  placeholder: string;
  submit: string;
  reset: string;
  footmark: string;
  sealing: string[]; // 3 条
  epiloguePrimary: string;
  epilogueSecondary: string;
  stageButtons: string[]; // 7 个
  langAria: string;
}

const STRINGS: Record<Lang, Strings> = {
  en: {
    brand: 'THE FORGETTING ENGINE',
    hint: 'Write a memory you wish to let go.<br />It will not be saved. Only forgotten.',
    placeholder: 'Begin here…',
    submit: 'Surrender to Forgetting',
    reset: 'Let go of another',
    footmark: 'A machine that remembers how to forget',
    sealing: [
      'Reading this memory…',
      'Measuring its weight…',
      'Weathering is about to begin…',
    ],
    epiloguePrimary: 'It is no longer here. May you be a little lighter, too.',
    epilogueSecondary: '— The Forgetting Engine',
    stageButtons: [
      'Continue',
      'Continue',
      'Continue',
      'Continue',
      'Almost there',
      'One last time',
      'Let go',
    ],
    langAria: 'Switch language',
  },
  zh: {
    brand: '遗 忘 引 擎',
    hint: '写下一段你想放下的记忆。<br />它不会被保存,只会被遗忘。',
    placeholder: '从这里开始……',
    submit: '交给遗忘引擎',
    reset: '再放下一段',
    footmark: '一台记得如何遗忘的机器',
    sealing: ['正在读取这段记忆…', '正在测量它的重量…', '风化即将开始…'],
    epiloguePrimary: '它已经不在这里了。希望你也轻了一点。',
    epilogueSecondary: '— 遗忘引擎 The Forgetting Engine',
    stageButtons: ['继续遗忘', '继续遗忘', '继续', '继续', '快好了', '最后一次', '放手'],
    langAria: '切换语言',
  },
};

const KEY = 'fe-lang';

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    /* 无 localStorage 权限 → 默认英文 */
  }
  return 'en';
}

let current: Lang = detectLang();

export function getLang(): Lang {
  return current;
}

export function isZh(): boolean {
  return current === 'zh';
}

export function t(): Strings {
  return STRINGS[current];
}

/** 写入 DOM:[data-i18n] / [data-i18n-placeholder] / 语言按钮 active */
export function applyLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* 静默 */
  }
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

  const s = STRINGS[lang];
  const doc = document;
  const setText = (selector: string, val: string) =>
    doc.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      el.textContent = val;
    });

  setText('[data-i18n="brand"]', s.brand);
  setText('[data-i18n="submit"]', s.submit);
  setText('[data-i18n="reset"]', s.reset);
  setText('[data-i18n="footmark"]', s.footmark);

  // hint 允许 <br />
  doc.querySelectorAll<HTMLElement>('[data-i18n="hint"]').forEach((el) => {
    el.innerHTML = s.hint;
  });

  // placeholder
  doc
    .querySelectorAll<HTMLElement>('[data-i18n-placeholder="placeholder"]')
    .forEach((el) => {
      (el as HTMLTextAreaElement).placeholder = s.placeholder;
    });

  // 语言按钮 active 态
  doc.querySelectorAll<HTMLElement>('.lang-opt').forEach((el) => {
    el.classList.toggle('active', el.dataset.lang === lang);
  });

  // 更新正在显示的阶段按钮文案(若处于阶段中)
  const stageBtnLabel = doc.querySelector<HTMLElement>('#stage-btn .btn-label');
  if (stageBtnLabel && stageBtnLabel.textContent) {
    const idx = parseInt(
      doc.getElementById('stage-text')?.dataset.stage || '0',
      10,
    );
    if (idx >= 1 && idx <= 7) stageBtnLabel.textContent = s.stageButtons[idx - 1];
  }
}

export function toggleLang(): Lang {
  applyLang(current === 'en' ? 'zh' : 'en');
  return current;
}
