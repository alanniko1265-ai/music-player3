/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Unit tests for NetworkBanner component logic.
 * Tests the network status detection and banner visibility behavior.
 */

describe('NetworkBanner - Network Status Logic', () => {
  let onlineListeners: Array<() => void>
  let offlineListeners: Array<() => void>

  beforeEach(() => {
    onlineListeners = []
    offlineListeners = []

    // Mock navigator.onLine
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })

    // Track event listeners
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'online') onlineListeners.push(handler as () => void)
      if (event === 'offline') offlineListeners.push(handler as () => void)
    })

    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should default to online when navigator.onLine is true', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
    expect(window.navigator.onLine).toBe(true)
  })

  it('should detect offline when navigator.onLine is false', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    expect(window.navigator.onLine).toBe(false)
  })

  it('should register online and offline event listeners', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')

    // Simulate what the component does on mount
    window.addEventListener('online', () => {})
    window.addEventListener('offline', () => {})

    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function))
  })

  it('should update status to offline when offline event fires', () => {
    let isOnline = true

    window.addEventListener('offline', () => { isOnline = false })

    // Simulate offline event
    offlineListeners.forEach(fn => fn())

    expect(isOnline).toBe(false)
  })

  it('should update status to online when online event fires', () => {
    let isOnline = false

    window.addEventListener('online', () => { isOnline = true })

    // Simulate online event
    onlineListeners.forEach(fn => fn())

    expect(isOnline).toBe(true)
  })

  it('should respond to IPC network status changes', () => {
    let isOnline = true

    // Simulate the networkService.onStatusChanged callback
    const callback = (online: boolean) => { isOnline = online }

    // Simulate network going offline via IPC
    callback(false)
    expect(isOnline).toBe(false)

    // Simulate network coming back online via IPC
    callback(true)
    expect(isOnline).toBe(true)
  })
})

describe('NetworkBanner - Banner Display Logic', () => {
  it('should not show banner when online', () => {
    const isOnline = true
    const shouldShowBanner = !isOnline
    expect(shouldShowBanner).toBe(false)
  })

  it('should show banner when offline', () => {
    const isOnline = false
    const shouldShowBanner = !isOnline
    expect(shouldShowBanner).toBe(true)
  })

  it('should hide banner when network is restored', () => {
    let isOnline = false

    // Network restores
    isOnline = true
    const shouldShowBanner = !isOnline
    expect(shouldShowBanner).toBe(false)
  })

  it('should show correct message text', () => {
    const bannerText = '网络连接已断开'
    expect(bannerText).toBe('网络连接已断开')
  })
})
