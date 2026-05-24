/**
 * @vitest-environment jsdom
 */
/**
 * Property 14: 播放状态恢复往返
 * Validates: Requirements 7.4
 *
 * For any valid PlaybackState object (containing currentTrack, currentTime, volume, playMode),
 * saving the state and then reloading SHALL restore an equivalent playback state.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { storageService } from '../ipc-renderer'
import { PlayMode } from '../../types/index'
import type { PlaybackState, Track, MusicSource } from '../../types/index'

/** Arbitrary for MusicSource */
const musicSourceArb: fc.Arbitrary<MusicSource> = fc.constantFrom('netease', 'qq')

/** Arbitrary for a valid Track */
const trackArb: fc.Arbitrary<Track> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  artist: fc.string({ minLength: 1, maxLength: 100 }),
  album: fc.string({ minLength: 1, maxLength: 100 }),
  duration: fc.nat({ max: 7200 }), // 0 to 2 hours in seconds
  coverUrl: fc.webUrl(),
  source: musicSourceArb,
})

/** Arbitrary for PlayMode enum */
const playModeArb: fc.Arbitrary<PlayMode> = fc.constantFrom(
  PlayMode.Sequential,
  PlayMode.Shuffle,
  PlayMode.RepeatOne
)

/** Arbitrary for a valid PlaybackState */
const playbackStateArb: fc.Arbitrary<PlaybackState> = fc.record({
  currentTrack: fc.option(trackArb, { nil: null }),
  isPlaying: fc.boolean(),
  currentTime: fc.nat({ max: 7200 }),
  duration: fc.nat({ max: 7200 }),
  volume: fc.integer({ min: 0, max: 100 }),
  playMode: playModeArb,
})

const STORAGE_KEY = 'playbackState'

describe('Property 14: 播放状态恢复往返', () => {
  beforeEach(() => {
    // Clear localStorage before each test to ensure isolation
    localStorage.clear()
    // Ensure we are NOT in Electron environment (use localStorage fallback)
    delete (window as any).electronAPI
  })

  /**
   * **Validates: Requirements 7.4**
   */
  it('saving and loading a PlaybackState should restore an equivalent state', () => {
    fc.assert(
      fc.asyncProperty(playbackStateArb, async (state: PlaybackState) => {
        // Save the playback state
        await storageService.save(STORAGE_KEY, state)

        // Load it back
        const defaultState: PlaybackState = {
          currentTrack: null,
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          volume: 80,
          playMode: PlayMode.Sequential,
        }
        const loaded = await storageService.load<PlaybackState>(STORAGE_KEY, defaultState)

        // Assert the loaded state equals the original
        expect(loaded).toEqual(state)
      }),
      { numRuns: 100 }
    )
  })
})
