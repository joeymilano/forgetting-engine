# Six Sips of Meng Po — Experience Upgrade

## Intent

Turn The Forgetting Engine into a clearer, more emotionally resonant interactive artwork
for digital-media-design applications. The existing brand and quiet celestial visual language
remain intact. Meng Po's soup becomes the work's central ritual metaphor, interpreted as six
sips rather than presented as a fixed or authoritative folk account.

The experience must:

- guide a first-time visitor without breaking the atmosphere;
- transform one memory through six distinct emotional stages;
- use three legally reusable, high-quality instrumental tracks;
- allow explicit music play, pause, previous, and next controls;
- remain fully bilingual and usable on desktop and mobile;
- preserve the promise that the submitted memory is not persistently stored.

## Cultural Positioning

The project will describe the six-sip structure as:

> A contemporary digital interpretation inspired by the Chinese folk legend of Meng Po's soup.

It will not claim that six sips are the sole canonical version of the legend. This phrasing
keeps the work culturally grounded while remaining accurate for an international admissions
audience.

## Core Ritual

Submitting the memory is the first sip. Each following action advances to the next sip.
After the sixth sip, one final action crosses the river and enters the epilogue.

| Sip | Taste | Human stage | Transformation direction |
| --- | --- | --- | --- |
| 1 | Sweet | The pure joy of being born | Preserve warmth while loosening incidental detail |
| 2 | Hot | Youthful rebellion, impulse, and attachment | Blur names and sharpen the sense of restless motion |
| 3 | Sour | Missed chances, regret, and what was not cherished | Remove certainty and leave traces of longing |
| 4 | Bitter | Love, responsibility, and the strain of ordinary life | Reduce emotional declarations into quieter burdens |
| 5 | Numb | The weariness and weathering of half a lifetime | Break narrative into sparse fragments and sensation |
| 6 | Clear water | Release; the former life becomes unremembered | Leave only a near-empty final trace |

Chinese labels:

- 一口甜｜初生纯粹欢喜
- 二口辣｜年少冲动执念
- 三口酸｜错过遗憾心酸
- 四口苦｜情爱与生活煎熬
- 五口麻｜半生沧桑疲惫
- 六口淡｜白水无味，前尘尽忘

English labels:

- First Sip · Sweet — the pure joy of arrival
- Second Sip · Hot — rebellion, impulse, attachment
- Third Sip · Sour — what was missed and not cherished
- Fourth Sip · Bitter — love, duty, and the weight of living
- Fifth Sip · Numb — the weariness of half a lifetime
- Sixth Sip · Clear — everything loosens; the past is gone

## First-Time Guidance

A three-part ritual guide appears on the first visit after the opening veil:

1. **Before the bowl**  
   Write one memory that still has weight. Use 30–300 characters. The text exists only in the
   current browser session and is never written to a database or browser storage.

2. **Six sips**  
   Each press takes another sip. Sweet, hot, sour, bitter, numb, and finally clear water
   progressively strip away detail, names, certainty, and emotional weight.

3. **Across the river**  
   After the sixth sip, the remaining words disperse into light. The visitor may begin again,
   but the submitted memory itself is not persisted.

The guide uses the existing translucent, quiet, serif-led design language. It includes:

- current step and `1 / 3`, `2 / 3`, `3 / 3` progress;
- Back, Continue, and Begin the ritual controls;
- Skip guide;
- a persistent `How it works / 仪式说明` control for replay;
- keyboard focus containment, Escape to close on replay, and reduced-motion support.

Only completion of the guide is stored in `localStorage`. Memory text is never stored there.

## Writing and Stage Copy

The writing screen keeps the current central composition. Supporting copy changes from generic
forgetting language to the ritual:

- Chinese prompt: `在饮下孟婆汤以前，写下那段仍有重量的记忆。`
- Chinese reassurance: `它不会被保存，只会在六口之后慢慢淡去。`
- Chinese submit action: `饮下第一口`
- English prompt: `Before you drink, write the memory that still carries weight.`
- English reassurance: `It will not be saved. Across six sips, it will slowly loosen.`
- English submit action: `Take the first sip`

Stage actions describe the next sip. On the sixth stage the action becomes
`渡过忘川 / Cross the river`.

The epilogue becomes:

- Chinese: `此岸已远。愿你从这里轻一点。`
- English: `The former shore is distant now. May you leave a little lighter.`

## Music Experience

### Emotional arc

The three tracks serve different forms of remembrance rather than behaving as generic ambient
background:

1. **Looking Back / 回望** — intimate felt piano with restrained cello; warm and personal.
2. **Rain at Dusk / 暮雨** — lyrical piano and strings; the emotional peak.
3. **The Far Shore / 彼岸** — spacious piano, soft bowed texture, and a nearly weightless ending.

Tracks must be instrumental, free of vocals, free of abrupt percussion, and suitable beneath
slow reading. Each source must provide a license that allows public portfolio use. The repository
will include a short credit file with track title, artist, source URL, license, and access date.
No track will be used if its license cannot be verified.

### Controls

The existing music button opens a compact player rather than being a play/pause-only mystery
control. The player contains:

- previous track;
- play/pause;
- next track;
- track title, artist, and `1 / 3` position;
- an emotional subtitle such as `回望 · 像旧照片慢慢显影`;
- a visible close action;
- a link to music credits.

Behavior:

- natural track end advances to the next track and loops after the third;
- manual previous/next works while paused or playing;
- changing tracks while playing uses a short crossfade;
- the selected track is remembered, but playback never resumes automatically on a future visit;
- the first explicit play action satisfies browser autoplay policies;
- failure to load one file skips to the next available track and shows a quiet inline message;
- if all tracks fail, controls remain usable and explain that music is unavailable.

## Visual Direction

The current star field, fog, warm gray type, fine frame, and spacious central stage remain the
visual source of truth. New surfaces use the same typography, thin lines, low-contrast borders,
and restrained blur. No literal illustration of Meng Po, no theatrical underworld imagery,
and no additional page routes are introduced.

The six tastes are signaled through language and extremely subtle tonal temperature shifts,
not six saturated colors:

- sweet: warm ivory;
- hot: muted ember;
- sour: desaturated plum;
- bitter: smoke brown;
- numb: cool gray-blue;
- clear: nearly colorless silver.

These shifts modify existing ambient variables and stage accents without reducing text contrast.

## Technical Boundaries

- Replace all hard-coded seven-stage assumptions with a six-stage constant shared by progress,
  state transitions, labels, validation, fallback generation, and API prompting.
- Keep `main.ts` as the flow coordinator.
- Keep music logic in `music.ts`; expose only the initialization boundary needed by `main.ts`.
- Add a focused onboarding module responsible for guide state, focus behavior, replay, and
  bilingual rendering.
- Extend the existing i18n dictionary instead of embedding user-facing strings in event handlers.
- Store only guide completion and selected track metadata. Never store memory content.
- Preserve the current Cloudflare Pages and fallback behavior.

## Error Handling

- LLM or API failure still produces all six stages through the local fallback.
- A malformed API response is rejected unless it contains exactly six non-empty strings.
- Music load errors do not block the writing or forgetting ritual.
- Guide state failure defaults to showing the guide, which is safer for first-time comprehension.
- Missing optional controls degrade to the existing writing flow rather than hiding the app.

## Accessibility and Mobile

- All new controls have bilingual accessible names and visible focus states.
- The guide and music player use semantic dialog behavior.
- Touch targets are at least 44 × 44 CSS pixels.
- Mobile layouts keep the writing field and primary ritual action unobstructed.
- `prefers-reduced-motion` removes guide transitions and shortens music-panel movement.
- The six taste states never rely on color alone; each includes text labels.

## Verification

Automated checks will cover:

- the six-stage contract in fallback generation and API response validation;
- stage button labels and the transition from sip six to the epilogue;
- onboarding first visit, completion persistence, replay, close, and language switching;
- music next/previous wraparound, paused selection, playing crossfade state, and load failure;
- production build output and Cloudflare deployment checks.

Browser verification will cover:

- first-time guide completion on desktop and mobile;
- guide replay and keyboard focus;
- all three tracks loading and every player control;
- full six-sip demo-mode journey through the epilogue;
- Chinese/English switching in the guide, player, writing screen, and stages;
- no console errors and no layout obstruction at the supported breakpoints.

## Acceptance Criteria

The upgrade is ready when a first-time visitor can understand the work without external
explanation, complete all six sips, manually move among three verified-license tracks, replay
the guide, and finish the experience on desktop or mobile without the interface persistently
storing the submitted memory.
