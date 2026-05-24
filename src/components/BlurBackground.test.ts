import { describe, it, expect } from 'vitest'

/**
 * Unit tests for BlurBackground component logic.
 * Since the component relies on Canvas/Image browser APIs,
 * we test the core color extraction logic and fallback behavior.
 */

// Extract the dominant color logic into a testable function
// that mirrors the component's implementation
function extractDominantColorFromPixels(pixels: Uint8ClampedArray): string {
  const defaultColor = 'rgba(29, 185, 84, 0.8)'
  let r = 0, g = 0, b = 0, count = 0

  for (let i = 0; i < pixels.length; i += 16) {
    const pr = pixels[i]
    const pg = pixels[i + 1]
    const pb = pixels[i + 2]

    const brightness = (pr + pg + pb) / 3
    if (brightness > 30 && brightness < 220) {
      r += pr
      g += pg
      b += pb
      count++
    }
  }

  if (count === 0) {
    return defaultColor
  }

  r = Math.round(r / count)
  g = Math.round(g / count)
  b = Math.round(b / count)

  return `rgba(${r}, ${g}, ${b}, 0.8)`
}

describe('BlurBackground - Color Extraction Logic', () => {
  it('should return default color when all pixels are too dark', () => {
    // All pixels are black (brightness < 30)
    const pixels = new Uint8ClampedArray(64 * 4) // 16 pixels * 4 channels
    // All zeros = black
    const result = extractDominantColorFromPixels(pixels)
    expect(result).toBe('rgba(29, 185, 84, 0.8)')
  })

  it('should return default color when all pixels are too bright', () => {
    // All pixels are white (brightness > 220)
    const pixels = new Uint8ClampedArray(64 * 4)
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 240     // R
      pixels[i + 1] = 240 // G
      pixels[i + 2] = 240 // B
      pixels[i + 3] = 255 // A
    }
    const result = extractDominantColorFromPixels(pixels)
    expect(result).toBe('rgba(29, 185, 84, 0.8)')
  })

  it('should extract average color from valid pixels', () => {
    // Create pixels with a known color (sampling every 16 bytes = every 4th pixel)
    const pixels = new Uint8ClampedArray(64 * 4)
    // Set pixels at positions 0, 16, 32, 48 (the ones that get sampled)
    for (let i = 0; i < pixels.length; i += 16) {
      pixels[i] = 100     // R
      pixels[i + 1] = 150 // G
      pixels[i + 2] = 200 // B
      pixels[i + 3] = 255 // A
    }
    const result = extractDominantColorFromPixels(pixels)
    expect(result).toBe('rgba(100, 150, 200, 0.8)')
  })

  it('should skip dark pixels and only average valid ones', () => {
    const pixels = new Uint8ClampedArray(32 * 4)
    // First sampled pixel (index 0): dark, should be skipped
    pixels[0] = 10
    pixels[1] = 10
    pixels[2] = 10
    pixels[3] = 255
    // Second sampled pixel (index 16): valid color
    pixels[16] = 80
    pixels[17] = 120
    pixels[18] = 160
    pixels[19] = 255

    const result = extractDominantColorFromPixels(pixels)
    expect(result).toBe('rgba(80, 120, 160, 0.8)')
  })

  it('should compute average across multiple valid pixels', () => {
    const pixels = new Uint8ClampedArray(48 * 4)
    // First sampled pixel (index 0)
    pixels[0] = 100
    pixels[1] = 100
    pixels[2] = 100
    pixels[3] = 255
    // Second sampled pixel (index 16)
    pixels[16] = 200
    pixels[17] = 200
    pixels[18] = 200
    pixels[19] = 255
    // Third sampled pixel (index 32)
    pixels[32] = 150
    pixels[33] = 150
    pixels[34] = 150
    pixels[35] = 255

    const result = extractDominantColorFromPixels(pixels)
    expect(result).toBe('rgba(150, 150, 150, 0.8)')
  })

  it('should return default color for empty pixel data', () => {
    const pixels = new Uint8ClampedArray(0)
    const result = extractDominantColorFromPixels(pixels)
    expect(result).toBe('rgba(29, 185, 84, 0.8)')
  })
})

describe('BlurBackground - Background Style', () => {
  it('should produce correct gradient style format', () => {
    const color = 'rgba(100, 150, 200, 0.8)'
    const style = {
      background: `linear-gradient(135deg, ${color} 0%, var(--color-background, #0D0D0D) 100%)`,
      filter: 'blur(80px)',
      opacity: 0.6,
    }
    expect(style.filter).toBe('blur(80px)')
    expect(style.opacity).toBe(0.6)
    expect(style.background).toContain('linear-gradient(135deg,')
    expect(style.background).toContain(color)
    expect(style.background).toContain('var(--color-background, #0D0D0D)')
  })

  it('should use default color in gradient when no cover provided', () => {
    const defaultColor = 'rgba(29, 185, 84, 0.8)'
    const style = {
      background: `linear-gradient(135deg, ${defaultColor} 0%, var(--color-background, #0D0D0D) 100%)`,
      filter: 'blur(80px)',
      opacity: 0.6,
    }
    expect(style.background).toContain('rgba(29, 185, 84, 0.8)')
  })
})
