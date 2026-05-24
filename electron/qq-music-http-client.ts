/**
 * QQ 音乐 HTTP 客户端模块
 * 提供带 Cookie 请求头构造和重试机制的 HTTP 请求方法
 */

import type { AuthCookie, ApiResponse } from '../src/types/qq-music-login'

/** 请求配置选项 */
export interface RequestOptions {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string | Record<string, unknown>
  cookies?: AuthCookie
  timeout?: number
}

/** 重试配置 */
const RETRY_DELAYS = [1000, 2000, 4000] // 重试间隔：1s, 2s, 4s
const MAX_RETRIES = 3

/**
 * 构造 Cookie 请求头字符串
 * 将 AuthCookie 对象转换为 "key=value; key2=value2" 格式的字符串
 * 仅包含已定义（非 undefined）的字段
 *
 * @param cookies AuthCookie 对象
 * @returns Cookie 请求头字符串
 */
export function buildCookieHeader(cookies: AuthCookie): string {
  return Object.entries(cookies)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}

/**
 * 延迟指定毫秒数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 判断是否应该重试请求
 * 仅在网络错误或 5xx 服务器错误时重试，4xx 客户端错误不重试
 */
function shouldRetry(error: unknown, statusCode?: number): boolean {
  // 网络错误（无状态码）应该重试
  if (statusCode === undefined) {
    return true
  }
  // 5xx 服务器错误应该重试
  if (statusCode >= 500) {
    return true
  }
  // 4xx 客户端错误不重试
  return false
}

/**
 * 发送 HTTP 请求，带自动重试机制
 * 失败时最多重试 3 次，间隔为 1s, 2s, 4s（指数退避）
 * 总尝试次数 = 4（1 次初始 + 3 次重试）
 * 仅在网络错误或 5xx 状态码时重试，4xx 不重试
 *
 * @param url 请求 URL
 * @param options 请求配置
 * @returns API 响应
 */
export async function request(url: string, options: RequestOptions = {}): Promise<ApiResponse> {
  const { method = 'GET', headers = {}, body, cookies, timeout = 15000 } = options

  // 构造请求头
  const requestHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ...headers,
  }

  // 如果提供了 cookies，构造 Cookie 请求头
  if (cookies) {
    requestHeaders['Cookie'] = buildCookieHeader(cookies)
  }

  // 构造请求体
  let requestBody: string | undefined
  if (body) {
    if (typeof body === 'string') {
      requestBody = body
    } else {
      requestBody = JSON.stringify(body)
      if (!requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json'
      }
    }
  }

  let lastError: unknown = null
  let lastStatusCode: number | undefined

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // 在重试前等待（第一次请求不等待）
    if (attempt > 0) {
      await delay(RETRY_DELAYS[attempt - 1])
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      lastStatusCode = response.status

      // 成功响应
      if (response.ok) {
        const data = await response.json().catch(() => null)
        return {
          success: true,
          data,
          code: response.status,
        }
      }

      // 4xx 客户端错误，不重试，直接返回
      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text().catch(() => '')
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText || response.statusText}`,
          code: response.status,
        }
      }

      // 5xx 服务器错误，记录后继续重试
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
    } catch (error: unknown) {
      lastError = error
      lastStatusCode = undefined

      // 如果是 AbortError（超时），视为网络错误，可重试
      // 其他网络错误也可重试
    }

    // 检查是否应该重试（最后一次尝试后不需要检查）
    if (attempt < MAX_RETRIES && !shouldRetry(lastError, lastStatusCode)) {
      break
    }
  }

  // 所有重试都失败
  const errorMessage = lastError instanceof Error
    ? lastError.message
    : '请求失败，已达到最大重试次数'

  return {
    success: false,
    error: errorMessage,
    code: lastStatusCode,
  }
}
