/**
 * @vitest-environment jsdom
 */
/**
 * Property 6: 歌单创建与删除的逆操作
 * Validates: Requirements 3.1, 3.4
 *
 * For any valid playlist name, creating a playlist SHALL make it exist in the collection;
 * subsequently deleting it SHALL make it no longer exist.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { PlaylistManager } from '../playlist-manager'

describe('Property 6: 歌单创建与删除的逆操作', () => {
  beforeEach(() => {
    // Ensure we are in non-Electron environment (localStorage fallback)
    delete (window as any).electronAPI
    localStorage.clear()
  })

  /**
   * **Validates: Requirements 3.1, 3.4**
   *
   * For any valid playlist name, creating a playlist SHALL make it exist in the collection;
   * subsequently deleting it SHALL make it no longer exist.
   */
  it('creating a playlist makes it exist; deleting it makes it no longer exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (name) => {
          localStorage.clear()

          // Create a fresh PlaylistManager instance
          const manager = new PlaylistManager()
          await manager.init()

          // Create a playlist with the generated name
          const created = await manager.createPlaylist(name)

          // Verify the playlist exists in getAllPlaylists()
          const playlistsAfterCreate = manager.getAllPlaylists()
          const found = playlistsAfterCreate.find((p) => p.id === created.id)
          expect(found).toBeDefined()
          expect(found!.name).toBe(name)

          // Delete the playlist
          await manager.deletePlaylist(created.id)

          // Verify the playlist no longer exists in getAllPlaylists()
          const playlistsAfterDelete = manager.getAllPlaylists()
          const notFound = playlistsAfterDelete.find((p) => p.id === created.id)
          expect(notFound).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})
