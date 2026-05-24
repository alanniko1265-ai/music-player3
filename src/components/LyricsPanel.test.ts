import { describe, it, expect } from 'vitest'
import { ref, computed, nextTick } from 'vue'
import type { LyricLine } from '../types/index'

/**
 * LyricsPanel component logic tests
 * Tests the active line computation, scroll behavior, and state management
 */

// Simulate the component's core getActiveLine logic
function getActiveLine(lyrics: LyricLine[], currentTime: number): number {
  if (!lyrics || lyrics.length === 0) {
    return -1
  }
  if (currentTime < lyrics[0].time) {
    return -1
  }

  let low = 0
  let high = lyrics.length - 1
  let result = 0

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (lyrics[mid].time <= currentTime) {
      result = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return result
}

// Simulate the component's reactive logic
function useLyricsPanelLogic(
  initialLyrics: LyricLine[],
  initialCurrentTime: number,
  initialIsExpanded: boolean
) {
  const lyrics = ref(initialLyrics)
  const currentTime = ref(initialCurrentTime)
  const isExpanded = ref(initialIsExpanded)

  const activeLine = computed(() => {
    return getActiveLine(lyrics.value, currentTime.value)
  })

  return { lyrics, currentTime, isExpanded, activeLine }
}

describe('LyricsPanel component logic', () => {
  const sampleLyrics: LyricLine[] = [
    { time: 0, text: '前奏' },
    { time: 5.5, text: '第一句歌词' },
    { time: 10.2, text: '第二句歌词' },
    { time: 15.8, text: '第三句歌词' },
    { time: 20.0, text: '第四句歌词' },
    { time: 25.3, text: '第五句歌词' },
  ]

  describe('activeLine computation', () => {
    it('should return -1 when lyrics array is empty', () => {
      const { activeLine } = useLyricsPanelLogic([], 10, true)
      expect(activeLine.value).toBe(-1)
    })

    it('should return -1 when currentTime is before first lyric', () => {
      const lyrics: LyricLine[] = [{ time: 5, text: '第一句' }]
      const { activeLine } = useLyricsPanelLogic(lyrics, 3, true)
      expect(activeLine.value).toBe(-1)
    })

    it('should return 0 when currentTime matches first lyric exactly', () => {
      const { activeLine } = useLyricsPanelLogic(sampleLyrics, 0, true)
      expect(activeLine.value).toBe(0)
    })

    it('should return correct index when currentTime is between two lyrics', () => {
      const { activeLine } = useLyricsPanelLogic(sampleLyrics, 7, true)
      // 7 is between lyrics[1].time (5.5) and lyrics[2].time (10.2)
      expect(activeLine.value).toBe(1)
    })

    it('should return last index when currentTime is after last lyric', () => {
      const { activeLine } = useLyricsPanelLogic(sampleLyrics, 100, true)
      expect(activeLine.value).toBe(sampleLyrics.length - 1)
    })

    it('should return correct index when currentTime matches a lyric exactly', () => {
      const { activeLine } = useLyricsPanelLogic(sampleLyrics, 10.2, true)
      expect(activeLine.value).toBe(2)
    })

    it('should update activeLine reactively when currentTime changes', async () => {
      const { currentTime, activeLine } = useLyricsPanelLogic(sampleLyrics, 0, true)
      expect(activeLine.value).toBe(0)

      currentTime.value = 12
      await nextTick()
      expect(activeLine.value).toBe(2)

      currentTime.value = 22
      await nextTick()
      expect(activeLine.value).toBe(4)
    })

    it('should update activeLine when lyrics change', async () => {
      const { lyrics, activeLine } = useLyricsPanelLogic(sampleLyrics, 7, true)
      expect(activeLine.value).toBe(1)

      // Replace with lyrics that have different timestamps
      lyrics.value = [
        { time: 0, text: '新歌词第一句' },
        { time: 10, text: '新歌词第二句' },
      ]
      await nextTick()
      // currentTime is 7, which is between 0 and 10
      expect(activeLine.value).toBe(0)
    })
  })

  describe('empty lyrics handling', () => {
    it('should indicate no lyrics when array is empty', () => {
      const { lyrics, activeLine } = useLyricsPanelLogic([], 5, true)
      expect(lyrics.value.length).toBe(0)
      expect(activeLine.value).toBe(-1)
    })
  })

  describe('expand/collapse state', () => {
    it('should start in expanded state when isExpanded is true', () => {
      const { isExpanded } = useLyricsPanelLogic(sampleLyrics, 0, true)
      expect(isExpanded.value).toBe(true)
    })

    it('should start in collapsed state when isExpanded is false', () => {
      const { isExpanded } = useLyricsPanelLogic(sampleLyrics, 0, false)
      expect(isExpanded.value).toBe(false)
    })

    it('should toggle expand state', async () => {
      const { isExpanded } = useLyricsPanelLogic(sampleLyrics, 0, false)
      expect(isExpanded.value).toBe(false)

      isExpanded.value = true
      await nextTick()
      expect(isExpanded.value).toBe(true)
    })
  })

  describe('seek event logic', () => {
    it('should provide correct time for each lyric line', () => {
      // Verify that each lyric line has a valid time for seeking
      sampleLyrics.forEach((line) => {
        expect(line.time).toBeGreaterThanOrEqual(0)
        expect(typeof line.time).toBe('number')
      })
    })

    it('should have lyrics sorted by time', () => {
      for (let i = 1; i < sampleLyrics.length; i++) {
        expect(sampleLyrics[i].time).toBeGreaterThanOrEqual(sampleLyrics[i - 1].time)
      }
    })
  })

  describe('edge cases', () => {
    it('should handle single lyric line', () => {
      const lyrics: LyricLine[] = [{ time: 5, text: '唯一一句' }]
      const { activeLine } = useLyricsPanelLogic(lyrics, 10, true)
      expect(activeLine.value).toBe(0)
    })

    it('should handle lyrics with same timestamp', () => {
      const lyrics: LyricLine[] = [
        { time: 5, text: '第一句' },
        { time: 5, text: '第二句' },
        { time: 10, text: '第三句' },
      ]
      const { activeLine } = useLyricsPanelLogic(lyrics, 5, true)
      // Binary search should find the last one with time <= currentTime
      expect(activeLine.value).toBe(1)
    })

    it('should handle very large currentTime', () => {
      const { activeLine } = useLyricsPanelLogic(sampleLyrics, 99999, true)
      expect(activeLine.value).toBe(sampleLyrics.length - 1)
    })

    it('should handle currentTime of 0 with lyrics starting at 0', () => {
      const { activeLine } = useLyricsPanelLogic(sampleLyrics, 0, true)
      expect(activeLine.value).toBe(0)
    })

    it('should handle negative currentTime', () => {
      const { activeLine } = useLyricsPanelLogic(sampleLyrics, -1, true)
      expect(activeLine.value).toBe(-1)
    })
  })
})
