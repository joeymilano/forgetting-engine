# Ambient Mode Interaction Redesign

## Intent

The Forgetting Engine currently has three ambient modes: `stardust`, `mist`, and `aurora`.
They should no longer feel like three background skins. Switching modes should change the
visitor's embodied relationship to the memory while preserving the same six-sip ritual,
privacy promise, bilingual copy, and quiet celestial identity.

The approved direction is:

- `stardust`: keep the current ceremonial default.
- `mist`: redesign as uncovering and releasing through fog.
- `aurora`: redesign as steering and weaving through light.

## Product Context

The existing source of truth is the current app in this repository:

- `index.html` contains the mode toggle and layered visual stage.
- `src/main.ts` coordinates writing, sealing, six stages, epilogue, and theme switching.
- `src/ambient.ts` owns persistent ambient particles, cursor follow, and theme tinting.
- `src/weathering.ts` owns text particle dispersal and assembly.
- `src/style.css` owns all background layers, controls, and mode-specific styling.

The redesign should build on these boundaries. It should not add React, Vue, Three.js, GSAP,
Tailwind, page routes, audio effects, or a separate app shell.

## Design Principle

Each mode gets a different interaction verb:

| Mode | Verb | Emotional logic | Visitor action |
| --- | --- | --- | --- |
| Stardust | Witness | Memory becomes ash and returns as quieter text | Click to advance |
| Mist | Uncover and release | Memory is present but difficult to hold clearly | Hold or drag to clear fog, release to advance |
| Aurora | Steer and weave | Memory bends, splits, and recomposes as moving light | Move, swipe, or drag to bend the next transition |

The six-sip structure remains identical across modes. Only the way the visitor moves through
the ritual changes.

## Stardust Mode

`stardust` remains the baseline and should be treated as the control version:

- keep the existing warm deep-space palette;
- keep the click-to-advance button rhythm;
- keep the current text-weathering particle transition;
- keep memory-star residue after epilogue;
- keep the custom cursor glow and gentle parallax;
- use the existing button copy without mode-specific instructions.

Implementation should avoid unnecessary churn here. Its value is contrast: the other two
modes feel more distinct because this one remains still, ceremonial, and readable.

## Mist Mode

Mist should feel like trying to find a sentence behind breath on glass.

### Interaction

The primary action changes from a simple click into a pressure-based gesture:

- desktop: press and hold the stage button, or drag horizontally through a fog rail;
- touch: long-press or drag on the same primary control area;
- keyboard: Space or Enter starts the hold, release completes it when the threshold is met.

The next sip should not trigger immediately. The visitor has to clear enough fog first.
Once the threshold is crossed, releasing the control commits the next stage. If they release
too early, the fog closes back over the current text.

### Visual Behavior

During the hold or drag:

- foreground fog thins around the text;
- stage text sharpens from blurred and low-contrast to readable;
- ambient particles slow down and drift laterally instead of rising like ash;
- the progress dots stretch into a low, waterline-like rail;
- the primary button becomes a quiet pressure meter rather than a normal button.

During transition:

- the old text dissolves sideways into fog;
- the next text seeps in from a soft horizontal band;
- particle assembly should be slower and less explosive than `stardust`;
- the screen should briefly feel muffled, then clear enough to read.

### Copy

Button labels can remain six-sip labels, but Mist may add non-persistent helper state through
aria labels or title text:

- before hold: "Hold to clear the fog";
- below threshold: "Keep holding";
- threshold met: "Release to take the next sip".

Chinese equivalents should live in `src/i18n.ts`.

## Aurora Mode

Aurora should feel like the memory has become a moving ribbon of light.

### Interaction

The primary action becomes directional rather than pressure-based:

- desktop: moving the cursor near the stage bends the light field and biases the transition;
- drag or swipe sets the ribbon direction before advancing;
- touch: swipe direction controls the bend;
- keyboard: arrow keys choose a bend direction, Enter advances.

The mode can still use the same visible primary button, but the button should react to the
current direction. The important difference is that the visitor steers the transformation
before committing it.

### Visual Behavior

Before transition:

- aurora bands respond more strongly to pointer position than in other modes;
- stage text gains a subtle shear or ribbon-like offset based on direction;
- ambient particles align into stream-like flows instead of free floating dots;
- the progress indicator pulses upward like vertical light bars.

During transition:

- old text splits into two or three luminous ribbons;
- ribbons bend along the chosen direction;
- the next text recomposes from the ribbons at a slight angle, then settles flat for reading;
- the transition can be faster and more alive than `mist`, but still not game-like.

### Copy

Mode copy should stay minimal. The interface should not explain the whole mechanic on screen.
Accessible names and onboarding text can say:

- "Move to bend the light";
- "Swipe to steer the next sip";
- "Press Enter to weave the next stage".

Chinese equivalents should live in `src/i18n.ts`.

## Shared Mode System

The implementation should add a small mode capability layer rather than scattering mode checks
throughout the app.

Suggested shape:

```ts
export type AmbientMode = 'stardust' | 'mist' | 'aurora';

export interface ModeBehavior {
  advanceKind: 'click' | 'hold' | 'directional';
  transitionKind: 'ash' | 'fog' | 'ribbon';
  progressKind: 'dots' | 'rail' | 'bars';
  particleField: 'embers' | 'fog' | 'streams';
}
```

`src/main.ts` should keep coordinating state, but mode-specific interaction state should be
small and explicit. A focused module such as `src/modes.ts` can define behavior tokens and
gesture thresholds. `src/ambient.ts` and `src/weathering.ts` can consume those tokens through
small public methods instead of reading DOM theme state directly.

## Accessibility

Every mode must remain fully usable without a pointer:

- `stardust`: Enter or Space activates the current button.
- `mist`: keydown starts the hold state, keyup releases it; reduced motion can shorten the
  hold threshold and remove animated fog intensity changes.
- `aurora`: arrow keys set direction, Enter advances; reduced motion keeps direction feedback
  subtle and removes large ribbon travel.

No mode may hide the stage text behind motion for long enough to block reading. The final
settled stage must always return to a clear, stable text layout.

## Technical Boundaries

- Keep runtime dependencies unchanged.
- Keep the existing three theme names to avoid breaking stored `fe-theme` values.
- Do not store memory content.
- Do not add additional persisted mode interaction data beyond the existing theme preference.
- Do not change the LLM request contract for this redesign.
- Keep `SIP_COUNT` and six-stage copy unchanged.
- Preserve current fallback and demo behavior.

## Verification

Automated checks should cover:

- theme cycling still preserves `stardust -> mist -> aurora`;
- `mist` does not advance before its hold threshold;
- `mist` advances after threshold and release;
- `aurora` stores a current direction and advances with keyboard support;
- reduced-motion paths do not block completion;
- existing six-sip journey tests still pass.

Browser verification should cover:

- desktop and mobile interaction for all three modes;
- readable final text after every transition;
- no overlapping controls in the top-right cluster;
- no regression in first-time guide, music player, language switching, or epilogue;
- full demo-mode journey from writing through epilogue in each mode.

## Acceptance Criteria

The redesign is ready when a visitor can switch among the three modes and immediately feel
that the ritual itself has changed:

- Stardust is witnessed by clicking.
- Mist is uncovered by holding or dragging through fog.
- Aurora is steered by movement and recomposed through light.

The modes must stay emotionally restrained, performant, bilingual, accessible, and faithful to
the existing six-sip memory-erasure artwork.
