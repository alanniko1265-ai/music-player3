/**
 * QQ 音乐 API 适配器
 * 基于 QQMusicApi 开源项目（https://github.com/jsososo/QQMusicApi）
 * 默认 API 地址：http://localhost:3300
 */

import axios, { AxiosInstance } from 'axios';
import type { SearchResult, Track, LyricLine } from '../types/index';
import { APIError, withRetry, type MusicAPIAdapter } from './music-api-adapter';

/**
 * QQ 音乐 API 适配器实现
 */
export class QQMusicAPIAdapter implements MusicAPIAdapter {
  private client: AxiosInstance;

  constructor(baseURL?: string) {
    const apiBaseURL = baseURL || import.meta.env.VITE_QQ_MUSIC_API_URL || 'http://localhost:3300';
    this.client = axios.create({
      baseURL: apiBaseURL,
      timeout: 10000,
    });
  }

  /**
   * 搜索音乐
   */
  async search(keyword: string, page: number = 1, pageSize: number = 20): Promise<SearchResult> {
    return withRetry(async () => {
      const response = await this.client.get('/getSearchByKey', {
        params: {
          key: keyword,
          limit: pageSize,
          page,
          t: 0, // 0 = 歌曲
        },
      });

      const data = response.data;

      if (data.result !== 100) {
        throw new APIError(
          data.errMsg || '搜索请求失败',
          data.result || 500,
          'qq'
        );
      }

      const songList = data.data?.song?.list || [];
      const totalNum = data.data?.song?.totalnum || 0;

      const tracks: Track[] = songList.map((song: any) => this.mapSongToTrack(song));

      return {
        tracks,
        total: totalNum,
        page,
        pageSize,
        hasMore: page * pageSize < totalNum,
      };
    });
  }

  /**
   * 获取音源 URL
   */
  async getTrackUrl(trackId: string): Promise<string> {
    return withRetry(async () => {
      const response = await this.client.get('/getMusicPlay', {
        params: {
          songmid: trackId,
        },
      });

      const data = response.data;

      if (data.result !== 100) {
        throw new APIError(
          '获取音源 URL 失败',
          data.result || 500,
          'qq'
        );
      }

      // 从返回数据中提取播放 URL
      const playUrl = data.data?.[trackId]?.url;
      if (!playUrl) {
        throw new APIError(
          '该歌曲暂时无法播放（可能需要 VIP）',
          403,
          'qq'
        );
      }

      return playUrl;
    });
  }

  /**
   * 获取歌词
   */
  async getLyrics(trackId: string): Promise<LyricLine[]> {
    return withRetry(async () => {
      const response = await this.client.get('/getLyric', {
        params: {
          songmid: trackId,
        },
      });

      const data = response.data;

      if (data.result !== 100) {
        throw new APIError(
          '获取歌词失败',
          data.result || 500,
          'qq'
        );
      }

      const lrcString = data.data?.lyric || '';
      return this.parseLrc(lrcString);
    });
  }

  /**
   * 获取搜索建议（热词）
   */
  async getSearchSuggestions(keyword: string): Promise<string[]> {
    return withRetry(async () => {
      const response = await this.client.get('/getSmartbox', {
        params: {
          key: keyword,
        },
      });

      const data = response.data;

      if (data.result !== 100) {
        return [];
      }

      const songs = data.data?.song?.itemlist || [];
      return songs.map((item: any) => `${item.name} - ${item.singer}`).slice(0, 10);
    });
  }

  /**
   * 将 QQ 音乐歌曲对象映射为统一的 Track 类型
   */
  private mapSongToTrack(song: any): Track {
    return {
      id: song.songmid || String(song.songid),
      title: song.songname || '未知歌曲',
      artist: song.singer?.map((s: any) => s.name).join(' / ') || '未知艺术家',
      album: song.albumname || '未知专辑',
      duration: song.interval || 0, // QQ 音乐直接返回秒数
      coverUrl: song.albummid
        ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.albummid}.jpg`
        : '',
      source: 'qq',
    };
  }

  /**
   * 解析 LRC 格式歌词
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

      timeRegex.lastIndex = 0;

      const text = line.slice(lastIndex).trim();
      if (timestamps.length > 0 && text) {
        for (const time of timestamps) {
          lyrics.push({ time, text });
        }
      }
    }

    lyrics.sort((a, b) => a.time - b.time);

    for (let i = 0; i < lyrics.length - 1; i++) {
      lyrics[i].duration = lyrics[i + 1].time - lyrics[i].time;
    }

    return lyrics;
  }
}
