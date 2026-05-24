/**
 * FavoritesStore 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFavoritesStore } from './favorites-store'
import type { Track } from '@/types'

// Shared mock state
let mockFavorites: Track[] = []

// Mock FavoritesManager
vi.mock('@/services/favorites-manager', () => {
  return {
    FavoritesManager: vi.fn().mockImplementation(() => ({
      init: vi.fn().mockResolvedValue(undefined),
      toggleFavorite: vi.fn().mockImplementation(async (track: Track) => {
        const index = mockFavorites.findIndex(t => t.id === track.id)
        if (index !== -1) {
          mockFavorites.splice(index, 1)
          return false
        } else {
          mockFavorites.push(track)
          return true
        }
      }),
      isFavorite: vi.fn().mockImplementation((trackId: string) => {
        return mockFavorites.some(t => t.id === trackId)
      }),
      getAllFavorites: vi.fn().mockImplementation(async () => {
        return [...mockFavorites]
      }),
    })),
  }
})

function createTrack(id: string): Track {
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

describe('FavoritesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockFavorites = []
  })

  it('should initialize with empty favorites', async () => {
    const store = useFavoritesStore()
    await store.init()
    expect(store.favorites).toEqual([])
  })

  it('should add a track to favorites via toggleFavorite', async () => {
    const store = useFavoritesStore()
    await store.init()

    const track = createTrack('1')
    await store.toggleFavorite(track)

    expect(store.favorites).toHaveLength(1)
    expect(store.favorites[0].id).toBe('1')
  })

  it('should remove a track from favorites via toggleFavorite', async () => {
    const store = useFavoritesStore()
    await store.init()

    const track = createTrack('1')
    await store.toggleFavorite(track) // add
    await store.toggleFavorite(track) // remove

    expect(store.favorites).toHaveLength(0)
  })

  it('should correctly report isFavorite status', async () => {
    const store = useFavoritesStore()
    await store.init()

    const track = createTrack('1')
    expect(store.isFavorite('1')).toBe(false)

    await store.toggleFavorite(track)
    expect(store.isFavorite('1')).toBe(true)

    await store.toggleFavorite(track)
    expect(store.isFavorite('1')).toBe(false)
  })

  it('should handle multiple tracks independently', async () => {
    const store = useFavoritesStore()
    await store.init()

    const track1 = createTrack('1')
    const track2 = createTrack('2')

    await store.toggleFavorite(track1)
    await store.toggleFavorite(track2)

    expect(store.favorites).toHaveLength(2)
    expect(store.isFavorite('1')).toBe(true)
    expect(store.isFavorite('2')).toBe(true)

    await store.toggleFavorite(track1) // remove track1

    expect(store.favorites).toHaveLength(1)
    expect(store.isFavorite('1')).toBe(false)
    expect(store.isFavorite('2')).toBe(true)
  })
})
