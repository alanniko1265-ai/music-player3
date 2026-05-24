import { describe, it, expect, vi } from 'vitest';
import { LyricsService } from './lyrics-service';
import type { MusicAPIAdapter } from './music-api-adapter';
import type { LyricLine } from '../types/index';

/**
 * 创建 mock MusicAPIAdapter
 */
function createMockAdapter(lyrics: LyricLine[] | Error = []): MusicAPIAdapter {
  return {
    search: vi.fn(),
    getTrackUrl: vi.fn(),
    getLyrics: lyrics instanceof Error
      ? vi.fn().mockRejectedValue(lyrics)
      : vi.fn().mockResolvedValue(lyrics),
    getSearchSuggestions: vi.fn(),
  };
}

describe('LyricsService', () => {
  describe('fetchLyrics', () => {
    it('应从 adapter 获取歌词并返回', async () => {
      const mockLyrics: LyricLine[] = [
        { time: 0, text: '第一行歌词' },
        { time: 5, text: '第二行歌词' },
        { time: 10, text: '第三行歌词' },
      ];
      const adapter = createMockAdapter(mockLyrics);
      const service = new LyricsService(adapter);

      const result = await service.fetchLyrics('track-1');

      expect(adapter.getLyrics).toHaveBeenCalledWith('track-1');
      expect(result).toEqual(mockLyrics);
    });

    it('无歌词时应返回空数组', async () => {
      const adapter = createMockAdapter([]);
      const service = new LyricsService(adapter);

      const result = await service.fetchLyrics('track-no-lyrics');

      expect(result).toEqual([]);
    });

    it('API 出错时应返回空数组', async () => {
      const adapter = createMockAdapter(new Error('网络错误'));
      const service = new LyricsService(adapter);

      const result = await service.fetchLyrics('track-error');

      expect(result).toEqual([]);
    });
  });

  describe('getActiveLine', () => {
    const lyrics: LyricLine[] = [
      { time: 5, text: '第一行' },
      { time: 10, text: '第二行' },
      { time: 20, text: '第三行' },
      { time: 30, text: '第四行' },
      { time: 45, text: '第五行' },
    ];

    it('空歌词数组应返回 -1', () => {
      const adapter = createMockAdapter();
      const service = new LyricsService(adapter);

      expect(service.getActiveLine([], 10)).toBe(-1);
    });

    it('currentTime 在第一行之前应返回 -1', () => {
      const adapter = createMockAdapter();
      const service = new LyricsService(adapter);

      expect(service.getActiveLine(lyrics, 2)).toBe(-1);
      expect(service.getActiveLine(lyrics, 0)).toBe(-1);
      expect(service.getActiveLine(lyrics, 4.99)).toBe(-1);
    });

    it('currentTime 恰好等于第一行时间应返回 0', () => {
      const adapter = createMockAdapter();
      const service = new LyricsService(adapter);

      expect(service.getActiveLine(lyrics, 5)).toBe(0);
    });

    it('currentTime 在两行之间应返回前一行索引', () => {
      const adapter = createMockAdapter();
      const service = new LyricsService(adapter);

      // 在第一行和第二行之间
      expect(service.getActiveLine(lyrics, 7)).toBe(0);
      // 在第二行和第三行之间
      expect(service.getActiveLine(lyrics, 15)).toBe(1);
      // 在第三行和第四行之间
      expect(service.getActiveLine(lyrics, 25)).toBe(2);
    });

    it('currentTime 恰好等于某行时间应返回该行索引', () => {
      const adapter = createMockAdapter();
      const service = new LyricsService(adapter);

      expect(service.getActiveLine(lyrics, 10)).toBe(1);
      expect(service.getActiveLine(lyrics, 20)).toBe(2);
      expect(service.getActiveLine(lyrics, 30)).toBe(3);
      expect(service.getActiveLine(lyrics, 45)).toBe(4);
    });

    it('currentTime 超过最后一行应返回最后一行索引', () => {
      const adapter = createMockAdapter();
      const service = new LyricsService(adapter);

      expect(service.getActiveLine(lyrics, 50)).toBe(4);
      expect(service.getActiveLine(lyrics, 100)).toBe(4);
      expect(service.getActiveLine(lyrics, 999)).toBe(4);
    });

    it('只有一行歌词时的边界情况', () => {
      const adapter = createMockAdapter();
      const service = new LyricsService(adapter);
      const singleLyric: LyricLine[] = [{ time: 10, text: '唯一一行' }];

      expect(service.getActiveLine(singleLyric, 5)).toBe(-1);
      expect(service.getActiveLine(singleLyric, 10)).toBe(0);
      expect(service.getActiveLine(singleLyric, 15)).toBe(0);
    });

    it('null/undefined 歌词数组应返回 -1', () => {
      const adapter = createMockAdapter();
      const service = new LyricsService(adapter);

      expect(service.getActiveLine(null as any, 10)).toBe(-1);
      expect(service.getActiveLine(undefined as any, 10)).toBe(-1);
    });
  });
});
