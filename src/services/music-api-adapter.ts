/**
 * 统一音乐 API 适配层
 * 屏蔽不同第三方音乐平台的接口差异，提供统一的调用接口
 */

import axios, { AxiosInstance } from 'axios';
import type { SearchResult, Track, LyricLine } from '../types/index';
import { AudioQuality } from '../types/index';

/**
 * API 错误类
 * 封装第三方 API 调用过程中的错误信息
 */
export class APIError extends Error {
  constructor(
    message: string,
    public code: number,
    public source: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * 延迟工具函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 请求重试包装函数
 * 实现指数退避重试机制
 * @param fn 需要重试的异步函数
 * @param maxRetries 最大重试次数，默认 3
 * @param baseDelay 基础延迟时间（毫秒），默认 1000
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await delay(baseDelay * Math.pow(2, i));
      }
    }
  }
  throw lastError!;
}

/**
 * 统一音乐 API 适配器接口
 */
export interface MusicAPIAdapter {
  /** 搜索音乐 */
  search(keyword: string, page: number, pageSize: number): Promise<SearchResult>;
  /** 获取音源 URL */
  getTrackUrl(trackId: string, quality?: AudioQuality): Promise<string>;
  /** 获取歌词 */
  getLyrics(trackId: string): Promise<LyricLine[]>;
  /** 获取搜索建议 */
  getSearchSuggestions(keyword: string): Promise<string[]>;
}

/**
 * 网易云音乐 API 适配器
 * 基于 NeteaseCloudMusicApi 开源项目提供的接口
 */
export class NeteaseAPIAdapter implements MusicAPIAdapter {
  private client: AxiosInstance;

  constructor(baseURL?: string) {
    const apiBaseURL = baseURL || import.meta.env.VITE_NETEASE_API_URL || 'http://localhost:3000';
    this.client = axios.create({
      baseURL: apiBaseURL,
      timeout: 10000,
    });
  }

  /**
   * 搜索音乐
   * @param keyword 搜索关键词
   * @param page 页码（从 1 开始）
   * @param pageSize 每页数量
   */
  async search(keyword: string, page: number = 1, pageSize: number = 20): Promise<SearchResult> {
    return withRetry(async () => {
      const offset = (page - 1) * pageSize;
      const response = await this.client.get('/cloudsearch', {
        params: {
          keywords: keyword,
          limit: pageSize,
          offset,
          type: 1, // 1 = 单曲
        },
      });

      const data = response.data;

      if (data.code !== 200) {
        throw new APIError(
          data.message || '搜索请求失败',
          data.code,
          'netease'
        );
      }

      const result = data.result || {};
      const songs = result.songs || [];
      const total = result.songCount || 0;

      const tracks: Track[] = songs.map((song: any) => this.mapSongToTrack(song));

      return {
        tracks,
        total,
        page,
        pageSize,
        hasMore: offset + pageSize < total,
      };
    });
  }

  /** 网易云音质映射 */
  private static readonly NETEASE_QUALITY_MAP: Record<AudioQuality, string> = {
    [AudioQuality.Standard]: 'standard',
    [AudioQuality.High]: 'exhigh',
    [AudioQuality.Lossless]: 'lossless',
    [AudioQuality.HiRes]: 'hires',
  };

  /**
   * 获取音源 URL
   * @param trackId 曲目 ID
   * @param quality 音质等级
   */
  async getTrackUrl(trackId: string, quality?: AudioQuality): Promise<string> {
    return withRetry(async () => {
      const level = quality ? NeteaseAPIAdapter.NETEASE_QUALITY_MAP[quality] : 'standard';
      const response = await this.client.get('/song/url/v1', {
        params: {
          id: trackId,
          level,
        },
      });

      const data = response.data;

      if (data.code !== 200) {
        throw new APIError(
          data.message || '获取音源 URL 失败',
          data.code,
          'netease'
        );
      }

      const urlData = data.data?.[0];
      if (!urlData || !urlData.url) {
        throw new APIError(
          '该歌曲暂时无法播放',
          404,
          'netease'
        );
      }

      return urlData.url;
    });
  }

  /**
   * 获取歌词
   * @param trackId 曲目 ID
   */
  async getLyrics(trackId: string): Promise<LyricLine[]> {
    return withRetry(async () => {
      const response = await this.client.get('/lyric', {
        params: {
          id: trackId,
        },
      });

      const data = response.data;

      if (data.code !== 200) {
        throw new APIError(
          data.message || '获取歌词失败',
          data.code,
          'netease'
        );
      }

      const lrcString = data.lrc?.lyric || '';
      return this.parseLrc(lrcString);
    });
  }

  /**
   * 获取搜索建议
   * @param keyword 搜索关键词
   */
  async getSearchSuggestions(keyword: string): Promise<string[]> {
    return withRetry(async () => {
      const response = await this.client.get('/search/suggest', {
        params: {
          keywords: keyword,
          type: 'mobile',
        },
      });

      const data = response.data;

      if (data.code !== 200) {
        throw new APIError(
          data.message || '获取搜索建议失败',
          data.code,
          'netease'
        );
      }

      const allMatch = data.result?.allMatch || [];
      return allMatch.map((item: any) => item.keyword || item.name || '');
    });
  }

  /**
   * 将网易云 API 返回的歌曲对象映射为统一的 Track 类型
   */
  private mapSongToTrack(song: any): Track {
    return {
      id: String(song.id),
      title: song.name || '未知歌曲',
      artist: song.ar?.map((a: any) => a.name).join(' / ') || '未知艺术家',
      album: song.al?.name || '未知专辑',
      duration: Math.round((song.dt || 0) / 1000), // 毫秒转秒
      coverUrl: song.al?.picUrl || '',
      source: 'netease',
    };
  }

  /**
   * 解析 LRC 格式歌词
   * LRC 格式示例: [00:12.34]歌词文本
   */
  private parseLrc(lrcString: string): LyricLine[] {
    if (!lrcString) return [];

    const lines = lrcString.split('\n');
    const lyrics: LyricLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

    for (const line of lines) {
      const timestamps: number[] = [];
      let match: RegExpExecArray | null;
      let lastIndex = 0;

      while ((match = timeRegex.exec(line)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = match[3].length === 2
          ? parseInt(match[3], 10) * 10
          : parseInt(match[3], 10);
        timestamps.push(minutes * 60 + seconds + milliseconds / 1000);
        lastIndex = match.index + match[0].length;
      }

      // 重置 regex lastIndex
      timeRegex.lastIndex = 0;

      const text = line.slice(lastIndex).trim();
      if (timestamps.length > 0 && text) {
        for (const time of timestamps) {
          lyrics.push({ time, text });
        }
      }
    }

    // 按时间排序
    lyrics.sort((a, b) => a.time - b.time);

    // 计算每行持续时间
    for (let i = 0; i < lyrics.length - 1; i++) {
      lyrics[i].duration = lyrics[i + 1].time - lyrics[i].time;
    }

    return lyrics;
  }
}
