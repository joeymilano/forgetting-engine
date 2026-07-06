import { t } from './i18n';

const COMPLETE_KEY = 'fe-guide-complete';
const ECHO_KEY = 'fe-echo-enabled';
const REVEAL_EVENT = 'fe:revealed';
const STEP_COUNT = 3;

export interface OnboardingController {
  open(): void;
  close(): void;
  complete(): void;
  isOpen(): boolean;
  isEchoEnabled(): boolean;
  refreshLanguage(): void;
}

function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The ritual remains usable when storage is unavailable.
  }
}

function showDialog(dialog: HTMLDialogElement): 'native' | 'fallback' {
  if (dialog.open || dialog.hasAttribute('open')) return 'native';
  try {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
      return 'native';
    }
  } catch {
    // Fall through for browsers that expose but cannot use the dialog API.
  }
  dialog.setAttribute('open', '');
  return 'fallback';
}

function hideDialog(dialog: HTMLDialogElement): void {
  if (!dialog.open && !dialog.hasAttribute('open')) return;
  try {
    if (typeof dialog.close === 'function') {
      dialog.close();
      return;
    }
  } catch {
    // Fall through to the attribute fallback.
  }
  dialog.removeAttribute('open');
}

export function initOnboarding(): OnboardingController {
  const dialog = document.getElementById('ritual-guide') as HTMLDialogElement | null;
  const replay = document.getElementById('guide-replay') as HTMLButtonElement | null;
  const echo = document.getElementById('echo-enabled') as HTMLInputElement | null;
  const progress = document.getElementById('guide-progress');
  const skip = document.getElementById('guide-skip') as HTMLButtonElement | null;
  const back = document.getElementById('guide-back') as HTMLButtonElement | null;
  const next = document.getElementById('guide-next') as HTMLButtonElement | null;
  const sections = dialog
    ? Array.from(dialog.querySelectorAll<HTMLElement>('[data-guide-step]'))
    : [];

  let currentStep = 0;
  let forcedFirstVisit = readPreference(COMPLETE_KEY) !== '1';
  let revealHandled = false;
  let echoEnabled = readPreference(ECHO_KEY) !== '0';
  let restoreTarget: HTMLElement | null = null;
  let fallbackMode = false;
  let fallbackAriaModal: string | null = null;
  let inertStates: { element: HTMLElement; inert: boolean }[] = [];

  if (echo) echo.checked = echoEnabled;

  const isOpen = (): boolean =>
    Boolean(dialog && (dialog.open || dialog.hasAttribute('open')));

  const focusableElements = (): HTMLElement[] => {
    if (!dialog) return [];
    const selector = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    return Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter(
      (element) =>
        !element.hidden &&
        !element.closest('[hidden]') &&
        element.getAttribute('aria-hidden') !== 'true',
    );
  };

  const enableFallbackModal = (): void => {
    if (!dialog) return;
    fallbackMode = true;
    fallbackAriaModal = dialog.getAttribute('aria-modal');
    dialog.setAttribute('aria-modal', 'true');
    inertStates = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement &&
          element !== dialog &&
          !element.contains(dialog) &&
          'inert' in element,
      )
      .map((element) => ({ element, inert: element.inert }));
    inertStates.forEach(({ element }) => {
      element.inert = true;
    });
    focusableElements()[0]?.focus();
  };

  const disableFallbackModal = (): void => {
    if (!dialog || !fallbackMode) return;
    inertStates.forEach(({ element, inert }) => {
      element.inert = inert;
    });
    inertStates = [];
    if (fallbackAriaModal === null) dialog.removeAttribute('aria-modal');
    else dialog.setAttribute('aria-modal', fallbackAriaModal);
    fallbackAriaModal = null;
    fallbackMode = false;
  };

  const render = (): void => {
    const strings = t().guide;
    const values = {
      current: String(currentStep + 1),
      total: String(STEP_COUNT),
    };
    if (progress) {
      progress.textContent = strings.progress.replace(
        /\{(current|total)\}/g,
        (_, key: keyof typeof values) => values[key],
      );
    }
    sections.forEach((section, index) => {
      const step = strings.steps[index];
      section.hidden = index !== currentStep;
      const kicker = section.querySelector<HTMLElement>('[data-guide-kicker]');
      const title = section.querySelector<HTMLElement>('[data-guide-title]');
      const copy = section.querySelector<HTMLElement>('[data-guide-copy]');
      if (kicker) kicker.textContent = step?.kicker ?? '';
      if (title) title.textContent = step?.title ?? '';
      if (copy) copy.textContent = step?.copy ?? '';
    });

    const privacy = document.getElementById('guide-privacy');
    const echoLabel = document.getElementById('guide-echo-label');
    const echoNote = document.getElementById('guide-echo-note');
    const tastes = document.getElementById('guide-tastes');
    if (privacy) privacy.textContent = strings.privacy;
    if (echoLabel) echoLabel.textContent = strings.echoLabel;
    if (echoNote) echoNote.textContent = strings.echoNote;
    if (tastes) {
      tastes.setAttribute('aria-label', strings.tastesLabel);
      tastes.querySelectorAll('li').forEach((item, index) => {
        item.textContent = strings.tastes[index] ?? '';
      });
    }
    if (skip) skip.textContent = strings.skip;
    if (back) {
      back.textContent = strings.back;
      back.hidden = currentStep === 0;
    }
    if (next) next.textContent = currentStep === STEP_COUNT - 1
      ? strings.begin
      : strings.continue;
    if (replay) {
      replay.textContent = strings.replay;
      replay.setAttribute('aria-label', strings.replay);
      replay.title = strings.replay;
    }
    if (dialog) dialog.setAttribute('aria-label', strings.dialogLabel);
  };

  const open = (): void => {
    if (!dialog || isOpen()) return;
    currentStep = 0;
    const active = document.activeElement;
    restoreTarget = active instanceof HTMLElement && active !== document.body
      ? active
      : replay;
    render();
    if (showDialog(dialog) === 'fallback') enableFallbackModal();
    // <dialog>.showModal() 进入浏览器顶层,凌驾一切 z-index。
    // 自定义光标在普通层会被盖住 → 标记开启态,由 CSS 恢复系统光标。
    document.documentElement.classList.add('guide-open');
  };

  const close = (): void => {
    if (!dialog || !isOpen()) return;
    hideDialog(dialog);
    disableFallbackModal();
    document.documentElement.classList.remove('guide-open');
    restoreTarget?.focus();
    restoreTarget = null;
  };

  const complete = (): void => {
    writePreference(COMPLETE_KEY, '1');
    forcedFirstVisit = false;
    close();
  };

  const onReveal = (): void => {
    if (revealHandled) return;
    revealHandled = true;
    if (forcedFirstVisit) open();
  };

  replay?.addEventListener('click', () => {
    forcedFirstVisit = false;
    open();
  });
  echo?.addEventListener('change', () => {
    echoEnabled = echo.checked;
    writePreference(ECHO_KEY, echoEnabled ? '1' : '0');
  });
  skip?.addEventListener('click', complete);
  back?.addEventListener('click', () => {
    currentStep = Math.max(0, currentStep - 1);
    render();
  });
  next?.addEventListener('click', () => {
    if (currentStep < STEP_COUNT - 1) {
      currentStep += 1;
      render();
      return;
    }
    complete();
  });
  dialog?.addEventListener('cancel', (event) => {
    if (forcedFirstVisit) {
      event.preventDefault();
      return;
    }
    close();
  });
  dialog?.addEventListener('keydown', (event) => {
    if (!fallbackMode || !isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!forcedFirstVisit) close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = focusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  window.addEventListener(REVEAL_EVENT, onReveal);

  render();

  return {
    open,
    close,
    complete,
    isOpen,
    isEchoEnabled: () => echoEnabled,
    refreshLanguage: render,
  };
}
