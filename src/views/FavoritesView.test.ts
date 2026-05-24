import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Track } from '@/types'

/**
 * FavoritesView logic tests
 * Tests the favorites page's core logic: displaying favorites,
 * unfavoriting tracks, playing all favorites, and empty state handling.
 *
 * Validates: Requirements 4.1, 4.2, 4.3
 */

function createTrack(id: string): Track {
  return {
    id,
    title: `Track ${id}`,
    artist: `Artist ${id}`,
    album: `Album ${id}`,
    duration: 240,
    coverUrl: `https://example.com/cover-${id}.jpg`,
    source: 'netease',
  }
}

function createMockFavoritesStore(initialFavorites: Track[] = []) {
  let favorites = [...initialFavorites]

  return {
    get favorites() { return favorites },
    init: vi.fn(async () => {}),
    toggleFavorite: vi.fn(async (track: Track) => {
      const idx = favorites.findIndex(t => t.id === track.id)
      if (idx !== -1) {
        favorites = favorites.filter(t => t.id !== track.id)
      } else {
        favorites = [...favorites, track]
      }
    }),
    isFavorite: vi.fn((trackId: string) => {
      return favorites.some(t => t.id === trackId)
    }),
  }
}

function createMockPlayerStore() {
  return {
    setPlaylist: vi.fn(),
    playTrack: vi.fn(),
  }
}

/**
 * Simulates the FavoritesView's core logic
 */
function useFavoritesViewLogic(deps: {
  favoritesStore: ReturnType<typeof createMockFavoritesStore>
  playerStore: ReturnType<typeof createMockPlayerStore>
}) {
  const { favoritesStore, playerStore } = deps

  async function init(): Promise<void> {
    await favoritesStore.init()
  }

  async function onPlayAll(): Promise<void> {
    if (favoritesStore.favorites.length === 0) return
    playerStore.setPlaylist(favoritesStore.favorites)
    await playerStore.playTrack(favoritesStore.favorites[0])
  }

  async function onPlayTrack(track: Track): Promise<void> {
    playerStore.setPlaylist(favoritesStore.favorites)
    await playerStore.playTrack(track)
  }

  async function onToggleFavorite(track: Track): Promise<void> {
    await favoritesStore.toggleFavorite(track)
  }

  return {
    get favorites() { return favoritesStore.favorites },
    init,
    onPlayAll,
    onPlayTrack,
    onToggleFavorite,
  }
}

describe('FavoritesView logic', () => {
  let favoritesStore: ReturnType<typeof createMockFavoritesStore>
  let playerStore: ReturnType<typeof createMockPlayerStore>

  beforeEach(() => {
    playerStore = createMockPlayerStore()
  })

  describe('initialization', () => {
    it('should call favoritesStore.init on mount', async () => {
      favoritesStore = createMockFavoritesStore()
      const view = useFavoritesViewLogic({ favoritesStore, playerStore })
      await view.init()

      expect(favoritesStore.init).toHaveBeenCalled()
    })
  })

  describe('empty state', () => {
    it('should show empty state when no favorites exist', () => {
      favoritesStore = createMockFavoritesStore([])
      const view = useFavoritesViewLogic({ favoritesStore, playerStore })

      expect(view.favorites).toHaveLength(0)
    })
  })

  describe('displaying favorites', () => {
    it('should display all favorited tracks', () => {
      const tracks = [createTrack('1'), createTrack('2'), createTrack('3')]
      favoritesStore = createMockFavoritesStore(tracks)
      const view = useFavoritesViewLogic({ favoritesStore, playerStore })

      expect(view.favorites).toHaveLength(3)
      expect(view.favorites[0].id).toBe('1')
      expect(view.favorites[1].id).toBe('2')
      expect(view.favorites[2].id).toBe('3')
    })
  })

  describe('unfavorite (toggle favorite)', () => {
    it('should remove track from favorites when toggled', async () => {
      const tracks = [createTrack('1'), createTrack('2'), createTrack('3')]
      favoritesStore = createMockFavoritesStore(tracks)
      const view = useFavoritesViewLogic({ favoritesStore, playerStore })

      await view.onToggleFavorite(tracks[1])

      expect(favoritesStore.toggleFavorite).toHaveBeenCalledWith(tracks[1])
      expect(view.favorites).toHaveLength(2)
      expect(view.favorites.find(t => t.id === '2')).toBeUndefined()
    })

    it('should result in empty state when last track is unfavorited', async () => {
      const tracks = [createTrack('1')]
      favoritesStore = createMockFavoritesStore(tracks)
      const view = useFavoritesViewLogic({ favoritesStore, playerStore })

      await view.onToggleFavorite(tracks[0])

      expect(view.favorites).toHaveLength(0)
    })
  })

  describe('play all', () => {
    it('should set playlist and play first track when play all is clicked', async () => {
      const tracks = [createTrack('1'), createTrack('2'), createTrack('3')]
      favoritesStore = createMockFavoritesStore(tracks)
      const view = useFavoritesViewLogic({ favoritesStore, playerStore })

      await view.onPlayAll()

      expect(playerStore.setPlaylist).toHaveBeenCalledWith(tracks)
      expect(playerStore.playTrack).toHaveBeenCalledWith(tracks[0])
    })

    it('should not play when favorites list is empty', async () => {
      favoritesStore = createMockFavoritesStore([])
      const view = useFavoritesViewLogic({ favoritesStore, playerStore })

      await view.onPlayAll()

      expect(playerStore.setPlaylist).not.toHaveBeenCalled()
      expect(playerStore.playTrack).not.toHaveBeenCalled()
    })
  })

  describe('play single track', () => {
    it('should set favorites as playlist and play selected track', async () => {
      const tracks = [createTrack('1'), createTrack('2'), createTrack('3')]
      favoritesStore = createMockFavoritesStore(tracks)
      const view = useFavoritesViewLogic({ favoritesStore, playerStore })

      await view.onPlayTrack(tracks[1])

      expect(playerStore.setPlaylist).toHaveBeenCalledWith(tracks)
      expect(playerStore.playTrack).toHaveBeenCalledWith(tracks[1])
    })
  })
})
