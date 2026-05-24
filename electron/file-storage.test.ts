import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FileStorageService, type StorageSchema } from './file-storage'
import type { PlaybackState, Playlist, Track } from '../src/types/index'

// Mock electron-store
const mockStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn()
}

vi.mock('electron-store', () => ({
  default: vi.fn(() => mockStore)
}))

describe('FileStorageService', () => {
  let service: FileStorageService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new FileStorageService()
  })

  describe('save', () => {
    it('should save playlists data', async () => {
      const playlists: Playlist[] = [
        {
          id: '1',
          name: 'My Playlist',
          tracks: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]

      await service.save('playlists', playlists)
      expect(mockStore.set).toHaveBeenCalledWith('playlists', playlists)
    })

    it('should save favorites data', async () => {
      const favorites: Track[] = [
        {
          id: 'track-1',
          title: 'Song A',
          artist: 'Artist A',
          album: 'Album A',
          duration: 240,
          coverUrl: 'https://example.com/cover.jpg',
          source: 'netease'
        }
      ]

      await service.save('favorites', favorites)
      expect(mockStore.set).toHaveBeenCalledWith('favorites', favorites)
    })

    it('should save searchHistory data', async () => {
      const history = ['周杰伦', '林俊杰', '陈奕迅']

      await service.save('searchHistory', history)
      expect(mockStore.set).toHaveBeenCalledWith('searchHistory', history)
    })

    it('should save playbackState data', async () => {
      const state: PlaybackState = {
        currentTrack: null,
        isPlaying: false,
        currentTime: 120,
        duration: 300,
        volume: 75,
        playMode: 'sequential' as any
      }

      await service.save('playbackState', state)
      expect(mockStore.set).toHaveBeenCalledWith('playbackState', state)
    })
  })

  describe('load', () => {
    it('should load playlists data', async () => {
      const playlists: Playlist[] = [
        {
          id: '1',
          name: 'Test',
          tracks: [],
          createdAt: 1000,
          updatedAt: 1000
        }
      ]
      mockStore.get.mockReturnValue(playlists)

      const result = await service.load('playlists')
      expect(mockStore.get).toHaveBeenCalledWith('playlists')
      expect(result).toEqual(playlists)
    })

    it('should return default value when data does not exist', async () => {
      mockStore.get.mockReturnValue(undefined)

      const result = await service.load('playlists')
      expect(result).toEqual([])
    })

    it('should return default empty array for favorites when not set', async () => {
      mockStore.get.mockReturnValue(undefined)

      const result = await service.load('favorites')
      expect(result).toEqual([])
    })

    it('should return default empty array for searchHistory when not set', async () => {
      mockStore.get.mockReturnValue(undefined)

      const result = await service.load('searchHistory')
      expect(result).toEqual([])
    })

    it('should return default playbackState when not set', async () => {
      mockStore.get.mockReturnValue(undefined)

      const result = await service.load('playbackState')
      expect(result).toEqual({
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 80,
        playMode: 'sequential'
      })
    })
  })

  describe('remove', () => {
    it('should remove data by key', async () => {
      await service.remove('playlists')
      expect(mockStore.delete).toHaveBeenCalledWith('playlists')
    })

    it('should remove favorites', async () => {
      await service.remove('favorites')
      expect(mockStore.delete).toHaveBeenCalledWith('favorites')
    })

    it('should remove searchHistory', async () => {
      await service.remove('searchHistory')
      expect(mockStore.delete).toHaveBeenCalledWith('searchHistory')
    })

    it('should remove playbackState', async () => {
      await service.remove('playbackState')
      expect(mockStore.delete).toHaveBeenCalledWith('playbackState')
    })
  })
})
