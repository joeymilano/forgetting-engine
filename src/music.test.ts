// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyLang } from './i18n'
import {
  createMusicPlayer,
  type AudioPort,
  type MusicController,
} from './music'

const fixture = `
  <button id="music-toggle" aria-expanded="false"></button>
  <section id="music-player" hidden>
    <button id="music-close"></button>
    <p id="music-track-title"></p>
    <p id="music-track-mood"></p>
    <p id="music-track-artist"></p>
    <span id="music-track-position"></span>
    <button id="music-prev"></button>
    <button id="music-play"></button>
    <button id="music-next"></button>
    <a id="music-credits" data-i18n="musicCredits"></a>
    <p id="music-error" role="status" hidden></p>
  </section>
`

interface FakeAudio extends AudioPort {
  loads: string[]
  playCount: number
  pauseCount: number
  volumes: number[]
  end(): void
}

function fakeAudio(
  failures: string[] = [],
  playFailures: string[] = [],
): FakeAudio {
  let ended = () => {}
  return {
    loads: [],
    playCount: 0,
    pauseCount: 0,
    volumes: [],
    async load(src) {
      this.loads.push(src)
      return !failures.includes(src)
    },
    async play() {
      this.playCount += 1
      return !playFailures.includes(this.loads[this.loads.length - 1] ?? '')
    },
    pause() {
      this.pauseCount += 1
    },
    setVolume(volume) {
      this.volumes.push(volume)
    },
    onEnded(handler) {
      ended = handler
    },
    end() {
      ended()
    },
  }
}

async function settle(): Promise<void> {
  await vi.runAllTimersAsync()
}

describe('music player', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = fixture
    const values = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
    localStorage.clear()
    applyLang('en')
  })

  it('renders the first title, artist, emotional subtitle, and position', () => {
    createMusicPlayer(fakeAudio())

    expect(document.querySelector('#music-track-title')?.textContent).toBe(
      'A Kind Of Hope',
    )
    expect(document.querySelector('#music-track-artist')?.textContent).toBe(
      'Scott Buckley',
    )
    expect(document.querySelector('#music-track-mood')?.textContent).toContain(
      'Looking Back',
    )
    expect(document.querySelector('#music-track-position')?.textContent).toBe(
      '1 / 3',
    )
  })

  it('wraps previous and next while paused and marks the choice manual', async () => {
    const player = createMusicPlayer(fakeAudio())

    await player.previous()
    expect(player.getState()).toMatchObject({
      index: 2,
      playing: false,
      manuallySelected: true,
    })
    expect(document.querySelector('#music-track-title')?.textContent).toBe(
      'At The End Of All Things',
    )

    await player.next()
    expect(player.getState().index).toBe(0)
  })

  it('does not let a suggested track override a manual choice', async () => {
    const player = createMusicPlayer(fakeAudio())

    await player.next()
    player.applySuggestedTrack('far-shore')

    expect(player.getState().index).toBe(1)
    expect(document.querySelector('#music-track-title')?.textContent).toBe(
      'The Long Dark',
    )
  })

  it('changes a paused selection without starting playback', async () => {
    const audio = fakeAudio()
    const player = createMusicPlayer(audio)

    await player.next()

    expect(audio.playCount).toBe(0)
    expect(audio.loads).toEqual([])
  })

  it('fades and continues playback when changing a playing track', async () => {
    const audio = fakeAudio()
    const player = createMusicPlayer(audio)

    const starting = player.toggle()
    await settle()
    await starting
    const changing = player.next()
    await settle()
    await changing

    expect(audio.loads).toEqual([
      '/music/a-kind-of-hope.mp3',
      '/music/the-long-dark.mp3',
    ])
    expect(audio.playCount).toBe(2)
    expect(audio.pauseCount).toBeGreaterThan(0)
    expect(player.getState()).toMatchObject({ index: 1, playing: true })
  })

  it('advances and loops after natural endings without marking a manual choice', async () => {
    const audio = fakeAudio()
    const player = createMusicPlayer(audio)
    const starting = player.toggle()
    await settle()
    await starting

    audio.end()
    await settle()

    expect(player.getState()).toMatchObject({
      index: 1,
      playing: true,
      manuallySelected: false,
    })
  })

  it('ignores an outgoing ended event during a manual track transition', async () => {
    const audio = fakeAudio()
    const player = createMusicPlayer(audio)
    const starting = player.toggle()
    await settle()
    await starting

    const changing = player.next()
    audio.end()
    await settle()
    await changing

    expect(player.getState()).toMatchObject({
      index: 1,
      playing: true,
      manuallySelected: true,
    })
  })

  it('restores a safe selected track but never persisted playback', async () => {
    const firstAudio = fakeAudio()
    const first = createMusicPlayer(firstAudio)
    await first.next()
    const starting = first.toggle()
    await settle()
    await starting

    document.body.innerHTML = fixture
    const secondAudio = fakeAudio()
    const restored = createMusicPlayer(secondAudio)

    expect(restored.getState()).toMatchObject({ index: 1, playing: false })
    expect(secondAudio.playCount).toBe(0)

    localStorage.setItem('fe-music-track', 'not-a-track')
    document.body.innerHTML = fixture
    expect(createMusicPlayer(fakeAudio()).getState().index).toBe(0)
  })

  it('persists an explicit manual selection of the first track as manual', async () => {
    const first = createMusicPlayer(fakeAudio())
    await first.previous()
    await first.next()
    expect(first.getState()).toMatchObject({
      index: 0,
      manuallySelected: true,
    })

    document.body.innerHTML = fixture
    const restored = createMusicPlayer(fakeAudio())

    expect(restored.getState()).toMatchObject({
      index: 0,
      manuallySelected: true,
    })
    restored.applySuggestedTrack('far-shore')
    expect(restored.getState().index).toBe(0)
  })

  it('persists a suggested selection without treating it as manual', () => {
    const first = createMusicPlayer(fakeAudio())
    first.applySuggestedTrack('far-shore')

    document.body.innerHTML = fixture
    const restored = createMusicPlayer(fakeAudio())

    expect(restored.getState()).toMatchObject({
      index: 2,
      manuallySelected: false,
    })
  })

  it('persists a natural advance without treating it as manual', async () => {
    const audio = fakeAudio()
    const first = createMusicPlayer(audio)
    const starting = first.toggle()
    await settle()
    await starting
    audio.end()
    await settle()

    document.body.innerHTML = fixture
    const restored = createMusicPlayer(fakeAudio())

    expect(restored.getState()).toMatchObject({
      index: 1,
      manuallySelected: false,
      playing: false,
    })
  })

  it('skips one failed track, plays the next, and keeps quiet feedback visible', async () => {
    const audio = fakeAudio(['/music/a-kind-of-hope.mp3'])
    const player = createMusicPlayer(audio)

    const starting = player.toggle()
    await settle()
    await starting

    expect(audio.loads).toEqual([
      '/music/a-kind-of-hope.mp3',
      '/music/the-long-dark.mp3',
    ])
    expect(player.getState()).toMatchObject({ index: 1, playing: true })
    expect(document.querySelector('#music-error')?.hasAttribute('hidden')).toBe(
      false,
    )
    expect(document.querySelector('#music-error')?.textContent).toContain(
      'Moved to the next one',
    )
  })

  it('localizes visible skipped-track feedback when language changes', async () => {
    const player = createMusicPlayer(
      fakeAudio(['/music/a-kind-of-hope.mp3']),
    )
    const starting = player.toggle()
    await settle()
    await starting

    applyLang('zh')

    expect(document.querySelector('#music-error')?.textContent).toContain(
      '已为你切换到下一首',
    )
  })

  it('stops after three distinct failures and shows an inline unavailable status', async () => {
    const audio = fakeAudio([
      '/music/a-kind-of-hope.mp3',
      '/music/the-long-dark.mp3',
      '/music/at-the-end-of-all-things.mp3',
    ])
    const player = createMusicPlayer(audio)

    const starting = player.toggle()
    await settle()
    await starting

    expect(audio.loads).toHaveLength(3)
    expect(player.getState().playing).toBe(false)
    expect(document.querySelector('#music-error')?.hasAttribute('hidden')).toBe(
      false,
    )
    expect(document.querySelector('#music-error')?.textContent).toContain(
      'Music is unavailable',
    )
  })

  it('treats a rejected play as a track failure and skips to an available track', async () => {
    const audio = fakeAudio([], ['/music/a-kind-of-hope.mp3'])
    const player = createMusicPlayer(audio)

    const starting = player.toggle()
    await settle()
    await starting

    expect(audio.loads).toEqual([
      '/music/a-kind-of-hope.mp3',
      '/music/the-long-dark.mp3',
    ])
    expect(player.getState()).toMatchObject({ index: 1, playing: true })
    expect(document.querySelector('#music-error')?.textContent).toContain(
      'Moved to the next one',
    )
  })

  it('bounds rejected playback to three tracks before reporting unavailable', async () => {
    const audio = fakeAudio([], [
      '/music/a-kind-of-hope.mp3',
      '/music/the-long-dark.mp3',
      '/music/at-the-end-of-all-things.mp3',
    ])
    const player = createMusicPlayer(audio)

    const starting = player.toggle()
    await settle()
    await starting

    expect(audio.loads).toHaveLength(3)
    expect(audio.playCount).toBe(3)
    expect(player.getState().playing).toBe(false)
    expect(document.querySelector('#music-error')?.textContent).toContain(
      'Music is unavailable',
    )
  })

  it('does not treat a stale rejected play as a media failure', async () => {
    const audio = fakeAudio()
    let resolvePlay!: (started: boolean) => void
    audio.play = () =>
      new Promise<boolean>((resolve) => {
        resolvePlay = resolve
      })
    const player = createMusicPlayer(audio)

    const starting = player.toggle()
    await vi.advanceTimersByTimeAsync(0)
    const stopping = player.toggle()
    resolvePlay(false)
    await settle()
    await Promise.all([starting, stopping])

    expect(player.getState()).toMatchObject({ index: 0, playing: false })
    expect(audio.loads).toHaveLength(1)
    expect(document.querySelector('#music-error')?.hasAttribute('hidden')).toBe(
      true,
    )
  })

  it('opens from the existing toggle and closes without starting playback', () => {
    const audio = fakeAudio()
    createMusicPlayer(audio)
    const toggle = document.querySelector<HTMLButtonElement>('#music-toggle')!
    const panel = document.querySelector<HTMLElement>('#music-player')!

    toggle.click()
    expect(panel.hidden).toBe(false)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(audio.playCount).toBe(0)

    document.querySelector<HTMLButtonElement>('#music-close')!.click()
    expect(panel.hidden).toBe(true)
  })

  it('closes an open panel with Escape and keeps toggle accessibility in sync', () => {
    createMusicPlayer(fakeAudio())
    const toggle = document.querySelector<HTMLButtonElement>('#music-toggle')!
    const panel = document.querySelector<HTMLElement>('#music-player')!

    toggle.click()
    expect(panel.hidden).toBe(false)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.getAttribute('aria-label')).toBe('Close music player')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(panel.hidden).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.getAttribute('aria-label')).toBe('Open music player')
  })

  it('refreshes emotional copy and accessible labels when language changes', () => {
    createMusicPlayer(fakeAudio())

    applyLang('zh')

    expect(document.querySelector('#music-track-mood')?.textContent).toContain(
      '回望',
    )
    expect(
      document.querySelector('#music-play')?.getAttribute('aria-label'),
    ).toBe('播放音乐')
  })
})
