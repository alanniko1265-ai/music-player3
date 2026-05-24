/**
 * useAppInit composable 单元测试
 * 验证应用启动时的状态恢复逻辑
 * Validates: Requirements 7.3, 7.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { MusicAPIAdapter } from '@/services/music-api-adapter'

// Mock ipc-renderer storageService
vi.mock('@/services/ipc-renderer', () => ({
  storageService: {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock PlaybackController to avoid Audio dependency in Node environment
vi.mock('@/services/playback-controller', () => ({
  PlaybackController: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    next: vi.fn().mockResolvedValue(undefined),
    previous: vi.fn().mockResolvedValue(undefined),
    seek: vi.fn(),
    setVolume: vi.fn(),
    setPlayMode: vi.fn(),
    setPlaylist: vi.fn(),
    getPlaylist: vi.fn().mockReturnValue([]),
    getCurrentState: vi.fn().mockReturnValue({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 80,
      playMode: 'sequential',
    }),
  })),
}))

// Mock playlist-manager
vi.mock('@/services/playlist-manager', () => ({
  playlistManager: {
    init: vi.fn().mockResolvedValue(undefined),
    getAllPlaylists: vi.fn().mockReturnValue([]),
  },
}))

// Mock favorites-manager
vi.mock('@/services/favorites-manager', () => ({
  FavoritesManager: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    getAllFavorites: vi.fn().mockResolvedValue([]),
    toggleFavorite: vi.fn().mockResolvedValue(true),
    isFavorite: vi.fn().mockReturnValue(false),
  })),
}))

import { useAppInit } from './useAppInit'

/**
 * 创建 mock MusicAPIAdapter
 */
function createMockAdapter(): MusicAPIAdapter {
  return {
    search: vi.fn().mockResolvedValue({ tracks: [], total: 0, page: 1, pageSize: 20, hasMore: false }),
    getTrackUrl: vi.fn().mockResolvedValue('http://example.com/track.mp3'),
    getLyrics: vi.fn().mockResolvedValue([]),
    getSearchSuggestions: vi.fn().mockResolvedValue([]),
  }
}

describe('useAppInit', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should start with loading=true and ready=false', () => {
    const mockAdapter = createMockAdapter()
    const { loading, ready, error } = useAppInit(mockAdapter)

    expect(loading.value).toBe(true)
    expect(ready.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('should set ready=true and loading=false after successful initialization', async () => {
    const mockAdapter = createMockAdapter()
    const { loading, ready, error, initialize } = useAppInit(mockAdapter)

    await initialize()

    expect(loading.value).toBe(false)
    expect(ready.value).toBe(true)
    expect(error.value).toBeNull()
  })

  it('should initialize PlayerStore with the provided API adapter', async () => {
    const mockAdapter = createMockAdapter()
    const { initialize } = useAppInit(mockAdapter)

    await initialize()

    // PlayerStore should be initialized (its initialized ref should be true)
    const { usePlayerStore } = await import('@/stores/player-store')
    const playerStore = usePlayerStore()
    expect(playerStore.initialized).toBe(true)
  })

  it('should initialize PlaylistStore', async () => {
    const mockAdapter = createMockAdapter()
    const { initialize } = useAppInit(mockAdapter)

    await initialize()

    // PlaylistStore init should have been called (via playlistManager.init mock)
    const { playlistManager } = await import('@/services/playlist-manager')
    expect(playlistManager.init).toHaveBeenCalled()
  })

  it('should initialize FavoritesStore', async () => {
    const mockAdapter = createMockAdapter()
    const { initialize } = useAppInit(mockAdapter)

    await initialize()

    // FavoritesStore should have loaded favorites
    const { useFavoritesStore } = await import('@/stores/favorites-store')
    const favoritesStore = useFavoritesStore()
    expect(favoritesStore.favorites).toEqual([])
  })

  it('should handle complete initialization failure gracefully', async () => {
    // Force a failure by making PlaylistStore init throw
    const { playlistManager } = await import('@/services/playlist-manager')
    const mockInit = playlistManager.init as ReturnType<typeof vi.fn>
    mockInit.mockRejectedValueOnce(new Error('Critical failure'))

    const mockAdapter = createMockAdapter()
    const { loading, ready, error, initialize } = useAppInit(mockAdapter)

    await initialize()

    expect(loading.value).toBe(false)
    expect(ready.value).toBe(false)
    expect(error.value).toBe('Critical failure')
  })

  it('should initialize stores in correct order (playlists+favorites before player)', async () => {
    const callOrder: string[] = []

    const { playlistManager } = await import('@/services/playlist-manager')
    const mockPlaylistInit = playlistManager.init as ReturnType<typeof vi.fn>
    mockPlaylistInit.mockImplementation(async () => {
      callOrder.push('playlist')
    })

    // Track PlayerStore initialization via storageService.load calls
    const { storageService } = await import('@/services/ipc-renderer')
    const mockLoad = storageService.load as ReturnType<typeof vi.fn>
    mockLoad.mockImplementation(async (key: string) => {
      if (key === 'playbackState' || key === 'playerPlaylist') {
        callOrder.push(`player:${key}`)
      }
      return null
    })

    const mockAdapter = createMockAdapter()
    const { initialize } = useAppInit(mockAdapter)

    await initialize()

    // Playlist init should happen before player state restoration
    const playlistIndex = callOrder.indexOf('playlist')
    const playerStateIndex = callOrder.indexOf('player:playbackState')

    expect(playlistIndex).toBeGreaterThanOrEqual(0)
    if (playerStateIndex >= 0) {
      expect(playlistIndex).toBeLessThan(playerStateIndex)
    }
  })
})
