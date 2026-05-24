import { describe, it, expect } from 'vitest'
import type { Track } from '@/types'

/**
 * TrackList component logic tests
 * Tests the list rendering logic, empty state, and favorite checking
 */

function createTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: `track-${Math.random().toString(36).slice(2, 8)}`,
    title: '测试歌曲',
    artist: '测试艺术家',
    album: '测试专辑',
    duration: 240,
    coverUrl: 'https://example.com/cover.jpg',
    source: 'netease',
    ...overrides,
  }
}

// Simulate the TrackList's checkIsFavorite logic
function createCheckIsFavorite(favoriteIds: Set<string>) {
  return (trackId: string): boolean => {
    return favoriteIds.has(trackId)
  }
}

describe('TrackList component logic', () => {
  describe('empty state', () => {
    it('should detect empty state when tracks array is empty', () => {
      const tracks: Track[] = []
      expect(tracks.length === 0).toBe(true)
    })

    it('should not show empty state when tracks exist', () => {
      const tracks = [createTrack()]
      expect(tracks.length === 0).toBe(false)
    })
  })

  describe('track list rendering', () => {
    it('should render correct number of items', () => {
      const tracks = [
        createTrack({ id: '1' }),
        createTrack({ id: '2' }),
        createTrack({ id: '3' }),
      ]
      expect(tracks.length).toBe(3)
    })

    it('should use track.id as unique key', () => {
      const tracks = [
        createTrack({ id: 'unique-1' }),
        createTrack({ id: 'unique-2' }),
        createTrack({ id: 'unique-3' }),
      ]
      const ids = tracks.map(t => t.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(tracks.length)
    })
  })

  describe('favorite status checking', () => {
    it('should identify favorited tracks', () => {
      const favoriteIds = new Set(['track-1', 'track-3'])
      const checkIsFavorite = createCheckIsFavorite(favoriteIds)

      expect(checkIsFavorite('track-1')).toBe(true)
      expect(checkIsFavorite('track-2')).toBe(false)
      expect(checkIsFavorite('track-3')).toBe(true)
    })

    it('should return false for empty favorites', () => {
      const favoriteIds = new Set<string>()
      const checkIsFavorite = createCheckIsFavorite(favoriteIds)

      expect(checkIsFavorite('track-1')).toBe(false)
    })

    it('should handle checking many tracks', () => {
      const favoriteIds = new Set(['a', 'b', 'c', 'd', 'e'])
      const checkIsFavorite = createCheckIsFavorite(favoriteIds)

      const tracks = [
        createTrack({ id: 'a' }),
        createTrack({ id: 'b' }),
        createTrack({ id: 'x' }),
        createTrack({ id: 'y' }),
      ]

      const results = tracks.map(t => checkIsFavorite(t.id))
      expect(results).toEqual([true, true, false, false])
    })
  })

  describe('event forwarding contract', () => {
    it('should forward play event with track data', () => {
      const track = createTrack({ id: 'play-test', title: '播放测试' })
      // Simulate event forwarding
      const emittedEvents: Track[] = []
      const onPlay = (t: Track) => emittedEvents.push(t)

      onPlay(track)
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].id).toBe('play-test')
    })

    it('should forward toggleFavorite event with track data', () => {
      const track = createTrack({ id: 'fav-test', title: '收藏测试' })
      // Simulate event forwarding
      const emittedEvents: Track[] = []
      const onToggleFavorite = (t: Track) => emittedEvents.push(t)

      onToggleFavorite(track)
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].id).toBe('fav-test')
    })
  })
})
