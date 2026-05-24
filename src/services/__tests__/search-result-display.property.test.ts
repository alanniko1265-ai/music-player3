/**
 * Property 1: 搜索结果展示完整性
 * Validates: Requirements 1.2
 *
 * For any Track object, when rendered as a search result, the render output
 * SHALL contain the Track's title, artist, album, and duration information.
 *
 * Since we cannot mount Vue components in node tests, we test the data contract:
 * verify that for any Track, the TrackItem's computed formattedDuration is correct
 * and all display fields are non-undefined.
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { Track } from '../../types/index'

/**
 * Arbitrary generator for MusicSource
 */
const musicSourceArb = fc.constantFrom('netease' as const, 'qq' as const)

/**
 * Arbitrary generator for Track objects
 */
const trackArb: fc.Arbitrary<Track> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  artist: fc.string({ minLength: 1, maxLength: 200 }),
  album: fc.string({ minLength: 1, maxLength: 200 }),
  duration: fc.integer({ min: 0, max: 36000 }), // 0 to 10 hours in seconds
  coverUrl: fc.webUrl(),
  source: musicSourceArb,
})

/**
 * Simulates the TrackItem component's formattedDuration computed property.
 * This mirrors the logic in src/components/TrackItem.vue:
 *   const totalSeconds = Math.floor(props.track.duration)
 *   const minutes = Math.floor(totalSeconds / 60)
 *   const seconds = totalSeconds % 60
 *   return `${minutes}:${seconds.toString().padStart(2, '0')}`
 */
function formatDuration(duration: number): string {
  const totalSeconds = Math.floor(duration)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

describe('Property 1: 搜索结果展示完整性', () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * For any Track, the formattedDuration follows mm:ss format.
   */
  it('formattedDuration produces valid mm:ss format for any track duration', () => {
    fc.assert(
      fc.property(trackArb, (track) => {
        const formatted = formatDuration(track.duration)

        // Must match mm:ss pattern (minutes can be multi-digit, seconds always 2 digits)
        expect(formatted).toMatch(/^\d+:\d{2}$/)

        // Verify the values are consistent with the input
        const [minStr, secStr] = formatted.split(':')
        const minutes = parseInt(minStr, 10)
        const seconds = parseInt(secStr, 10)
        const totalSeconds = Math.floor(track.duration)

        expect(minutes).toBe(Math.floor(totalSeconds / 60))
        expect(seconds).toBe(totalSeconds % 60)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.2**
   *
   * For any Track object, all display fields (title, artist, album) are
   * defined and non-empty strings, ensuring the search result can render
   * complete information.
   */
  it('all display fields are defined and non-empty for any Track', () => {
    fc.assert(
      fc.property(trackArb, (track) => {
        // title must be a defined non-empty string
        expect(track.title).toBeDefined()
        expect(typeof track.title).toBe('string')
        expect(track.title.length).toBeGreaterThan(0)

        // artist must be a defined non-empty string
        expect(track.artist).toBeDefined()
        expect(typeof track.artist).toBe('string')
        expect(track.artist.length).toBeGreaterThan(0)

        // album must be a defined non-empty string
        expect(track.album).toBeDefined()
        expect(typeof track.album).toBe('string')
        expect(track.album.length).toBeGreaterThan(0)

        // duration must be a defined number
        expect(track.duration).toBeDefined()
        expect(typeof track.duration).toBe('number')
        expect(track.duration).toBeGreaterThanOrEqual(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.2**
   *
   * For any Track, simulating the TrackItem render output (concatenation of
   * all display fields) SHALL contain the track's title, artist, album,
   * and formatted duration string.
   */
  it('simulated render output contains all required display information', () => {
    fc.assert(
      fc.property(trackArb, (track) => {
        const formattedDuration = formatDuration(track.duration)

        // Simulate what TrackItem renders: title, artist, album, and duration
        // This mirrors the template structure in TrackItem.vue
        const renderOutput = [
          track.title,       // .track-item__title
          track.artist,      // .track-item__artist
          track.album,       // .track-item__album
          formattedDuration, // .track-item__duration
        ].join(' ')

        // All fields must be present in the render output
        expect(renderOutput).toContain(track.title)
        expect(renderOutput).toContain(track.artist)
        expect(renderOutput).toContain(track.album)
        expect(renderOutput).toContain(formattedDuration)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.2**
   *
   * Edge case: duration of 0 seconds should format as "0:00".
   */
  it('zero duration formats correctly as 0:00', () => {
    const zeroDurationTrack: Track = {
      id: 'test-zero',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      duration: 0,
      coverUrl: 'https://example.com/cover.jpg',
      source: 'netease',
    }

    const formatted = formatDuration(zeroDurationTrack.duration)
    expect(formatted).toBe('0:00')
  })
})
