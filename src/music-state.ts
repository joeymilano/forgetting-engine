const TRACK_COUNT = 3

export interface MusicState {
  index: number
  playing: boolean
  manuallySelected: boolean
}

function normalizeIndex(index: number): number {
  if (!Number.isFinite(index)) return 0
  return Math.min(TRACK_COUNT - 1, Math.max(0, Math.trunc(index)))
}

function isValidIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < TRACK_COUNT
}

export function createMusicState(index = 0): MusicState {
  return {
    index: normalizeIndex(index),
    playing: false,
    manuallySelected: false,
  }
}

export function nextTrack(state: MusicState): MusicState {
  return {
    ...state,
    index: (normalizeIndex(state.index) + 1) % TRACK_COUNT,
    manuallySelected: true,
  }
}

export function previousTrack(state: MusicState): MusicState {
  return {
    ...state,
    index: (normalizeIndex(state.index) + TRACK_COUNT - 1) % TRACK_COUNT,
    manuallySelected: true,
  }
}

export function suggestTrack(state: MusicState, index: number): MusicState {
  if (state.manuallySelected || !isValidIndex(index)) return state

  return {
    ...state,
    index,
  }
}
