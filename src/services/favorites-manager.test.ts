/**
 * FavoritesManager 单元测试
 * 使用 mocked storageService 验证收藏管理功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FavoritesManager, StorageServiceInterface } from './favorites-manager'
import type { Track } from '@/types'

/** 创建测试用 Track */
function createTrack(id: string, title = 'Test Track'): Track {
  return {
    id,
    title,
    artist: 'Test Artist',
    album: 'Test Album',
    duration: 240,
    coverUrl: 'https://example.com/cover.jpg',
    source: 'netease',
  }
}

/** 创建 mock storageService */
function createMockStorage(initialData: Track[] = []): StorageServiceInterface {
  let stored: Track[] = [...initialData]
  return {
    save: vi.fn(async (_key: string, data: unknown) => {
      stored = data as Track[]
    }),
    load: vi.fn(async <T>(_key: string, defaultValue: T): Promise<T> => {
      return (stored.length > 0 ? stored : defaultValue) as T
    }),
  }
}

describe('FavoritesManager', () => {
  let manager: FavoritesManager
  let mockStorage: StorageServiceInterface

  beforeEach(() => {
    mockStorage = createMockStorage()
    manager = new FavoritesManager(mockStorage)
  })

  describe('init', () => {
    it('should load favorites from storage on initialization', async () => {
      const tracks = [createTrack('1'), createTrack('2')]
      mockStorage = createMockStorage(tracks)
      manager = new FavoritesManager(mockStorage)

      await manager.init()

      expect(mockStorage.load).toHaveBeenCalledWith('favorites', [])
      const favorites = await manager.getAllFavorites()
      expect(favorites).toHaveLength(2)
      expect(favorites[0].id).toBe('1')
      expect(favorites[1].id).toBe('2')
    })

    it('should only initialize once', async () => {
      await manager.init()
      await manager.init()

      expect(mockStorage.load).toHaveBeenCalledTimes(1)
    })

    it('should default to empty array when no stored data', async () => {
      await manager.init()

      const favorites = await manager.getAllFavorites()
      expect(favorites).toHaveLength(0)
    })
  })

  describe('toggleFavorite', () => {
    it('should add track to favorites and return true', async () => {
      const track = createTrack('1')

      const result = await manager.toggleFavorite(track)

      expect(result).toBe(true)
      expect(manager.isFavorite('1')).toBe(true)
    })

    it('should remove track from favorites and return false', async () => {
      const track = createTrack('1')
      await manager.toggleFavorite(track) // add

      const result = await manager.toggleFavorite(track) // remove

      expect(result).toBe(false)
      expect(manager.isFavorite('1')).toBe(false)
    })

    it('should persist after adding a favorite', async () => {
      const track = createTrack('1')

      await manager.toggleFavorite(track)

      expect(mockStorage.save).toHaveBeenCalledWith('favorites', [track])
    })

    it('should persist after removing a favorite', async () => {
      const track = createTrack('1')
      await manager.toggleFavorite(track) // add

      await manager.toggleFavorite(track) // remove

      expect(mockStorage.save).toHaveBeenLastCalledWith('favorites', [])
    })

    it('should handle multiple tracks independently', async () => {
      const track1 = createTrack('1', 'Song A')
      const track2 = createTrack('2', 'Song B')
      const track3 = createTrack('3', 'Song C')

      await manager.toggleFavorite(track1)
      await manager.toggleFavorite(track2)
      await manager.toggleFavorite(track3)

      expect(manager.isFavorite('1')).toBe(true)
      expect(manager.isFavorite('2')).toBe(true)
      expect(manager.isFavorite('3')).toBe(true)

      // Remove track2
      await manager.toggleFavorite(track2)

      expect(manager.isFavorite('1')).toBe(true)
      expect(manager.isFavorite('2')).toBe(false)
      expect(manager.isFavorite('3')).toBe(true)
    })

    it('should auto-initialize if not yet initialized', async () => {
      const track = createTrack('1')

      await manager.toggleFavorite(track)

      expect(mockStorage.load).toHaveBeenCalled()
      expect(manager.isFavorite('1')).toBe(true)
    })
  })

  describe('isFavorite', () => {
    it('should return false for non-favorited track', () => {
      expect(manager.isFavorite('nonexistent')).toBe(false)
    })

    it('should return true for favorited track', async () => {
      const track = createTrack('1')
      await manager.toggleFavorite(track)

      expect(manager.isFavorite('1')).toBe(true)
    })

    it('should return false after toggling off', async () => {
      const track = createTrack('1')
      await manager.toggleFavorite(track) // add
      await manager.toggleFavorite(track) // remove

      expect(manager.isFavorite('1')).toBe(false)
    })
  })

  describe('getAllFavorites', () => {
    it('should return empty array initially', async () => {
      const favorites = await manager.getAllFavorites()
      expect(favorites).toEqual([])
    })

    it('should return all favorited tracks', async () => {
      const track1 = createTrack('1', 'Song A')
      const track2 = createTrack('2', 'Song B')

      await manager.toggleFavorite(track1)
      await manager.toggleFavorite(track2)

      const favorites = await manager.getAllFavorites()
      expect(favorites).toHaveLength(2)
      expect(favorites.map(t => t.id)).toContain('1')
      expect(favorites.map(t => t.id)).toContain('2')
    })

    it('should return a copy, not the internal array', async () => {
      const track = createTrack('1')
      await manager.toggleFavorite(track)

      const favorites = await manager.getAllFavorites()
      favorites.push(createTrack('2'))

      const favoritesAgain = await manager.getAllFavorites()
      expect(favoritesAgain).toHaveLength(1)
    })

    it('should auto-initialize if not yet initialized', async () => {
      const tracks = [createTrack('1')]
      mockStorage = createMockStorage(tracks)
      manager = new FavoritesManager(mockStorage)

      const favorites = await manager.getAllFavorites()

      expect(mockStorage.load).toHaveBeenCalled()
      expect(favorites).toHaveLength(1)
    })
  })

  describe('persistence with pre-existing data', () => {
    it('should load existing favorites and allow toggling', async () => {
      const existingTracks = [createTrack('1'), createTrack('2')]
      mockStorage = createMockStorage(existingTracks)
      manager = new FavoritesManager(mockStorage)

      await manager.init()

      expect(manager.isFavorite('1')).toBe(true)
      expect(manager.isFavorite('2')).toBe(true)

      // Toggle off track 1
      const result = await manager.toggleFavorite(createTrack('1'))
      expect(result).toBe(false)
      expect(manager.isFavorite('1')).toBe(false)
      expect(manager.isFavorite('2')).toBe(true)
    })
  })
})
