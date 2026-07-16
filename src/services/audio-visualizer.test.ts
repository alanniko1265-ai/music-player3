import { describe, expect, it } from 'vitest'
import { createSpectrumLevels } from './audio-visualizer'

const options = {
  sampleRate: 44100,
  barCount: 44,
}

describe('createSpectrumLevels', () => {
  it('creates a bounded mirrored spectrum', () => {
    const data = new Uint8Array(256).fill(128)
    const levels = createSpectrumLevels(data, options)

    expect(levels).toHaveLength(44)
    levels.forEach((level) => {
      expect(level).toBeGreaterThanOrEqual(0.08)
      expect(level).toBeLessThanOrEqual(1)
    })

    levels.forEach((level, index) => {
      expect(level).toBeCloseTo(levels[levels.length - 1 - index], 8)
    })
  })

  it('places bass energy near the center bars', () => {
    const data = new Uint8Array(256)
    data.fill(255, 1, 6)

    const levels = createSpectrumLevels(data, options)
    const center = levels[Math.floor(levels.length / 2)]
    const edge = levels[0]

    expect(center).toBeGreaterThan(edge)
  })

  it('places treble energy near the outer bars', () => {
    const data = new Uint8Array(256)
    data.fill(255, 110, 190)

    const levels = createSpectrumLevels(data, options)
    const center = levels[Math.floor(levels.length / 2)]
    const edge = levels[0]

    expect(edge).toBeGreaterThan(center)
  })

  it('releases energy gradually instead of dropping in one frame', () => {
    const data = new Uint8Array(256).fill(200)
    const active = createSpectrumLevels(data, options)
    const released = createSpectrumLevels(new Uint8Array(256), {
      ...options,
      previousLevels: active,
    })

    expect(released[Math.floor(released.length / 2)]).toBeGreaterThan(0.08)
    expect(released[Math.floor(released.length / 2)]).toBeLessThan(active[Math.floor(active.length / 2)])
  })
})
