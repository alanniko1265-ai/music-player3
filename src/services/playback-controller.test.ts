import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackController } from './playback-controller';
import type { MusicAPIAdapter } from './music-api-adapter';
import type { Track } from '../types/index';
import { PlayMode } from '../types/index';

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
    // Helper to trigger events in tests
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

describe('PlaybackController', () => {
  let controller: PlaybackController;
  let mockAudio: ReturnType<typeof createMockAudio>;
  let mockAdapter: MusicAPIAdapter;

  beforeEach(() => {
    mockAudio = createMockAudio();
    mockAdapter = createMockAdapter();
    controller = new PlaybackController(mockAdapter, mockAudio as any);
  });

  describe('play', () => {
    it('should get track URL from API and start playing', async () => {
      const track = createTrack('1');
      await controller.play(track);

      expect(mockAdapter.getTrackUrl).toHaveBeenCalledWith('1');
      expect(mockAudio.src).toBe('http://example.com/track.mp3');
      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('should update current state after playing', async () => {
      const track = createTrack('1');
      await controller.play(track);

      const state = controller.getCurrentState();
      expect(state.currentTrack).toEqual(track);
      expect(state.isPlaying).toBe(true);
    });

    it('should add track to playlist if not already present', async () => {
      const track = createTrack('1');
      await controller.play(track);

      expect(controller.getPlaylist()).toHaveLength(1);
      expect(controller.getCurrentIndex()).toBe(0);
    });

    it('should update index if track is already in playlist', async () => {
      const tracks = [createTrack('1'), createTrack('2'), createTrack('3')];
      controller.setPlaylist(tracks);

      await controller.play(tracks[2]);

      expect(controller.getCurrentIndex()).toBe(2);
      expect(controller.getPlaylist()).toHaveLength(3);
    });

    it('should emit trackChanged event', async () => {
      const track = createTrack('1');
      const listener = vi.fn();
      controller.on(listener);

      await controller.play(track);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'trackChanged', track })
      );
    });

    it('should emit error and skip to next on URL fetch failure', async () => {
      (mockAdapter.getTrackUrl as any)
        .mockRejectedValueOnce(new Error('URL not available'))
        .mockResolvedValueOnce('http://example.com/track2.mp3');

      const tracks = [createTrack('1'), createTrack('2')];
      controller.setPlaylist(tracks);

      const listener = vi.fn();
      controller.on(listener);

      await controller.play(tracks[0]);

      // Should have emitted an error
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
      // Should have tried to play next track
      expect(mockAdapter.getTrackUrl).toHaveBeenCalledWith('2');
    });
  });

  describe('pause', () => {
    it('should pause audio and update state', async () => {
      const track = createTrack('1');
      await controller.play(track);

      controller.pause();

      expect(mockAudio.pause).toHaveBeenCalled();
      expect(controller.getCurrentState().isPlaying).toBe(false);
    });

    it('should not pause if not playing', () => {
      controller.pause();
      // pause should not be called on audio if not playing
      // (only called during construction setup is not counted)
      expect(controller.getCurrentState().isPlaying).toBe(false);
    });
  });

  describe('resume', () => {
    it('should resume playing and update state', async () => {
      const track = createTrack('1');
      await controller.play(track);
      controller.pause();

      controller.resume();

      expect(mockAudio.play).toHaveBeenCalled();
      expect(controller.getCurrentState().isPlaying).toBe(true);
    });

    it('should not resume if no track is loaded', () => {
      controller.resume();
      expect(controller.getCurrentState().isPlaying).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop audio, reset state, and clear current track', async () => {
      const track = createTrack('1');
      await controller.play(track);

      controller.stop();

      expect(mockAudio.pause).toHaveBeenCalled();
      expect(mockAudio.currentTime).toBe(0);
      expect(controller.getCurrentState().isPlaying).toBe(false);
      expect(controller.getCurrentState().currentTrack).toBeNull();
      expect(controller.getCurrentIndex()).toBe(-1);
    });
  });

  describe('seek', () => {
    it('should set audio currentTime to the specified position', async () => {
      const track = createTrack('1');
      await controller.play(track);

      controller.seek(120);

      expect(mockAudio.currentTime).toBe(120);
    });

    it('should clamp position to 0 when negative', async () => {
      const track = createTrack('1');
      await controller.play(track);

      controller.seek(-10);

      expect(mockAudio.currentTime).toBe(0);
    });

    it('should clamp position to duration when exceeding', async () => {
      const track = createTrack('1');
      await controller.play(track);
      // mockAudio.duration is 240

      controller.seek(300);

      expect(mockAudio.currentTime).toBe(240);
    });
  });

  describe('setVolume', () => {
    it('should set volume and convert to 0-1 range for audio', () => {
      controller.setVolume(50);

      expect(controller.getCurrentState().volume).toBe(50);
      expect(mockAudio.volume).toBe(0.5);
    });

    it('should clamp volume to 0 when negative', () => {
      controller.setVolume(-20);

      expect(controller.getCurrentState().volume).toBe(0);
      expect(mockAudio.volume).toBe(0);
    });

    it('should clamp volume to 100 when exceeding', () => {
      controller.setVolume(150);

      expect(controller.getCurrentState().volume).toBe(100);
      expect(mockAudio.volume).toBe(1);
    });

    it('should handle boundary values correctly', () => {
      controller.setVolume(0);
      expect(controller.getCurrentState().volume).toBe(0);

      controller.setVolume(100);
      expect(controller.getCurrentState().volume).toBe(100);
    });
  });

  describe('setPlayMode', () => {
    it('should update play mode', () => {
      controller.setPlayMode(PlayMode.Shuffle);
      expect(controller.getCurrentState().playMode).toBe(PlayMode.Shuffle);

      controller.setPlayMode(PlayMode.RepeatOne);
      expect(controller.getCurrentState().playMode).toBe(PlayMode.RepeatOne);

      controller.setPlayMode(PlayMode.Sequential);
      expect(controller.getCurrentState().playMode).toBe(PlayMode.Sequential);
    });
  });

  describe('next - Sequential mode', () => {
    it('should play next track in sequence', async () => {
      const tracks = [createTrack('1'), createTrack('2'), createTrack('3')];
      controller.setPlaylist(tracks);
      await controller.play(tracks[0]);

      await controller.next();

      expect(controller.getCurrentIndex()).toBe(1);
      expect(mockAdapter.getTrackUrl).toHaveBeenCalledWith('2');
    });

    it('should stop at end of playlist in Sequential mode', async () => {
      const tracks = [createTrack('1'), createTrack('2')];
      controller.setPlaylist(tracks);
      await controller.play(tracks[1]); // Start at last track

      await controller.next();

      expect(controller.getCurrentState().isPlaying).toBe(false);
    });
  });

  describe('next - RepeatOne mode', () => {
    it('should replay the same track', async () => {
      const tracks = [createTrack('1'), createTrack('2')];
      controller.setPlaylist(tracks);
      controller.setPlayMode(PlayMode.RepeatOne);
      await controller.play(tracks[0]);

      await controller.next();

      expect(controller.getCurrentIndex()).toBe(0);
      expect(mockAdapter.getTrackUrl).toHaveBeenCalledWith('1');
    });
  });

  describe('next - Shuffle mode', () => {
    it('should play a different track than the current one', async () => {
      const tracks = [createTrack('1'), createTrack('2'), createTrack('3')];
      controller.setPlaylist(tracks);
      controller.setPlayMode(PlayMode.Shuffle);
      await controller.play(tracks[0]);

      // After calling next, the index should be different from 0 (the starting index)
      await controller.next();
      const nextIndex = controller.getCurrentIndex();
      expect(nextIndex).not.toBe(0);
      expect(nextIndex).toBeGreaterThanOrEqual(0);
      expect(nextIndex).toBeLessThan(tracks.length);
    });

    it('should return index 0 when playlist has only one track', async () => {
      const tracks = [createTrack('1')];
      controller.setPlaylist(tracks);
      controller.setPlayMode(PlayMode.Shuffle);
      await controller.play(tracks[0]);

      await controller.next();

      expect(controller.getCurrentIndex()).toBe(0);
    });
  });

  describe('previous - Sequential mode', () => {
    it('should play previous track in sequence', async () => {
      const tracks = [createTrack('1'), createTrack('2'), createTrack('3')];
      controller.setPlaylist(tracks);
      await controller.play(tracks[2]);

      await controller.previous();

      expect(controller.getCurrentIndex()).toBe(1);
      expect(mockAdapter.getTrackUrl).toHaveBeenCalledWith('2');
    });

    it('should seek to beginning when at first track', async () => {
      const tracks = [createTrack('1'), createTrack('2')];
      controller.setPlaylist(tracks);
      await controller.play(tracks[0]);
      mockAudio.currentTime = 60; // Simulate some playback

      await controller.previous();

      expect(mockAudio.currentTime).toBe(0);
    });
  });

  describe('audio ended event', () => {
    it('should auto-advance to next track when current track ends', async () => {
      const tracks = [createTrack('1'), createTrack('2')];
      controller.setPlaylist(tracks);
      await controller.play(tracks[0]);

      // Simulate track ending
      mockAudio._emit('ended');

      // Wait for async next() to complete
      await vi.waitFor(() => {
        expect(mockAdapter.getTrackUrl).toHaveBeenCalledWith('2');
      });
    });

    it('should emit ended event', async () => {
      const tracks = [createTrack('1'), createTrack('2')];
      controller.setPlaylist(tracks);
      await controller.play(tracks[0]);

      const listener = vi.fn();
      controller.on(listener);

      mockAudio._emit('ended');

      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'ended' })
        );
      });
    });
  });

  describe('audio error event', () => {
    it('should skip to next track on audio error', async () => {
      const tracks = [createTrack('1'), createTrack('2')];
      controller.setPlaylist(tracks);
      await controller.play(tracks[0]);

      // Simulate audio error
      mockAudio._emit('error');

      await vi.waitFor(() => {
        expect(mockAdapter.getTrackUrl).toHaveBeenCalledWith('2');
      });
    });

    it('should emit error event with track title', async () => {
      const tracks = [createTrack('1', 'My Song')];
      controller.setPlaylist(tracks);
      await controller.play(tracks[0]);

      const listener = vi.fn();
      controller.on(listener);

      mockAudio._emit('error');

      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            message: expect.stringContaining('My Song'),
          })
        );
      });
    });
  });

  describe('setPlaylist', () => {
    it('should set the playlist', () => {
      const tracks = [createTrack('1'), createTrack('2')];
      controller.setPlaylist(tracks);

      expect(controller.getPlaylist()).toEqual(tracks);
    });

    it('should update currentIndex if current track is in new playlist', async () => {
      const tracks = [createTrack('1'), createTrack('2'), createTrack('3')];
      controller.setPlaylist(tracks);
      await controller.play(tracks[1]);

      // Set a new playlist that still contains track '2'
      const newTracks = [createTrack('3'), createTrack('2')];
      controller.setPlaylist(newTracks);

      expect(controller.getCurrentIndex()).toBe(1); // track '2' is at index 1 in new list
    });
  });

  describe('getCurrentState', () => {
    it('should return initial state', () => {
      const state = controller.getCurrentState();

      expect(state.currentTrack).toBeNull();
      expect(state.isPlaying).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.volume).toBe(80);
      expect(state.playMode).toBe(PlayMode.Sequential);
    });

    it('should reflect current playback state', async () => {
      const track = createTrack('1');
      await controller.play(track);

      const state = controller.getCurrentState();
      expect(state.currentTrack).toEqual(track);
      expect(state.isPlaying).toBe(true);
    });
  });

  describe('event listeners', () => {
    it('should register and call listeners', async () => {
      const listener = vi.fn();
      controller.on(listener);

      const track = createTrack('1');
      await controller.play(track);

      expect(listener).toHaveBeenCalled();
    });

    it('should remove listeners with off()', async () => {
      const listener = vi.fn();
      controller.on(listener);
      controller.off(listener);

      const track = createTrack('1');
      await controller.play(track);

      // Listener should not be called after removal
      // (it may have been called during on/off setup, so check specific events)
      // After off, no more calls should happen
      listener.mockClear();
      controller.setVolume(50);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clean up audio and listeners', () => {
      const listener = vi.fn();
      controller.on(listener);

      controller.destroy();

      expect(mockAudio.pause).toHaveBeenCalled();
      expect(mockAudio.src).toBe('');
      expect(mockAudio.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty playlist for next()', async () => {
      await controller.next();
      // Should not throw, just do nothing
      expect(controller.getCurrentState().isPlaying).toBe(false);
    });

    it('should handle empty playlist for previous()', async () => {
      await controller.previous();
      // Should not throw, just do nothing
      expect(controller.getCurrentState().isPlaying).toBe(false);
    });

    it('should handle seek when no track is loaded (duration is 0)', () => {
      // When no track is loaded, duration is 0
      Object.defineProperty(mockAudio, 'duration', { value: 0, writable: true });
      controller.seek(50);
      expect(mockAudio.currentTime).toBe(0);
    });
  });
});
