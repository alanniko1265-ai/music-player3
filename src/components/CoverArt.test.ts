import { describe, it, expect } from 'vitest'
import { ref, computed, watch, nextTick } from 'vue'

/**
 * CoverArt component logic tests
 * Tests the reactive state management for loading, error, and size computation
 */

// Simulate the component's core logic (since we're in node environment without full Vue mount)
function useCoverArtLogic(initialSrc: string, size: string | number = '100%') {
  const src = ref(initialSrc)
  const loading = ref(true)
  const hasError = ref(false)

  const containerStyle = computed(() => {
    const sizeValue = typeof size === 'number' ? `${size}px` : size
    return {
      width: sizeValue,
      height: sizeValue
    }
  })

  function onLoad() {
    loading.value = false
    hasError.value = false
  }

  function onError() {
    loading.value = false
    hasError.value = true
  }

  // Reset state when src changes
  watch(src, () => {
    loading.value = true
    hasError.value = false
  })

  return { src, loading, hasError, containerStyle, onLoad, onError }
}

describe('CoverArt component logic', () => {
  it('should start in loading state', () => {
    const { loading, hasError } = useCoverArtLogic('https://example.com/cover.jpg')
    expect(loading.value).toBe(true)
    expect(hasError.value).toBe(false)
  })

  it('should transition to loaded state on successful image load', () => {
    const { loading, hasError, onLoad } = useCoverArtLogic('https://example.com/cover.jpg')
    onLoad()
    expect(loading.value).toBe(false)
    expect(hasError.value).toBe(false)
  })

  it('should transition to error state on image load failure', () => {
    const { loading, hasError, onError } = useCoverArtLogic('https://example.com/invalid.jpg')
    onError()
    expect(loading.value).toBe(false)
    expect(hasError.value).toBe(true)
  })

  it('should reset to loading state when src changes', async () => {
    const { src, loading, hasError, onLoad } = useCoverArtLogic('https://example.com/cover1.jpg')

    // Simulate successful load
    onLoad()
    expect(loading.value).toBe(false)

    // Change src
    src.value = 'https://example.com/cover2.jpg'
    await nextTick()

    expect(loading.value).toBe(true)
    expect(hasError.value).toBe(false)
  })

  it('should reset error state when src changes', async () => {
    const { src, loading, hasError, onError } = useCoverArtLogic('https://example.com/bad.jpg')

    // Simulate error
    onError()
    expect(hasError.value).toBe(true)

    // Change src
    src.value = 'https://example.com/good.jpg'
    await nextTick()

    expect(loading.value).toBe(true)
    expect(hasError.value).toBe(false)
  })

  it('should compute container style with string size', () => {
    const { containerStyle } = useCoverArtLogic('https://example.com/cover.jpg', '300px')
    expect(containerStyle.value).toEqual({ width: '300px', height: '300px' })
  })

  it('should compute container style with number size (appends px)', () => {
    const { containerStyle } = useCoverArtLogic('https://example.com/cover.jpg', 200)
    expect(containerStyle.value).toEqual({ width: '200px', height: '200px' })
  })

  it('should compute container style with percentage size', () => {
    const { containerStyle } = useCoverArtLogic('https://example.com/cover.jpg', '100%')
    expect(containerStyle.value).toEqual({ width: '100%', height: '100%' })
  })

  it('should handle empty src string', () => {
    const { loading, hasError } = useCoverArtLogic('')
    expect(loading.value).toBe(true)
    expect(hasError.value).toBe(false)
  })
})
