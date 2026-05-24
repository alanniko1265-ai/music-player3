/**
 * Property 11: 歌词同步高亮正确性
 * Validates: Requirements 5.2
 *
 * For any lyrics data (LyricLine[] sorted by time ascending) and any play time t,
 * getActiveLine returns index i such that:
 * - If i === -1, then currentTime < lyrics[0].time
 * - If i >= 0, then lyrics[i].time <= currentTime AND (i is the last line OR lyrics[i+1].time > currentTime)
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { LyricLine } from '../../types/index'
import { LyricsService } from '../lyrics-service'

/**
 * Create a LyricsService instance with a dummy adapter (not needed for getActiveLine)
 */
function createLyricsService(): LyricsService {
  const dummyAdapter = {} as any
  return new LyricsService(dummyAdapter)
}

/**
 * Arbitrary generator for sorted LyricLine arrays (1-50 lines, strictly increasing times)
 */
const sortedLyricsArb: fc.Arbitrary<LyricLine[]> = fc
  .array(fc.nat({ max: 100000 }), { minLength: 1, maxLength: 50 })
  .map((values) => {
    // Sort and deduplicate to ensure strictly increasing times
    const uniqueSorted = [...new Set(values)].sort((a, b) => a - b)
    // Ensure at least 1 element remains after dedup
    if (uniqueSorted.length === 0) {
      uniqueSorted.push(0)
    }
    return uniqueSorted.map((time, index) => ({
      time: time / 10, // Convert to seconds with decimal precision
      text: `Lyric line ${index}`,
    }))
  })

/**
 * Arbitrary generator for currentTime values that cover all cases:
 * - Before first lyric line
 * - Between lyric lines
 * - After last lyric line
 * - Exactly on a lyric line time
 */
function currentTimeArb(lyrics: LyricLine[]): fc.Arbitrary<number> {
  const firstTime = lyrics[0].time
  const lastTime = lyrics[lyrics.length - 1].time

  return fc.oneof(
    // Before first line
    fc.double({ min: -10, max: firstTime - 0.001, noNaN: true, noDefaultInfinity: true }),
    // Between lines or on a line
    fc.double({ min: firstTime, max: lastTime + 100, noNaN: true, noDefaultInfinity: true }),
    // Exactly on a line time
    fc.constantFrom(...lyrics.map((l) => l.time))
  )
}

describe('Property 11: 歌词同步高亮正确性', () => {
  const service = createLyricsService()

  /**
   * **Validates: Requirements 5.2**
   *
   * For any sorted lyrics and any currentTime, getActiveLine returns a valid index
   * satisfying the boundary conditions.
   */
  it('getActiveLine returns correct index for any lyrics and currentTime', () => {
    fc.assert(
      fc.property(
        sortedLyricsArb.chain((lyrics) =>
          currentTimeArb(lyrics).map((time) => ({ lyrics, time }))
        ),
        ({ lyrics, time }) => {
          const result = service.getActiveLine(lyrics, time)

          if (result === -1) {
            // If result is -1, currentTime must be before the first lyric line
            expect(time).toBeLessThan(lyrics[0].time)
          } else {
            // result >= 0: lyrics[result].time <= currentTime
            expect(lyrics[result].time).toBeLessThanOrEqual(time)

            // AND (result is the last line OR lyrics[result+1].time > currentTime)
            if (result < lyrics.length - 1) {
              expect(lyrics[result + 1].time).toBeGreaterThan(time)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 5.2**
   *
   * Edge case: when currentTime is exactly on a lyric line's time,
   * that line should be the active line.
   */
  it('getActiveLine returns the exact line when currentTime matches a line time', () => {
    fc.assert(
      fc.property(
        sortedLyricsArb,
        fc.nat(),
        (lyrics, indexSeed) => {
          const index = indexSeed % lyrics.length
          const exactTime = lyrics[index].time

          const result = service.getActiveLine(lyrics, exactTime)

          // The result should be at least the index of the line with that time
          expect(result).toBeGreaterThanOrEqual(index)
          // And lyrics[result].time should equal exactTime (since times are strictly increasing,
          // the only line with that time is at `index`)
          expect(lyrics[result].time).toBe(exactTime)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 5.2**
   *
   * When currentTime is before all lyrics, result should be -1.
   */
  it('getActiveLine returns -1 when currentTime is before all lyrics', () => {
    fc.assert(
      fc.property(
        sortedLyricsArb,
        (lyrics) => {
          const beforeFirst = lyrics[0].time - 1
          const result = service.getActiveLine(lyrics, beforeFirst)

          expect(result).toBe(-1)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 5.2**
   *
   * When currentTime is after all lyrics, result should be the last index.
   */
  it('getActiveLine returns last index when currentTime is after all lyrics', () => {
    fc.assert(
      fc.property(
        sortedLyricsArb,
        (lyrics) => {
          const afterLast = lyrics[lyrics.length - 1].time + 100
          const result = service.getActiveLine(lyrics, afterLast)

          expect(result).toBe(lyrics.length - 1)
        }
      ),
      { numRuns: 100 }
    )
  })
})
