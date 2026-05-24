/**
 * @vitest-environment jsdom
 */
/**
 * Property 3: 播放进度跳转正确性
 * Validates: Requirements 2.3, 5.3
 *
 * For any valid seek position (0 ≤ position ≤ duration), after calling seek(position),
 * the PlaybackController's currentTime SHALL equal that position value.
 * For positions outside the valid range (negative or > duration), the value SHALL be clamped to [0, duration].
 */
import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { PlaybackController } from '../playback-controller'
import type { MusicAPIAdapter } from '../music-api-adapter'

/** Create a mock MusicAPIAdapter */
function createMockAPIAdapter(): MusicAPIAdapter {
  return {
    search: vi.fn(),
    getTrackUrl: vi.fn().mockResolvedValue('https://example.com/audio.mp3'),
    getLyrics: vi.fn().mockResolvedValue([]),
    getSearchSuggestions: vi.fn().mockResolvedValue([]),
  } as unknown as MusicAPIAdapter
}

/** Create a mock HTMLAudioElement with a configurable duration */
function createMockAudio(duration: number): HTMLAudioElement {
  let currentTime = 0

  const audio = {
    currentTime: 0,
    duration,
    volume: 1,
    src: '',
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLAudioElement

  // Make currentTime behave like a real property (get/set)
  Object.defineProperty(audio, 'currentTime', {
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value
    },
    configurable: true,
  })

  return audio
}

/** Clamp helper matching the implementation */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

describe('Property 3: 播放进度跳转正确性', () => {
  /**
   * **Validates: Requirements 2.3, 5.3**
   */
  it('seek(position) within [0, duration] sets currentTime to exactly that position', () => {
    fc.assert(
      fc.property(
        // Generate duration between 1 and 7200 seconds
        fc.integer({ min: 1, max: 7200 }),
        // Generate a position factor in [0, 1] to derive a valid position within [0, duration]
        fc.double({ min: 0, max: 1, noNaN: true }),
        (duration: number, factor: number) => {
          const position = factor * duration
          const mockAudio = createMockAudio(duration)
          const mockAdapter = createMockAPIAdapter()
          const controller = new PlaybackController(mockAdapter, mockAudio)

          controller.seek(position)

          const expectedTime = clamp(position, 0, duration)
          expect(mockAudio.currentTime).toBeCloseTo(expectedTime, 10)

          controller.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 2.3, 5.3**
   */
  it('seek(position) with negative values clamps currentTime to 0', () => {
    fc.assert(
      fc.property(
        // Generate duration between 1 and 7200 seconds
        fc.integer({ min: 1, max: 7200 }),
        // Generate negative positions
        fc.double({ min: -7200, max: -0.001, noNaN: true }),
        (duration: number, negativePosition: number) => {
          const mockAudio = createMockAudio(duration)
          const mockAdapter = createMockAPIAdapter()
          const controller = new PlaybackController(mockAdapter, mockAudio)

          controller.seek(negativePosition)

          expect(mockAudio.currentTime).toBe(0)

          controller.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 2.3, 5.3**
   */
  it('seek(position) with values > duration clamps currentTime to duration', () => {
    fc.assert(
      fc.property(
        // Generate duration between 1 and 7200 seconds
        fc.integer({ min: 1, max: 7200 }),
        // Generate a positive offset beyond duration
        fc.double({ min: 0.001, max: 7200, noNaN: true }),
        (duration: number, offset: number) => {
          const positionBeyondDuration = duration + offset
          const mockAudio = createMockAudio(duration)
          const mockAdapter = createMockAPIAdapter()
          const controller = new PlaybackController(mockAdapter, mockAudio)

          controller.seek(positionBeyondDuration)

          expect(mockAudio.currentTime).toBeCloseTo(duration, 10)

          controller.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })
})
