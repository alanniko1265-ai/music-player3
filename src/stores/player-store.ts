/**
 * PlayerStore - Pinia 播放器状态管理
 * 封装 PlaybackController，提供响应式播放状态和操作
 * 启动时从本地存储恢复播放状态，关键状态变更时自动持久化
 */

import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { Track, PlaybackState } from '../types/index';
import { PlayMode, AudioQuality } from '../types/index';
import { PlaybackController } from '../services/playback-controller';
import type { IPlaybackController, PlaybackEvent } from '../services/playback-controller';
import type { MusicAPIAdapter } from '../services/music-api-adapter';
import { storageService } from '../services/ipc-renderer';

/** 存储键名 */
const STORAGE_KEY_PLAYBACK_STATE = 'playbackState';
const STORAGE_KEY_PLAYLIST = 'playerPlaylist';
const STORAGE_KEY_QUALITY = 'audioQuality';

/** 默认播放状态 */
const DEFAULT_PLAYBACK_STATE: PlaybackState = {
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 80,
  playMode: PlayMode.Sequential,
};

export const usePlayerStore = defineStore('player', () => {
  // ========== Reactive State ==========

  /** 当前播放曲目 */
  const currentTrack = ref<Track | null>(null);
  /** 是否正在播放 */
  const isPlaying = ref(false);
  /** 当前播放时间（秒） */
  const currentTime = ref(0);
  /** 曲目总时长（秒） */
  const duration = ref(0);
  /** 音量（0-100） */
  const volume = ref(80);
  /** 播放模式 */
  const playMode = ref<PlayMode>(PlayMode.Sequential);
  /** 当前播放队列 */
  const playlist = ref<Track[]>([]);
  /** 音质等级 */
  const quality = ref<AudioQuality>(AudioQuality.Standard);
  /** 错误消息 */
  const errorMessage = ref<string | null>(null);
  /** 是否已初始化 */
  const initialized = ref(false);

  // ========== Internal State ==========

  /** PlaybackController 实例 */
  let controller: IPlaybackController | null = null;
  /** 进度更新定时器 */
  let progressTimer: ReturnType<typeof setInterval> | null = null;
  /** 状态保存防抖定时器 */
  let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ========== Computed ==========

  /** 播放进度百分比（0-100） */
  const progress = computed(() => {
    if (duration.value === 0) return 0;
    return (currentTime.value / duration.value) * 100;
  });

  /** 当前播放状态快照 */
  const playbackState = computed<PlaybackState>(() => ({
    currentTrack: currentTrack.value,
    isPlaying: isPlaying.value,
    currentTime: currentTime.value,
    duration: duration.value,
    volume: volume.value,
    playMode: playMode.value,
  }));

  // ========== Actions ==========

  /**
   * 初始化 PlayerStore
   * 创建 PlaybackController 实例并从本地存储恢复状态
   * @param apiAdapter 音乐 API 适配器
   * @param audio 可选的 HTMLAudioElement（用于测试注入）
   */
  async function initialize(apiAdapter: MusicAPIAdapter, audio?: HTMLAudioElement): Promise<void> {
    if (controller) {
      controller.destroy();
    }

    controller = new PlaybackController(apiAdapter, audio);
    controller.on(handlePlaybackEvent);

    // 从本地存储恢复播放状态
    await restoreState();

    // 启动进度更新定时器
    startProgressTimer();

    initialized.value = true;
  }

  /**
   * 播放指定曲目
   * @param track 要播放的曲目
   */
  async function playTrack(track: Track): Promise<void> {
    if (!controller) return;

    await controller.play(track);
    // 状态通过事件监听器更新
  }

  /** 暂停播放 */
  function pause(): void {
    if (!controller) return;
    controller.pause();
  }

  /** 恢复播放 */
  function resume(): void {
    if (!controller) return;
    controller.resume();
  }

  /** 播放下一首 */
  async function next(): Promise<void> {
    if (!controller) return;
    await controller.next();
  }

  /** 播放上一首 */
  async function previous(): Promise<void> {
    if (!controller) return;
    await controller.previous();
  }

  /**
   * 跳转到指定播放位置
   * @param position 目标位置（秒）
   */
  function seek(position: number): void {
    if (!controller) return;
    controller.seek(position);
    currentTime.value = position;
    debounceSaveState();
  }

  /**
   * 设置音量
   * @param vol 音量值（0-100）
   */
  function setVolume(vol: number): void {
    if (!controller) return;
    controller.setVolume(vol);
    volume.value = Math.max(0, Math.min(100, vol));
    debounceSaveState();
  }

  /**
   * 设置播放模式
   * @param mode 播放模式
   */
  function setPlayMode(mode: PlayMode): void {
    if (!controller) return;
    controller.setPlayMode(mode);
    playMode.value = mode;
    debounceSaveState();
  }

  /**
   * 设置播放队列
   * @param tracks 曲目列表
   */
  function setPlaylist(tracks: Track[]): void {
    if (!controller) return;
    controller.setPlaylist(tracks);
    playlist.value = [...tracks];
    debounceSaveState();
  }

  function setApiAdapter(apiAdapter: MusicAPIAdapter): void {
    controller?.setApiAdapter(apiAdapter);
  }

  /**
   * 设置音质等级
   * 切换后重新获取当前歌曲 URL 并恢复播放位置
   */
  async function setQuality(newQuality: AudioQuality): Promise<void> {
    if (newQuality === quality.value) return;
    quality.value = newQuality;
    controller?.setQuality(newQuality);
    await storageService.save(STORAGE_KEY_QUALITY, newQuality);

    // 如果当前有歌曲，重新加载以应用新音质
    if (currentTrack.value && controller) {
      const wasPlaying = isPlaying.value;
      const savedTime = currentTime.value;
      try {
        await controller.play(currentTrack.value);
        if (!wasPlaying) controller.pause();
        controller.seek(savedTime);
      } catch {
        // 新音质不可用时静默回退
      }
    }
  }

  /** 清除错误消息 */
  function clearError(): void {
    errorMessage.value = null;
  }

  /** 销毁 store，清理资源 */
  function destroy(): void {
    stopProgressTimer();
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
    }
    if (controller) {
      controller.off(handlePlaybackEvent);
      controller.destroy();
      controller = null;
    }
    initialized.value = false;
  }

  // ========== Internal Methods ==========

  /**
   * 处理 PlaybackController 事件
   * 同步 controller 状态到 store 响应式状态
   */
  function handlePlaybackEvent(event: PlaybackEvent): void {
    switch (event.type) {
      case 'stateChanged':
        syncState(event.state);
        break;
      case 'trackChanged':
        currentTrack.value = event.track;
        if (controller) {
          playlist.value = controller.getPlaylist();
        }
        debounceSaveState();
        break;
      case 'error':
        errorMessage.value = event.message;
        break;
      case 'ended':
        // ended 事件后 controller 会自动调用 next()，状态通过 stateChanged 更新
        break;
    }
  }

  /**
   * 同步 PlaybackState 到响应式状态
   */
  function syncState(state: PlaybackState): void {
    currentTrack.value = state.currentTrack;
    isPlaying.value = state.isPlaying;
    currentTime.value = state.currentTime;
    duration.value = state.duration;
    volume.value = state.volume;
    playMode.value = state.playMode;
  }

  /**
   * 从本地存储恢复播放状态
   */
  async function restoreState(): Promise<void> {
    try {
      const savedState = await storageService.load<PlaybackState>(
        STORAGE_KEY_PLAYBACK_STATE,
        DEFAULT_PLAYBACK_STATE
      );

      const savedPlaylist = await storageService.load<Track[]>(
        STORAGE_KEY_PLAYLIST,
        []
      );

      // 恢复音质设置
      const savedQuality = await storageService.load<AudioQuality>(
        STORAGE_KEY_QUALITY,
        AudioQuality.Standard
      );
      quality.value = savedQuality;
      controller?.setQuality(savedQuality);

      // 恢复音量和播放模式
      if (savedState.volume !== undefined) {
        volume.value = savedState.volume;
        controller?.setVolume(savedState.volume);
      }

      if (savedState.playMode !== undefined) {
        playMode.value = savedState.playMode;
        controller?.setPlayMode(savedState.playMode);
      }

      // 恢复播放队列
      if (savedPlaylist.length > 0) {
        playlist.value = savedPlaylist;
        controller?.setPlaylist(savedPlaylist);
      }

      // 恢复当前曲目信息（不自动播放）
      if (savedState.currentTrack) {
        currentTrack.value = savedState.currentTrack;
        currentTime.value = savedState.currentTime || 0;
        duration.value = savedState.duration || 0;
      }
    } catch {
      // 恢复失败时使用默认状态，静默处理
      console.warn('Failed to restore playback state from storage');
    }
  }

  /**
   * 保存当前播放状态到本地存储
   */
  async function saveState(): Promise<void> {
    try {
      const stateToSave: PlaybackState = {
        currentTrack: currentTrack.value,
        isPlaying: false, // 不保存播放状态，启动时不自动播放
        currentTime: currentTime.value,
        duration: duration.value,
        volume: volume.value,
        playMode: playMode.value,
      };

      await storageService.save(STORAGE_KEY_PLAYBACK_STATE, stateToSave);
      await storageService.save(STORAGE_KEY_PLAYLIST, playlist.value);
    } catch {
      // 保存失败静默处理
      console.warn('Failed to save playback state to storage');
    }
  }

  /**
   * 防抖保存状态（避免频繁写入）
   * 延迟 1 秒后保存，期间如有新的保存请求则重置计时
   */
  function debounceSaveState(): void {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
    }
    saveDebounceTimer = setTimeout(() => {
      saveState();
      saveDebounceTimer = null;
    }, 1000);
  }

  /**
   * 启动进度更新定时器
   * 每 500ms 从 controller 同步当前播放时间
   */
  function startProgressTimer(): void {
    stopProgressTimer();
    progressTimer = setInterval(() => {
      if (controller && isPlaying.value) {
        const state = controller.getCurrentState();
        currentTime.value = state.currentTime;
        duration.value = state.duration;
      }
    }, 500);
  }

  /** 停止进度更新定时器 */
  function stopProgressTimer(): void {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }

  return {
    // State
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playMode,
    quality,
    playlist,
    errorMessage,
    initialized,

    // Computed
    progress,
    playbackState,

    // Actions
    initialize,
    playTrack,
    pause,
    resume,
    next,
    previous,
    seek,
    setVolume,
    setPlayMode,
    setPlaylist,
    setApiAdapter,
    setQuality,
    clearError,
    destroy,
  };
});
