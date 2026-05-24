/**
 * Property 5: 播放模式决定下一首逻辑
 * Validates: Requirements 2.5, 2.6
 *
 * For any playlist and current position, when the current Track ends:
 * - Sequential: next SHALL be index+1 (stop at end)
 * - RepeatOne: next SHALL be the same track
 * - Shuffle: next SHALL be a valid track in the queue
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { PlaybackController } from '../playback-controller';
import type { MusicAPIAdapter } from '../music-api-adapter';
import type { Track, MusicSource } from '../../types/index';
import { PlayMode } from '../../types/index';

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
  } as unknown as HTMLAudioElement;

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

/** Arbitrary for MusicSource */
const musicSourceArb: fc.Arbitrary<MusicSource> = fc.constantFrom('netease', 'qq');

/** Arbitrary for a valid Track with unique id */
function trackArb(idSuffix: number): fc.Arbitrary<Track> {
  return fc.record({
    id: fc.constant(`track-${idSuffix}`),
    title: fc.string({ minLength: 1, maxLength: 30 }),
    artist: fc.string({ minLength: 1, maxLength: 30 }),
    album: fc.string({ minLength: 1, maxLength: 30 }),
    duration: fc.integer({ min: 1, max: 600 }),
    coverUrl: fc.constant('http://example.com/cover.jpg'),
    source: musicSourceArb,
  });
}

/** Generate a playlist of 1-20 tracks with unique IDs */
const playlistArb: fc.Arbitrary<Track[]> = fc
  .integer({ min: 1, max: 20 })
  .chain((size) =>
    fc.tuple(...Array.from({ length: size }, (_, i) => trackArb(i)))
  );

describe('Property 5: 播放模式决定下一首逻辑', () => {
  beforeEach(() => {
    createMockAudio();
    createMockAdapter();
  });

  /**
   * **Validates: Requirements 2.5, 2.6**
   *
   * Sequential mode: next index is currentIndex+1, or stops at end
   */
  it('Sequential mode: next SHALL be index+1, or stop at end', async () => {
    await fc.assert(
      fc.asyncProperty(
        playlistArb,
        fc.integer({ min: 0, max: 19 }),
        async (playlist, rawIndex) => {
          const currentIndex = rawIndex % playlist.length;

          // Create fresh mocks for each run
          const audio = createMockAudio();
          const adapter = createMockAdapter();
          const controller = new PlaybackController(adapter, audio as any);

          controller.setPlaylist(playlist);
          controller.setPlayMode(PlayMode.Sequential);
          await controller.play(playlist[currentIndex]);

          // Call next
          await controller.next();

          if (currentIndex >= playlist.length - 1) {
            // At end of playlist: should stop playing
            expect(controller.getCurrentState().isPlaying).toBe(false);
          } else {
            // Should advance to next index
            expect(controller.getCurrentIndex()).toBe(currentIndex + 1);
          }

          controller.destroy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.5, 2.6**
   *
   * RepeatOne mode: next SHALL be the same track
   */
  it('RepeatOne mode: next SHALL be the same track', async () => {
    await fc.assert(
      fc.asyncProperty(
        playlistArb,
        fc.integer({ min: 0, max: 19 }),
        async (playlist, rawIndex) => {
          const currentIndex = rawIndex % playlist.length;

          const audio = createMockAudio();
          const adapter = createMockAdapter();
          const controller = new PlaybackController(adapter, audio as any);

          controller.setPlaylist(playlist);
          controller.setPlayMode(PlayMode.RepeatOne);
          await controller.play(playlist[currentIndex]);

          // Call next
          await controller.next();

          // Should remain at the same index
          expect(controller.getCurrentIndex()).toBe(currentIndex);

          controller.destroy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.5, 2.6**
   *
   * Shuffle mode: next SHALL be a valid track in the queue,
   * and different from current when playlist.length > 1
   */
  it('Shuffle mode: next SHALL be a valid index, different from current when length > 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        playlistArb,
        fc.integer({ min: 0, max: 19 }),
        async (playlist, rawIndex) => {
          const currentIndex = rawIndex % playlist.length;

          const audio = createMockAudio();
          const adapter = createMockAdapter();
          const controller = new PlaybackController(adapter, audio as any);

          controller.setPlaylist(playlist);
          controller.setPlayMode(PlayMode.Shuffle);
          await controller.play(playlist[currentIndex]);

          // Call next
          await controller.next();

          const nextIndex = controller.getCurrentIndex();

          // Next index must be valid
          expect(nextIndex).toBeGreaterThanOrEqual(0);
          expect(nextIndex).toBeLessThan(playlist.length);

          // When playlist has more than 1 track, next should differ from current
          if (playlist.length > 1) {
            expect(nextIndex).not.toBe(currentIndex);
          }

          controller.destroy();
        }
      ),
      { numRuns: 100 }
    );
  });
});
