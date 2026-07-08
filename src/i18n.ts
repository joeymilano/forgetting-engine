/* =====================================================================
   i18n.ts — 中英文文案中枢
   - 默认英文;localStorage 记忆选择
   - applyLang():写 [data-i18n] 文本 + placeholder + 语言按钮 active 态
   - t():取当前语言整套文案(main.ts / stages 按钮等运行时取用)
   ===================================================================== */

export type Lang = 'en' | 'zh';

export interface GuideStepStrings {
  kicker: string;
  title: string;
  copy: string;
}

export interface GuideStrings {
  replay: string;
  dialogLabel: string;
  progress: string;
  skip: string;
  back: string;
  continue: string;
  begin: string;
  privacy: string;
  echoLabel: string;
  echoNote: string;
  tastesLabel: string;
  tastes: [string, string, string, string, string, string];
  steps: [GuideStepStrings, GuideStepStrings, GuideStepStrings];
}

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
  stageButtons: string[]; // 6 个（孟婆汤六口:前 5 口推进，第 6 口渡过忘川→尾声）
  langAria: string;
  themeAria: string;
  themeNames: { stardust: string; mist: string; aurora: string };
  modeHints: {
    mistIdle: string;
    mistHolding: string;
    mistReady: string;
    aurora: string;
    auroraTooShort: string;
  };
  genericWhispers: [string, string, string, string, string, string];
  genericAcknowledgment: string;
  memoriesTitle: string;
  memoriesSub: string;
  musicPlayer: string;
  musicToggle: string;
  musicClose: string;
  musicPrev: string;
  musicPlay: string;
  musicPause: string;
  musicNext: string;
  musicCredits: string;
  musicSkipped: string;
  musicUnavailable: string;
  guide: GuideStrings;
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
      'Finding the edges of what it was…',
      'Letting the words loosen…',
      'Weathering is about to begin…',
    ],
    epiloguePrimary: 'It is no longer here. May you be a little lighter, too.',
    epilogueSecondary: '— The Forgetting Engine',
    stageButtons: [
      'Take another sip',
      'Take another sip',
      'Take another sip',
      'Almost there',
      'One last sip',
      'Cross the river',
    ],
    langAria: 'Switch language',
    themeAria: 'Switch ambient theme',
    themeNames: { stardust: 'Stardust', mist: 'Mist', aurora: 'Aurora' },
    modeHints: {
      mistIdle: 'Hold to clear the fog',
      mistHolding: 'Keep holding',
      mistReady: 'Release to take the next sip',
      aurora: 'Draw a line to weave the light',
      auroraTooShort: 'Draw a longer thread',
    },
    genericWhispers: [
      'Sweetness, before it fades.',
      'Heat, loosening its grip.',
      'Only the outline remains.',
      'A calm, distant fragment.',
      'Almost gone now.',
      'Clear water.',
    ],
    genericAcknowledgment: 'It has been read. It is heavier for having been carried.',
    memoriesTitle: 'Sealed Memories',
    memoriesSub: 'What you let go remains here, as light.',
    musicPlayer: 'Memory score player',
    musicToggle: 'Open music player',
    musicClose: 'Close music player',
    musicPrev: 'Previous track',
    musicPlay: 'Play music',
    musicPause: 'Pause music',
    musicNext: 'Next track',
    musicCredits: 'Music credits',
    musicSkipped: 'That track could not be loaded. Moved to the next one.',
    musicUnavailable: 'Music is unavailable right now. You may try again.',
    guide: {
      replay: 'How it works',
      dialogLabel: 'Ritual guide',
      progress: 'Step {current} / {total}',
      skip: 'Skip guide',
      back: 'Back',
      continue: 'Continue',
      begin: 'Begin ritual',
      privacy:
        'AI and privacy: the app sends this text once for an AI-assisted transformation. It does not store the memory in its database or in browser storage.',
      echoLabel: 'Personalized final echo',
      echoNote:
        'Allow one brief closing line shaped by your words. This preference may be saved; the memory and echo are not.',
      tastesLabel: 'The six sips',
      tastes: ['Sweet', 'Hot', 'Sour', 'Bitter', 'Numb', 'Clear'],
      steps: [
        {
          kicker: 'Before the bowl',
          title: 'Bring one memory',
          copy:
            'Write one memory that still has weight, using 30–300 characters. The visible session copy clears when you refresh or close this page.',
        },
        {
          kicker: 'Six sips',
          title: 'Let each taste loosen it',
          copy:
            'Each press takes another sip: sweet, hot, sour, bitter, numb, then clear water. Detail, names, certainty, and emotional weight slowly fall away.',
        },
        {
          kicker: 'Across the river',
          title: 'Watch the words disperse',
          copy:
            'After the sixth sip, the remaining words disperse into light. You may begin again, but the submitted memory itself is not persisted.',
        },
      ],
    },
  },
  zh: {
    brand: '遗 忘 引 擎',
    hint: '写下一段你想放下的记忆。<br />它不会被保存,只会被遗忘。',
    placeholder: '从这里开始……',
    submit: '交给遗忘引擎',
    reset: '再放下一段',
    footmark: '一台记得如何遗忘的机器',
    sealing: ['正在读取这段记忆…', '正在测量它的重量…', '正在辨认它的轮廓…', '让字句慢慢松动…', '风化即将开始…'],
    epiloguePrimary: '它已经不在这里了。希望你也轻了一点。',
    epilogueSecondary: '— 遗忘引擎 The Forgetting Engine',
    stageButtons: ['再饮一口', '再饮一口', '再饮一口', '快好了', '最后一口', '渡过忘川'],
    langAria: '切换语言',
    themeAria: '切换氛围主题',
    themeNames: { stardust: '星河', mist: '雾海', aurora: '极光' },
    modeHints: {
      mistIdle: '按住，让雾散开',
      mistHolding: '继续按住',
      mistReady: '松开，饮下下一口',
      aurora: '画一道轨迹，织出光带',
      auroraTooShort: '再画长一点',
    },
    genericWhispers: [
      '甜，还没散尽。',
      '辣，正在松开。',
      '只剩下轮廓了。',
      '一片平静的残迹。',
      '快要没有了。',
      '清水无痕。',
    ],
    genericAcknowledgment: '已经读过了。被记住过的,终究更重一些。',
    memoriesTitle: '已封缄的记忆',
    memoriesSub: '你放下的,在此化作光。',
    musicPlayer: '记忆配乐播放器',
    musicToggle: '打开音乐播放器',
    musicClose: '关闭音乐播放器',
    musicPrev: '上一首',
    musicPlay: '播放音乐',
    musicPause: '暂停音乐',
    musicNext: '下一首',
    musicCredits: '音乐鸣谢',
    musicSkipped: '这首音乐暂时无法加载，已为你切换到下一首。',
    musicUnavailable: '音乐暂时无法播放，你可以稍后重试。',
    guide: {
      replay: '仪式说明',
      dialogLabel: '仪式说明',
      progress: '第 {current} / {total} 步',
      skip: '跳过说明',
      back: '返回',
      continue: '继续',
      begin: '开始仪式',
      privacy:
        'AI 与隐私：应用只会将这段文字发送一次，用于 AI 辅助转化；不会把记忆写入自身数据库或浏览器存储。',
      echoLabel: '个性化余响',
      echoNote:
        '允许系统根据你的文字留下一句简短结语。此偏好可以保存，但记忆与余响不会被保存。',
      tastesLabel: '六口滋味',
      tastes: ['甜', '辣', '酸', '苦', '麻', '清'],
      steps: [
        {
          kicker: '碗前',
          title: '带来一段记忆',
          copy:
            '写下一段仍有重量的记忆，长度为 30–300 个字符。页面刷新或关闭后，当前会话中可见的文字也会清除。',
        },
        {
          kicker: '六口',
          title: '让每一种滋味松开它',
          copy:
            '每次按下按钮，便再饮一口：甜、辣、酸、苦、麻，最后是清水。细节、名字、确定感与情绪重量会逐渐淡去。',
        },
        {
          kicker: '渡过忘川',
          title: '看字句散入微光',
          copy:
            '第六口之后，余下的字句会散入光中。你可以重新开始，但提交的记忆本身不会被持久保存。',
        },
      ],
    },
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
  setText('[data-i18n="memoriesTitle"]', s.memoriesTitle);
  setText('[data-i18n="memoriesSub"]', s.memoriesSub);
  setText('[data-i18n="musicCredits"]', s.musicCredits);

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

  // 主题切换按钮 aria / 各主题点 title(双语)
  const themeBtn = doc.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.setAttribute('aria-label', s.themeAria);
    themeBtn.setAttribute('title', s.themeAria);
  }
  const tn = s.themeNames;
  doc.querySelectorAll<HTMLElement>('.theme-dots i').forEach((el) => {
    const k = el.dataset.theme as keyof typeof tn | undefined;
    if (k && tn[k]) el.setAttribute('title', tn[k]);
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

  window.dispatchEvent(new CustomEvent('fe:langchange', { detail: { lang } }));
}

export function toggleLang(): Lang {
  applyLang(current === 'en' ? 'zh' : 'en');
  return current;
}
