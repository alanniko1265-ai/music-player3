import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIError, withRetry, NeteaseAPIAdapter } from './music-api-adapter';
import type { MusicAPIAdapter } from './music-api-adapter';

const mockGet = vi.fn();

vi.mock('axios', () => {
  return {
    default: {
      create: () => ({
        get: (...args: any[]) => mockGet(...args),
      }),
    },
  };
});

describe('APIError', () => {
  it('should create an error with code, source, and message', () => {
    const error = new APIError('请求失败', 500, 'netease');
    expect(error.message).toBe('请求失败');
    expect(error.code).toBe(500);
    expect(error.source).toBe('netease');
    expect(error.name).toBe('APIError');
  });

  it('should be an instance of Error', () => {
    const error = new APIError('test', 400, 'netease');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('withRetry', () => {
  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed on subsequent attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(withRetry(fn, 3, 10)).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use exponential backoff delays', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, 3, 1000);

    // First retry after 1000ms (1000 * 2^0)
    await vi.advanceTimersByTimeAsync(1000);
    // Second retry after 2000ms (1000 * 2^1)
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });
});

describe('NeteaseAPIAdapter', () => {
  let adapter: MusicAPIAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new NeteaseAPIAdapter('http://test-api.example.com');
  });

  describe('search', () => {
    it('should return search results mapped to Track type', async () => {
      mockGet.mockResolvedValue({
        data: {
          code: 200,
          result: {
            songs: [
              {
                id: 12345,
                name: '测试歌曲',
                ar: [{ name: '测试歌手' }],
                al: { name: '测试专辑', picUrl: 'http://cover.jpg' },
                dt: 240000,
              },
            ],
            songCount: 100,
          },
        },
      });

      const result = await adapter.search('测试', 1, 20);

      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0]).toEqual({
        id: '12345',
        title: '测试歌曲',
        artist: '测试歌手',
        album: '测试专辑',
        duration: 240,
        coverUrl: 'http://cover.jpg',
        source: 'netease',
      });
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.hasMore).toBe(true);
    });

    it('should calculate hasMore correctly when no more results', async () => {
      mockGet.mockResolvedValue({
        data: {
          code: 200,
          result: {
            songs: [{ id: 1, name: 'Song', ar: [], al: {}, dt: 1000 }],
            songCount: 5,
          },
        },
      });

      const result = await adapter.search('test', 1, 20);
      expect(result.hasMore).toBe(false);
    });

    it('should throw APIError on non-200 response code', async () => {
      mockGet.mockResolvedValue({
        data: { code: 400, message: '参数错误' },
      });

      await expect(adapter.search('test', 1, 20)).rejects.toThrow(APIError);
    });

    it('should handle multiple artists', async () => {
      mockGet.mockResolvedValue({
        data: {
          code: 200,
          result: {
            songs: [
              {
                id: 1,
                name: 'Collab Song',
                ar: [{ name: 'Artist A' }, { name: 'Artist B' }],
                al: { name: 'Album', picUrl: '' },
                dt: 180000,
              },
            ],
            songCount: 1,
          },
        },
      });

      const result = await adapter.search('collab', 1, 20);
      expect(result.tracks[0].artist).toBe('Artist A / Artist B');
    });
  });

  describe('getTrackUrl', () => {
    it('should return the track URL', async () => {
      mockGet.mockResolvedValue({
        data: {
          code: 200,
          data: [{ url: 'http://music.example.com/track.mp3' }],
        },
      });

      const url = await adapter.getTrackUrl('12345');
      expect(url).toBe('http://music.example.com/track.mp3');
    });

    it('should throw APIError when URL is not available', async () => {
      mockGet.mockResolvedValue({
        data: {
          code: 200,
          data: [{ url: null }],
        },
      });

      await expect(adapter.getTrackUrl('12345')).rejects.toThrow(APIError);
    });
  });

  describe('getLyrics', () => {
    it('should parse LRC format lyrics', async () => {
      mockGet.mockResolvedValue({
        data: {
          code: 200,
          lrc: {
            lyric: '[00:12.34]第一行歌词\n[00:15.67]第二行歌词\n',
          },
        },
      });

      const lyrics = await adapter.getLyrics('12345');
      expect(lyrics).toHaveLength(2);
      expect(lyrics[0].time).toBeCloseTo(12.34, 1);
      expect(lyrics[0].text).toBe('第一行歌词');
      expect(lyrics[1].time).toBeCloseTo(15.67, 1);
      expect(lyrics[1].text).toBe('第二行歌词');
    });

    it('should return empty array when no lyrics available', async () => {
      mockGet.mockResolvedValue({
        data: {
          code: 200,
          lrc: { lyric: '' },
        },
      });

      const lyrics = await adapter.getLyrics('12345');
      expect(lyrics).toEqual([]);
    });

    it('should calculate duration for each lyric line', async () => {
      mockGet.mockResolvedValue({
        data: {
          code: 200,
          lrc: {
            lyric: '[00:10.00]Line 1\n[00:15.00]Line 2\n[00:22.00]Line 3\n',
          },
        },
      });

      const lyrics = await adapter.getLyrics('12345');
      expect(lyrics[0].duration).toBeCloseTo(5, 1);
      expect(lyrics[1].duration).toBeCloseTo(7, 1);
      expect(lyrics[2].duration).toBeUndefined();
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return suggestion keywords', async () => {
      mockGet.mockResolvedValue({
        data: {
          code: 200,
          result: {
            allMatch: [
              { keyword: '周杰伦' },
              { keyword: '周杰伦 晴天' },
            ],
          },
        },
      });

      const suggestions = await adapter.getSearchSuggestions('周');
      expect(suggestions).toEqual(['周杰伦', '周杰伦 晴天']);
    });

    it('should return empty array when no suggestions', async () => {
      mockGet.mockResolvedValue({
        data: {
          code: 200,
          result: {},
        },
      });

      const suggestions = await adapter.getSearchSuggestions('xyz');
      expect(suggestions).toEqual([]);
    });
  });
});
