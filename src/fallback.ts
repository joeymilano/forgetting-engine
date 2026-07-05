/* =====================================================================
   fallback.ts — 纯前端兜底退化算法(双语)
   断网 / 限流 / 超时 / 校验失败 时,保证体验不中断。
   中文:人名模式 → 「那个人」;英文:名字 → "someone"。
   ===================================================================== */

import type { Lang } from './i18n';

/** 把句子按句末标点切分(保留标点)。兼容中英 */
function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[。.!！?？\n])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [text.trim()];
}

/** 中文常见称呼/人名模式 → 泛称 */
function blurNamesZh(s: string): string {
  return s
    .replace(/([一-鿿])(老师|师傅|先生|女士|小姐|医生|同学|总|姐|哥)\b/g, '那个人')
    .replace(/(小|阿)([一-鿿])/g, '那个人')
    .replace(/「[^」]{1,4}」/g, '那个人')
    .replace(/([一-鿿]{2,3})(说|道|告诉我|答应|笑着)/g, '那个人$2');
}

/** 英文人名/称谓 → "someone"。保守匹配,避免破坏句首大写 */
function blurNamesEn(s: string): string {
  return s
    // 引号里的称谓
    .replace(/"[A-Z][a-z]+"/g, 'someone')
    .replace(/"[A-Z][a-z]+ [A-Z][a-z]+"/g, 'someone')
    // Mr./Mrs./Ms./Dr. X
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+\b/g, 'someone')
    // my friend / my love / darling 等
    .replace(/\b(my (friend|love|dear|darling|husband|wife|brother|sister|mother|father|son|daughter))\b/gi, 'someone')
    // 句中(非句首)首字母大写词 → someone(保守:仅匹配前接空格且不在段首的)
    .replace(/(\s)([A-Z][a-z]{2,})(\s)/g, (_m, a, _w, b) => `${a}someone${b}`);
}

/** 中英通用抽词 */
function extractWords(text: string, lang: Lang): string[] {
  const cleaned =
    lang === 'zh'
      ? text.replace(/[。.!！?？,\s,、;；:：()（）「」""''’‘]+/g, ' ')
      : text.replace(/[.!?,;:()\s"'`—–-]+/g, ' ');
  const minLen = lang === 'zh' ? 2 : 3;
  return cleaned
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length >= minLen);
}

/** 从句子里按 keepRatio 删句,保留首句骨架(确定性"随机") */
function dropSentences(sentences: string[], keepRatio: number): string[] {
  if (sentences.length <= 1) return sentences;
  const keepCount = Math.max(1, Math.round(sentences.length * keepRatio));
  const rest = sentences.slice(1);
  const picked: string[] = [];
  const n = Math.min(rest.length, Math.max(0, keepCount - 1));
  const indexed = rest.map((s, i) => ({ s, i }));
  indexed.sort((a, b) => hash(a.s) - hash(b.s));
  for (let i = 0; i < n; i++) picked.push(indexed[i].s);
  picked.sort((a, b) => rest.indexOf(a) - rest.indexOf(b));
  return [sentences[0], ...picked];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function fallbackStages(memory: string, lang: Lang = 'zh'): string[] {
  const mem = (memory || '').trim();
  const sentences = splitSentences(mem);
  const isZh = lang === 'zh';

  const blur = isZh ? blurNamesZh : blurNamesEn;
  const ellipsis4 = isZh ? '……好像……记不清了。' : '…I think…I can barely remember.';
  const defaultWords = isZh ? ['那时', '后来'] : ['then', 'later'];
  const poem6 = isZh ? '有些事发生过 / 后来轻了' : 'things happened / then they grew light';
  const trace7 = isZh ? '……' : '…';

  // 第 1 层:删 ~15% 句子
  const s1 = dropSentences(sentences, 0.85).join('');
  // 第 2 层:删到 ~70% + 名字泛化
  const s2 = blur(dropSentences(splitSentences(s1), 0.82).join(''));
  // 第 3 层:情绪词淡化
  const emotionRe = isZh
    ? /(崩溃|心碎|痛哭|撕心|绝望|恨|爱极了|狂喜|愤怒|气愤|悲伤|难过|伤心)/g
    : /\b(devastated|heartbroken|crushed|shattered|furious|agonizing|despair|grief|miserable|ecstatic|desperate|tortured)\b/gi;
  const s3 = s2.replace(emotionRe, isZh ? '有些波动' : 'something shifted').slice(
    0,
    Math.ceil(s2.length * 0.8),
  );
  // 第 4 层:截断到 ~40% + 省略语
  const s4 =
    s3.slice(0, Math.max(8, Math.ceil(mem.length * 0.4))).trim() + ellipsis4;

  // 第 5 层:4 个孤立词碎片
  const words = extractWords(mem, lang);
  const picks: string[] = [];
  if (words.length) {
    const used = new Set<number>();
    let guard = 0;
    while (picks.length < Math.min(4, words.length) && guard < 50) {
      const idx = hash(words.join('|') + picks.length) % words.length;
      if (!used.has(idx)) {
        used.add(idx);
        picks.push(words[idx]);
      }
      guard++;
    }
  }
  const s5 = (picks.length ? picks : defaultWords).join('  ');

  // 第 6 层 / 第 7 层
  const s6 = poem6;
  const s7 = trace7;

  return [s1, s2, s3, s4, s5, s6, s7];
}
