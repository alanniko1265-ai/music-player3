/**
 * PlaylistStore 单元测试
 * 测试 Pinia 歌单状态管理的响应式状态和 actions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlaylistStore } from './playlist-store'
import type { Track } from '../types'

// Mock PlaylistManager
vi.mock('../services/playlist-manager', () => {
  let playlists: any[] = []

  return {
    playlistManager: {
      init: vi.fn().mockImplementation(async () => {
        playlists = []
      }),
      getAllPlaylists: vi.fn().mockImplementation(() => [...playlists]),
      createPlaylist: vi.fn().mockImplementation(async (name: string) => {
        const playlist = {
          id: `pl-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name,
          tracks: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        playlists.push(playlist)
        return playlist
      }),
      createPlaylistWithTracks: vi.fn().mockImplementation(async (name: string, tracks: any[]) => {
        const playlist = {
          id: `pl-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name,
          tracks,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        playlists.push(playlist)
        return playlist
      }),
      deletePlaylist: vi.fn().mockImplementation(async (id: string) => {
        const index = playlists.findIndex((p: any) => p.id === id)
        if (index === -1) throw new Error(`Playlist not found: ${id}`)
        playlists.splice(index, 1)
      }),
      renamePlaylist: vi.fn().mockImplementation(async (id: string, newName: string) => {
        const playlist = playlists.find((p: any) => p.id === id)
        if (!playlist) throw new Error(`Playlist not found: ${id}`)
        playlist.name = newName
        playlist.updatedAt = Date.now()
      }),
      addTrack: vi.fn().mockImplementation(async (playlistId: string, track: any) => {
        const playlist = playlists.find((p: any) => p.id === playlistId)
        if (!playlist) throw new Error(`Playlist not found: ${playlistId}`)
        if (!playlist.tracks.some((t: any) => t.id === track.id)) {
          playlist.tracks.push(track)
          playlist.updatedAt = Date.now()
        }
      }),
      removeTrack: vi.fn().mockImplementation(async (playlistId: string, trackId: string) => {
        const playlist = playlists.find((p: any) => p.id === playlistId)
        if (!playlist) throw new Error(`Playlist not found: ${playlistId}`)
        const index = playlist.tracks.findIndex((t: any) => t.id === trackId)
        if (index === -1) throw new Error(`Track not found in playlist: ${trackId}`)
        playlist.tracks.splice(index, 1)
        playlist.updatedAt = Date.now()
      }),
      reorderTracks: vi.fn().mockImplementation(async (playlistId: string, fromIndex: number, toIndex: number) => {
        const playlist = playlists.find((p: any) => p.id === playlistId)
        if (!playlist) throw new Error(`Playlist not found: ${playlistId}`)
        const [moved] = playlist.tracks.splice(fromIndex, 1)
        playlist.tracks.splice(toIndex, 0, moved)
        playlist.updatedAt = Date.now()
      }),
    },
  }
})

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

describe('PlaylistStore', () => {
  let store: ReturnType<typeof usePlaylistStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    store = usePlaylistStore()
    await store.init()
  })

  describe('init', () => {
    it('should initialize with empty playlists', () => {
      expect(store.playlists).toEqual([])
    })

    it('should call playlistManager.init', async () => {
      const { playlistManager } = await import('../services/playlist-manager')
      expect(playlistManager.init).toHaveBeenCalled()
    })
  })

  describe('createPlaylist', () => {
    it('should create a playlist and update reactive state', async () => {
      const playlist = await store.createPlaylist('My Playlist')

      expect(playlist.name).toBe('My Playlist')
      expect(playlist.id).toBeDefined()
      expect(store.playlists).toHaveLength(1)
      expect(store.playlists[0].name).toBe('My Playlist')
    })

    it('should accumulate multiple playlists', async () => {
      await store.createPlaylist('Playlist 1')
      await store.createPlaylist('Playlist 2')

      expect(store.playlists).toHaveLength(2)
    })
  })

  describe('createPlaylistWithTracks', () => {
    it('should create a playlist with imported tracks', async () => {
      const track = createMockTrack('imported-1')
      const playlist = await store.createPlaylistWithTracks('Imported', [track])

      expect(playlist.name).toBe('Imported')
      expect(playlist.tracks).toEqual([track])
      expect(store.playlists[0].tracks).toHaveLength(1)
    })
  })

  describe('deletePlaylist', () => {
    it('should remove playlist from reactive state', async () => {
      const playlist = await store.createPlaylist('To Delete')
      await store.deletePlaylist(playlist.id)

      expect(store.playlists).toHaveLength(0)
    })

    it('should throw when playlist does not exist', async () => {
      await expect(store.deletePlaylist('nonexistent')).rejects.toThrow(
        'Playlist not found: nonexistent'
      )
    })
  })

  describe('renamePlaylist', () => {
    it('should update playlist name in reactive state', async () => {
      const playlist = await store.createPlaylist('Old Name')
      await store.renamePlaylist(playlist.id, 'New Name')

      expect(store.playlists[0].name).toBe('New Name')
    })

    it('should throw when playlist does not exist', async () => {
      await expect(store.renamePlaylist('nonexistent', 'Name')).rejects.toThrow(
        'Playlist not found: nonexistent'
      )
    })
  })

  describe('addTrack', () => {
    it('should add track to playlist in reactive state', async () => {
      const playlist = await store.createPlaylist('My Playlist')
      const track = createMockTrack('t1')

      await store.addTrack(playlist.id, track)

      expect(store.playlists[0].tracks).toHaveLength(1)
      expect(store.playlists[0].tracks[0].id).toBe('t1')
    })

    it('should not add duplicate tracks', async () => {
      const playlist = await store.createPlaylist('My Playlist')
      const track = createMockTrack('t1')

      await store.addTrack(playlist.id, track)
      await store.addTrack(playlist.id, track)

      expect(store.playlists[0].tracks).toHaveLength(1)
    })

    it('should throw when playlist does not exist', async () => {
      const track = createMockTrack('t1')
      await expect(store.addTrack('nonexistent', track)).rejects.toThrow(
        'Playlist not found: nonexistent'
      )
    })
  })

  describe('removeTrack', () => {
    it('should remove track from playlist in reactive state', async () => {
      const playlist = await store.createPlaylist('My Playlist')
      const track = createMockTrack('t1')
      await store.addTrack(playlist.id, track)

      await store.removeTrack(playlist.id, 't1')

      expect(store.playlists[0].tracks).toHaveLength(0)
    })

    it('should throw when track does not exist', async () => {
      const playlist = await store.createPlaylist('My Playlist')
      await expect(store.removeTrack(playlist.id, 'nonexistent')).rejects.toThrow(
        'Track not found in playlist: nonexistent'
      )
    })
  })

  describe('reorderTracks', () => {
    it('should reorder tracks in reactive state', async () => {
      const playlist = await store.createPlaylist('My Playlist')
      await store.addTrack(playlist.id, createMockTrack('t1'))
      await store.addTrack(playlist.id, createMockTrack('t2'))
      await store.addTrack(playlist.id, createMockTrack('t3'))

      await store.reorderTracks(playlist.id, 0, 2)

      const trackIds = store.playlists[0].tracks.map((t) => t.id)
      expect(trackIds).toEqual(['t2', 't3', 't1'])
    })
  })
})
