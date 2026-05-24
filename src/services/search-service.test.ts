import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from './search-service';
import type { MusicAPIAdapter } from './music-api-adapter';
import type { SearchResult } from '../types/index';

// Mock storageService
vi.mock('./ipc-renderer', () => ({
  storageService: {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

import { storageService } from './ipc-renderer';

function createMockAdapter(): MusicAPIAdapter {
  return {
    search: vi.fn().mockResolvedValue({
      tracks: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    } as SearchResult),
    getTrackUrl: vi.fn().mockResolvedValue('http://example.com/track.mp3'),
    getLyrics: vi.fn().mockResolvedValue([]),
    getSearchSuggestions: vi.fn().mockResolvedValue(['suggestion1', 'suggestion2']),
  };
}

describe('SearchService', () => {
  let service: SearchService;
  let mockAdapter: MusicAPIAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    (storageService.load as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    mockAdapter = createMockAdapter();
    service = new SearchService(mockAdapter);
  });

  describe('search', () => {
    it('should delegate to adapter with default pageSize of 20', async () => {
      await service.search('周杰伦');

      expect(mockAdapter.search).toHaveBeenCalledWith('周杰伦', 1, 20);
    });

    it('should pass page parameter to adapter', async () => {
      await service.search('周杰伦', 3);

      expect(mockAdapter.search).toHaveBeenCalledWith('周杰伦', 3, 20);
    });

    it('should return the search result from adapter', async () => {
      const mockResult: SearchResult = {
        tracks: [
          {
            id: '1',
            title: '晴天',
            artist: '周杰伦',
            album: '叶惠美',
            duration: 269,
            coverUrl: 'http://cover.jpg',
            source: 'netease',
          },
        ],
        total: 50,
        page: 1,
        pageSize: 20,
        hasMore: true,
      };
      (mockAdapter.search as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await service.search('周杰伦');

      expect(result).toEqual(mockResult);
    });
  });

  describe('getSuggestions', () => {
    it('should delegate to adapter getSearchSuggestions', async () => {
      const suggestions = await service.getSuggestions('周');

      expect(mockAdapter.getSearchSuggestions).toHaveBeenCalledWith('周');
      expect(suggestions).toEqual(['suggestion1', 'suggestion2']);
    });
  });

  describe('getSearchHistory', () => {
    it('should return empty array initially', () => {
      const history = service.getSearchHistory();
      expect(history).toEqual([]);
    });

    it('should return history after adding items', () => {
      service.addToHistory('周杰伦');
      service.addToHistory('林俊杰');

      const history = service.getSearchHistory();
      expect(history).toEqual(['林俊杰', '周杰伦']);
    });
  });

  describe('addToHistory', () => {
    it('should add keyword to the beginning of history', () => {
      service.addToHistory('周杰伦');
      service.addToHistory('林俊杰');

      expect(service.getSearchHistory()).toEqual(['林俊杰', '周杰伦']);
    });

    it('should not add empty or whitespace-only keywords', () => {
      service.addToHistory('');
      service.addToHistory('   ');

      expect(service.getSearchHistory()).toEqual([]);
    });

    it('should trim keywords before adding', () => {
      service.addToHistory('  周杰伦  ');

      expect(service.getSearchHistory()).toEqual(['周杰伦']);
    });

    it('should remove duplicates and move to front', () => {
      service.addToHistory('周杰伦');
      service.addToHistory('林俊杰');
      service.addToHistory('周杰伦');

      expect(service.getSearchHistory()).toEqual(['周杰伦', '林俊杰']);
    });

    it('should limit history to 20 items', () => {
      for (let i = 0; i < 25; i++) {
        service.addToHistory(`keyword_${i}`);
      }

      const history = service.getSearchHistory();
      expect(history).toHaveLength(20);
      expect(history[0]).toBe('keyword_24');
      expect(history[19]).toBe('keyword_5');
    });

    it('should persist history to storage', () => {
      service.addToHistory('周杰伦');

      expect(storageService.save).toHaveBeenCalledWith('searchHistory', ['周杰伦']);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      service.addToHistory('周杰伦');
      service.addToHistory('林俊杰');

      service.clearHistory();

      expect(service.getSearchHistory()).toEqual([]);
    });

    it('should persist empty history to storage', () => {
      service.addToHistory('周杰伦');
      vi.clearAllMocks();

      service.clearHistory();

      expect(storageService.save).toHaveBeenCalledWith('searchHistory', []);
    });
  });

  describe('initialization', () => {
    it('should load history from storage on construction', () => {
      expect(storageService.load).toHaveBeenCalledWith('searchHistory', []);
    });

    it('should use loaded history from storage', async () => {
      (storageService.load as ReturnType<typeof vi.fn>).mockResolvedValue(['历史1', '历史2']);

      const newService = new SearchService(mockAdapter);

      // Wait for async loadHistory to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(newService.getSearchHistory()).toEqual(['历史1', '历史2']);
    });

    it('should default to empty array if storage load fails', async () => {
      (storageService.load as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('storage error'));

      const newService = new SearchService(mockAdapter);

      // Wait for async loadHistory to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(newService.getSearchHistory()).toEqual([]);
    });
  });
});
