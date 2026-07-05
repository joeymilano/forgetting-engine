/* =====================================================================
   music.ts — 氛围 BGM 控制器
   曲目:Meditation Impromptu 01 by Kevin MacLeod(CC-BY 4.0,专辑 Serenity)
   - 懒加载 Audio,首次播放才请求文件
   - 淡入 / 淡出(避免突兀)
   - 浏览器自动播放策略:首次任意用户交互后,温和自动淡入
   - 音乐按钮手动 toggle;二者状态同步
   ===================================================================== */

import { getLang } from './i18n';

const MUSIC_SRC = '/meditation.mp3';
const TARGET_VOLUME = 0.5; // 轻柔背景音量
const FADE_IN_STEP = 50; // ms
const FADE_IN_FRAMES = 60; // ~3s
const FADE_OUT_STEP = 40; // ms
const FADE_OUT_FRAMES = 50; // ~2s

let audio: HTMLAudioElement | null = null;
let toggleBtn: HTMLButtonElement | null = null;
let playing = false;
let firstInteractHandled = false;

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';
  }
  return audio;
}

function setBtnState(on: boolean) {
  if (!toggleBtn) return;
  toggleBtn.classList.toggle('is-on', on);
  const s = getLang();
  toggleBtn.setAttribute(
    'aria-label',
    on
      ? s === 'zh'
        ? '暂停氛围音乐'
        : 'Pause ambient music'
      : s === 'zh'
        ? '播放氛围音乐'
        : 'Play ambient music',
  );
}

async function fadeIn(): Promise<void> {
  const a = ensureAudio();
  a.volume = 0;
  try {
    await a.play();
  } catch {
    // 被浏览器阻止:不标记为 playing,等待下一次交互
    playing = false;
    return;
  }
  playing = true;
  setBtnState(true);
  for (let i = 1; i <= FADE_IN_FRAMES; i++) {
    if (!playing) return; // 中途被关
    a.volume = (TARGET_VOLUME * i) / FADE_IN_FRAMES;
    await wait(FADE_IN_STEP);
  }
  a.volume = TARGET_VOLUME;
}

function fadeOut(): void {
  const a = audio;
  if (!a) return;
  const start = a.volume;
  let i = 0;
  const step = () => {
    i++;
    if (!a) return;
    a.volume = start * (1 - i / FADE_OUT_FRAMES);
    if (i >= FADE_OUT_FRAMES) {
      a.pause();
      playing = false;
      setBtnState(false);
    } else {
      setTimeout(step, FADE_OUT_STEP);
    }
  };
  step();
}

async function toggle() {
  firstInteractHandled = true; // 手动操作即视为已交互,避免重复自动播放
  if (playing) {
    fadeOut();
  } else {
    await fadeIn();
  }
}

/** 首次任意用户交互后,温和自动淡入 */
function onFirstInteract() {
  if (firstInteractHandled) return;
  firstInteractHandled = true;
  window.removeEventListener('pointerdown', onFirstInteract);
  window.removeEventListener('keydown', onFirstInteract);
  // ⚠ 必须在用户手势同步上下文内调用 play(),否则被浏览器自动播放策略拦截
  // (放在 setTimeout 里会让 play 脱离手势栈,被静默 block —— 这就是之前没声音的根因)
  if (!playing) void fadeIn();
}

export function initMusic(): void {
  toggleBtn = document.getElementById('music-toggle') as HTMLButtonElement | null;
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    void toggle();
  });

  // 监听首次交互以自动播放(满足浏览器自动播放策略)
  window.addEventListener('pointerdown', onFirstInteract, { passive: true });
  window.addEventListener('keydown', onFirstInteract);
  setBtnState(false);
}
