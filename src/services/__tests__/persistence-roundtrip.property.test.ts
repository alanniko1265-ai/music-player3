/**
 * @vitest-environment jsdom
 */
/**
 * Property 13: 用户数据持久化往返
 * Validates: Requirements 7.3
 *
 * For any valid UserData object (containing playlists, favorites, searchHistory),
 * executing save followed by load SHALL return an object equivalent to the original data.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { storageService } from '../ipc-renderer'
import type { Track, Playlist } from '../../types/index'

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
  duration: fc.nat({ max: 7200 }), // 0 to 2 hours in seconds
  coverUrl: fc.webUrl(),
  source: musicSourceArb,
})

/**
 * Arbitrary generator for Playlist
 */
const playlistArb: fc.Arbitrary<Playlist> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  tracks: fc.array(trackArb, { minLength: 0, maxLength: 10 }),
  createdAt: fc.nat({ max: 2000000000000 }),
  updatedAt: fc.nat({ max: 2000000000000 }),
})

/**
 * Arbitrary generator for searchHistory (array of non-empty strings)
 */
const searchHistoryArb = fc.array(
  fc.string({ minLength: 1, maxLength: 50 }),
  { minLength: 0, maxLength: 20 }
)

describe('Property 13: 用户数据持久化往返', () => {
  beforeEach(() => {
    // Ensure we are in non-Electron environment (localStorage fallback)
    delete (window as any).electronAPI
    localStorage.clear()
  })

  /**
   * **Validates: Requirements 7.3**
   *
   * For any valid UserData object (containing playlists, favorites, searchHistory),
   * executing save followed by load SHALL return an object equivalent to the original data.
   */
  it('save followed by load returns equivalent playlists data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(playlistArb, { minLength: 0, maxLength: 5 }),
        async (playlists) => {
          localStorage.clear()

          await storageService.save('playlists', playlists)
          const loaded = await storageService.load<Playlist[]>('playlists', [])

          expect(loaded).toEqual(playlists)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('save followed by load returns equivalent favorites data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(trackArb, { minLength: 0, maxLength: 10 }),
        async (favorites) => {
          localStorage.clear()

          await storageService.save('favorites', favorites)
          const loaded = await storageService.load<Track[]>('favorites', [])

          expect(loaded).toEqual(favorites)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('save followed by load returns equivalent searchHistory data', async () => {
    await fc.assert(
      fc.asyncProperty(
        searchHistoryArb,
        async (searchHistory) => {
          localStorage.clear()

          await storageService.save('searchHistory', searchHistory)
          const loaded = await storageService.load<string[]>('searchHistory', [])

          expect(loaded).toEqual(searchHistory)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('save followed by load returns equivalent combined UserData', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(playlistArb, { minLength: 0, maxLength: 5 }),
        fc.array(trackArb, { minLength: 0, maxLength: 10 }),
        searchHistoryArb,
        async (playlists, favorites, searchHistory) => {
          localStorage.clear()

          // Save each piece of user data
          await storageService.save('playlists', playlists)
          await storageService.save('favorites', favorites)
          await storageService.save('searchHistory', searchHistory)

          // Load each piece back
          const loadedPlaylists = await storageService.load<Playlist[]>('playlists', [])
          const loadedFavorites = await storageService.load<Track[]>('favorites', [])
          const loadedHistory = await storageService.load<string[]>('searchHistory', [])

          // Assert equivalence
          expect(loadedPlaylists).toEqual(playlists)
          expect(loadedFavorites).toEqual(favorites)
          expect(loadedHistory).toEqual(searchHistory)
        }
      ),
      { numRuns: 100 }
    )
  })
})
