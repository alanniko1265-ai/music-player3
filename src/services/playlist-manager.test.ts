/**
 * PlaylistManager 单元测试
 * 测试歌单 CRUD 操作和曲目管理功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PlaylistManager } from './playlist-manager'
import type { Track } from '../types'

// Mock storageService
vi.mock('./ipc-renderer', () => ({
  storageService: {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockImplementation(() => Promise.resolve([])),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}))

function createMockTrack(id: string): Track {
  return {
    id,
    title: `Track ${id}`,
    artist: `Artist ${id}`,
    album: `Album ${id}`,
    duration: 200,
    coverUrl: `https://example.com/cover-${id}.jpg`,
    source: 'netease',
  }
}

describe('PlaylistManager', () => {
  let manager: PlaylistManager

  beforeEach(async () => {
    manager = new PlaylistManager()
    await manager.init()
  })

  describe('createPlaylist', () => {
    it('should create a playlist with the given name', async () => {
      const playlist = await manager.createPlaylist('My Playlist')

      expect(playlist.name).toBe('My Playlist')
      expect(playlist.id).toBeDefined()
      expect(playlist.tracks).toEqual([])
      expect(playlist.createdAt).toBeGreaterThan(0)
      expect(playlist.updatedAt).toBe(playlist.createdAt)
    })

    it('should assign unique IDs to different playlists', async () => {
      const p1 = await manager.createPlaylist('Playlist 1')
      const p2 = await manager.createPlaylist('Playlist 2')

      expect(p1.id).not.toBe(p2.id)
    })

    it('should add the playlist to the collection', async () => {
      await manager.createPlaylist('Test')

      const all = manager.getAllPlaylists()
      expect(all).toHaveLength(1)
      expect(all[0].name).toBe('Test')
    })
  })

  describe('createPlaylistWithTracks', () => {
    it('should create a playlist with tracks in one persist operation', async () => {
      const { storageService } = await import('./ipc-renderer')
      vi.mocked(storageService.save).mockClear()
      const playlist = await manager.createPlaylistWithTracks('Imported', [
        createMockTrack('t1'),
        createMockTrack('t2'),
      ])

      expect(playlist.name).toBe('Imported')
      expect(playlist.tracks.map((track) => track.id)).toEqual(['t1', 't2'])
      expect(storageService.save).toHaveBeenCalledTimes(1)
    })

    it('should skip duplicate imported tracks', async () => {
      const playlist = await manager.createPlaylistWithTracks('Imported', [
        createMockTrack('t1'),
        createMockTrack('t1'),
      ])

      expect(playlist.tracks).toHaveLength(1)
    })
  })

  describe('deletePlaylist', () => {
    it('should remove the playlist from the collection', async () => {
      const playlist = await manager.createPlaylist('To Delete')
      await manager.deletePlaylist(playlist.id)

      const all = manager.getAllPlaylists()
      expect(all).toHaveLength(0)
    })

    it('should throw when playlist does not exist', async () => {
      await expect(manager.deletePlaylist('nonexistent')).rejects.toThrow(
        'Playlist not found: nonexistent'
      )
    })
  })

  describe('renamePlaylist', () => {
    it('should update the playlist name', async () => {
      const playlist = await manager.createPlaylist('Old Name')
      await manager.renamePlaylist(playlist.id, 'New Name')

      const updated = manager.getPlaylist(playlist.id)
      expect(updated?.name).toBe('New Name')
    })

    it('should update the updatedAt timestamp', async () => {
      const playlist = await manager.createPlaylist('Test')
      const originalUpdatedAt = playlist.updatedAt

      // Small delay to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 5))
      await manager.renamePlaylist(playlist.id, 'Renamed')

      const updated = manager.getPlaylist(playlist.id)
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })

    it('should throw when playlist does not exist', async () => {
      await expect(manager.renamePlaylist('nonexistent', 'Name')).rejects.toThrow(
        'Playlist not found: nonexistent'
      )
    })
  })

  describe('addTrack', () => {
    it('should add a track to the playlist', async () => {
      const playlist = await manager.createPlaylist('My Playlist')
      const track = createMockTrack('t1')

      await manager.addTrack(playlist.id, track)

      const updated = manager.getPlaylist(playlist.id)
      expect(updated!.tracks).toHaveLength(1)
      expect(updated!.tracks[0].id).toBe('t1')
    })

    it('should not add duplicate tracks', async () => {
      const playlist = await manager.createPlaylist('My Playlist')
      const track = createMockTrack('t1')

      await manager.addTrack(playlist.id, track)
      await manager.addTrack(playlist.id, track)

      const updated = manager.getPlaylist(playlist.id)
      expect(updated!.tracks).toHaveLength(1)
    })

    it('should throw when playlist does not exist', async () => {
      const track = createMockTrack('t1')
      await expect(manager.addTrack('nonexistent', track)).rejects.toThrow(
        'Playlist not found: nonexistent'
      )
    })
  })

  describe('removeTrack', () => {
    it('should remove a track from the playlist', async () => {
      const playlist = await manager.createPlaylist('My Playlist')
      const track = createMockTrack('t1')
      await manager.addTrack(playlist.id, track)

      await manager.removeTrack(playlist.id, 't1')

      const updated = manager.getPlaylist(playlist.id)
      expect(updated!.tracks).toHaveLength(0)
    })

    it('should throw when track does not exist in playlist', async () => {
      const playlist = await manager.createPlaylist('My Playlist')

      await expect(manager.removeTrack(playlist.id, 'nonexistent')).rejects.toThrow(
        'Track not found in playlist: nonexistent'
      )
    })

    it('should throw when playlist does not exist', async () => {
      await expect(manager.removeTrack('nonexistent', 't1')).rejects.toThrow(
        'Playlist not found: nonexistent'
      )
    })
  })

  describe('reorderTracks', () => {
    it('should move a track from one position to another', async () => {
      const playlist = await manager.createPlaylist('My Playlist')
      await manager.addTrack(playlist.id, createMockTrack('t1'))
      await manager.addTrack(playlist.id, createMockTrack('t2'))
      await manager.addTrack(playlist.id, createMockTrack('t3'))

      // Move t1 (index 0) to index 2
      await manager.reorderTracks(playlist.id, 0, 2)

      const updated = manager.getPlaylist(playlist.id)
      expect(updated!.tracks.map((t) => t.id)).toEqual(['t2', 't3', 't1'])
    })

    it('should handle moving to the same position', async () => {
      const playlist = await manager.createPlaylist('My Playlist')
      await manager.addTrack(playlist.id, createMockTrack('t1'))
      await manager.addTrack(playlist.id, createMockTrack('t2'))

      await manager.reorderTracks(playlist.id, 0, 0)

      const updated = manager.getPlaylist(playlist.id)
      expect(updated!.tracks.map((t) => t.id)).toEqual(['t1', 't2'])
    })

    it('should throw for invalid fromIndex', async () => {
      const playlist = await manager.createPlaylist('My Playlist')
      await manager.addTrack(playlist.id, createMockTrack('t1'))

      await expect(manager.reorderTracks(playlist.id, -1, 0)).rejects.toThrow(
        'Invalid fromIndex: -1'
      )
      await expect(manager.reorderTracks(playlist.id, 5, 0)).rejects.toThrow(
        'Invalid fromIndex: 5'
      )
    })

    it('should throw for invalid toIndex', async () => {
      const playlist = await manager.createPlaylist('My Playlist')
      await manager.addTrack(playlist.id, createMockTrack('t1'))

      await expect(manager.reorderTracks(playlist.id, 0, -1)).rejects.toThrow(
        'Invalid toIndex: -1'
      )
      await expect(manager.reorderTracks(playlist.id, 0, 5)).rejects.toThrow(
        'Invalid toIndex: 5'
      )
    })

    it('should throw when playlist does not exist', async () => {
      await expect(manager.reorderTracks('nonexistent', 0, 1)).rejects.toThrow(
        'Playlist not found: nonexistent'
      )
    })
  })

  describe('getPlaylist', () => {
    it('should return the playlist by ID', async () => {
      const playlist = await manager.createPlaylist('Test')

      const found = manager.getPlaylist(playlist.id)
      expect(found).toBeDefined()
      expect(found!.name).toBe('Test')
    })

    it('should return undefined for non-existent ID', () => {
      const found = manager.getPlaylist('nonexistent')
      expect(found).toBeUndefined()
    })
  })

  describe('getAllPlaylists', () => {
    it('should return empty array initially', () => {
      const all = manager.getAllPlaylists()
      expect(all).toEqual([])
    })

    it('should return all created playlists', async () => {
      await manager.createPlaylist('Playlist 1')
      await manager.createPlaylist('Playlist 2')
      await manager.createPlaylist('Playlist 3')

      const all = manager.getAllPlaylists()
      expect(all).toHaveLength(3)
    })
  })

  describe('persistence', () => {
    it('should call storageService.save after createPlaylist', async () => {
      const { storageService } = await import('./ipc-renderer')
      await manager.createPlaylist('Test')

      expect(storageService.save).toHaveBeenCalledWith('playlists', expect.any(Array))
    })

    it('should call storageService.save after deletePlaylist', async () => {
      const { storageService } = await import('./ipc-renderer')
      const playlist = await manager.createPlaylist('Test')
      await manager.deletePlaylist(playlist.id)

      expect(storageService.save).toHaveBeenCalledWith('playlists', expect.any(Array))
    })

    it('should call storageService.save after addTrack', async () => {
      const { storageService } = await import('./ipc-renderer')
      const playlist = await manager.createPlaylist('Test')
      await manager.addTrack(playlist.id, createMockTrack('t1'))

      expect(storageService.save).toHaveBeenCalledWith('playlists', expect.any(Array))
    })

    it('should call storageService.save after removeTrack', async () => {
      const { storageService } = await import('./ipc-renderer')
      const playlist = await manager.createPlaylist('Test')
      await manager.addTrack(playlist.id, createMockTrack('t1'))
      await manager.removeTrack(playlist.id, 't1')

      expect(storageService.save).toHaveBeenCalledWith('playlists', expect.any(Array))
    })

    it('should call storageService.save after reorderTracks', async () => {
      const { storageService } = await import('./ipc-renderer')
      const playlist = await manager.createPlaylist('Test')
      await manager.addTrack(playlist.id, createMockTrack('t1'))
      await manager.addTrack(playlist.id, createMockTrack('t2'))
      await manager.reorderTracks(playlist.id, 0, 1)

      expect(storageService.save).toHaveBeenCalledWith('playlists', expect.any(Array))
    })

    it('should call storageService.load on init', async () => {
      const { storageService } = await import('./ipc-renderer')
      const newManager = new PlaylistManager()
      await newManager.init()

      expect(storageService.load).toHaveBeenCalledWith('playlists', [])
    })
  })
})
