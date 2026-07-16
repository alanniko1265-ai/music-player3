/**
 * PlayerStore 单元测试
 * 测试 Pinia 状态管理层对 PlaybackController 的封装
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePlayerStore } from './player-store';
import type { Track } from '../types/index';
import { PlayMode } from '../types/index';
import type { MusicAPIAdapter } from '../services/music-api-adapter';

// Mock storageService
vi.mock('../services/ipc-renderer', () => ({
  storageService: {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

import { storageService } from '../services/ipc-renderer';

/**
 * 创建 mock HTMLAudioElement
 */
function createMockAudio() {
  const listeners: Record<string, Function[]> = {};
  const mockAudio = {
    src: '',
    currentTime: 0,
    duration: 240,
    volume: 0.8,
    paused: true,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockImplementation(function (this: any) {
      this.paused = true;
    }),
    addEventListener: vi.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      }
    }),
    _emit: (event: string) => {
      if (listeners[event]) {
        listeners[event].forEach((h) => h());
      }
    },
  } as unknown as HTMLAudioElement & { _emit: (event: string) => void };

  return mockAudio;
}

/**
 * 创建 mock MusicAPIAdapter
 */
function createMockAdapter(): MusicAPIAdapter {
  return {
    search: vi.fn(),
    getTrackUrl: vi.fn().mockResolvedValue('http://example.com/track.mp3'),
    getLyrics: vi.fn().mockResolvedValue([]),
    getSearchSuggestions: vi.fn().mockResolvedValue([]),
  };
}

/**
 * 创建测试用 Track
 */
function createTrack(id: string, title?: string): Track {
  return {
    id,
    title: title || `Track ${id}`,
    artist: 'Test Artist',
    album: 'Test Album',
    duration: 240,
    coverUrl: 'http://example.com/cover.jpg',
    source: 'netease',
  };
}

describe('PlayerStore', () => {
  let store: ReturnType<typeof usePlayerStore>;
  let mockAudio: ReturnType<typeof createMockAudio>;
  let mockAdapter: MusicAPIAdapter;

  beforeEach(async () => {
    vi.useFakeTimers();
    setActivePinia(createPinia());

    mockAudio = createMockAudio();
    mockAdapter = createMockAdapter();

    // Default: storageService.load returns default values
    (storageService.load as any).mockImplementation((_key: string, defaultValue: any) => {
      return Promise.resolve(defaultValue);
    });

    store = usePlayerStore();
    await store.initialize(mockAdapter, mockAudio as any);
  });

  afterEach(() => {
    store.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      expect(store.currentTrack).toBeNull();
      expect(store.isPlaying).toBe(false);
      expect(store.currentTime).toBe(0);
      // duration may reflect the mock audio's default duration property
      expect(store.volume).toBe(80);
      expect(store.playMode).toBe(PlayMode.Sequential);
      expect(store.playlist).toEqual([]);
      expect(store.playbackActivity).toBe('idle');
      expect(store.initialized).toBe(true);
    });

    it('should restore saved state from storage on initialization', async () => {
      store.destroy();

      const savedState = {
        currentTrack: createTrack('saved-1', 'Saved Track'),
        isPlaying: true,
        currentTime: 60,
        duration: 240,
        volume: 50,
        playMode: PlayMode.Shuffle,
      };
      const savedPlaylist = [createTrack('saved-1'), createTrack('saved-2')];

      (storageService.load as any).mockImplementation((key: string, defaultValue: any) => {
        if (key === 'playbackState') return Promise.resolve(savedState);
        if (key === 'playerPlaylist') return Promise.resolve(savedPlaylist);
        return Promise.resolve(defaultValue);
      });

      const newStore = usePlayerStore();
      await newStore.initialize(mockAdapter, createMockAudio() as any);

      expect(newStore.volume).toBe(50);
      expect(newStore.playMode).toBe(PlayMode.Shuffle);
      expect(newStore.currentTrack).toEqual(savedState.currentTrack);
      expect(newStore.currentTime).toBe(60);
      expect(newStore.playlist).toEqual(savedPlaylist);

      newStore.destroy();
    });

    it('should handle storage load failure gracefully', async () => {
      store.destroy();

      (storageService.load as any).mockRejectedValue(new Error('Storage error'));

      const newStore = usePlayerStore();
      // Should not throw
      await newStore.initialize(mockAdapter, createMockAudio() as any);

      expect(newStore.initialized).toBe(true);
      expect(newStore.volume).toBe(80); // default

      newStore.destroy();
    });
  });

  describe('playTrack', () => {
    it('should play a track and update state', async () => {
      const track = createTrack('1');
      await store.playTrack(track);

      expect(store.currentTrack).toEqual(track);
      expect(store.isPlaying).toBe(true);
      expect(mockAdapter.getTrackUrl).toHaveBeenCalledWith('1', 'standard');
    });

    it('should update playlist when playing a new track', async () => {
      const track = createTrack('1');
      await store.playTrack(track);

      expect(store.playlist).toHaveLength(1);
      expect(store.playlist[0]).toEqual(track);
    });
  });

  describe('playback activity', () => {
    it('tracks buffering and seeking events from the audio element', async () => {
      await store.playTrack(createTrack('1'));

      mockAudio._emit('waiting');
      expect(store.playbackActivity).toBe('buffering');

      mockAudio._emit('playing');
      expect(store.playbackActivity).toBe('idle');

      mockAudio._emit('seeking');
      expect(store.playbackActivity).toBe('seeking');

      mockAudio._emit('seeked');
      expect(store.playbackActivity).toBe('idle');
    });
  });

  describe('pause', () => {
    it('should pause playback and update state', async () => {
      const track = createTrack('1');
      await store.playTrack(track);

      store.pause();

      expect(store.isPlaying).toBe(false);
      expect(mockAudio.pause).toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    it('should resume playback and update state', async () => {
      const track = createTrack('1');
      await store.playTrack(track);
      store.pause();

      store.resume();

      expect(store.isPlaying).toBe(true);
    });
  });

  describe('next', () => {
    it('should advance to next track', async () => {
      const tracks = [createTrack('1'), createTrack('2'), createTrack('3')];
      store.setPlaylist(tracks);
      await store.playTrack(tracks[0]);

      await store.next();

      expect(store.currentTrack).toEqual(tracks[1]);
    });
  });

  describe('previous', () => {
    it('should go to previous track', async () => {
      const tracks = [createTrack('1'), createTrack('2'), createTrack('3')];
      store.setPlaylist(tracks);
      await store.playTrack(tracks[2]);

      await store.previous();

      expect(store.currentTrack).toEqual(tracks[1]);
    });
  });

  describe('seek', () => {
    it('should update currentTime', async () => {
      const track = createTrack('1');
      await store.playTrack(track);

      store.seek(120);

      expect(store.currentTime).toBe(120);
      expect(mockAudio.currentTime).toBe(120);
    });
  });

  describe('setVolume', () => {
    it('should update volume', () => {
      store.setVolume(60);

      expect(store.volume).toBe(60);
      expect(mockAudio.volume).toBe(0.6);
    });

    it('should clamp volume to [0, 100]', () => {
      store.setVolume(-10);
      expect(store.volume).toBe(0);

      store.setVolume(150);
      expect(store.volume).toBe(100);
    });
  });

  describe('setPlayMode', () => {
    it('should update play mode', () => {
      store.setPlayMode(PlayMode.Shuffle);
      expect(store.playMode).toBe(PlayMode.Shuffle);

      store.setPlayMode(PlayMode.RepeatOne);
      expect(store.playMode).toBe(PlayMode.RepeatOne);
    });
  });

  describe('setPlaylist', () => {
    it('should update the playlist', () => {
      const tracks = [createTrack('1'), createTrack('2')];
      store.setPlaylist(tracks);

      expect(store.playlist).toEqual(tracks);
    });
  });

  describe('computed properties', () => {
    it('progress should be 0 when duration is 0', () => {
      expect(store.progress).toBe(0);
    });

    it('playbackState should reflect current state', async () => {
      const track = createTrack('1');
      await store.playTrack(track);

      const state = store.playbackState;
      expect(state.currentTrack).toEqual(track);
      expect(state.isPlaying).toBe(true);
      expect(state.volume).toBe(80);
      expect(state.playMode).toBe(PlayMode.Sequential);
    });
  });

  describe('state persistence', () => {
    it('should debounce save state on volume change', async () => {
      store.setVolume(50);

      // Should not save immediately
      expect(storageService.save).not.toHaveBeenCalledWith('playbackState', expect.anything());

      // Advance timer past debounce delay
      vi.advanceTimersByTime(1100);

      expect(storageService.save).toHaveBeenCalledWith(
        'playbackState',
        expect.objectContaining({ volume: 50 })
      );
    });

    it('should debounce save state on play mode change', async () => {
      store.setPlayMode(PlayMode.Shuffle);

      vi.advanceTimersByTime(1100);

      expect(storageService.save).toHaveBeenCalledWith(
        'playbackState',
        expect.objectContaining({ playMode: PlayMode.Shuffle })
      );
    });

    it('should save isPlaying as false (do not auto-play on restart)', async () => {
      const track = createTrack('1');
      await store.playTrack(track);

      vi.advanceTimersByTime(1100);

      expect(storageService.save).toHaveBeenCalledWith(
        'playbackState',
        expect.objectContaining({ isPlaying: false })
      );
    });
  });

  describe('error handling', () => {
    it('should set errorMessage on playback error', async () => {
      (mockAdapter.getTrackUrl as any).mockRejectedValue(new Error('Network error'));

      const track = createTrack('1', 'Error Track');
      await store.playTrack(track);

      expect(store.errorMessage).toBeTruthy();
    });

    it('should clear error message', async () => {
      (mockAdapter.getTrackUrl as any).mockRejectedValue(new Error('Network error'));

      const track = createTrack('1');
      await store.playTrack(track);

      store.clearError();
      expect(store.errorMessage).toBeNull();
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      store.destroy();

      expect(store.initialized).toBe(false);
      expect(mockAudio.pause).toHaveBeenCalled();
    });
  });
});
