/**
 * @vitest-environment jsdom
 */
/**
 * Property 10: 收藏切换的幂等往返
 * Validates: Requirements 4.1, 4.2
 *
 * For any Track, toggling favorite once SHALL make isFavorite return true;
 * toggling again SHALL make isFavorite return false, and the favorites set
 * returns to its initial state.
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { FavoritesManager, StorageServiceInterface } from '../favorites-manager'
import type { Track } from '../../types/index'

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
 * Creates a mock storage service backed by an in-memory map
 */
function createMockStorage(): StorageServiceInterface {
  const store = new Map<string, unknown>()
  return {
    async save<T>(key: string, data: T): Promise<void> {
      store.set(key, JSON.parse(JSON.stringify(data)))
    },
    async load<T>(key: string, defaultValue: T): Promise<T> {
      if (store.has(key)) {
        return store.get(key) as T
      }
      return defaultValue
    },
  }
}

describe('Property 10: 收藏切换的幂等往返', () => {
  /**
   * **Validates: Requirements 4.1, 4.2**
   *
   * For any Track, toggling favorite once SHALL make isFavorite return true;
   * toggling again SHALL make isFavorite return false, and the favorites set
   * returns to its initial state (empty).
   */
  it('toggle favorite twice returns to initial empty state', async () => {
    await fc.assert(
      fc.asyncProperty(trackArb, async (track) => {
        const mockStorage = createMockStorage()
        const manager = new FavoritesManager(mockStorage)

        // Initial state: track is not a favorite
        await manager.init()
        expect(manager.isFavorite(track.id)).toBe(false)

        // First toggle: should add to favorites
        const firstResult = await manager.toggleFavorite(track)
        expect(firstResult).toBe(true)
        expect(manager.isFavorite(track.id)).toBe(true)

        // Second toggle: should remove from favorites
        const secondResult = await manager.toggleFavorite(track)
        expect(secondResult).toBe(false)
        expect(manager.isFavorite(track.id)).toBe(false)

        // Favorites set returns to initial state (empty)
        const allFavorites = await manager.getAllFavorites()
        expect(allFavorites).toEqual([])
      }),
      { numRuns: 100 }
    )
  })
})
