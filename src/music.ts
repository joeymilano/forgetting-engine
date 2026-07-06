/* =====================================================================
   music.ts — 氛围 BGM 控制器(多曲轮换)
   曲目(均 CC-BY 4.0,Scott Buckley / www.scottbuckley.com.au):
     1. Amberlight — 柔和怀旧钢琴 + 管弦,久石让 / 吉卜力般的暖意(开场·忆往昔)
     2. Meanwhile  — 空灵梦境钢琴,后半弦乐涌入,苦乐参半的余韵(中段)
     3. Penumbra   — 冰川般缓慢的弦乐冥想,饱含思念与怅惘(长尾·潸然)
   - 顺序自动轮换:每首自然结束 → 淡入下一首 → 循环
   - 底部 now-playing 显示曲名,点击切下一首
   - 浏览器自动播放策略:首次任意用户交互后温和自动淡入
   ===================================================================== */

import { getLang } from './i18n';

interface Track {
  src: string;
  name: string;
  author: string;
}

const TRACKS: Track[] = [
  { src: '/amberlight.mp3', name: 'Amberlight', author: 'Scott Buckley' },
  { src: '/meanwhile.mp3', name: 'Meanwhile', author: 'Scott Buckley' },
  { src: '/penumbra.mp3', name: 'Penumbra', author: 'Scott Buckley' },
];

const TARGET_VOLUME = 0.42;
const FADE_STEP = 50; // ms
const FADE_FRAMES = 50; // ~2.5s 淡入 / 淡出

let audio: HTMLAudioElement | null = null;
let toggleBtn: HTMLButtonElement | null = null;
let nowEl: HTMLElement | null = null;
let trackIdx = 0;
let playing = false;
let firstInteractHandled = false;
let crossfading = false;

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.volume = 0;
    audio.preload = 'auto';
    audio.addEventListener('ended', () => {
      // 自然结束 → 淡入下一首(音频已停,无需淡出)。
      // 必须同时满足「仍在播放」且「未处于切换/淡出中」:
      //  ① playing 守卫:手动暂停临近曲末时,toggle() 已先置 playing=false 再淡出,
      //     防止 ended 触发后又自动续播(暂停后诡异复活);
      //  ② crossfading 守卫:手动切歌淡出期间曲目自然结束,防止一次跳过两首。
      if (playing && !crossfading) void nextTrack(true);
    });
  }
  return audio;
}

function currentTrack(): Track {
  return TRACKS[trackIdx];
}

function renderNowPlaying(): void {
  if (!nowEl) return;
  const t = currentTrack();
  nowEl.textContent = `♪  ${t.name}  ·  ${t.author}`;
  const zh = getLang() === 'zh';
  nowEl.title = zh ? '点击切换下一首' : 'Click for next track';
}

function syncBtnState(): void {
  if (!toggleBtn) return;
  toggleBtn.classList.toggle('is-on', playing);
  toggleBtn.classList.toggle('is-off', !playing);
  const zh = getLang() === 'zh';
  toggleBtn.setAttribute(
    'aria-label',
    playing
      ? zh
        ? '暂停氛围音乐'
        : 'Pause ambient music'
      : zh
        ? '播放氛围音乐'
        : 'Play ambient music',
  );
  if (nowEl) {
    nowEl.classList.toggle('show', playing);
    nowEl.setAttribute('aria-hidden', playing ? 'false' : 'true');
  }
}

async function loadTrack(t: Track): Promise<boolean> {
  const a = ensureAudio();
  const full = location.origin + t.src;
  if (a.src !== full) a.src = t.src;
  a.volume = 0;
  try {
    await a.play();
  } catch {
    return false; // 被浏览器自动播放策略拦截
  }
  return true;
}

async function fadeIn(): Promise<void> {
  const a = audio;
  if (!a) return;
  for (let i = 1; i <= FADE_FRAMES; i++) {
    if (!playing || !a) return; // 中途被关
    a.volume = (TARGET_VOLUME * i) / FADE_FRAMES;
    await wait(FADE_STEP);
  }
  if (a) a.volume = TARGET_VOLUME;
}

function fadeOut(): Promise<void> {
  return new Promise((resolve) => {
    const a = audio;
    if (!a) {
      resolve();
      return;
    }
    const start = a.volume;
    let i = 0;
    const step = () => {
      i++;
      if (!a) {
        resolve();
        return;
      }
      a.volume = start * (1 - i / FADE_FRAMES);
      if (i >= FADE_FRAMES) {
        a.pause();
        resolve();
      } else {
        setTimeout(step, FADE_STEP);
      }
    };
    step();
  });
}

async function startPlayback(): Promise<void> {
  renderNowPlaying();
  const ok = await loadTrack(currentTrack());
  if (!ok) {
    playing = false;
    syncBtnState();
    return;
  }
  playing = true;
  syncBtnState();
  await fadeIn();
}

/** 切换下一首:natural=true 表示自然结束(直接淡入);false 表示手动(先淡出再淡入) */
async function nextTrack(natural = false): Promise<void> {
  if (crossfading) return;
  crossfading = true;
  trackIdx = (trackIdx + 1) % TRACKS.length;
  if (playing && !natural) {
    await fadeOut();
  }
  if (playing || natural) {
    await startPlayback();
  }
  crossfading = false;
}

async function toggle(): Promise<void> {
  firstInteractHandled = true; // 手动操作即视为已交互
  if (playing) {
    playing = false;
    syncBtnState();
    await fadeOut();
  } else {
    await startPlayback();
  }
}

/** 首次任意用户交互后,温和自动淡入(必须在手势同步上下文内 play) */
function onFirstInteract(): void {
  if (firstInteractHandled) return;
  firstInteractHandled = true;
  window.removeEventListener('pointerdown', onFirstInteract);
  window.removeEventListener('keydown', onFirstInteract);
  if (!playing) void startPlayback();
}

export function initMusic(): void {
  toggleBtn = document.getElementById('music-toggle') as HTMLButtonElement | null;
  nowEl = document.getElementById('now-playing');
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    void toggle();
  });

  // 点击底部曲名 = 切下一首(避免与 play/pause 按钮的双击冲突)
  if (nowEl) {
    nowEl.addEventListener('click', () => {
      if (playing) void nextTrack(false);
    });
  }

  // 监听首次交互以自动播放(满足浏览器自动播放策略)
  window.addEventListener('pointerdown', onFirstInteract, { passive: true });
  window.addEventListener('keydown', onFirstInteract);
  syncBtnState();
}
