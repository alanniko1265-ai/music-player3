/**
 * PlaybackController - 核心播放控制模块
 * 封装 HTML5 Audio API，管理播放队列和播放模式
 */

import type { Track, PlaybackState } from '../types/index';
import { PlayMode, AudioQuality } from '../types/index';
import type { MusicAPIAdapter } from './music-api-adapter';

export type PlaybackActivity = 'idle' | 'loading' | 'buffering' | 'seeking';

/** 播放控制器事件类型 */
export type PlaybackEvent =
  | { type: 'stateChanged'; state: PlaybackState }
  | { type: 'trackChanged'; track: Track | null }
  | { type: 'activityChanged'; activity: PlaybackActivity }
  | { type: 'error'; message: string }
  | { type: 'ended' };

/** 播放控制器事件监听器 */
export type PlaybackEventListener = (event: PlaybackEvent) => void;

/** PlaybackController 接口 */
export interface IPlaybackController {
  play(track: Track): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(position: number): void;
  setVolume(volume: number): void;
  setPlayMode(mode: PlayMode): void;
  setPlaylist(tracks: Track[]): void;
  setApiAdapter(apiAdapter: MusicAPIAdapter): void;
  setQuality(quality: AudioQuality): void;
  getCurrentState(): PlaybackState;
  getAudioElement(): HTMLAudioElement;
  getPlaylist(): Track[];
  getCurrentIndex(): number;
  on(listener: PlaybackEventListener): void;
  off(listener: PlaybackEventListener): void;
  destroy(): void;
}

/**
 * PlaybackController 实现
 * 封装 HTML5 Audio API，实现完整的播放控制逻辑
 */
export class PlaybackController implements IPlaybackController {
  private audio: HTMLAudioElement;
  private apiAdapter: MusicAPIAdapter;
  private playlist: Track[] = [];
  private currentIndex: number = -1;
  private currentTrack: Track | null = null;
  private volume: number = 80;
  private playMode: PlayMode = PlayMode.Sequential;
  private isPlaying: boolean = false;
  private quality: AudioQuality = AudioQuality.Standard;
  private activity: PlaybackActivity = 'idle';
  private listeners: PlaybackEventListener[] = [];

  constructor(apiAdapter: MusicAPIAdapter, audio?: HTMLAudioElement) {
    this.apiAdapter = apiAdapter;
    this.audio = audio || new Audio();
    try {
      this.audio.crossOrigin = 'anonymous';
    } catch {
      // Ignore cross-origin assignment failures in mocked/test audio elements.
    }
    this.volume = 80;
    this.audio.volume = this.volume / 100;
    this.setupAudioEventListeners();
  }

  /**
   * 播放指定 Track
   * 从 API 获取音源 URL，设置 audio src 并播放
   */
  async play(track: Track): Promise<void> {
    // 如果 track 在播放列表中，更新 currentIndex
    const indexInPlaylist = this.playlist.findIndex((t) => t.id === track.id);
    if (indexInPlaylist !== -1) {
      this.currentIndex = indexInPlaylist;
    } else {
      // 如果不在播放列表中，添加到列表末尾
      this.playlist.push(track);
      this.currentIndex = this.playlist.length - 1;
    }

    await this.loadAndPlay(track);
  }

  /** 暂停播放 */
  pause(): void {
    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
      this.setActivity('idle');
      this.emitStateChanged();
    }
  }

  /** 恢复播放 */
  resume(): void {
    if (!this.isPlaying && this.currentTrack) {
      this.audio.play();
      this.isPlaying = true;
      this.emitStateChanged();
    }
  }

  /** 停止播放 */
  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
    this.currentTrack = null;
    this.currentIndex = -1;
    this.setActivity('idle');
    this.emitStateChanged();
    this.emit({ type: 'trackChanged', track: null });
  }

  /**
   * 播放下一首
   * 根据当前播放模式决定下一首逻辑
   */
  async next(): Promise<void> {
    if (this.playlist.length === 0) return;

    const nextIndex = this.getNextIndex();
    if (nextIndex === -1) {
      // Sequential 模式到达末尾，停止播放
      this.audio.pause();
      this.isPlaying = false;
      this.emitStateChanged();
      return;
    }

    this.currentIndex = nextIndex;
    await this.loadAndPlay(this.playlist[this.currentIndex]);
  }

  /**
   * 播放上一首
   * 根据当前播放模式决定上一首逻辑
   */
  async previous(): Promise<void> {
    if (this.playlist.length === 0) return;

    const prevIndex = this.getPreviousIndex();
    if (prevIndex === -1) {
      // 已经是第一首，重新播放当前曲目
      this.seek(0);
      return;
    }

    this.currentIndex = prevIndex;
    await this.loadAndPlay(this.playlist[this.currentIndex]);
  }

  /**
   * 跳转到指定播放位置
   * @param position 目标位置（秒），会被 clamp 到 [0, duration]
   */
  seek(position: number): void {
    const duration = this.audio.duration || 0;
    const clampedPosition = Math.max(0, Math.min(position, duration));
    this.audio.currentTime = clampedPosition;
    this.emitStateChanged();
  }

  /**
   * 设置音量
   * @param volume 音量值，会被 clamp 到 [0, 100]
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
    this.audio.volume = this.volume / 100;
    this.emitStateChanged();
  }

  /** 设置播放模式 */
  setPlayMode(mode: PlayMode): void {
    this.playMode = mode;
    this.emitStateChanged();
  }

  /** 设置播放队列 */
  setPlaylist(tracks: Track[]): void {
    this.playlist = [...tracks];
    // 如果当前播放的 track 在新列表中，更新 index
    if (this.currentTrack) {
      const newIndex = this.playlist.findIndex((t) => t.id === this.currentTrack!.id);
      this.currentIndex = newIndex;
    }
  }

  setApiAdapter(apiAdapter: MusicAPIAdapter): void {
    this.apiAdapter = apiAdapter;
  }

  /** 设置音质等级 */
  setQuality(quality: AudioQuality): void {
    this.quality = quality;
  }

  /** 获取当前播放状态 */
  getCurrentState(): PlaybackState {
    return {
      currentTrack: this.currentTrack,
      isPlaying: this.isPlaying,
      currentTime: this.audio.currentTime || 0,
      duration: this.audio.duration || 0,
      volume: this.volume,
      playMode: this.playMode,
    };
  }

  /** Expose the internal audio element for visualizers and advanced UI surfaces. */
  getAudioElement(): HTMLAudioElement {
    return this.audio;
  }

  /** 获取当前播放队列 */
  getPlaylist(): Track[] {
    return [...this.playlist];
  }

  /** 获取当前播放索引 */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /** 注册事件监听器 */
  on(listener: PlaybackEventListener): void {
    this.listeners.push(listener);
  }

  /** 移除事件监听器 */
  off(listener: PlaybackEventListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /** 销毁控制器，清理资源 */
  destroy(): void {
    this.audio.pause();
    this.audio.src = '';
    this.removeAudioEventListeners();
    this.listeners = [];
  }

  // ========== Private Methods ==========

  /** 设置 Audio 事件监听 */
  private setupAudioEventListeners(): void {
    this.handleEnded = this.handleEnded.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleWaiting = this.handleWaiting.bind(this);
    this.handlePlaying = this.handlePlaying.bind(this);
    this.handleStalled = this.handleStalled.bind(this);
    this.handleSeeking = this.handleSeeking.bind(this);
    this.handleSeeked = this.handleSeeked.bind(this);
    this.audio.addEventListener('ended', this.handleEnded);
    this.audio.addEventListener('error', this.handleError);
    this.audio.addEventListener('waiting', this.handleWaiting);
    this.audio.addEventListener('playing', this.handlePlaying);
    this.audio.addEventListener('stalled', this.handleStalled);
    this.audio.addEventListener('seeking', this.handleSeeking);
    this.audio.addEventListener('seeked', this.handleSeeked);
  }

  /** 移除 Audio 事件监听 */
  private removeAudioEventListeners(): void {
    this.audio.removeEventListener('ended', this.handleEnded);
    this.audio.removeEventListener('error', this.handleError);
    this.audio.removeEventListener('waiting', this.handleWaiting);
    this.audio.removeEventListener('playing', this.handlePlaying);
    this.audio.removeEventListener('stalled', this.handleStalled);
    this.audio.removeEventListener('seeking', this.handleSeeking);
    this.audio.removeEventListener('seeked', this.handleSeeked);
  }

  /** 处理播放结束事件 */
  private async handleEnded(): Promise<void> {
    this.setActivity('idle');
    this.emit({ type: 'ended' });
    await this.next();
  }

  /** 处理播放错误事件 */
  private async handleError(): Promise<void> {
    this.setActivity('idle');
    const trackTitle = this.currentTrack?.title || '未知歌曲';
    this.emit({ type: 'error', message: `"${trackTitle}" 无法播放，正在跳转下一首` });
    await this.next();
  }

  private handleWaiting(): void {
    if (this.currentTrack) {
      this.setActivity('buffering');
    }
  }

  private handlePlaying(): void {
    this.setActivity('idle');
  }

  private handleStalled(): void {
    if (this.currentTrack) {
      this.setActivity('buffering');
    }
  }

  private handleSeeking(): void {
    if (this.currentTrack) {
      this.setActivity('seeking');
    }
  }

  private handleSeeked(): void {
    this.setActivity('idle');
  }

  /**
   * 加载并播放指定 Track
   * 从 API 获取 URL，处理错误时自动跳转下一首
   */
  private async loadAndPlay(track: Track): Promise<void> {
    this.currentTrack = track;
    this.emit({ type: 'trackChanged', track });
    this.setActivity('loading');

    try {
      const url = await this.apiAdapter.getTrackUrl(track.id, this.quality);
      this.audio.src = url;
      await this.audio.play();
      this.isPlaying = true;
      this.setActivity('idle');
      this.emitStateChanged();
    } catch (error) {
      this.setActivity('idle');
      // 音源 URL 无效时自动跳转下一首并提示
      this.emit({
        type: 'error',
        message: `"${track.title}" 暂时无法播放`,
      });
      // 尝试播放下一首（避免无限循环）
      const nextIndex = this.getNextIndex();
      if (nextIndex !== -1 && nextIndex !== this.currentIndex) {
        this.currentIndex = nextIndex;
        await this.loadAndPlay(this.playlist[this.currentIndex]);
      } else {
        // 没有可播放的下一首，停止
        this.isPlaying = false;
        this.emitStateChanged();
      }
    }
  }

  private setActivity(activity: PlaybackActivity): void {
    if (this.activity === activity) return;
    this.activity = activity;
    this.emit({ type: 'activityChanged', activity });
  }

  /**
   * 根据播放模式计算下一首索引
   * @returns 下一首索引，-1 表示没有下一首（Sequential 模式末尾）
   */
  private getNextIndex(): number {
    if (this.playlist.length === 0) return -1;

    switch (this.playMode) {
      case PlayMode.Sequential:
        if (this.currentIndex >= this.playlist.length - 1) {
          return -1; // 到达末尾，停止
        }
        return this.currentIndex + 1;

      case PlayMode.RepeatOne:
        return this.currentIndex;

      case PlayMode.Shuffle:
        if (this.playlist.length === 1) return 0;
        // 随机选择一个不同于当前的索引
        let randomIndex: number;
        do {
          randomIndex = Math.floor(Math.random() * this.playlist.length);
        } while (randomIndex === this.currentIndex);
        return randomIndex;

      default:
        return this.currentIndex + 1;
    }
  }

  /**
   * 根据播放模式计算上一首索引
   * @returns 上一首索引，-1 表示没有上一首
   */
  private getPreviousIndex(): number {
    if (this.playlist.length === 0) return -1;

    switch (this.playMode) {
      case PlayMode.Sequential:
        if (this.currentIndex <= 0) {
          return -1; // 已经是第一首
        }
        return this.currentIndex - 1;

      case PlayMode.RepeatOne:
        return this.currentIndex;

      case PlayMode.Shuffle:
        if (this.playlist.length === 1) return 0;
        let randomIndex: number;
        do {
          randomIndex = Math.floor(Math.random() * this.playlist.length);
        } while (randomIndex === this.currentIndex);
        return randomIndex;

      default:
        return this.currentIndex - 1;
    }
  }

  /** 发送状态变更事件 */
  private emitStateChanged(): void {
    this.emit({ type: 'stateChanged', state: this.getCurrentState() });
  }

  /** 发送事件给所有监听器 */
  private emit(event: PlaybackEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
