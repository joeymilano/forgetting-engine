// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLang } from './i18n';
import { initOnboarding } from './onboarding';

const fixture = `
  <button id="guide-replay" type="button"></button>
  <dialog id="ritual-guide">
    <p id="guide-progress"></p>
    <section data-guide-step="0">
      <p data-guide-kicker></p>
      <h2 data-guide-title></h2>
      <p data-guide-copy></p>
      <p id="guide-privacy"></p>
      <label>
        <input id="echo-enabled" type="checkbox" checked>
        <span id="guide-echo-label"></span>
        <small id="guide-echo-note"></small>
      </label>
    </section>
    <section data-guide-step="1" hidden>
      <p data-guide-kicker></p>
      <h2 data-guide-title></h2>
      <p data-guide-copy></p>
      <ol id="guide-tastes"><li></li><li></li><li></li><li></li><li></li><li></li></ol>
    </section>
    <section data-guide-step="2" hidden>
      <p data-guide-kicker></p>
      <h2 data-guide-title></h2>
      <p data-guide-copy></p>
    </section>
    <button id="guide-skip" type="button"></button>
    <button id="guide-back" type="button"></button>
    <button id="guide-next" type="button"></button>
  </dialog>
`;

function installDialogPolyfill(): void {
  const dialog = document.getElementById('ritual-guide') as HTMLDialogElement;
  Object.defineProperty(dialog, 'showModal', {
    configurable: true,
    value: () => dialog.setAttribute('open', ''),
  });
  Object.defineProperty(dialog, 'close', {
    configurable: true,
    value: () => dialog.removeAttribute('open'),
  });
}

function reveal(): void {
  window.dispatchEvent(new Event('fe:revealed'));
}

class FakeStorage {
  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this, key)
      ? String((this as unknown as Record<string, string>)[key])
      : null;
  }

  setItem(key: string, value: string): void {
    (this as unknown as Record<string, string>)[key] = value;
  }

  removeItem(key: string): void {
    delete (this as unknown as Record<string, string>)[key];
  }

  clear(): void {
    Object.keys(this).forEach((key) => this.removeItem(key));
  }
}

describe('ritual guide', () => {
  beforeEach(() => {
    document.body.innerHTML = fixture;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: new FakeStorage(),
    });
    installDialogPolyfill();
    applyLang('en');
    localStorage.clear();
  });

  it('waits for the page reveal before opening on a first visit', () => {
    const guide = initOnboarding();

    expect(guide.isOpen()).toBe(false);
    reveal();
    expect(guide.isOpen()).toBe(true);
  });

  it('opens only once when the reveal notification repeats', () => {
    const dialog = document.getElementById('ritual-guide') as HTMLDialogElement;
    const showModal = vi.spyOn(dialog, 'showModal');
    initOnboarding();

    reveal();
    reveal();

    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it('persists completion when the final action is used', () => {
    const guide = initOnboarding();
    reveal();
    document.getElementById('guide-next')?.click();
    document.getElementById('guide-next')?.click();
    document.getElementById('guide-next')?.click();

    expect(guide.isOpen()).toBe(false);
    expect(localStorage.getItem('fe-guide-complete')).toBe('1');
  });

  it('marks the guide complete when it is skipped', () => {
    const guide = initOnboarding();
    reveal();
    document.getElementById('guide-skip')?.click();

    expect(guide.isOpen()).toBe(false);
    expect(localStorage.getItem('fe-guide-complete')).toBe('1');
  });

  it('restores and persists the personalized echo preference', () => {
    localStorage.setItem('fe-echo-enabled', '0');
    const guide = initOnboarding();
    const echo = document.getElementById('echo-enabled') as HTMLInputElement;

    expect(guide.isEchoEnabled()).toBe(false);
    expect(echo.checked).toBe(false);

    echo.click();
    expect(guide.isEchoEnabled()).toBe(true);
    expect(localStorage.getItem('fe-echo-enabled')).toBe('1');
  });

  it('replays after completion and Escape closes back to the replay control', () => {
    localStorage.setItem('fe-guide-complete', '1');
    const replay = document.getElementById('guide-replay') as HTMLButtonElement;
    const dialog = document.getElementById('ritual-guide') as HTMLDialogElement;
    const guide = initOnboarding();

    reveal();
    expect(guide.isOpen()).toBe(false);

    replay.focus();
    replay.click();
    expect(guide.isOpen()).toBe(true);

    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(false);
    expect(guide.isOpen()).toBe(false);
    expect(document.activeElement).toBe(replay);
  });

  it('keeps the forced first-visit guide open when Escape is pressed', () => {
    const dialog = document.getElementById('ritual-guide') as HTMLDialogElement;
    const guide = initOnboarding();
    reveal();

    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(guide.isOpen()).toBe(true);
    expect(localStorage.getItem('fe-guide-complete')).toBeNull();
  });

  it('moves within the three step boundaries and supports Back', () => {
    initOnboarding();
    reveal();
    const back = document.getElementById('guide-back') as HTMLButtonElement;
    const next = document.getElementById('guide-next') as HTMLButtonElement;
    const progress = document.getElementById('guide-progress');

    expect(progress?.textContent).toContain('1 / 3');
    expect(back.hidden).toBe(true);

    next.click();
    expect(progress?.textContent).toContain('2 / 3');
    expect(back.hidden).toBe(false);

    back.click();
    back.click();
    expect(progress?.textContent).toContain('1 / 3');

    next.click();
    next.click();
    expect(progress?.textContent).toContain('3 / 3');
    expect(next.textContent).toBe('Begin ritual');
  });

  it('refreshes all visible guide text when the language changes', () => {
    const guide = initOnboarding();
    reveal();
    expect(document.getElementById('guide-progress')?.textContent).toContain('Step');

    applyLang('zh');
    guide.refreshLanguage();

    expect(document.getElementById('guide-progress')?.textContent).toContain('第');
    expect(document.getElementById('guide-next')?.textContent).toBe('继续');
    expect(document.querySelector('#guide-tastes li')?.textContent).toBe('甜');
  });

  it('falls back safely when storage access fails', () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
    });

    const guide = initOnboarding();
    expect(guide.isEchoEnabled()).toBe(true);
    expect(() => reveal()).not.toThrow();
    expect(guide.isOpen()).toBe(true);
    expect(() => guide.complete()).not.toThrow();

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: original,
    });
  });

  it('never creates a storage key for memory content', () => {
    const guide = initOnboarding();
    reveal();
    guide.complete();

    expect(Object.keys(localStorage).sort()).toEqual([
      'fe-guide-complete',
    ]);
  });
});
