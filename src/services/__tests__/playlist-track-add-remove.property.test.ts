/**
 * Property 7: 歌单曲目添加与移除的逆操作
 * **Validates: Requirements 3.2, 3.3**
 *
 * For any playlist and Track, adding the Track SHALL make it exist in the playlist's tracks;
 * subsequently removing it SHALL make it no longer exist.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { PlaylistManager } from '../playlist-manager'
import type { Track } from '../../types/index'

// Mock storageService to avoid actual persistence
vi.mock('../ipc-renderer', () => ({
  storageService: {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}))

/**
 * Arbitrary generator for MusicSource
 */
const musicSourceArb = fc.constantFrom('netease' as const, 'qq' as const)

/**
 * Arbitrary generator for Track objects
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

describe('Property 7: 歌单曲目添加与移除的逆操作', () => {
  let manager: PlaylistManager

  beforeEach(async () => {
    manager = new PlaylistManager()
    await manager.init()
  })

  /**
   * **Validates: Requirements 3.2, 3.3**
   *
   * For any playlist and Track, adding the Track SHALL make it exist in the playlist's tracks;
   * subsequently removing it SHALL make it no longer exist.
   */
  it('adding a track makes it exist, then removing it makes it no longer exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        trackArb,
        async (playlistName, track) => {
          // Create a fresh manager for each iteration to avoid state leakage
          const mgr = new PlaylistManager()
          await mgr.init()

          // Create a playlist
          const playlist = await mgr.createPlaylist(playlistName)

          // Add the track to the playlist
          await mgr.addTrack(playlist.id, track)

          // Verify the track exists in the playlist
          const afterAdd = mgr.getPlaylist(playlist.id)
          const trackExistsAfterAdd = afterAdd!.tracks.some((t) => t.id === track.id)
          expect(trackExistsAfterAdd).toBe(true)

          // Remove the track from the playlist
          await mgr.removeTrack(playlist.id, track.id)

          // Verify the track no longer exists in the playlist
          const afterRemove = mgr.getPlaylist(playlist.id)
          const trackExistsAfterRemove = afterRemove!.tracks.some((t) => t.id === track.id)
          expect(trackExistsAfterRemove).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})
