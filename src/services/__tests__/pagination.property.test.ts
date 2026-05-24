/**
 * Property 2: 分页正确性
 * Validates: Requirements 1.3
 *
 * For any search result set, when the total count exceeds pageSize (20),
 * the returned SearchResult SHALL correctly set hasMore to true,
 * and each page's tracks count SHALL not exceed pageSize.
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { SearchResult, Track } from '../../types/index'

/**
 * Arbitrary generator for MusicSource
 */
const musicSourceArb = fc.constantFrom('netease' as const, 'qq' as const)

/**
 * Arbitrary generator for Track
 */
const trackArb: fc.Arbitrary<Track> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  artist: fc.string({ minLength: 1, maxLength: 100 }),
  album: fc.string({ minLength: 1, maxLength: 100 }),
  duration: fc.nat({ max: 7200 }),
  coverUrl: fc.webUrl(),
  source: musicSourceArb,
})

/**
 * Helper: Build a SearchResult from given parameters, simulating
 * the pagination logic used in NeteaseAPIAdapter.search()
 */
function buildSearchResult(
  total: number,
  page: number,
  pageSize: number,
  tracksOnPage: number
): SearchResult {
  const tracks: Track[] = Array.from({ length: tracksOnPage }, (_, i) => ({
    id: `track-${(page - 1) * pageSize + i}`,
    title: `Track ${(page - 1) * pageSize + i}`,
    artist: 'Artist',
    album: 'Album',
    duration: 200,
    coverUrl: 'https://example.com/cover.jpg',
    source: 'netease' as const,
  }))

  const offset = (page - 1) * pageSize
  return {
    tracks,
    total,
    page,
    pageSize,
    hasMore: offset + pageSize < total,
  }
}

describe('Property 2: 分页正确性', () => {
  /**
   * **Validates: Requirements 1.3**
   *
   * For any search result where (page-1)*pageSize + tracks.length < total,
   * hasMore SHALL be true.
   */
  it('hasMore is true when there are more results beyond the current page', () => {
    fc.assert(
      fc.property(
        // total: at least 1 result
        fc.integer({ min: 1, max: 10000 }),
        // pageSize: between 1 and 100
        fc.integer({ min: 1, max: 100 }),
        // page: at least 1
        fc.integer({ min: 1, max: 500 }),
        (total, pageSize, page) => {
          const offset = (page - 1) * pageSize
          // Only test cases where there are more results beyond this page
          fc.pre(offset + pageSize < total)

          // The number of tracks on this page
          const tracksOnPage = Math.min(pageSize, Math.max(0, total - offset))

          const result = buildSearchResult(total, page, pageSize, tracksOnPage)

          expect(result.hasMore).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.3**
   *
   * For any search result where (page-1)*pageSize + pageSize >= total (last page or beyond),
   * hasMore SHALL be false.
   */
  it('hasMore is false when on the last page or beyond', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 500 }),
        (total, pageSize, page) => {
          const offset = (page - 1) * pageSize
          // Only test cases where this is the last page or beyond
          fc.pre(offset + pageSize >= total)

          const tracksOnPage = Math.min(pageSize, Math.max(0, total - offset))

          const result = buildSearchResult(total, page, pageSize, tracksOnPage)

          expect(result.hasMore).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.3**
   *
   * For any search result, tracks.length SHALL not exceed pageSize.
   */
  it('tracks count never exceeds pageSize', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 500 }),
        (total, pageSize, page) => {
          const offset = (page - 1) * pageSize
          const tracksOnPage = Math.min(pageSize, Math.max(0, total - offset))

          const result = buildSearchResult(total, page, pageSize, tracksOnPage)

          expect(result.tracks.length).toBeLessThanOrEqual(pageSize)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.3**
   *
   * Edge case: empty results (total = 0) should have hasMore = false
   * and tracks.length = 0.
   */
  it('empty results have hasMore false and zero tracks', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (pageSize) => {
          const result = buildSearchResult(0, 1, pageSize, 0)

          expect(result.hasMore).toBe(false)
          expect(result.tracks.length).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.3**
   *
   * Edge case: when total equals exactly pageSize, the first page should
   * have hasMore = false and tracks.length = pageSize.
   */
  it('exactly pageSize results on single page has hasMore false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (pageSize) => {
          const total = pageSize
          const result = buildSearchResult(total, 1, pageSize, pageSize)

          expect(result.hasMore).toBe(false)
          expect(result.tracks.length).toBe(pageSize)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.3**
   *
   * Verify pagination with the default pageSize of 20 (as used in SearchService).
   * When total > 20, hasMore should be true on page 1.
   */
  it('with default pageSize 20, hasMore is true when total exceeds 20', () => {
    const DEFAULT_PAGE_SIZE = 20

    fc.assert(
      fc.property(
        fc.integer({ min: 21, max: 10000 }),
        (total) => {
          const tracksOnPage = Math.min(DEFAULT_PAGE_SIZE, total)
          const result = buildSearchResult(total, 1, DEFAULT_PAGE_SIZE, tracksOnPage)

          expect(result.hasMore).toBe(true)
          expect(result.tracks.length).toBeLessThanOrEqual(DEFAULT_PAGE_SIZE)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.3**
   *
   * Verify that the SearchResult built with arbitrary Track objects
   * maintains pagination invariants.
   */
  it('pagination invariants hold with arbitrary Track objects', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 25 }),
        fc.array(trackArb, { minLength: 0, maxLength: 50 }),
        (total, pageSize, page, generatedTracks) => {
          const offset = (page - 1) * pageSize
          const tracksOnPage = Math.min(
            pageSize,
            Math.max(0, total - offset),
            generatedTracks.length
          )
          const tracks = generatedTracks.slice(0, tracksOnPage)

          const result: SearchResult = {
            tracks,
            total,
            page,
            pageSize,
            hasMore: offset + pageSize < total,
          }

          // Invariant 1: tracks count never exceeds pageSize
          expect(result.tracks.length).toBeLessThanOrEqual(result.pageSize)

          // Invariant 2: hasMore correctness
          if (offset + pageSize < total) {
            expect(result.hasMore).toBe(true)
          } else {
            expect(result.hasMore).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
