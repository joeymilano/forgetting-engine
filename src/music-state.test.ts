import { describe, expect, it } from 'vitest'
import {
  createMusicState,
  nextTrack,
  previousTrack,
  suggestTrack,
} from './music-state'

describe('music selection state', () => {
  it('wraps next from index 2 to index 0', () => {
    expect(nextTrack(createMusicState(2))).toEqual({
      index: 0,
      playing: false,
      manuallySelected: true,
    })
  })

  it('wraps previous from index 0 to index 2', () => {
    expect(previousTrack(createMusicState(0))).toEqual({
      index: 2,
      playing: false,
      manuallySelected: true,
    })
  })

  it('marks next and previous selections as manual', () => {
    expect(nextTrack(createMusicState()).manuallySelected).toBe(true)
    expect(previousTrack(createMusicState()).manuallySelected).toBe(true)
  })

  it('applies a suggested track before a manual selection', () => {
    expect(suggestTrack(createMusicState(), 2)).toEqual({
      index: 2,
      playing: false,
      manuallySelected: false,
    })
  })

  it('ignores a suggested track after a manual selection', () => {
    const manuallySelected = nextTrack(createMusicState())

    expect(suggestTrack(manuallySelected, 2)).toEqual(manuallySelected)
  })

  it('preserves playing state across track changes and suggestions', () => {
    const playing = { ...createMusicState(1), playing: true }

    expect(nextTrack(playing).playing).toBe(true)
    expect(previousTrack(playing).playing).toBe(true)
    expect(suggestTrack(playing, 2).playing).toBe(true)
  })

  it.each([-1, 3, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    'ignores invalid suggested index %s',
    (index) => {
      const state = createMusicState(1)

      expect(suggestTrack(state, index)).toEqual(state)
    },
  )

  it.each([-1, 3, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    'clamps invalid initial index %s so state stays in range',
    (index) => {
      const state = createMusicState(index)

      expect(state.index).toBeGreaterThanOrEqual(0)
      expect(state.index).toBeLessThanOrEqual(2)
      expect(Number.isInteger(state.index)).toBe(true)
    },
  )
})
