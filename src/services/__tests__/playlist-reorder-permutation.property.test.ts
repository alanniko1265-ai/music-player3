/**
 * @vitest-environment jsdom
 */
/**
 * Property 9: 歌单重排序是置换操作
 * **Validates: Requirements 3.7**
 *
 * For any playlist and valid reorder operation (fromIndex, toIndex),
 * the reordered tracks list SHALL be a permutation of the original
 * (same elements, possibly different order).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
import type { Track } from '../../types/index'

// Mock the storageService from ipc-renderer
vi.mock('../ipc-renderer', () => ({
  storageService: {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}))

import { PlaylistManager } from '../playlist-manager'

/**
 * Arbitrary generator for MusicSource
 */
const musicSourceArb = fc.constantFrom('netease' as const, 'qq' as const)

/**
 * Arbitrary generator for Track with a given unique ID
 */
function trackWithIdArb(id: string): fc.Arbitrary<Track> {
  return fc.record({
    id: fc.constant(id),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    artist: fc.string({ minLength: 1, maxLength: 50 }),
    album: fc.string({ minLength: 1, maxLength: 50 }),
    duration: fc.nat({ max: 7200 }),
    coverUrl: fc.webUrl(),
    source: musicSourceArb,
  })
}

/**
 * Generate a tuple of (tracks with unique IDs, fromIndex, toIndex)
 * where indices are valid for the generated track list (2-20 tracks).
 */
const reorderInputArb: fc.Arbitrary<{ tracks: Track[]; fromIndex: number; toIndex: number }> = fc
  .integer({ min: 2, max: 20 })
  .chain((count) => {
    const trackArbs = Array.from({ length: count }, (_, i) => trackWithIdArb(`track-${i}`))
    return fc.tuple(
      fc.tuple(...(trackArbs as [fc.Arbitrary<Track>, ...fc.Arbitrary<Track>[]])).map((tuple) => [...tuple]),
      fc.integer({ min: 0, max: count - 1 }),
      fc.integer({ min: 0, max: count - 1 })
    )
  })
  .map(([tracks, fromIndex, toIndex]) => ({ tracks, fromIndex, toIndex }))

describe('Property 9: 歌单重排序是置换操作', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * **Validates: Requirements 3.7**
   *
   * For any playlist and valid reorder operation (fromIndex, toIndex),
   * the reordered tracks list SHALL be a permutation of the original
   * (same elements, possibly different order).
   */
  it('reorderTracks produces a permutation of the original tracks', async () => {
    await fc.assert(
      fc.asyncProperty(reorderInputArb, async ({ tracks, fromIndex, toIndex }) => {
        // Create a PlaylistManager and initialize
        const manager = new PlaylistManager()
        await manager.init()

        // Create a playlist and add all tracks
        const playlist = await manager.createPlaylist('test-playlist')

        for (const track of tracks) {
          await manager.addTrack(playlist.id, track)
        }

        // Record track IDs before reorder
        const beforeReorder = manager.getPlaylist(playlist.id)!.tracks.map((t) => t.id)

        // Perform reorder
        await manager.reorderTracks(playlist.id, fromIndex, toIndex)

        // Get track IDs after reorder
        const afterReorder = manager.getPlaylist(playlist.id)!.tracks.map((t) => t.id)

        // Assert: same length
        expect(afterReorder.length).toBe(beforeReorder.length)

        // Assert: same set of track IDs (permutation)
        const sortedBefore = [...beforeReorder].sort()
        const sortedAfter = [...afterReorder].sort()
        expect(sortedAfter).toEqual(sortedBefore)
      }),
      { numRuns: 100 }
    )
  })
})
