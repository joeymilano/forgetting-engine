import type { TrackId } from './experience'
import { getLang, t } from './i18n'
import {
  createMusicState,
  nextTrack,
  previousTrack,
  suggestTrack,
  type MusicState,
} from './music-state'

interface Track {
  id: TrackId
  src: string
  title: string
  artist: string
  mood: { en: string; zh: string }
}

const TRACKS: Track[] = [
  {
    id: 'looking-back',
    src: '/music/a-kind-of-hope.mp3',
    title: 'A Kind Of Hope',
    artist: 'Scott Buckley',
    mood: {
      en: 'Looking Back · Like an old photograph slowly developing',
      zh: '回望 · 像旧照片慢慢显影',
    },
  },
  {
    id: 'rain-at-dusk',
    src: '/music/the-long-dark.mp3',
    title: 'The Long Dark',
    artist: 'Scott Buckley',
    mood: {
      en: 'Rain at Dusk · Let the rain carry what words cannot',
      zh: '暮雨 · 让雨带走言语未尽之处',
    },
  },
  {
    id: 'far-shore',
    src: '/music/at-the-end-of-all-things.mp3',
    title: 'At The End Of All Things',
    artist: 'Scott Buckley',
    mood: {
      en: 'The Far Shore · Where the weight finally thins',
      zh: '彼岸 · 重量终于在远处变轻',
    },
  },
]

const STORAGE_KEY = 'fe-music-track'
const TARGET_VOLUME = 0.36
const FADE_STEPS = 4
const FADE_INTERVAL = 25

interface StoredSelection {
  id: TrackId
  manuallySelected: boolean
}

export interface AudioPort {
  load(src: string): Promise<boolean>
  play(): Promise<boolean>
  pause(): void
  setVolume(volume: number): void
  onEnded(handler: () => void): void
}

export interface MusicController {
  applySuggestedTrack(id: TrackId): void
  next(): Promise<void>
  previous(): Promise<void>
  toggle(): Promise<void>
  getState(): MusicState
}

class HtmlAudioPort implements AudioPort {
  private readonly audio = new Audio()

  constructor() {
    this.audio.preload = 'metadata'
  }

  async load(src: string): Promise<boolean> {
    if (this.audio.getAttribute('src') === src && this.audio.readyState >= 1) {
      return true
    }

    // Set the source synchronously inside the click task. Waiting for a
    // metadata event here would consume the browser's transient user gesture
    // before play() runs; playback itself reports an unavailable source.
    this.audio.src = src
    this.audio.load()
    return true
  }

  async play(): Promise<boolean> {
    try {
      await this.audio.play()
      return true
    } catch {
      return false
    }
  }

  pause(): void {
    this.audio.pause()
  }

  setVolume(volume: number): void {
    this.audio.volume = Math.max(0, Math.min(1, volume))
  }

  onEnded(handler: () => void): void {
    this.audio.addEventListener('ended', handler)
  }
}

function readStoredSelection(): {
  index: number
  manuallySelected: boolean
} {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { index: 0, manuallySelected: false }
    const parsed = JSON.parse(stored) as Partial<StoredSelection>
    const index = TRACKS.findIndex((track) => track.id === parsed.id)
    if (index < 0 || typeof parsed.manuallySelected !== 'boolean') {
      return { index: 0, manuallySelected: false }
    }
    return { index, manuallySelected: parsed.manuallySelected }
  } catch {
    return { index: 0, manuallySelected: false }
  }
}

function persistTrack(state: MusicState): void {
  try {
    const selection: StoredSelection = {
      id: TRACKS[state.index]?.id ?? TRACKS[0].id,
      manuallySelected: state.manuallySelected,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
  } catch {
    // Storage can be unavailable in private or hardened browsing contexts.
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function createMusicPlayer(
  audioPort: AudioPort = new HtmlAudioPort(),
): MusicController {
  const restored = readStoredSelection()
  let state: MusicState = {
    ...createMusicState(restored.index),
    manuallySelected: restored.manuallySelected,
  }
  let operation = 0
  let errorKind: 'skipped' | 'unavailable' | null = null

  const panel = document.getElementById('music-player') as HTMLElement | null
  const panelToggle = document.getElementById(
    'music-toggle',
  ) as HTMLButtonElement | null
  const close = document.getElementById(
    'music-close',
  ) as HTMLButtonElement | null
  const play = document.getElementById(
    'music-play',
  ) as HTMLButtonElement | null
  const previous = document.getElementById(
    'music-prev',
  ) as HTMLButtonElement | null
  const next = document.getElementById(
    'music-next',
  ) as HTMLButtonElement | null
  const title = document.getElementById('music-track-title')
  const mood = document.getElementById('music-track-mood')
  const artist = document.getElementById('music-track-artist')
  const position = document.getElementById('music-track-position')
  const error = document.getElementById('music-error')

  const render = () => {
    const strings = t()
    const track = TRACKS[state.index] ?? TRACKS[0]
    if (title) title.textContent = track.title
    if (mood) mood.textContent = track.mood[getLang()]
    if (artist) artist.textContent = track.artist
    if (position) position.textContent = `${state.index + 1} / ${TRACKS.length}`
    if (play) {
      play.setAttribute(
        'aria-label',
        state.playing ? strings.musicPause : strings.musicPlay,
      )
      play.setAttribute(
        'title',
        state.playing ? strings.musicPause : strings.musicPlay,
      )
      play.dataset.playing = state.playing ? 'true' : 'false'
    }
    if (previous) {
      previous.setAttribute('aria-label', strings.musicPrev)
      previous.setAttribute('title', strings.musicPrev)
    }
    if (next) {
      next.setAttribute('aria-label', strings.musicNext)
      next.setAttribute('title', strings.musicNext)
    }
    if (close) {
      close.setAttribute('aria-label', strings.musicClose)
      close.setAttribute('title', strings.musicClose)
    }
    if (panel) panel.setAttribute('aria-label', strings.musicPlayer)
    if (panelToggle) {
      panelToggle.setAttribute('aria-label', strings.musicToggle)
      panelToggle.setAttribute('title', strings.musicToggle)
      panelToggle.classList.toggle('is-on', state.playing)
      panelToggle.classList.toggle('is-off', !state.playing)
    }
    if (error) {
      error.hidden = errorKind === null
      error.textContent =
        errorKind === 'skipped'
          ? strings.musicSkipped
          : errorKind === 'unavailable'
            ? strings.musicUnavailable
            : ''
    }
  }

  const hideError = () => {
    errorKind = null
    if (error) {
      error.hidden = true
      error.textContent = ''
    }
  }

  const showSkipped = () => {
    errorKind = 'skipped'
    if (error) {
      error.hidden = false
      error.textContent = t().musicSkipped
    }
  }

  const showUnavailable = () => {
    errorKind = 'unavailable'
    if (error) {
      error.hidden = false
      error.textContent = t().musicUnavailable
    }
  }

  const fade = async (
    from: number,
    to: number,
    token: number,
  ): Promise<boolean> => {
    for (let step = 1; step <= FADE_STEPS; step += 1) {
      await wait(FADE_INTERVAL)
      if (token !== operation) return false
      audioPort.setVolume(from + ((to - from) * step) / FADE_STEPS)
    }
    return true
  }

  const startAvailable = async (token: number): Promise<void> => {
    const failed = new Set<number>()
    audioPort.setVolume(0)

    while (failed.size < TRACKS.length && token === operation) {
      const track = TRACKS[state.index]
      const loaded = await audioPort.load(track.src)
      if (token !== operation) return
      const started = loaded ? await audioPort.play() : false
      if (token !== operation) {
        if (started) audioPort.pause()
        return
      }

      if (loaded && started) {
        if (failed.size > 0) showSkipped()
        else hideError()
        state = { ...state, playing: true }
        render()
        await fade(0, TARGET_VOLUME, token)
        return
      }

      failed.add(state.index)
      state = {
        ...state,
        index: (state.index + 1) % TRACKS.length,
        playing: true,
      }
      persistTrack(state)
      render()
    }

    if (token === operation) {
      state = { ...state, playing: false }
      audioPort.pause()
      showUnavailable()
      render()
    }
  }

  const changeSelection = async (
    nextState: MusicState,
    natural = false,
  ): Promise<void> => {
    const wasPlaying = state.playing
    state = nextState
    if (!natural) hideError()
    persistTrack(state)
    render()
    if (!wasPlaying) return

    const token = ++operation
    if (!natural) {
      const completed = await fade(TARGET_VOLUME, 0, token)
      if (!completed) return
      audioPort.pause()
    }
    await startAvailable(token)
  }

  const controller: MusicController = {
    applySuggestedTrack(id) {
      const index = TRACKS.findIndex((track) => track.id === id)
      if (index < 0) return
      const suggested = suggestTrack(state, index)
      if (suggested === state || suggested.index === state.index) return
      void changeSelection(suggested)
    },

    async next() {
      await changeSelection(nextTrack(state))
    },

    async previous() {
      await changeSelection(previousTrack(state))
    },

    async toggle() {
      hideError()
      if (state.playing) {
        state = { ...state, playing: false }
        const token = ++operation
        render()
        await fade(TARGET_VOLUME, 0, token)
        if (token === operation) audioPort.pause()
        return
      }

      state = { ...state, playing: true }
      const token = ++operation
      render()
      await startAvailable(token)
    },

    getState() {
      return { ...state }
    },
  }

  const setPanelOpen = (open: boolean) => {
    if (!panel) return
    panel.hidden = !open
    panelToggle?.setAttribute('aria-expanded', open ? 'true' : 'false')
    if (open) play?.focus()
  }

  panelToggle?.addEventListener('click', () => {
    setPanelOpen(panel?.hidden ?? false)
  })
  close?.addEventListener('click', () => {
    setPanelOpen(false)
    panelToggle?.focus()
  })
  play?.addEventListener('click', () => {
    void controller.toggle()
  })
  previous?.addEventListener('click', () => {
    void controller.previous()
  })
  next?.addEventListener('click', () => {
    void controller.next()
  })
  window.addEventListener('fe:langchange', render)
  audioPort.onEnded(() => {
    if (!state.playing) return
    const advanced = {
      ...state,
      index: (state.index + 1) % TRACKS.length,
    }
    void changeSelection(advanced, true)
  })

  render()
  return controller
}

export function initMusic(audioPort?: AudioPort): MusicController {
  return createMusicPlayer(audioPort)
}
