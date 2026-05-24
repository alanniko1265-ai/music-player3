import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Track, SearchResult } from '@/types'

/**
 * SearchView logic tests
 * Tests the search page's core logic: search execution, pagination,
 * error handling, retry, infinite scroll trigger, and history management.
 */

// Mock SearchService behavior
function createMockSearchService() {
  const history: string[] = []

  return {
    search: vi.fn<[string, number?], Promise<SearchResult>>(),
    getSuggestions: vi.fn<[string], Promise<string[]>>(),
    getSearchHistory: vi.fn(() => [...history]),
    addToHistory: vi.fn((keyword: string) => {
      const idx = history.indexOf(keyword)
      if (idx !== -1) history.splice(idx, 1)
      history.unshift(keyword)
    }),
    clearHistory: vi.fn(() => { history.length = 0 }),
  }
}

function createMockPlayerStore() {
  return {
    setPlaylist: vi.fn(),
    playTrack: vi.fn(),
  }
}

function createMockFavoritesStore() {
  return {
    toggleFavorite: vi.fn(),
  }
}

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

function createSearchResult(page: number, hasMore: boolean, count: number = 20): SearchResult {
  const tracks: Track[] = []
  for (let i = 0; i < count; i++) {
    tracks.push(createTrack(`${page}-${i}`))
  }
  return {
    tracks,
    total: hasMore ? 100 : count,
    page,
    pageSize: 20,
    hasMore,
  }
}

/**
 * Simulates the SearchView's core reactive logic
 */
function useSearchViewLogic(deps: {
  searchService: ReturnType<typeof createMockSearchService>
  playerStore: ReturnType<typeof createMockPlayerStore>
  favoritesStore: ReturnType<typeof createMockFavoritesStore>
}) {
  const { searchService, playerStore, favoritesStore } = deps

  let keyword = ''
  let tracks: Track[] = []
  let suggestions: string[] = []
  let searchHistory: string[] = searchService.getSearchHistory()
  let isLoading = false
  let isLoadingMore = false
  let hasSearched = false
  let hasMore = false
  let error: string | null = null
  let currentPage = 1
  let currentKeyword = ''

  async function onSearch(searchKeyword: string): Promise<void> {
    if (!searchKeyword.trim()) return

    const trimmed = searchKeyword.trim()
    currentKeyword = trimmed
    currentPage = 1
    tracks = []
    hasSearched = true
    isLoading = true
    error = null
    hasMore = false

    searchService.addToHistory(trimmed)
    searchHistory = searchService.getSearchHistory()

    try {
      const result = await searchService.search(trimmed, 1)
      tracks = result.tracks
      hasMore = result.hasMore
      currentPage = 1
    } catch (err: any) {
      error = err?.message || '搜索失败，请稍后重试'
    } finally {
      isLoading = false
    }
  }

  async function loadMore(): Promise<void> {
    if (isLoadingMore || !hasMore || !currentKeyword) return

    isLoadingMore = true
    error = null
    const nextPage = currentPage + 1

    try {
      const result = await searchService.search(currentKeyword, nextPage)
      tracks = [...tracks, ...result.tracks]
      hasMore = result.hasMore
      currentPage = nextPage
    } catch (err: any) {
      error = err?.message || '加载更多失败，请稍后重试'
    } finally {
      isLoadingMore = false
    }
  }

  async function retry(): Promise<void> {
    if (currentKeyword) {
      await onSearch(currentKeyword)
    }
  }

  async function onSuggest(value: string): Promise<void> {
    if (!value.trim()) {
      suggestions = []
      return
    }
    try {
      suggestions = await searchService.getSuggestions(value.trim())
    } catch {
      suggestions = []
    }
  }

  function onPlayTrack(track: Track): void {
    playerStore.setPlaylist(tracks)
    playerStore.playTrack(track)
  }

  function onToggleFavorite(track: Track): void {
    favoritesStore.toggleFavorite(track)
  }

  function shouldTriggerLoadMore(scrollTop: number, scrollHeight: number, clientHeight: number): boolean {
    if (!hasMore || isLoadingMore) return false
    const threshold = 200
    return scrollTop + clientHeight >= scrollHeight - threshold
  }

  return {
    get keyword() { return keyword },
    set keyword(v: string) { keyword = v },
    get tracks() { return tracks },
    get suggestions() { return suggestions },
    get searchHistory() { return searchHistory },
    get isLoading() { return isLoading },
    get isLoadingMore() { return isLoadingMore },
    get hasSearched() { return hasSearched },
    get hasMore() { return hasMore },
    get error() { return error },
    get currentPage() { return currentPage },
    get currentKeyword() { return currentKeyword },
    onSearch,
    loadMore,
    retry,
    onSuggest,
    onPlayTrack,
    onToggleFavorite,
    shouldTriggerLoadMore,
  }
}

describe('SearchView logic', () => {
  let searchService: ReturnType<typeof createMockSearchService>
  let playerStore: ReturnType<typeof createMockPlayerStore>
  let favoritesStore: ReturnType<typeof createMockFavoritesStore>

  beforeEach(() => {
    searchService = createMockSearchService()
    playerStore = createMockPlayerStore()
    favoritesStore = createMockFavoritesStore()
  })

  describe('search execution', () => {
    it('should execute search and populate tracks', async () => {
      const result = createSearchResult(1, true)
      searchService.search.mockResolvedValue(result)

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('周杰伦')

      expect(view.tracks).toHaveLength(20)
      expect(view.hasSearched).toBe(true)
      expect(view.hasMore).toBe(true)
      expect(view.isLoading).toBe(false)
      expect(view.error).toBeNull()
      expect(searchService.search).toHaveBeenCalledWith('周杰伦', 1)
    })

    it('should trim keyword before searching', async () => {
      searchService.search.mockResolvedValue(createSearchResult(1, false, 5))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('  周杰伦  ')

      expect(searchService.search).toHaveBeenCalledWith('周杰伦', 1)
    })

    it('should not search with empty keyword', async () => {
      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('   ')

      expect(searchService.search).not.toHaveBeenCalled()
      expect(view.hasSearched).toBe(false)
    })

    it('should add keyword to history on search', async () => {
      searchService.search.mockResolvedValue(createSearchResult(1, false, 5))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('周杰伦')

      expect(searchService.addToHistory).toHaveBeenCalledWith('周杰伦')
    })

    it('should handle search error', async () => {
      searchService.search.mockRejectedValue(new Error('网络超时'))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('test')

      expect(view.error).toBe('网络超时')
      expect(view.tracks).toHaveLength(0)
      expect(view.isLoading).toBe(false)
    })

    it('should provide default error message when error has no message', async () => {
      searchService.search.mockRejectedValue({})

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('test')

      expect(view.error).toBe('搜索失败，请稍后重试')
    })

    it('should reset state on new search', async () => {
      searchService.search.mockResolvedValue(createSearchResult(1, true))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('first')

      searchService.search.mockResolvedValue(createSearchResult(1, false, 3))
      await view.onSearch('second')

      expect(view.tracks).toHaveLength(3)
      expect(view.hasMore).toBe(false)
      expect(view.currentPage).toBe(1)
    })
  })

  describe('pagination / load more', () => {
    it('should load more results on next page', async () => {
      searchService.search
        .mockResolvedValueOnce(createSearchResult(1, true))
        .mockResolvedValueOnce(createSearchResult(2, false, 10))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('test')
      expect(view.tracks).toHaveLength(20)

      await view.loadMore()
      expect(view.tracks).toHaveLength(30)
      expect(view.currentPage).toBe(2)
      expect(view.hasMore).toBe(false)
    })

    it('should not load more when already loading', async () => {
      searchService.search.mockResolvedValue(createSearchResult(1, true))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('test')

      // Simulate concurrent loadMore calls
      searchService.search.mockImplementation(() => new Promise(() => {})) // never resolves
      void view.loadMore()
      // Second call should be blocked
      await view.loadMore()

      // Only one additional call should have been made
      expect(searchService.search).toHaveBeenCalledTimes(2) // initial + 1 loadMore
    })

    it('should not load more when hasMore is false', async () => {
      searchService.search.mockResolvedValue(createSearchResult(1, false, 5))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('test')
      await view.loadMore()

      // Only the initial search call
      expect(searchService.search).toHaveBeenCalledTimes(1)
    })

    it('should handle load more error', async () => {
      searchService.search
        .mockResolvedValueOnce(createSearchResult(1, true))
        .mockRejectedValueOnce(new Error('加载失败'))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('test')
      await view.loadMore()

      expect(view.error).toBe('加载失败')
      expect(view.tracks).toHaveLength(20) // original results preserved
      expect(view.isLoadingMore).toBe(false)
    })
  })

  describe('infinite scroll detection', () => {
    it('should trigger load more when near bottom', async () => {
      searchService.search.mockResolvedValue(createSearchResult(1, true))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('test')

      // scrollTop + clientHeight >= scrollHeight - 200
      const shouldLoad = view.shouldTriggerLoadMore(700, 1000, 500)
      expect(shouldLoad).toBe(true)
    })

    it('should not trigger load more when far from bottom', async () => {
      searchService.search.mockResolvedValue(createSearchResult(1, true))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('test')

      const shouldLoad = view.shouldTriggerLoadMore(100, 1000, 500)
      expect(shouldLoad).toBe(false)
    })

    it('should not trigger load more when hasMore is false', async () => {
      searchService.search.mockResolvedValue(createSearchResult(1, false, 5))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('test')

      const shouldLoad = view.shouldTriggerLoadMore(700, 1000, 500)
      expect(shouldLoad).toBe(false)
    })
  })

  describe('retry', () => {
    it('should retry the last search on retry', async () => {
      searchService.search
        .mockRejectedValueOnce(new Error('网络错误'))
        .mockResolvedValueOnce(createSearchResult(1, false, 5))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('周杰伦')
      expect(view.error).toBe('网络错误')

      await view.retry()
      expect(view.tracks).toHaveLength(5)
      expect(view.error).toBeNull()
    })
  })

  describe('suggestions', () => {
    it('should fetch suggestions for non-empty input', async () => {
      searchService.getSuggestions.mockResolvedValue(['周杰伦', '周深'])

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSuggest('周')

      expect(view.suggestions).toEqual(['周杰伦', '周深'])
    })

    it('should clear suggestions for empty input', async () => {
      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSuggest('   ')

      expect(view.suggestions).toEqual([])
      expect(searchService.getSuggestions).not.toHaveBeenCalled()
    })

    it('should handle suggestion fetch error silently', async () => {
      searchService.getSuggestions.mockRejectedValue(new Error('fail'))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSuggest('test')

      expect(view.suggestions).toEqual([])
    })
  })

  describe('track actions', () => {
    it('should set playlist and play track on play', async () => {
      searchService.search.mockResolvedValue(createSearchResult(1, false, 5))

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      await view.onSearch('test')

      const track = view.tracks[0]
      view.onPlayTrack(track)

      expect(playerStore.setPlaylist).toHaveBeenCalledWith(view.tracks)
      expect(playerStore.playTrack).toHaveBeenCalledWith(track)
    })

    it('should toggle favorite on track', async () => {
      const track = createTrack('1')

      const view = useSearchViewLogic({ searchService, playerStore, favoritesStore })
      view.onToggleFavorite(track)

      expect(favoritesStore.toggleFavorite).toHaveBeenCalledWith(track)
    })
  })
})
