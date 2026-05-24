/**
 * 歌词服务
 * 负责歌词获取与播放时间同步计算
 */

import type { MusicAPIAdapter } from './music-api-adapter';
import type { LyricLine } from '../types/index';

/**
 * LyricsService 歌词服务
 * 提供歌词获取和当前高亮行计算功能
 */
export class LyricsService {
  private adapter: MusicAPIAdapter;

  constructor(adapter: MusicAPIAdapter) {
    this.adapter = adapter;
  }

  /**
   * 获取指定曲目的歌词
   * @param trackId 曲目 ID
   * @returns 歌词行数组，无歌词或出错时返回空数组
   */
  async fetchLyrics(trackId: string): Promise<LyricLine[]> {
    try {
      const lyrics = await this.adapter.getLyrics(trackId);
      return lyrics ?? [];
    } catch {
      return [];
    }
  }

  /**
   * 根据当前播放时间计算高亮行索引
   * 使用二分查找定位当前应高亮的歌词行
   *
   * @param lyrics 歌词行数组（按 time 升序排列）
   * @param currentTime 当前播放时间（秒）
   * @returns 高亮行索引，若 currentTime 在第一行之前则返回 -1
   */
  getActiveLine(lyrics: LyricLine[], currentTime: number): number {
    if (!lyrics || lyrics.length === 0) {
      return -1;
    }

    // 如果当前时间在第一行歌词之前，返回 -1
    if (currentTime < lyrics[0].time) {
      return -1;
    }

    // 二分查找：找到最后一个 time <= currentTime 的行
    let low = 0;
    let high = lyrics.length - 1;
    let result = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lyrics[mid].time <= currentTime) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result;
  }
}
