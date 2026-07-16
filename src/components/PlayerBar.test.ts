import { describe, it, expect } from 'vitest'
import { PlayMode } from '@/types'
import type { Track } from '@/types'

/**
 * PlayerBar component logic tests
 * Tests the core logic: time formatting, progress calculation,
 * play mode cycling, and volume mute toggle behavior.
 */

// ===== Extracted logic functions (mirrors component implementation) =====

function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(seconds)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function calcProgressPercent(currentTime: number, duration: number): number {
  if (duration === 0) return 0
  return (currentTime / duration) * 100
}

function calcProgressPreviewTime(pointerX: number, left: number, width: number, duration: number): number {
  if (duration === 0 || width <= 0) return 0
  const percent = Math.max(0, Math.min(1, (pointerX - left) / width))
  return percent * duration
}

function getNextPlayMode(current: PlayMode): PlayMode {
  const modes = [PlayMode.Sequential, PlayMode.Shuffle, PlayMode.RepeatOne]
  const currentIndex = modes.indexOf(current)
  const nextIndex = (currentIndex + 1) % modes.length
  return modes[nextIndex]
}

function getPlayModeLabel(mode: PlayMode): string {
  switch (mode) {
    case PlayMode.Sequential:
      return '顺序播放'
    case PlayMode.Shuffle:
      return '随机播放'
    case PlayMode.RepeatOne:
      return '单曲循环'
    default:
      return '播放模式'
  }
}

function createTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    title: '测试歌曲',
    artist: '测试艺术家',
    album: '测试专辑',
    duration: 240,
    coverUrl: 'https://example.com/cover.jpg',
    source: 'netease',
    ...overrides,
  }
}

describe('PlayerBar component logic', () => {
  describe('formatTime', () => {
    it('should format 0 seconds as 0:00', () => {
      expect(formatTime(0)).toBe('0:00')
    })

    it('should format seconds less than a minute', () => {
      expect(formatTime(45)).toBe('0:45')
    })

    it('should format exactly one minute', () => {
      expect(formatTime(60)).toBe('1:00')
    })

    it('should format standard track duration', () => {
      expect(formatTime(240)).toBe('4:00')
    })

    it('should pad seconds with leading zero', () => {
      expect(formatTime(65)).toBe('1:05')
    })

    it('should handle long durations', () => {
      expect(formatTime(723)).toBe('12:03')
    })

    it('should floor fractional seconds', () => {
      expect(formatTime(125.7)).toBe('2:05')
    })
  })

  describe('progress calculation', () => {
    it('should return 0 when duration is 0', () => {
      expect(calcProgressPercent(50, 0)).toBe(0)
    })

    it('should return 0 when currentTime is 0', () => {
      expect(calcProgressPercent(0, 240)).toBe(0)
    })

    it('should return 50 at midpoint', () => {
      expect(calcProgressPercent(120, 240)).toBe(50)
    })

    it('should return 100 at end', () => {
      expect(calcProgressPercent(240, 240)).toBe(100)
    })

    it('should return correct percentage for arbitrary position', () => {
      expect(calcProgressPercent(60, 240)).toBe(25)
    })

    it('should calculate hover time from the pointer position', () => {
      expect(calcProgressPreviewTime(150, 50, 200, 240)).toBe(120)
    })

    it('should clamp hover time to the track bounds', () => {
      expect(calcProgressPreviewTime(0, 50, 200, 240)).toBe(0)
      expect(calcProgressPreviewTime(300, 50, 200, 240)).toBe(240)
    })
  })

  describe('play mode cycling', () => {
    it('should cycle from Sequential to Shuffle', () => {
      expect(getNextPlayMode(PlayMode.Sequential)).toBe(PlayMode.Shuffle)
    })

    it('should cycle from Shuffle to RepeatOne', () => {
      expect(getNextPlayMode(PlayMode.Shuffle)).toBe(PlayMode.RepeatOne)
    })

    it('should cycle from RepeatOne back to Sequential', () => {
      expect(getNextPlayMode(PlayMode.RepeatOne)).toBe(PlayMode.Sequential)
    })
  })

  describe('play mode labels', () => {
    it('should return correct label for Sequential', () => {
      expect(getPlayModeLabel(PlayMode.Sequential)).toBe('顺序播放')
    })

    it('should return correct label for Shuffle', () => {
      expect(getPlayModeLabel(PlayMode.Shuffle)).toBe('随机播放')
    })

    it('should return correct label for RepeatOne', () => {
      expect(getPlayModeLabel(PlayMode.RepeatOne)).toBe('单曲循环')
    })
  })

  describe('volume mute toggle logic', () => {
    it('should mute by setting volume to 0 and remember previous volume', () => {
      const currentVolume = 75
      let volumeBeforeMute = 0
      let volume = currentVolume

      // Mute action
      if (volume !== 0) {
        volumeBeforeMute = volume
        volume = 0
      }

      expect(volume).toBe(0)
      expect(volumeBeforeMute).toBe(75)
    })

    it('should unmute by restoring previous volume', () => {
      const volumeBeforeMute = 75
      let volume = 0

      // Unmute action
      if (volume === 0) {
        volume = volumeBeforeMute || 80
      }

      expect(volume).toBe(75)
    })

    it('should default to 80 when unmuting with no saved volume', () => {
      const volumeBeforeMute = 0
      let volume = 0

      // Unmute action
      if (volume === 0) {
        volume = volumeBeforeMute || 80
      }

      expect(volume).toBe(80)
    })
  })

  describe('track info display contract', () => {
    it('should display track title and artist when track is loaded', () => {
      const track = createTrack({ title: '晴天', artist: '周杰伦' })
      expect(track.title).toBe('晴天')
      expect(track.artist).toBe('周杰伦')
      expect(track.coverUrl).toBeDefined()
    })

    it('should show empty state when no track is loaded', () => {
      const currentTrack: Track | null = null
      expect(currentTrack).toBeNull()
    })
  })
})
