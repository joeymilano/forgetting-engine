/* =====================================================================
   demo-data.ts — 离线演示模式预置样例(双语)
   URL 带 ?demo=1 时,完全不调 API,从对应语言随机取一组。
   每组 6 层,严格长度递减,并附带手写的低语/回应/结语(不个性化,固定文案)。
   ===================================================================== */

import type { Emotion, PacingId, TrackId } from './experience';
import type { Lang } from './i18n';

export type StageTuple = [string, string, string, string, string, string];
export type WhisperTuple = [string, string, string, string, string, string];

export interface DemoExperience {
  stages: StageTuple;
  whispers: WhisperTuple;
  acknowledgment: string;
  echo: string;
  emotion: Emotion;
  soundtrack: TrackId;
  pacing: PacingId;
}

export const DEMO_DATA_ZH: DemoExperience[] = [
  // —— 1. 一段告别 ——
  {
    stages: [
      '2019 年深秋,我们在上海虹桥的最后一班地铁前告别。你围着我送的那条灰色围巾,说以后不要再联系了。后来我删掉了所有照片,只剩下你写给我的那张生日卡片。',
      '那一年的深秋,我们在某个城市的最后一班地铁前告别。你围着那条围巾,说以后不要再联系了。后来我删掉了所有照片,只剩下那张卡片。',
      '那年的秋天,我们在某处告别。有人围着围巾,说以后别再联系。后来照片都删了,只剩一张卡片。',
      '秋天……在某处告别。有人说,别再联系。照片都没了,只剩一张卡片。',
      '秋天  地铁  围巾  卡片',
      '后来轻了',
    ],
    whispers: [
      '甜里还留着那条围巾的暖。',
      '辣的是那句再也不要联系。',
      '酸的只剩告别的轮廓。',
      '苦到只记得一张卡片。',
      '地铁,风,卡片。',
      '清水见底。',
    ],
    acknowledgment: '那条灰色围巾,还没冷透。',
    echo: '这碗汤里,甜比苦多。往前走吧,桥那头有光。',
    emotion: 'attachment',
    soundtrack: 'looking-back',
    pacing: 'steady',
  },
  // —— 2. 一次失败 ——
  {
    stages: [
      '我把整整两年都投进了那个项目,推掉了所有社交,熬到凌晨四点,最后还是在一个周二的下午收到拒信。我盯着屏幕很久,第一次怀疑自己是不是一开始就错了。',
      '我把很长时间投进了那件事,推掉了所有社交,熬到深夜,最后还是在一个下午收到拒信。我盯着屏幕很久,第一次怀疑自己是不是一开始就错了。',
      '我把很长时间投进那件事,推掉社交,熬到深夜,最后还是收到拒信。我盯着屏幕,怀疑自己是不是一开始就错了。',
      '很久投进那件事……推掉一切……深夜……还是被拒。盯着屏幕,怀疑自己。',
      '深夜  屏幕  怀疑',
      '原来如此',
    ],
    whispers: [
      '甜的是那两年全部的心血。',
      '辣的是周二下午那封信。',
      '酸的只剩屏幕前的自己。',
      '苦到只记得一句怀疑。',
      '深夜,屏幕,怀疑。',
      '清水见底。',
    ],
    acknowledgment: '那两年,你没有敷衍。',
    echo: '这碗汤里,苦先来,甜后到。放下吧,桥那头有光。',
    emotion: 'weariness',
    soundtrack: 'rain-at-dusk',
    pacing: 'deep',
  },
  // —— 3. 一个没说出口的道歉 ——
  {
    stages: [
      '其实那天是我先说的重话,你摔门走了以后,我在客厅站了很久,想追出去,却始终没有拉开门。后来我们再也没见过,那句对不起就一直留在了那扇门后面。',
      '其实那天是我先说了重话,有人走了以后,我在客厅站了很久,想追出去,却没有开门。后来再也没见过,那句对不起一直留在了门后。',
      '那天是我先说重话,有人走了,我在客厅站了很久,想追却没开门。后来再没见,那句对不起留在了门后。',
      '那天……我先说了重话……想追,没开门。那句对不起,留在了门后。',
      '门后  对不起',
      '没说出口',
    ],
    whispers: [
      '甜里藏着没说完的那句话。',
      '辣的是那扇没拉开的门。',
      '酸的只剩客厅里的等待。',
      '苦到只记得那句对不起。',
      '门后,对不起。',
      '清水见底。',
    ],
    acknowledgment: '那扇门,你在它后面站了很久。',
    echo: '这碗汤里,话没说完也无妨。往前走吧,桥那头有光。',
    emotion: 'regret',
    soundtrack: 'far-shore',
    pacing: 'gentle',
  },
];

export const DEMO_DATA_EN: DemoExperience[] = [
  // —— 1. A farewell ——
  {
    stages: [
      'That deep autumn of 2019, we said goodbye at Shanghai Hongqiao, right before the last metro. You wore the grey scarf I had given you and said we should never speak again. Later I deleted every photo, keeping only the birthday card you wrote me.',
      'One deep autumn, we said goodbye at a city station before the last train. You wore that scarf and said we should never speak again. Later I deleted every photo, keeping only that card.',
      'One autumn, we said goodbye somewhere before the last train. Someone wore that scarf and said never to speak again. Later the photos were all deleted, only a card remained.',
      'Autumn… we said goodbye somewhere… someone said never again… the photos are gone, only a card left.',
      'autumn  train  scarf  card',
      'lighter later',
    ],
    whispers: [
      'Sweet still carries the warmth of that scarf.',
      'Hot is the word never again.',
      'Sour keeps only the outline of goodbye.',
      'Bitter remembers just one card.',
      'Train. Wind. Card.',
      'Clear water now.',
    ],
    acknowledgment: 'That grey scarf, still not cold.',
    echo: 'This bowl held more sweetness than bitterness. Walk on — there is light past the bridge.',
    emotion: 'attachment',
    soundtrack: 'looking-back',
    pacing: 'steady',
  },
  // —— 2. A failure ——
  {
    stages: [
      'I poured two whole years into that project, gave up every weekend, stayed up till four in the morning, and still got the rejection on a Tuesday afternoon. I stared at the screen for a long time, wondering for the first time if I had been wrong from the start.',
      'I poured a long time into that thing, gave up my weekends, stayed up late, and still got the rejection one afternoon. I stared at the screen for a long time, wondering if I had been wrong from the start.',
      'I poured a long time into that thing, gave up weekends, stayed up late, and still got rejected. I stared at the screen, wondering if I had been wrong.',
      'poured so long into it… gave up everything… late nights… still rejected. staring at the screen, doubting.',
      'late nights  screen  doubt',
      'so it goes',
    ],
    whispers: [
      'Sweet holds all those two years of effort.',
      'Hot is that Tuesday afternoon letter.',
      'Sour keeps only the one at the screen.',
      'Bitter remembers a single doubt.',
      'Late night. Screen. Doubt.',
      'Clear water now.',
    ],
    acknowledgment: 'Those two years, never once going through the motions.',
    echo: 'This bowl held bitterness first, sweetness after. Set it down — there is light past the bridge.',
    emotion: 'weariness',
    soundtrack: 'rain-at-dusk',
    pacing: 'deep',
  },
  // —— 3. An apology never spoken ——
  {
    stages: [
      'That day I was the one who said the cruel words first. After you slammed the door, I stood in the living room for a long time, wanting to chase after you, but I never pulled the door open. We never saw each other again, and that sorry stayed behind the door forever.',
      'That day I was the one who said the cruel words first. After someone left, I stood in the living room for a long time, wanting to chase after them, but I never opened the door. We never met again, and that sorry stayed behind the door.',
      'That day I said the cruel words first. Someone left, and I stood in the living room a long time, wanting to chase them but never opening the door. That sorry stayed behind the door.',
      'that day… I said the cruel words first… wanted to chase, never opened the door. that sorry, still behind the door.',
      'door  sorry',
      'unsaid',
    ],
    whispers: [
      'Sweet still hides the words left unsaid.',
      'Hot is the door that stayed shut.',
      'Sour keeps only the waiting in that room.',
      'Bitter remembers a single sorry.',
      'Door. Sorry.',
      'Clear water now.',
    ],
    acknowledgment: 'That door, and how long you stood before it.',
    echo: 'This bowl is fine even unfinished. Walk on — there is light past the bridge.',
    emotion: 'regret',
    soundtrack: 'far-shore',
    pacing: 'gentle',
  },
];

/** 随机取一组(按语言) */
export function pickDemo(lang: Lang = 'zh'): DemoExperience {
  const pool = lang === 'zh' ? DEMO_DATA_ZH : DEMO_DATA_EN;
  const idx = Math.floor(Math.random() * pool.length);
  const demo = pool[idx];
  return {
    ...demo,
    stages: [...demo.stages] as StageTuple,
    whispers: [...demo.whispers] as WhisperTuple,
  };
}
