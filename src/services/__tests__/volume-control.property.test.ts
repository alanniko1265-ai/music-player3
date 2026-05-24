/**
 * Property 4: 音量控制范围约束
 * **Validates: Requirements 2.4**
 *
 * For any volume value v, after calling setVolume(v), the actual volume
 * SHALL be clamped to [0, 100] (i.e., clamp(v, 0, 100)).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { PlaybackController } from '../playback-controller';
import type { MusicAPIAdapter } from '../music-api-adapter';

/**
 * 创建 mock HTMLAudioElement
 */
function createMockAudio(): HTMLAudioElement {
  const listeners: Record<string, Function[]> = {};
  return {
    src: '',
    currentTime: 0,
    duration: 240,
    volume: 0.8,
    paused: true,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    addEventListener: vi.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeEventListener: vi.fn(),
  } as unknown as HTMLAudioElement;
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
  } as unknown as MusicAPIAdapter;
}

describe('Property 4: 音量控制范围约束', () => {
  let controller: PlaybackController;
  let mockAudio: HTMLAudioElement;
  let mockAdapter: MusicAPIAdapter;

  beforeEach(() => {
    mockAudio = createMockAudio();
    mockAdapter = createMockAdapter();
    controller = new PlaybackController(mockAdapter, mockAudio);
  });

  /**
   * **Validates: Requirements 2.4**
   *
   * For any volume value v (including negatives, very large values, decimals),
   * after calling setVolume(v), getCurrentState().volume === clamp(v, 0, 100).
   */
  it('setVolume(v) should clamp volume to [0, 100] for any arbitrary number v', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e10, max: 1e10, noNaN: true, noDefaultInfinity: true }),
        (v: number) => {
          controller.setVolume(v);

          const actualVolume = controller.getCurrentState().volume;
          const expectedVolume = Math.max(0, Math.min(100, v));

          expect(actualVolume).toBe(expectedVolume);
        }
      ),
      { numRuns: 100 }
    );
  });
});
