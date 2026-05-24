/**
 * @vitest-environment jsdom
 */
/**
 * Property 8: 歌单重命名保持曲目不变
 * Validates: Requirements 3.5
 *
 * For any playlist and any new name, renaming the playlist SHALL NOT change
 * its tracks list (order and content remain identical).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { PlaylistManager } from '../playlist-manager'
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
 * Arbitrary generator for playlist name (non-empty string)
 */
const playlistNameArb = fc.string({ minLength: 1, maxLength: 100 })

describe('Property 8: 歌单重命名保持曲目不变', () => {
  beforeEach(() => {
    // Use localStorage fallback (non-Electron environment)
    delete (window as any).electronAPI
    localStorage.clear()
  })

  /**
   * **Validates: Requirements 3.5**
   *
   * For any playlist and any new name, renaming the playlist SHALL NOT change
   * its tracks list (order and content remain identical).
   */
  it('renaming a playlist preserves its tracks list unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        playlistNameArb,
        playlistNameArb,
        fc.array(trackArb, { minLength: 0, maxLength: 10 }),
        async (originalName, newName, tracks) => {
          localStorage.clear()

          // Create a PlaylistManager and create a playlist
          const manager = new PlaylistManager()
          await manager.init()
          const playlist = await manager.createPlaylist(originalName)

          // Add tracks to the playlist (use unique IDs to avoid dedup)
          const uniqueTracks = tracks.map((t, i) => ({ ...t, id: `${t.id}_${i}` }))
          for (const track of uniqueTracks) {
            await manager.addTrack(playlist.id, track)
          }

          // Record tracks before rename
          const tracksBefore = manager.getPlaylist(playlist.id)!.tracks.map((t) => ({ ...t }))

          // Rename the playlist
          await manager.renamePlaylist(playlist.id, newName)

          // Get tracks after rename
          const tracksAfter = manager.getPlaylist(playlist.id)!.tracks

          // Assert tracks after rename are deeply equal to tracks before rename
          expect(tracksAfter).toEqual(tracksBefore)
        }
      ),
      { numRuns: 100 }
    )
  })
})
