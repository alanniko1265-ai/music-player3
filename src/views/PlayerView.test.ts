import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Track, LyricLine } from '@/types'
import type { MusicAPIAdapter } from '@/services/music-api-adapter'
import { LyricsService } from '@/services/lyrics-service'

/**
 * PlayerView logic tests
 * Tests the player detail page's core logic: lyrics fetching on track change,
 * seek handling, and lyrics state management.
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

function createLyrics(): LyricLine[] {
  return [
    { time: 0, text: '前奏', duration: 5 },
    { time: 5, text: '第一句歌词', duration: 4 },
    { time: 9, text: '第二句歌词', duration: 5 },
    { time: 14, text: '第三句歌词', duration: 6 },
    { time: 20, text: '结尾' },
  ]
}

function createMockAdapter(lyrics: LyricLine[] = []): MusicAPIAdapter {
  return {
    search: vi.fn(),
    getTrackUrl: vi.fn(),
    getLyrics: vi.fn().mockResolvedValue(lyrics),
    getSearchSuggestions: vi.fn(),
  }
}

function createMockPlayerStore() {
  return {
    currentTrack: null as Track | null,
    currentTime: 0,
    seek: vi.fn(),
  }
}

/**
 * Simulates the PlayerView's core reactive logic
 */
function usePlayerViewLogic(deps: {
  playerStore: ReturnType<typeof createMockPlayerStore>
  lyricsService: LyricsService
}) {
  const { playerStore, lyricsService } = deps

  let lyrics: LyricLine[] = []
  let lyricsExpanded = true

  async function onTrackChange(trackId: string | undefined): Promise<void> {
    if (!trackId) {
      lyrics = []
      return
    }
    try {
      lyrics = await lyricsService.fetchLyrics(trackId)
    } catch {
      lyrics = []
    }
  }

  function handleSeek(time: number): void {
    playerStore.seek(time)
  }

  function toggleLyricsExpanded(): void {
    lyricsExpanded = !lyricsExpanded
  }

  function getCoverAlt(): string {
    const track = playerStore.currentTrack
    return track
      ? `${track.title} - ${track.artist} 专辑封面`
      : '专辑封面'
  }

  return {
    get lyrics() { return lyrics },
    get lyricsExpanded() { return lyricsExpanded },
    onTrackChange,
    handleSeek,
    toggleLyricsExpanded,
    getCoverAlt,
  }
}

describe('PlayerView logic', () => {
  let playerStore: ReturnType<typeof createMockPlayerStore>
  let mockAdapter: MusicAPIAdapter
  let lyricsService: LyricsService

  beforeEach(() => {
    playerStore = createMockPlayerStore()
    mockAdapter = createMockAdapter(createLyrics())
    lyricsService = new LyricsService(mockAdapter)
  })

  describe('lyrics fetching', () => {
    it('should fetch lyrics when track changes', async () => {
      const view = usePlayerViewLogic({ playerStore, lyricsService })
      await view.onTrackChange('track-1')

      expect(view.lyrics).toHaveLength(5)
      expect(mockAdapter.getLyrics).toHaveBeenCalledWith('track-1')
    })

    it('should clear lyrics when track is undefined', async () => {
      const view = usePlayerViewLogic({ playerStore, lyricsService })
      await view.onTrackChange('track-1')
      expect(view.lyrics).toHaveLength(5)

      await view.onTrackChange(undefined)
      expect(view.lyrics).toHaveLength(0)
    })

    it('should handle lyrics fetch error gracefully', async () => {
      const errorAdapter = createMockAdapter()
      ;(errorAdapter.getLyrics as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('网络错误'))
      const errorService = new LyricsService(errorAdapter)

      const view = usePlayerViewLogic({ playerStore, lyricsService: errorService })
      await view.onTrackChange('track-1')

      expect(view.lyrics).toHaveLength(0)
    })

    it('should fetch new lyrics when track id changes', async () => {
      const view = usePlayerViewLogic({ playerStore, lyricsService })
      await view.onTrackChange('track-1')
      expect(mockAdapter.getLyrics).toHaveBeenCalledWith('track-1')

      await view.onTrackChange('track-2')
      expect(mockAdapter.getLyrics).toHaveBeenCalledWith('track-2')
      expect(mockAdapter.getLyrics).toHaveBeenCalledTimes(2)
    })
  })

  describe('seek handling', () => {
    it('should call playerStore.seek with the given time', () => {
      const view = usePlayerViewLogic({ playerStore, lyricsService })
      view.handleSeek(42.5)

      expect(playerStore.seek).toHaveBeenCalledWith(42.5)
    })

    it('should call playerStore.seek with time 0', () => {
      const view = usePlayerViewLogic({ playerStore, lyricsService })
      view.handleSeek(0)

      expect(playerStore.seek).toHaveBeenCalledWith(0)
    })
  })

  describe('lyrics panel expand/collapse', () => {
    it('should start expanded by default', () => {
      const view = usePlayerViewLogic({ playerStore, lyricsService })
      expect(view.lyricsExpanded).toBe(true)
    })

    it('should toggle expanded state', () => {
      const view = usePlayerViewLogic({ playerStore, lyricsService })
      view.toggleLyricsExpanded()
      expect(view.lyricsExpanded).toBe(false)

      view.toggleLyricsExpanded()
      expect(view.lyricsExpanded).toBe(true)
    })
  })

  describe('cover alt text', () => {
    it('should return default alt when no track is playing', () => {
      const view = usePlayerViewLogic({ playerStore, lyricsService })
      expect(view.getCoverAlt()).toBe('专辑封面')
    })

    it('should return track info alt when track is playing', () => {
      playerStore.currentTrack = createTrack('1')
      const view = usePlayerViewLogic({ playerStore, lyricsService })
      expect(view.getCoverAlt()).toBe('Track 1 - Artist 1 专辑封面')
    })
  })
})
