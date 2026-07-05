/* =====================================================================
   fallback.ts — 纯前端兜底退化算法
   断网 / 限流 / 超时 / 校验失败 时,保证体验不中断(说明书 §4.3)。
   规则:
     第 1-4 层:按比例随机删句 + 把人名/称呼模式替换为「那个人」
     第 5 层  :从原文随机抽 4 个词
     第 6 层  :固定文案「有些事发生过 / 后来轻了」
     第 7 层  :「……」
   ===================================================================== */

/** 把句子按句末标点切分(保留标点) */
function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[。.!！?？\n])\s*/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [text.trim()];
}

/** 中文常见称呼/人名模式 → 泛称。仅做模式匹配,不依赖任何词库 */
function blurNames(s: string): string {
  return s
    // 「X 老师/师傅/姐/哥/总/医生」等称呼
    .replace(/([一-鿿])(老师|师傅|先生|女士|小姐|医生|同学|总|姐|哥)\b/g, '那个人')
    // 「小 X / 阿 X 」前缀
    .replace(/(小|阿)([一-鿿])/g, '那个人')
    // 引号里的称谓:「xx」/「xx」
    .replace(/「[^」]{1,4}」/g, '那个人')
    // 我/你/他 名字(两到三字 + 说/道/看/想)——保守替换
    .replace(/([一-鿿]{2,3})(说|道|告诉我|答应|笑着)/g, '那个人$2');
}

/** 从句子里随机删除一定比例的句子,保留首句骨架 */
function dropSentences(sentences: string[], keepRatio: number): string[] {
  if (sentences.length <= 1) return sentences;
  const keepCount = Math.max(1, Math.round(sentences.length * keepRatio));
  // 永远保留第一句,从其余里随机选
  const rest = sentences.slice(1);
  const picked: string[] = [];
  const n = Math.min(rest.length, Math.max(0, keepCount - 1));
  // 简单确定性「随机」:按字符码点排序后取前 n(避免引入强随机导致每次差异过大)
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

/** 抽词:按非汉字/字母边界切,过滤过短的 */
function extractWords(text: string): string[] {
  const words = text
    .replace(/[。.!！?？,\s,、;；:：()（）「」""''’‘]+/g, ' ')
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
  return words;
}

export function fallbackStages(memory: string): string[] {
  const mem = (memory || '').trim();
  const sentences = splitSentences(mem);

  // 第 1 层:删 ~15% 句子 + 不替换名字
  const s1 = dropSentences(sentences, 0.85).join('');
  // 第 2 层:在 s1 基础上删到 ~70% + 名字泛化
  const s2 = blurNames(dropSentences(splitSentences(s1), 0.82).join(''));
  // 第 3 层:情绪词淡化(粗略替换几个常见强情绪词)
  const s3 = s2
    .replace(/(崩溃|心碎|痛哭|撕心|绝望|恨|爱极了|狂喜|愤怒|气愤|悲伤|难过|伤心)/g, '有些波动')
    .slice(0, Math.ceil(s2.length * 0.8));
  // 第 4 层:截断到 ~40% + 省略号
  const s4 =
    s3.slice(0, Math.max(8, Math.ceil(mem.length * 0.4))).trim() +
    '……好像……记不清了。';

  // 第 5 层:4 个孤立词碎片
  const words = extractWords(mem);
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
  const s5 = (picks.length ? picks : ['那时', '后来']).join('  ');

  // 第 6 层:近乎空白的诗
  const s6 = '有些事发生过 / 后来轻了';
  // 第 7 层:最后的痕迹
  const s7 = '……';

  return [s1, s2, s3, s4, s5, s6, s7];
}
