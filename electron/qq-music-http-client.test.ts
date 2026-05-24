/**
 * QQ 音乐 HTTP 客户端模块单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildCookieHeader, request } from './qq-music-http-client'
import type { AuthCookie } from '../src/types/qq-music-login'

describe('buildCookieHeader', () => {
  it('should construct cookie header from AuthCookie with all fields', () => {
    const cookies: AuthCookie = {
      qqmusic_key: 'abc123',
      qm_keyst: 'keyst456',
      uin: '12345678',
      login_type: 1,
    }

    const header = buildCookieHeader(cookies)

    expect(header).toContain('qqmusic_key=abc123')
    expect(header).toContain('qm_keyst=keyst456')
    expect(header).toContain('uin=12345678')
    expect(header).toContain('login_type=1')
  })

  it('should separate key-value pairs with "; "', () => {
    const cookies: AuthCookie = {
      qqmusic_key: 'key1',
      qm_keyst: 'key2',
      uin: '111',
      login_type: 1,
    }

    const header = buildCookieHeader(cookies)
    const parts = header.split('; ')

    expect(parts.length).toBe(4)
  })

  it('should exclude undefined fields', () => {
    const cookies: AuthCookie = {
      qqmusic_key: 'abc',
      qm_keyst: 'def',
      uin: '999',
      login_type: 2,
      wxuin: undefined,
    }

    const header = buildCookieHeader(cookies)

    expect(header).not.toContain('wxuin')
  })

  it('should include optional fields when defined', () => {
    const cookies: AuthCookie = {
      qqmusic_key: 'abc',
      qm_keyst: 'def',
      uin: '999',
      login_type: 2,
      wxuin: 'wx123',
    }

    const header = buildCookieHeader(cookies)

    expect(header).toContain('wxuin=wx123')
  })

  it('should handle cookies with extra custom fields', () => {
    const cookies: AuthCookie = {
      qqmusic_key: 'key',
      qm_keyst: 'keyst',
      uin: '100',
      login_type: 1,
      custom_field: 'custom_value',
    }

    const header = buildCookieHeader(cookies)

    expect(header).toContain('custom_field=custom_value')
  })
})

describe('request', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('should make a successful GET request', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: 'success' }),
    })

    const promise = request('https://example.com/api')
    const result = await promise

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ result: 'success' })
    expect(result.code).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('should include Cookie header when cookies are provided', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    })

    const cookies: AuthCookie = {
      qqmusic_key: 'test_key',
      qm_keyst: 'test_keyst',
      uin: '123',
      login_type: 1,
    }

    await request('https://example.com/api', { cookies })

    const callArgs = fetchMock.mock.calls[0]
    expect(callArgs[1].headers['Cookie']).toContain('qqmusic_key=test_key')
  })

  it('should not retry on 4xx client errors', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve('Access denied'),
    })

    const promise = request('https://example.com/api')
    const result = await promise

    expect(result.success).toBe(false)
    expect(result.code).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('should retry on 5xx server errors up to 3 times', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const promise = request('https://example.com/api')

    // Advance through all retry delays
    await vi.advanceTimersByTimeAsync(1000) // 1st retry delay
    await vi.advanceTimersByTimeAsync(2000) // 2nd retry delay
    await vi.advanceTimersByTimeAsync(4000) // 3rd retry delay

    const result = await promise

    expect(result.success).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
  })

  it('should retry on network errors up to 3 times', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'))

    const promise = request('https://example.com/api')

    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(4000)

    const result = await promise

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('should succeed on retry if server recovers', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ recovered: true }),
      })

    const promise = request('https://example.com/api')

    await vi.advanceTimersByTimeAsync(1000) // 1st retry delay

    const result = await promise

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ recovered: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('should send POST request with JSON body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ posted: true }),
    })

    await request('https://example.com/api', {
      method: 'POST',
      body: { key: 'value' },
    })

    const callArgs = fetchMock.mock.calls[0]
    expect(callArgs[1].method).toBe('POST')
    expect(callArgs[1].body).toBe(JSON.stringify({ key: 'value' }))
    expect(callArgs[1].headers['Content-Type']).toBe('application/json')
  })
})
