/* =====================================================================
   demo-data.ts — 离线演示模式预置样例(双语)
   URL 带 ?demo=1 时,完全不调 API,从对应语言随机取一组。
   每组 7 层,严格长度递减,中文第 7 层 ≤ 4 字,英文第 7 层 ≤ 4 字符。
   ===================================================================== */

import type { Lang } from './i18n';

export type StageTuple = [string, string, string, string, string, string, string];

export const DEMO_DATA_ZH: StageTuple[] = [
  // —— 1. 一段告别 ——
  [
    '2019 年深秋,我们在上海虹桥的最后一班地铁前告别。你围着我送的那条灰色围巾,说以后不要再联系了。后来我删掉了所有照片,只剩下你写给我的那张生日卡片。',
    '那一年的深秋,我们在某个城市的最后一班地铁前告别。你围着那条围巾,说以后不要再联系了。后来我删掉了所有照片,只剩下那张卡片。',
    '那年的秋天,我们在某处告别。有人围着围巾,说以后别再联系。后来照片都删了,只剩一张卡片。',
    '秋天……在某处告别。有人说,别再联系。照片都没了,只剩一张卡片。',
    '秋天  地铁  围巾  卡片',
    '后来轻了',
    '……',
  ],
  // —— 2. 一次失败 ——
  [
    '我把整整两年都投进了那个项目,推掉了所有社交,熬到凌晨四点,最后还是在一个周二的下午收到拒信。我盯着屏幕很久,第一次怀疑自己是不是一开始就错了。',
    '我把很长时间投进了那件事,推掉了所有社交,熬到深夜,最后还是在一个下午收到拒信。我盯着屏幕很久,第一次怀疑自己是不是一开始就错了。',
    '我把很长时间投进那件事,推掉社交,熬到深夜,最后还是收到拒信。我盯着屏幕,怀疑自己是不是一开始就错了。',
    '很久投进那件事……推掉一切……深夜……还是被拒。盯着屏幕,怀疑自己。',
    '深夜  屏幕  怀疑',
    '原来如此',
    '嗯。',
  ],
  // —— 3. 一个没说出口的道歉 ——
  [
    '其实那天是我先说的重话,你摔门走了以后,我在客厅站了很久,想追出去,却始终没有拉开门。后来我们再也没见过,那句对不起就一直留在了那扇门后面。',
    '其实那天是我先说了重话,有人走了以后,我在客厅站了很久,想追出去,却没有开门。后来再也没见过,那句对不起一直留在了门后。',
    '那天是我先说重话,有人走了,我在客厅站了很久,想追却没开门。后来再没见,那句对不起留在了门后。',
    '那天……我先说了重话……想追,没开门。那句对不起,留在了门后。',
    '门后  对不起',
    '没说出口',
    '——',
  ],
];

export const DEMO_DATA_EN: StageTuple[] = [
  // —— 1. A farewell ——
  [
    'That deep autumn of 2019, we said goodbye at Shanghai Hongqiao, right before the last metro. You wore the grey scarf I had given you and said we should never speak again. Later I deleted every photo, keeping only the birthday card you wrote me.',
    'One deep autumn, we said goodbye at a city station before the last train. You wore that scarf and said we should never speak again. Later I deleted every photo, keeping only that card.',
    'One autumn, we said goodbye somewhere before the last train. Someone wore that scarf and said never to speak again. Later the photos were all deleted, only a card remained.',
    'Autumn… we said goodbye somewhere… someone said never again… the photos are gone, only a card left.',
    'autumn  train  scarf  card',
    'lighter later',
    '…',
  ],
  // —— 2. A failure ——
  [
    'I poured two whole years into that project, gave up every weekend, stayed up till four in the morning, and still got the rejection on a Tuesday afternoon. I stared at the screen for a long time, wondering for the first time if I had been wrong from the start.',
    'I poured a long time into that thing, gave up my weekends, stayed up late, and still got the rejection one afternoon. I stared at the screen for a long time, wondering if I had been wrong from the start.',
    'I poured a long time into that thing, gave up weekends, stayed up late, and still got rejected. I stared at the screen, wondering if I had been wrong.',
    'poured so long into it… gave up everything… late nights… still rejected. staring at the screen, doubting.',
    'late nights  screen  doubt',
    'so it goes',
    'oh.',
  ],
  // —— 3. An apology never spoken ——
  [
    'That day I was the one who said the cruel words first. After you slammed the door, I stood in the living room for a long time, wanting to chase after you, but I never pulled the door open. We never saw each other again, and that sorry stayed behind the door forever.',
    'That day I was the one who said the cruel words first. After someone left, I stood in the living room for a long time, wanting to chase after them, but I never opened the door. We never met again, and that sorry stayed behind the door.',
    'That day I said the cruel words first. Someone left, and I stood in the living room a long time, wanting to chase them but never opening the door. That sorry stayed behind the door.',
    'that day… I said the cruel words first… wanted to chase, never opened the door. that sorry, still behind the door.',
    'door  sorry',
    'never spoken',
    '—',
  ],
];

/** 随机取一组(按语言) */
export function pickDemo(lang: Lang = 'zh'): string[] {
  const pool = lang === 'zh' ? DEMO_DATA_ZH : DEMO_DATA_EN;
  const idx = Math.floor(Math.random() * pool.length);
  return [...pool[idx]];
}
