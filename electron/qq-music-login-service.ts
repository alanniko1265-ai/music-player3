import { app, net, type BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import https from 'https'
import http from 'http'
import QRCode from 'qrcode'
import { IPC_CHANNELS } from '../src/types/ipc'
import {
  LoginStatus,
  type ApiResponse,
  type AuthCookie,
  type LoginStatusInfo,
  type QRCodeResult,
  type QRPollResult,
  type RefreshResult,
  type UserInfo,
} from '../src/types/qq-music-login'
import { credentialStore, type CredentialSaveOptions } from './qq-music-credential-store'
import { buildCookieHeader } from './qq-music-http-client'
import { sign } from './qq-music-sign'

const QQ_QR_APP_ID = '716027609'
const QQ_QR_DAID = '383'
const QQ_MUSIC_CLIENT_ID = '100497308'
const QQ_OAUTH_LOGIN_JUMP = 'https://graph.qq.com/oauth2.0/login_jump'
const QQ_OAUTH_REDIRECT_URI = 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/'
const QQ_OAUTH_SCOPE = 'get_user_info,get_app_friends'
const QQ_LOGIN_REFERER = 'https://xui.ptlogin2.qq.com/'
const QQ_QR_EXPIRES_MS = 120 * 1000
const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000
const DEFAULT_SESSION_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000

type CookieJar = Record<string, string>

interface HttpGetResult {
  status: number
  text: string
  buffer: Buffer
  cookies: CookieJar
  headers: http.IncomingHttpHeaders
}

interface QQCredentialData {
  openid?: string
  refresh_token?: string
  access_token?: string
  expired_at?: number
  musicid?: number | string
  musickey?: string
  unionid?: string
  str_musicid?: string
  refresh_key?: string
  musickeyCreateTime?: number
  keyExpiresIn?: number
  first_login?: number
  bindAccountType?: number
  needRefreshKeyIn?: number
  encryptUin?: string
  loginType?: number
  nick?: string
  nickname?: string
  headurl?: string
}

interface MusicuRequest {
  module: string
  method: string
  param: Record<string, unknown>
}

interface NormalizedEndpoint {
  endpoint: string
  payload: Record<string, unknown>
}

export function hash33(value: string, seed = 0): number {
  let hash = seed
  for (let i = 0; i < value.length; i += 1) {
    hash += (hash << 5) + value.charCodeAt(i)
  }
  return hash & 0x7fffffff
}

function hash33Gtk(value: string, seed = 5381): number {
  let hash = seed
  for (let i = 0; i < value.length; i += 1) {
    hash += (hash << 5) + value.charCodeAt(i)
  }
  return hash & 0x7fffffff
}

export function shouldRefreshSession(
  expiryTime: number,
  now = Date.now(),
  thresholdMs = SESSION_REFRESH_THRESHOLD_MS,
): boolean {
  return expiryTime > 0 && expiryTime - now < thresholdMs
}

export function extractAuthCookieFromCredential(data: QQCredentialData): AuthCookie | null {
  const musicKey = String(data.musickey || '')
  const musicId = String(data.str_musicid || data.musicid || '').replace(/\D/g, '')

  if (!musicKey || !musicId) {
    return null
  }

  return {
    qqmusic_key: musicKey,
    qm_keyst: musicKey,
    uin: musicId,
    qqmusic_uin: musicId,
    login_type: Number(data.loginType || 1),
    openid: data.openid,
    refresh_token: data.refresh_token,
    access_token: data.access_token,
    expired_at: data.expired_at,
    unionid: data.unionid,
    refresh_key: data.refresh_key,
    musickeyCreateTime: data.musickeyCreateTime,
    keyExpiresIn: data.keyExpiresIn,
    first_login: data.first_login,
    bindAccountType: data.bindAccountType,
    needRefreshKeyIn: data.needRefreshKeyIn,
    encryptUin: data.encryptUin,
  }
}

function splitSetCookieHeader(header: string | null): string[] {
  if (!header) {
    return []
  }
  // 按 ", " 分割，但要避免把 cookie 值里的逗号（如 expires 日期）当成分隔符
  // 策略：只在逗号后紧跟 "word=" 模式时才分割（新 cookie 的开始）
  // 注意：p_skey 的值以 * 开头，不含逗号，所以这里主要处理 expires 日期里的逗号
  const result: string[] = []
  let current = ''
  let i = 0
  while (i < header.length) {
    if (header[i] === ',' && i + 1 < header.length) {
      // 检查逗号后面是否是新 cookie 的开始（跳过空格后是 word=）
      let j = i + 1
      while (j < header.length && header[j] === ' ') j++
      const rest = header.slice(j)
      // 新 cookie 开始的特征：word= 且 word 不含分号
      if (/^[a-zA-Z0-9_\-]+=/.test(rest)) {
        result.push(current.trim())
        current = ''
        i = j
        continue
      }
    }
    current += header[i]
    i++
  }
  if (current.trim()) {
    result.push(current.trim())
  }
  return result
}

function extractCookies(response: Response): CookieJar {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : splitSetCookieHeader(headers.get('set-cookie'))

  const cookies: CookieJar = {}
  for (const item of setCookies) {
    const firstPart = item.split(';')[0]
    const eqIndex = firstPart.indexOf('=')
    if (eqIndex <= 0) {
      continue
    }
    cookies[firstPart.slice(0, eqIndex)] = firstPart.slice(eqIndex + 1)
  }
  return cookies
}

function cookieJarHeader(cookies: CookieJar): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}

function decodeMaybe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function buildUserInfo(cookies: AuthCookie, nickname?: string, avatarUrl?: string): UserInfo {
  return {
    uin: cookies.uin,
    nickname: nickname || cookies.nickname?.toString() || `QQ Music ${cookies.uin}`,
    avatarUrl: avatarUrl || `https://q1.qlogo.cn/g?b=qq&nk=${cookies.uin}&s=100`,
  }
}

function buildAuthCookieFromCookieJar(cookies: CookieJar, loginType: 1 | 2): AuthCookie | null {
  const musicKey = String(cookies.qqmusic_key || cookies.qm_keyst || '')
  const rawUin = loginType === 2
    ? String(cookies.wxuin || cookies.uin || cookies.qqmusic_uin || '')
    : String(cookies.uin || cookies.qqmusic_uin || '')
  const uin = rawUin.replace(/\D/g, '')

  if (!musicKey || !uin) {
    return null
  }

  return {
    ...cookies,
    qqmusic_key: musicKey,
    qm_keyst: musicKey,
    uin,
    qqmusic_uin: String(cookies.qqmusic_uin || uin),
    login_type: loginType,
    wxuin: cookies.wxuin,
  }
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  const normalized = text
    .replace(/^callback\(/, '')
    .replace(/^MusicJsonCallback\(/, '')
    .replace(/^jsonCallback\(/, '')
    .replace(/\)$/, '')

  try {
    return JSON.parse(normalized)
  } catch {
    return text
  }
}

function appendQuery(url: string, params: Record<string, string | number | undefined>): string {
  const target = new URL(url)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      target.searchParams.set(key, String(value))
    }
  }
  return target.toString()
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function getNestedRecord(value: unknown, path: string[]): Record<string, unknown> {
  let current: unknown = value
  for (const key of path) {
    current = asRecord(current)[key]
  }
  return asRecord(current)
}

/**
 * 使用 Electron net.fetch 发起请求（仅用于 musicu API）
 * net.fetch 专为 Electron 主进程设计，能正确处理 SSL 证书和网络请求
 */
function netFetch(url: string, options?: RequestInit): Promise<Response> {
  if (app.isReady() && net && typeof net.fetch === 'function') {
    return net.fetch(url, options as Parameters<typeof net.fetch>[1]) as Promise<Response>
  }
  return fetch(url, options)
}

/**
 * 用 Node.js https 模块发起 GET 请求，返回响应文本/二进制和 Set-Cookie
 * 用于登录流程中需要读取 Set-Cookie 的请求（Electron fetch 对某些 QQ 域名有兼容性问题）
 */
function httpsGet(
  url: string,
  headers: Record<string, string>,
): Promise<HttpGetResult> {
  return new Promise((resolve, reject) => {
    let parsed: URL
    try { parsed = new URL(url) } catch (e) { return reject(e) }

    const req = https.request({
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
      minVersion: 'TLSv1.2' as const,
      rejectUnauthorized: false,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const text = buffer.toString('utf8')
        const cookies = parseCookiesFromHeaders(res.headers['set-cookie'])
        resolve({ status: res.statusCode ?? 0, text, buffer, cookies, headers: res.headers })
      })
    })

    req.on('error', reject)
    req.setTimeout(15000, () => req.destroy(new Error('Request timeout')))
    req.end()
  })
}

function httpsPostForm(
  url: string,
  headers: Record<string, string>,
  form: Record<string, string | number>,
  initialCookies: CookieJar = {},
): Promise<{ status: number; text: string; buffer: Buffer; cookies: CookieJar; location?: string }> {
  return new Promise((resolve, reject) => {
    let parsed: URL
    try { parsed = new URL(url) } catch (e) { return reject(e) }

    const body = new URLSearchParams(
      Object.fromEntries(Object.entries(form).map(([key, value]) => [key, String(value)])),
    ).toString()
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieJarHeader(initialCookies),
      ...headers,
      'Content-Length': String(Buffer.byteLength(body)),
    }

    const req = https.request({
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: requestHeaders,
      minVersion: 'TLSv1.2' as const,
      rejectUnauthorized: false,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const cookies = {
          ...initialCookies,
          ...parseCookiesFromHeaders(res.headers['set-cookie']),
        }
        resolve({
          status: res.statusCode ?? 0,
          text: buffer.toString('utf8'),
          buffer,
          cookies,
          location: res.headers.location,
        })
      })
    })

    req.on('error', reject)
    req.setTimeout(15000, () => req.destroy(new Error('Request timeout')))
    req.write(body)
    req.end()
  })
}

function httpsPostJson(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number; text: string; buffer: Buffer; cookies: CookieJar; location?: string }> {
  return new Promise((resolve, reject) => {
    let parsed: URL
    try { parsed = new URL(url) } catch (e) { return reject(e) }

    const requestHeaders: Record<string, string> = {
      ...headers,
      'Content-Length': String(Buffer.byteLength(body)),
    }

    const req = https.request({
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: requestHeaders,
      minVersion: 'TLSv1.2' as const,
      rejectUnauthorized: false,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        resolve({
          status: res.statusCode ?? 0,
          text: buffer.toString('utf8'),
          buffer,
          cookies: parseCookiesFromHeaders(res.headers['set-cookie']),
          location: res.headers.location,
        })
      })
    })

    req.on('error', reject)
    req.setTimeout(15000, () => req.destroy(new Error('Request timeout')))
    req.write(body)
    req.end()
  })
}

function parseCookiesFromHeaders(rawSetCookie: string[] | string | undefined): CookieJar {
  const cookies: CookieJar = {}
  const items = Array.isArray(rawSetCookie) ? rawSetCookie : (rawSetCookie ? [rawSetCookie] : [])
  for (const item of items) {
    const nameValue = item.split(';')[0].trim()
    const eq = nameValue.indexOf('=')
    if (eq > 0) {
      const name = nameValue.slice(0, eq).trim()
      const value = nameValue.slice(eq + 1)
      if (name) cookies[name] = value
    }
  }
  return cookies
}

function parseJsonText(text: string): unknown {
  const normalized = text
    .replace(/^callback\(/, '')
    .replace(/^MusicJsonCallback\(/, '')
    .replace(/^jsonCallback\(/, '')
    .replace(/\)$/, '')
  try {
    return JSON.parse(normalized)
  } catch {
    return {}
  }
}

function detectImageMime(buffer: Buffer): string {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (buffer.length >= 6) {
    const signature = buffer.subarray(0, 6).toString('ascii')
    if (signature === 'GIF87a' || signature === 'GIF89a') {
      return 'image/gif'
    }
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  const head = buffer.subarray(0, 128).toString('utf8').trimStart().toLowerCase()
  if (head.startsWith('<svg') || head.startsWith('<?xml')) {
    return 'image/svg+xml'
  }
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    return ''
  }
  return 'image/png'
}

function imageBufferToDataUri(buffer: Buffer): string {
  const mime = detectImageMime(buffer)
  return mime ? `data:${mime};base64,${buffer.toString('base64')}` : ''
}

async function createQrDataUri(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    type: 'image/png',
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
  })
}

async function fetchImageDataUri(url: string, headers: Record<string, string>): Promise<string> {
  try {
    const { status, buffer, headers: responseHeaders } = await httpsGet(url, headers)
    const dataUri = imageBufferToDataUri(buffer)
    if (status === 200 && dataUri) {
      return dataUri
    }
    console.warn('[QQMusic] invalid image response:', {
      url,
      status,
      contentType: responseHeaders['content-type'],
      preview: buffer.subarray(0, 120).toString('utf8'),
    })
  } catch (error) {
    console.warn('[QQMusic] image fetch via https failed:', error instanceof Error ? error.message : error)
  }

  const response = await netFetch(url, { headers })
  const buffer = Buffer.from(await response.arrayBuffer())
  const dataUri = imageBufferToDataUri(buffer)
  if (!response.ok || !dataUri) {
    console.warn('[QQMusic] invalid image response via net.fetch:', {
      url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      preview: buffer.subarray(0, 120).toString('utf8'),
    })
    return ''
  }
  return dataUri
}

export class QQMusicLoginService {
  private statusInfo: LoginStatusInfo = { status: LoginStatus.LoggedOut }
  private currentQrsig: string | null = null
  private qrStartedAt = 0

  constructor(private readonly getWindows: () => BrowserWindow[]) {}

  private currentLoginMethod: 'qq' | 'wechat' = 'qq'
  private wxLoginUuid: string | null = null
  private wxOauthUrl = ''
  private wxLoginCookie = ''
  private wxLastCode = ''

  async startQRLogin(method: 'qq' | 'wechat' = 'qq'): Promise<QRCodeResult> {
    this.currentLoginMethod = method
    if (method === 'wechat') {
      return this.startWechatQRLogin()
    }
    return this.startQQQRLogin()
  }

  private async startQQQRLogin(): Promise<QRCodeResult> {
    try {
      const url = 'https://ssl.ptlogin2.qq.com/ptqrshow?' + new URLSearchParams({
        appid: QQ_QR_APP_ID,
        e: '2',
        l: 'M',
        s: '3',
        d: '72',
        v: '4',
        t: String(Math.random()),
        daid: QQ_QR_DAID,
        pt_3rd_aid: QQ_MUSIC_CLIENT_ID,
      }).toString()

      // 用 Node.js https 模块，避免 Electron net.fetch 对 ptlogin2 域名的兼容性问题
      const { status, buffer, cookies } = await httpsGet(url, {
        Referer: QQ_LOGIN_REFERER,
        'User-Agent': this.userAgent,
      })

      if (status !== 200) {
        return { success: false, error: `QR request failed: HTTP ${status}` }
      }

      const qrsig = cookies.qrsig
      if (!qrsig) {
        return { success: false, error: 'QR request did not return qrsig' }
      }

      this.currentQrsig = qrsig
      this.wxLoginUuid = null
      this.qrStartedAt = Date.now()
      this.updateStatus({ status: LoginStatus.Scanning })

      return {
        success: true,
        qrsig,
        qrImageBase64: imageBufferToDataUri(buffer),
        method: 'qq',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start QQ Music login',
      }
    }
  }

  private async startWechatQRLogin(): Promise<QRCodeResult> {
    try {
      // 微信 OAuth2 二维码：请求 open.weixin.qq.com 获取 uuid
      const wxAppId = 'wx48db31d50e334801' // QQ音乐微信登录 AppID
      const wxRedirectUri = encodeURIComponent('https://y.qq.com/portal/wx_redirect.html?login_type=2&surl=https://y.qq.com/')
      const state = `qq_music_${Date.now()}`

      // 获取微信 OAuth 页面以提取 uuid
      const oauthUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${wxAppId}&redirect_uri=${wxRedirectUri}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`

      const { status, text, cookies } = await httpsGet(oauthUrl, {
        'User-Agent': this.userAgent,
        Referer: 'https://y.qq.com/',
      })

      if (status !== 200) {
        return { success: false, error: `WeChat QR request failed: HTTP ${status}` }
      }

      // 从页面 HTML 中提取 uuid
      const uuidMatch = /\/connect\/qrcode\/([^"'\s<>?]+)/.exec(text)
        || /window\.QRLogin\.uuid\s*=\s*["']([^"']+)["']/.exec(text)
        || /window\.uuid\s*=\s*["']([^"']+)["']/.exec(text)
        || /uuid\s*=\s*["']([^"']+)["']/.exec(text)

      if (!uuidMatch || !uuidMatch[1]) {
        return { success: false, error: 'Failed to extract WeChat QR uuid' }
      }

      const uuid = uuidMatch[1].replace(/&amp;/g, '&')
      this.wxLoginUuid = uuid
      this.wxOauthUrl = oauthUrl
      this.wxLoginCookie = cookieJarHeader(cookies)
      this.wxLastCode = ''
      this.currentQrsig = `wx_${uuid}` // 用前缀区分
      this.qrStartedAt = Date.now()
      this.updateStatus({ status: LoginStatus.Scanning })

      // 微信官方二维码图片需要页面请求上下文；本地生成同一 uuid 的确认页二维码更稳定。
      const qrImage = await createQrDataUri(`https://open.weixin.qq.com/connect/confirm?uuid=${uuid}`)

      return {
        success: true,
        qrsig: this.currentQrsig,
        qrImageBase64: qrImage,
        method: 'wechat',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start WeChat login',
      }
    }
  }

  async pollQRStatus(qrsig: string): Promise<QRPollResult> {
    if (!qrsig || qrsig !== this.currentQrsig) {
      return { status: 'error', error: 'Invalid QR login session' }
    }

    if (Date.now() - this.qrStartedAt > QQ_QR_EXPIRES_MS) {
      this.updateStatus({ status: LoginStatus.Expired })
      return { status: 'expired' }
    }

    // 微信登录走单独的轮询逻辑
    if (this.currentLoginMethod === 'wechat' && this.wxLoginUuid) {
      return this.pollWechatQRStatus()
    }

    // u1 是登录成功后的重定向目标
    const redirectUri = encodeURIComponent(QQ_OAUTH_REDIRECT_URI)
    const authorizeUrl = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${QQ_MUSIC_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(QQ_OAUTH_SCOPE)}&state=state&from_ptlogin=1&src=1&update_auth=1&openapi=1010_1030`

    const params = new URLSearchParams({
      u1: authorizeUrl,
      ptqrtoken: String(hash33(qrsig)),
      ptredirect: '0',
      h: '1',
      t: '1',
      g: '1',
      from_ui: '1',
      ptlang: '2052',
      action: `0-0-${Date.now()}`,
      js_ver: '20102616',
      js_type: '1',
      pt_uistyle: '40',
      aid: QQ_QR_APP_ID,
      daid: QQ_QR_DAID,
      pt_3rd_aid: QQ_MUSIC_CLIENT_ID,
      has_onekey: '1',
    })

    try {
      const { status, text } = await httpsGet(
        `https://ssl.ptlogin2.qq.com/ptqrlogin?${params.toString()}`,
        {
          Cookie: `qrsig=${qrsig}`,
          Referer: QQ_LOGIN_REFERER,
          'User-Agent': this.userAgent,
        },
      )

      if (status !== 200) {
        return { status: 'error', error: `Poll request failed: HTTP ${status}` }
      }

      const args = this.parsePtuiCallback(text)
      if (!args.length) {
        return { status: 'error', error: 'Invalid QR poll response' }
      }

      switch (args[0]) {
        case '66':
          this.updateStatus({ status: LoginStatus.Scanning })
          return { status: 'waiting' }
        case '67':
          this.updateStatus({ status: LoginStatus.Confirming })
          return { status: 'scanned' }
        case '65':
          this.updateStatus({ status: LoginStatus.Expired })
          return { status: 'expired' }
        case '68':
          this.updateStatus({ status: LoginStatus.LoggedOut })
          return { status: 'error', error: 'Login was refused on the mobile device' }
        case '0':
          return await this.completeQQLogin(args)
        default:
          return { status: 'error', error: args[4] || `Unknown QR status: ${args[0]}` }
      }
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to poll QR status',
      }
    }
  }

  async cancelQRLogin(): Promise<void> {
    this.currentQrsig = null
    this.qrStartedAt = 0
    if (this.statusInfo.status === LoginStatus.Scanning || this.statusInfo.status === LoginStatus.Confirming) {
      this.updateStatus({ status: LoginStatus.LoggedOut })
    }
  }

  async validateSession(): Promise<LoginStatusInfo> {
    const credentials = await credentialStore.loadCredentials()
    if (!credentials || !credentialStore.isCredentialComplete(credentials)) {
      this.updateStatus({ status: LoginStatus.LoggedOut })
      return this.statusInfo
    }

    const expiryTime = await credentialStore.getExpiryTime()
    if (shouldRefreshSession(expiryTime)) {
      // 尝试刷新，失败时继续用旧凭据（不直接标记为过期）
      await this.refreshSession().catch(() => null)
    }

    // 重新加载凭据（刷新后可能已更新）
    const latestCredentials = await credentialStore.loadCredentials()
    if (!latestCredentials || !credentialStore.isCredentialComplete(latestCredentials)) {
      this.updateStatus({ status: LoginStatus.LoggedOut })
      return this.statusInfo
    }

    // 验证凭据有效性，网络错误时保守地认为仍然有效
    const stillValid = await this.checkCredential(latestCredentials)
    if (!stillValid) {
      this.updateStatus({ status: LoginStatus.Expired })
      return this.statusInfo
    }

    this.updateStatus({
      status: LoginStatus.LoggedIn,
      userInfo: buildUserInfo(latestCredentials),
    })
    return this.statusInfo
  }

  getStatus(): LoginStatusInfo {
    return this.statusInfo
  }

  async logout(): Promise<void> {
    await credentialStore.clearCredentials()
    this.currentQrsig = null
    this.qrStartedAt = 0
    this.updateStatus({ status: LoginStatus.LoggedOut })
  }

  async refreshSession(): Promise<RefreshResult> {
    const credentials = await credentialStore.loadCredentials()
    if (!credentials || !credentialStore.isCredentialComplete(credentials)) {
      this.updateStatus({ status: LoginStatus.Expired })
      return { success: false, error: 'No complete credential to refresh' }
    }

    try {
      const refreshed = await this.refreshWithLoginServer(credentials)
      if (!refreshed) {
        return { success: false, error: 'QQ Music did not return a refreshed musickey' }
      }

      await credentialStore.saveCredentials(refreshed.cookies, refreshed.options)
      this.updateStatus({
        status: LoginStatus.LoggedIn,
        userInfo: buildUserInfo(refreshed.cookies),
      })

      return {
        success: true,
        newMusicKey: refreshed.cookies.qqmusic_key,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh QQ Music session'
      return { success: false, error: message }
    }
  }

  async callApi(endpoint: string, data: unknown): Promise<ApiResponse> {
    const credentials = await credentialStore.loadCredentials()
    if (!credentials || !credentialStore.isCredentialComplete(credentials)) {
      this.updateStatus({ status: LoginStatus.Expired })
      return { success: false, error: 'QQ Music login required', code: 301 }
    }

    const normalized = this.normalizeEndpoint(endpoint, asRecord(data))

    try {
      switch (normalized.endpoint) {
        case 'search':
        case 'getSearchByKey':
          return await this.search(normalized.payload, credentials)
        case 'search/quick':
        case 'getSmartbox':
          return await this.searchSuggestions(normalized.payload, credentials)
        case 'song/url':
        case 'getMusicPlay':
          return await this.getTrackUrl(normalized.payload, credentials)
        case 'lyric':
        case 'getLyric':
          return await this.getLyrics(normalized.payload, credentials)
        case 'songlist':
          return await this.getSonglist(normalized.payload, credentials)
        default:
          return await this.callRawMusicu(normalized.endpoint, normalized.payload, credentials)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'QQ Music API call failed'
      // 登录失效：更新状态并返回 301
      if (/login expired|1000|104401|104400|301/.test(message)) {
        this.updateStatus({ status: LoginStatus.Expired })
        return { success: false, error: '登录已过期，请重新登录', code: 301 }
      }
      return { success: false, error: message }
    }
  }

  private async pollWechatQRStatus(): Promise<QRPollResult> {
    const uuid = this.wxLoginUuid!
    try {
      const basePollUrl = `https://long.open.weixin.qq.com/connect/l/qrconnect?uuid=${encodeURIComponent(uuid)}&_=${Date.now()}`
      const pollUrl = this.wxLastCode
        ? `${basePollUrl}&last=${this.wxLastCode}`
        : basePollUrl
      const pollHeaders: Record<string, string> = {
        'User-Agent': this.userAgent,
        Accept: '*/*',
        Referer: this.wxOauthUrl || 'https://open.weixin.qq.com/',
      }
      if (this.wxLoginCookie) {
        pollHeaders.Cookie = this.wxLoginCookie
      }
      let { status, text } = await httpsGet(pollUrl, pollHeaders)

      if (status === 400 && this.wxLastCode) {
        this.wxLastCode = ''
        const retry = await httpsGet(basePollUrl, pollHeaders)
        status = retry.status
        text = retry.text
      }

      if (status !== 200) {
        console.warn('[QQMusic] WeChat poll returned non-200, will keep waiting:', status, text.slice(0, 120))
        return { status: 'waiting' }
      }

      // 响应格式：window.wx_errcode=CODE;window.wx_code='xxx';
      const errCodeMatch = /wx_errcode=(\d+)/.exec(text)
      const wxCodeMatch = /wx_code='([^']*)'/.exec(text)
      const errCode = errCodeMatch ? Number(errCodeMatch[1]) : -1

      switch (errCode) {
        case 408: // 等待扫码
          this.wxLastCode = ''
          return { status: 'waiting' }
        case 404: // 已扫码，等待确认
          this.wxLastCode = '404'
          this.updateStatus({ status: LoginStatus.Confirming })
          return { status: 'scanned' }
        case 403: // 用户拒绝
          this.updateStatus({ status: LoginStatus.LoggedOut })
          return { status: 'error', error: '用户拒绝了微信登录授权' }
        case 405: // 确认授权，获得 code
          if (wxCodeMatch && wxCodeMatch[1]) {
            return await this.completeWechatLogin(wxCodeMatch[1])
          }
          return { status: 'error', error: 'WeChat authorized but no code returned' }
        case 402: // 二维码过期
        case 500:
          this.updateStatus({ status: LoginStatus.Expired })
          return { status: 'expired' }
        default:
          return { status: 'error', error: `Unknown WeChat status: ${errCode}` }
      }
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to poll WeChat QR status',
      }
    }
  }

  private async completeWechatLogin(code: string): Promise<QRPollResult> {
    console.log('[QQMusic] WeChat login code obtained, exchanging for musickey...')
    try {
      const callbackResult = await this.completeWechatLoginViaRedirect(code)
      if (callbackResult) {
        return callbackResult
      }

      const rawResult = await this.completeWechatLoginViaRawMusicu(code)
      if (rawResult) {
        return rawResult
      }

      // 用微信 code 调 QQ 音乐的 WXLogin 接口换取 musickey
      const result = await this.callMusicu({
        req_0: {
          module: 'QQConnectLogin.LoginServer',
          method: 'QQLogin',
          param: {
            code,
            login_type: 2, // 微信登录
          },
        },
        comm: {
          tmeLoginType: 1,
        },
      })

      const credentialData = this.extractMusicuData(result)
      const authCookie = extractAuthCookieFromCredential(credentialData)

      if (authCookie && credentialStore.isCredentialComplete(authCookie)) {
        // 微信登录标记 login_type = 2
        authCookie.login_type = 2
        return this.finishLogin(authCookie, credentialData, credentialData.nick || credentialData.nickname || '')
      }

      // 尝试 WXLogin method
      const result2 = await this.callMusicu({
        req_0: {
          module: 'music.login.LoginServer',
          method: 'Login',
          param: {
            code,
            login_type: 2,
          },
        },
        comm: {
          tmeLoginType: 1,
        },
      })

      const credentialData2 = this.extractMusicuData(result2)
      const authCookie2 = extractAuthCookieFromCredential(credentialData2)

      if (authCookie2 && credentialStore.isCredentialComplete(authCookie2)) {
        authCookie2.login_type = 2
        return this.finishLogin(authCookie2, credentialData2, credentialData2.nick || credentialData2.nickname || '')
      }

      return { status: 'error', error: '微信登录凭据不完整，请重试' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'WeChat login exchange failed'
      console.error('[QQMusic] WeChat login failed:', message)
      return { status: 'error', error: `微信登录失败: ${message}` }
    }
  }

  private async completeWechatLoginViaRedirect(code: string): Promise<QRPollResult | null> {
    const callbackUrl = 'https://y.qq.com/portal/wx_redirect.html?' + new URLSearchParams({
      login_type: '2',
      code,
      state: 'state',
      surl: 'https://y.qq.com/',
    }).toString()

    try {
      const { cookies, finalUrl } = await this.followRedirectsCollectingCookiesAndUrl(
        callbackUrl,
        {
          Referer: this.wxOauthUrl || 'https://open.weixin.qq.com/',
          'User-Agent': this.userAgent,
        },
        undefined,
        10,
        this.cookieHeaderToJar(this.wxLoginCookie),
      )

      const authCookie = buildAuthCookieFromCookieJar(cookies, 2)
      console.log('[QQMusic] WeChat redirect result:', {
        finalUrl: finalUrl.substring(0, 120),
        cookies: Object.keys(cookies).filter(key => cookies[key]),
        hasAuthCookie: !!authCookie,
      })

      if (authCookie && credentialStore.isCredentialComplete(authCookie)) {
        const credentialData: QQCredentialData = {
          musickey: authCookie.qqmusic_key,
          musicid: authCookie.uin,
          str_musicid: authCookie.uin,
          loginType: 2,
        }
        return this.finishLogin(authCookie, credentialData, '')
      }
    } catch (error) {
      console.warn('[QQMusic] WeChat redirect exchange failed:', error instanceof Error ? error.message : error)
    }

    return null
  }

  private async completeWechatLoginViaRawMusicu(code: string): Promise<QRPollResult | null> {
    const cookieJar = {
      ...this.cookieHeaderToJar(this.wxLoginCookie),
      login_type: '2',
    }
    const payload = {
      comm: {
        tmeAppID: 'qqmusic',
        tmeLoginType: '1',
        g_tk: 5381,
        platform: 'yqq',
        ct: 24,
        cv: 0,
      },
      req: {
        module: 'music.login.LoginServer',
        method: 'Login',
        param: {
          strAppid: 'wx48db31d50e334801',
          code,
        },
      },
    }

    for (const host of ['u.y.qq.com', 'szu.y.qq.com', 'shu.y.qq.com']) {
      try {
        const { text, cookies } = await httpsPostJson(
          `https://${host}/cgi-bin/musicu.fcg`,
          {
            'Content-Type': 'application/x-www-form-urlencoded',
            Origin: 'https://y.qq.com',
            Referer: 'https://y.qq.com/',
            'User-Agent': this.userAgent,
            Cookie: cookieJarHeader(cookieJar),
          },
          JSON.stringify(payload),
        )
      const body = asRecord(parseJsonText(text))
      const req = asRecord(body.req)
      const codeValue = Number(req.code ?? body.code ?? 0)
      console.log('[QQMusic] WeChat raw musicu result:', {
        host,
        code: codeValue,
        cookies: Object.keys(cookies).filter(key => cookies[key]),
      })

      const data = asRecord(req.data)
      const credentialData = data as QQCredentialData
      let authCookie = extractAuthCookieFromCredential(credentialData)
      if (!authCookie) {
        authCookie = buildAuthCookieFromCookieJar({ ...cookieJar, ...cookies }, 2)
      }
      if (authCookie && credentialStore.isCredentialComplete(authCookie)) {
        authCookie.login_type = 2
        return this.finishLogin(authCookie, credentialData, credentialData.nick || credentialData.nickname || '')
      }

        if (codeValue !== 0) {
          continue
        }
      } catch (error) {
        console.warn(`[QQMusic] WeChat raw musicu exchange failed on ${host}:`, error instanceof Error ? error.message : error)
      }
    }

    return null
  }

  private cookieHeaderToJar(cookieHeader: string): CookieJar {
    const cookies: CookieJar = {}
    for (const part of cookieHeader.split(';')) {
      const trimmed = part.trim()
      const eq = trimmed.indexOf('=')
      if (eq > 0) {
        cookies[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
      }
    }
    return cookies
  }

  private async completeQQLogin(args: string[]): Promise<QRPollResult> {
    const redirectUrl = args[2] || ''
    const nickname = decodeMaybe(args[5] || '')
    const sigx = /(?:\?|&)ptsigx=(.+?)(?:&|$)/.exec(redirectUrl)?.[1]
    const uinFromUrl = /(?:\?|&)uin=(.+?)(?:&|$)/.exec(redirectUrl)?.[1]
    const resolvedUin = decodeMaybe(uinFromUrl || '')
    const diag: string[] = []

    console.log('[QQMusic] QR login completed, redirectUrl:', redirectUrl.substring(0, 200))

    // 策略 A：直接跟随 redirect URL，收集 cookie
    let allCookies: CookieJar = {}
    let finalUrl = ''
    try {
      const result = await this.followRedirectsCollectingCookiesAndUrl(
        redirectUrl,
        { Referer: QQ_LOGIN_REFERER, 'User-Agent': this.userAgent },
      )
      allCookies = result.cookies
      finalUrl = result.finalUrl
      diag.push(`redirectChain: finalUrl=${finalUrl.substring(0, 100)}, cookies=[${Object.keys(allCookies).join(', ') || 'none'}]`)
      console.log('[QQMusic] redirect chain result:', diag[diag.length - 1])

      // A1) OAuth code 已在 URL 中
      const code = /(?:\?|&)code=([^&]+)/.exec(finalUrl)?.[1]
      if (code) {
        console.log('[QQMusic] found OAuth code, exchanging...')
        try {
          const cd = await this.callQQLoginWithCode(decodeMaybe(code))
          const ac = extractAuthCookieFromCredential(cd)
          if (ac && credentialStore.isCredentialComplete(ac)) return this.finishLogin(ac, cd, nickname)
          diag.push('code exchange: incomplete')
        } catch (e) { diag.push(`code exchange: ${(e as Error).message}`) }
      }

      // A2) graph.qq.com/oauth2.0/show 中间确认页 → 递归解析表单并提交
      let postCode: string | undefined
      if (!code && finalUrl.includes('graph.qq.com/oauth2.0/show')) {
        const pSkey = allCookies.p_skey || ''
        const pUin = (allCookies.p_uin || '').replace(/^o0*/, '')
        const ptOauthToken = allCookies.pt_oauth_token || ''
        diag.push(`showPage: p_skey.len=${pSkey.length}, p_uin=${pUin}, pt_oauth_token.len=${ptOauthToken.length}`)

        const loginJumpResult = await this.exchangePLoginSessionForMusicCredential(allCookies, nickname, diag)
        if (loginJumpResult) {
          return loginJumpResult
        }

        // 循环处理 /show 页面链：error → Login → 最终 code
        let currentUrl = finalUrl
        for (let formRound = 1; formRound <= 3 && !postCode; formRound++) {
          console.log(`[QQMusic] form round ${formRound}, url=${currentUrl.substring(0, 80)}`)
          const roundParams = this.extractQueryParams(currentUrl)
          try {
            const html = await this.fetchPageHtml(currentUrl, allCookies)
            const formFields = this.parseOAuthForm(html, roundParams)
            diag.push(`formR${formRound}: fields=[${Object.keys(formFields).join(',') || 'none'}]`)
            if (Object.keys(formFields).length === 0) break
            // api_choose 是登录方式选择器，补齐 value
            if (Object.keys(formFields).length === 1 && 'api_choose' in formFields && !formFields.api_choose) {
              formFields.api_choose = 'qq'
            }

            const submissionFields = this.prepareOAuthFormSubmission(formFields, roundParams)
            const formBody = new URLSearchParams(submissionFields).toString()
            const { finalUrl: nextUrl } = await this.followRedirectsCollectingCookiesAndUrl(
              'https://graph.qq.com/oauth2.0/authorize',
              { Referer: currentUrl, 'User-Agent': this.userAgent, 'Content-Type': 'application/x-www-form-urlencoded' },
              formBody,
              10,
              allCookies,
            )
            diag.push(`formR${formRound} result: ${nextUrl.substring(0, 100)}`)
            postCode = /(?:\?|&)code=([^&]+)/.exec(nextUrl)?.[1]
            if (postCode) {
              try {
                const cd = await this.callQQLoginWithCode(decodeMaybe(postCode))
                const ac = extractAuthCookieFromCredential(cd)
                if (ac && credentialStore.isCredentialComplete(ac)) return this.finishLogin(ac, cd, nickname)
                diag.push(`formR${formRound}: code exchange incomplete`)
              } catch (e) { diag.push(`formR${formRound}: ${(e as Error).message}`) }
            }
            // 如果还在 /show 页面，继续下一轮
            if (nextUrl.includes('/oauth2.0/show')) {
              currentUrl = nextUrl
            } else {
              break
            }
          } catch (e) { diag.push(`formR${formRound}: ${(e as Error).message}`); break }
        }
      }

      // A2.5) 用已收集的 p_skey session 尝试所有路径换取 musickey
      const pSkey = allCookies.p_skey || ''
      const pUin = (allCookies.p_uin || '').replace(/^o0*/, '')
      if (!code && !postCode && pSkey && pUin) {
        const pSkeyCookies = `p_skey=${pSkey}; p_uin=o${pUin}; uin=${pUin}; pt4_token=${allCookies.pt4_token || ''}; pt_oauth_token=${allCookies.pt_oauth_token || ''}`
        console.log('[QQMusic] p_skey acquired, trying all paths, uin=', pUin)

        // 路径 1：直接访问 y.qq.com 携带 p_skey，让服务器下发 music cookie
        try {
          const { cookies: yCookies, finalUrl: yUrl } = await this.followRedirectsCollectingCookiesAndUrl(
            'https://y.qq.com/',
            { Referer: 'https://y.qq.com/', 'User-Agent': this.userAgent },
            undefined, 5,
            { p_skey: pSkey, p_uin: `o${pUin}`, uin: pUin, pt4_token: allCookies.pt4_token || '' },
          )
          const yKeys = Object.keys(yCookies).filter(k => yCookies[k])
          diag.push(`y.qq.com: finalUrl=${yUrl.substring(0, 80)}, cookies=[${yKeys.join(',')}]`)
          const yMusicKey = yCookies.qqmusic_key || yCookies.qm_keyst || ''
          const yMusicId = (yCookies.uin || yCookies.qqmusic_uin || pUin).replace(/\D/g, '')
          if (yMusicKey && yMusicId) {
            const cd: QQCredentialData = { musickey: yMusicKey, musicid: yMusicId, str_musicid: yMusicId, loginType: 1 }
            const ac = extractAuthCookieFromCredential(cd)
            if (ac && credentialStore.isCredentialComplete(ac)) return this.finishLogin(ac, cd, nickname)
            diag.push('y.qq.com: incomplete credential')
          }
        } catch (e) { diag.push(`y.qq.com: ${(e as Error).message}`) }

        // 路径 1.5：访问 y.qq.com 登录回调页 (wx_redirect.html)，可能触发下发 music cookie
        try {
          const wxUrl = 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/'
          const { cookies: wxCookies, finalUrl: wxFinal } = await this.followRedirectsCollectingCookiesAndUrl(
            wxUrl,
            { Referer: 'https://y.qq.com/', 'User-Agent': this.userAgent },
            undefined, 5,
            { p_skey: pSkey, p_uin: `o${pUin}`, uin: pUin, pt4_token: allCookies.pt4_token || '' },
          )
          const wxKeys = Object.keys(wxCookies).filter(k => wxCookies[k])
          diag.push(`wx_redirect: finalUrl=${wxFinal.substring(0, 80)}, cookies=[${wxKeys.join(',')}]`)
          const wxKey = wxCookies.qqmusic_key || wxCookies.qm_keyst || ''
          const wxId = (wxCookies.uin || wxCookies.qqmusic_uin || pUin).replace(/\D/g, '')
          if (wxKey && wxId) {
            const cd: QQCredentialData = { musickey: wxKey, musicid: wxId, str_musicid: wxId, loginType: 1 }
            const ac = extractAuthCookieFromCredential(cd)
            if (ac && credentialStore.isCredentialComplete(ac)) return this.finishLogin(ac, cd, nickname)
          }
        } catch (e) { diag.push(`wx_redirect: ${(e as Error).message}`) }

        // 路径 2：直接调 OAuth authorize（p_skey 作为 session，绕过 ptsigx）
        try {
          const authUrl = 'https://graph.qq.com/oauth2.0/authorize?' + new URLSearchParams({
            response_type: 'code', client_id: QQ_MUSIC_CLIENT_ID,
            redirect_uri: 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/',
            scope: 'get_user_info,get_app_friends', state: 'state',
          }).toString()
          const initCookies = { p_skey: pSkey, p_uin: `o${pUin}`, uin: pUin, pt4_token: allCookies.pt4_token || '' }
          const { finalUrl: authFinalUrl } = await this.followRedirectsCollectingCookiesAndUrl(
            authUrl,
            { Referer: 'https://y.qq.com/', 'User-Agent': this.userAgent },
            undefined, 10, initCookies,
          )
          diag.push(`authorize: finalUrl=${authFinalUrl.substring(0, 100)}`)
          const authCode = /(?:\?|&)code=([^&]+)/.exec(authFinalUrl)?.[1]
          if (authCode) {
            const cd = await this.callQQLoginWithCode(decodeMaybe(authCode))
            const ac = extractAuthCookieFromCredential(cd)
            if (ac && credentialStore.isCredentialComplete(ac)) return this.finishLogin(ac, cd, nickname)
            diag.push('authorize: code exchange incomplete')
          }
        } catch (e) { diag.push(`authorize: ${(e as Error).message}`) }

        // 路径 3：musics.fcg 带 p_skey cookie
        try {
          const payload = { req1: { module: 'QQConnectLogin.LoginServer', method: 'QQLogin', param: { p_skey: pSkey, uin: Number(pUin), pttype: 1 } } }
          const musicsUrl = `https://u6.y.qq.com/cgi-bin/musics.fcg?sign=${sign(payload)}&format=json&inCharset=utf8&outCharset=utf-8&data=${encodeURIComponent(JSON.stringify(payload))}`
          const { text, cookies: mc } = await httpsGet(musicsUrl, {
            Cookie: pSkeyCookies, Referer: 'https://y.qq.com/', 'User-Agent': this.userAgent,
          })
          const mr = asRecord(parseJsonText(text))
          const req1 = asRecord(mr.req1)
          const mcCode = Number(req1.code ?? mr.code ?? 0)
          diag.push(`musics.fcg: code=${mcCode}, respCookies=[${Object.keys(mc).filter(k => mc[k]).join(',')}]`)
          if (mcCode === 0) {
            const data = asRecord(req1.data)
            const mk = String(data.musickey || '')
            const mid = String(data.str_musicid || data.musicid || pUin)
            if (mk && mid) {
              const cd: QQCredentialData = { musickey: mk, musicid: mid, str_musicid: mid, loginType: 1, musickeyCreateTime: data.musickeyCreateTime, keyExpiresIn: data.keyExpiresIn }
              const ac = extractAuthCookieFromCredential(cd)
              if (ac && credentialStore.isCredentialComplete(ac)) return this.finishLogin(ac, cd, nickname)
            }
          }
          // musics.fcg 响应里也可能直接带 cookie
          const mKey = mc.qqmusic_key || mc.qm_keyst || ''
          const mId = (mc.uin || mc.qqmusic_uin || '').replace(/\D/g, '')
          if (mKey && mId) {
            const cd: QQCredentialData = { musickey: mKey, musicid: mId, str_musicid: mId, loginType: 1 }
            const ac = extractAuthCookieFromCredential(cd)
            if (ac && credentialStore.isCredentialComplete(ac)) return this.finishLogin(ac, cd, nickname)
          }
        } catch (e) { diag.push(`musics.fcg: ${(e as Error).message}`) }
      } else if (!code && !postCode) {
        diag.push(`p_skey not available: pSkey.len=${(allCookies.p_skey || '').length}, pUin=${(allCookies.p_uin || '').replace(/^o0*/, '')}`)
      }

      // A4) musickey 直接在 cookie 中
      const uinFromCookie = allCookies.uin || allCookies.qqmusic_uin || ''
      const musicKey = allCookies.qqmusic_key || allCookies.qm_keyst || ''
      const musicId = uinFromCookie.replace(/\D/g, '')
      if (musicKey && musicId) {
        const cd: QQCredentialData = { musickey: musicKey, musicid: musicId, str_musicid: musicId, loginType: 1 }
        const ac = extractAuthCookieFromCredential(cd)
        if (ac && credentialStore.isCredentialComplete(ac)) {
          await credentialStore.saveCredentials(ac, { expiryTime: Date.now() + DEFAULT_SESSION_EXPIRES_MS })
          return this.finishLogin(ac, cd, nickname)
        }
      }

      // A5) pt4_token 登录
      const pt4Token = allCookies.pt4_token || ''
      const uinClean = uinFromCookie.replace(/\D/g, '') || pUin
      if (pt4Token && uinClean) {
        try {
          const cd = this.extractMusicuData(await this.callMusicu({
            req_0: { module: 'QQConnectLogin.LoginServer', method: 'QQLogin', param: { pt4_token: pt4Token, uin: Number(uinClean), pttype: 1 } },
            comm: { tmeLoginType: 2 },
          }))
          const ac = extractAuthCookieFromCredential(cd)
          if (ac && credentialStore.isCredentialComplete(ac)) return this.finishLogin(ac, cd, nickname)
        } catch (e) { diag.push(`pt4_token: ${(e as Error).message}`) }
      }
    } catch (e) {
      diag.push(`redirectChain error: ${(e as Error).message}`)
    }

    // 策略 B：check_sig 重定向链
    if (sigx && resolvedUin) {
      try {
        const cd = await this.authorizeQQLogin(resolvedUin, decodeMaybe(sigx))
        const ac = extractAuthCookieFromCredential(cd)
        if (ac && credentialStore.isCredentialComplete(ac)) return this.finishLogin(ac, cd, nickname)
        diag.push('check_sig: incomplete')
      } catch (e) { diag.push(`check_sig: ${(e as Error).message}`) }
    }

    // 策略 C：ptsigx 直接登录
    if (sigx && resolvedUin) {
      try {
        const cd = await this.loginWithPtsigxDirect(resolvedUin, decodeMaybe(sigx))
        const ac = extractAuthCookieFromCredential(cd)
        if (ac && credentialStore.isCredentialComplete(ac)) return this.finishLogin(ac, cd, nickname)
        diag.push('ptsigx direct: incomplete')
      } catch (e) { diag.push(`ptsigx direct: ${(e as Error).message}`) }
    }

    const summary = diag.join(' | ')
    console.error('[QQMusic] all methods exhausted:', summary)
    return { status: 'error', error: `QQ Music credential was incomplete after all methods. Debug: ${summary}` }
  }

  private async exchangePLoginSessionForMusicCredential(cookies: CookieJar, nickname: string, diag: string[]): Promise<QRPollResult | null> {
    const pSkey = cookies.p_skey || ''
    const pUin = (cookies.p_uin || cookies.uin || '').replace(/^o0*/, '').replace(/\D/g, '')
    if (!pSkey || !pUin) {
      diag.push(`login_jump: missing p_skey/p_uin (p_skey.len=${pSkey.length}, p_uin=${pUin})`)
      return null
    }

    const jumpCookies = {
      ...cookies,
      p_uin: cookies.p_uin || `o${pUin}`,
      uin: pUin,
    }
    const loginJump = new URL(QQ_OAUTH_LOGIN_JUMP)
    loginJump.searchParams.set('login_type', '1')
    loginJump.searchParams.set('client_id', QQ_MUSIC_CLIENT_ID)
    loginJump.searchParams.set('redirect_uri', QQ_OAUTH_REDIRECT_URI)
    loginJump.searchParams.set('state', 'state')
    loginJump.searchParams.set('response_type', 'code')
    loginJump.searchParams.set('scope', QQ_OAUTH_SCOPE)

    try {
      const jumped = await this.followRedirectsCollectingCookiesAndUrl(
        loginJump.toString(),
        { Referer: 'https://graph.qq.com/oauth2.0/show', 'User-Agent': this.userAgent },
        undefined,
        6,
        jumpCookies,
      )
      Object.assign(jumpCookies, jumped.cookies)
      diag.push(`login_jump: finalUrl=${jumped.finalUrl.substring(0, 100)}, cookies=[${Object.keys(jumpCookies).filter(k => jumpCookies[k]).join(',')}]`)

      const jumpCode = /(?:\?|&)code=([^&]+)/.exec(jumped.finalUrl)?.[1]
      if (jumpCode) {
        const cd = await this.callQQLoginWithCode(decodeMaybe(jumpCode))
        const ac = extractAuthCookieFromCredential(cd)
        if (ac && credentialStore.isCredentialComplete(ac)) {
          return this.finishLogin(ac, cd, nickname)
        }
        diag.push('login_jump: code exchange incomplete')
      }
    } catch (e) {
      diag.push(`login_jump: ${(e as Error).message}`)
    }

    try {
      const authorizeResult = await this.postOAuthAuthorize(jumpCookies)
      const redirectTarget = authorizeResult.location
        ? new URL(authorizeResult.location, 'https://graph.qq.com/oauth2.0/authorize').toString()
        : ''
      Object.assign(jumpCookies, authorizeResult.cookies)
      diag.push(`authorizePOST: status=${authorizeResult.status}, location=${redirectTarget.substring(0, 100)}, cookies=[${Object.keys(jumpCookies).filter(k => jumpCookies[k]).join(',')}]`)

      const postCode = /(?:\?|&)code=([^&]+)/.exec(redirectTarget || authorizeResult.text)?.[1]
      if (postCode) {
        const cd = await this.callQQLoginWithCode(decodeMaybe(postCode))
        const ac = extractAuthCookieFromCredential(cd)
        if (ac && credentialStore.isCredentialComplete(ac)) {
          return this.finishLogin(ac, cd, nickname)
        }
        diag.push('authorizePOST: code exchange incomplete')
      }

      if (redirectTarget) {
        const followed = await this.followRedirectsCollectingCookiesAndUrl(
          redirectTarget,
          { Referer: 'https://graph.qq.com/oauth2.0/authorize', 'User-Agent': this.userAgent },
          undefined,
          6,
          jumpCookies,
        )
        Object.assign(jumpCookies, followed.cookies)
        const followedCode = /(?:\?|&)code=([^&]+)/.exec(followed.finalUrl)?.[1]
        diag.push(`authorizePOST-follow: finalUrl=${followed.finalUrl.substring(0, 100)}`)
        if (followedCode) {
          const cd = await this.callQQLoginWithCode(decodeMaybe(followedCode))
          const ac = extractAuthCookieFromCredential(cd)
          if (ac && credentialStore.isCredentialComplete(ac)) {
            return this.finishLogin(ac, cd, nickname)
          }
        }
      }
    } catch (e) {
      diag.push(`authorizePOST: ${(e as Error).message}`)
    }

    return null
  }

  private postOAuthAuthorize(cookies: CookieJar) {
    const pSkey = cookies.p_skey || ''
    const pUin = (cookies.p_uin || cookies.uin || '').replace(/^o0*/, '').replace(/\D/g, '')
    return httpsPostForm(
      'https://graph.qq.com/oauth2.0/authorize',
      {
        Referer: QQ_OAUTH_LOGIN_JUMP,
        Origin: 'https://graph.qq.com',
        'User-Agent': this.userAgent,
      },
      {
        response_type: 'code',
        client_id: QQ_MUSIC_CLIENT_ID,
        redirect_uri: QQ_OAUTH_REDIRECT_URI,
        scope: QQ_OAUTH_SCOPE,
        state: 'state',
        switch: '',
        from_ptlogin: '1',
        src: '1',
        update_auth: '1',
        openapi: '1010_1030',
        g_tk: hash33Gtk(pSkey),
        auth_time: Date.now(),
        ui: pUin,
      },
      cookies,
    )
  }

  private extractQueryParams(url: string): Record<string, string> {
    const params: Record<string, string> = {}
    const qs = url.split('?')[1] || ''
    for (const part of qs.split('&')) {
      const [k, v] = part.split('=')
      if (k) params[decodeMaybe(k)] = decodeMaybe(v || '')
    }
    return params
  }

  /** 用 Node.js https 获取页面 HTML，携带 cookie */
  private fetchPageHtml(url: string, cookies: CookieJar): Promise<string> {
    return new Promise((resolve, reject) => {
      let parsed: URL
      try { parsed = new URL(url) } catch (e) { return reject(e) }
      const req = https.request({
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          Cookie: cookieJarHeader(cookies),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: QQ_LOGIN_REFERER,
        },
        minVersion: 'TLSv1.2' as const,
        rejectUnauthorized: false,
      }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
      req.on('error', reject)
      req.setTimeout(10000, () => req.destroy(new Error('timeout')))
      req.end()
    })
  }

  /** 从 OAuth /show 页面 HTML 中解析出确认表单的隐藏字段 */
  private parseOAuthForm(html: string, urlParams: Record<string, string>): Record<string, string> {
    const fields: Record<string, string> = {}
    // 提取所有 input（hidden/text/submit）、select、textarea 的 name/value
    const inputRe = /<(?:input|select|textarea|button)[^>]*name\s*=\s*["']([^"']+)["'][^>]*(?:value\s*=\s*["']([^"']*)["'])?[^>]*\/?>/gi
    let m: RegExpExecArray | null
    while ((m = inputRe.exec(html)) !== null) {
      const name = decodeMaybe(m[1])
      const value = decodeMaybe(m[2] || '')
      if (name && !fields[name]) fields[name] = value
    }
    // 也抓 type=hidden 的 input（有些表单用单引号）
    const hiddenRe = /<input[^>]*type\s*=\s*["']hidden["'][^>]*name\s*=\s*["']([^"']+)["'][^>]*value\s*=\s*["']([^"']*)["'][^>]*\/?>/gi
    while ((m = hiddenRe.exec(html)) !== null) {
      const name = decodeMaybe(m[1])
      const value = decodeMaybe(m[2] || '')
      if (name && !fields[name]) fields[name] = value
    }
    // 从 JS 中提取可能的 redirect/confirm 调用
    const jsRedirect = /location(?:\.href|\.replace|\.assign)?\s*=\s*["']([^"']+)["']/i.exec(html)
    if (jsRedirect) fields['_js_redirect'] = decodeMaybe(jsRedirect[1])
    // 如果页面有 form，也提取其 action
    const formMatch = /<form[^>]*action\s*=\s*["']([^"']+)["'][^>]*method\s*=\s*["']([^"']+)["']/i.exec(html)
    if (formMatch) {
      fields['_form_action'] = decodeMaybe(formMatch[1])
      fields['_form_method'] = decodeMaybe(formMatch[2])
    }
    // fallback: 用 URL 参数
    if (Object.keys(fields).filter(k => !k.startsWith('_')).length === 0) {
      for (const key of ['response_type', 'client_id', 'redirect_uri', 'scope', 'state']) {
        if (urlParams[key]) fields[key] = urlParams[key]
      }
    }
    return fields
  }

  private prepareOAuthFormSubmission(
    formFields: Record<string, string>,
    urlParams: Record<string, string>,
  ): Record<string, string> {
    const merged: Record<string, string> = {}
    for (const key of ['response_type', 'client_id', 'redirect_uri', 'scope', 'state', 'src', 'update_auth', 'openapi']) {
      const value = formFields[key] || urlParams[key]
      if (value) {
        merged[key] = value
      }
    }

    merged.response_type ||= 'code'
    merged.client_id ||= QQ_MUSIC_CLIENT_ID
    merged.redirect_uri ||= QQ_OAUTH_REDIRECT_URI
    merged.scope ||= QQ_OAUTH_SCOPE
    merged.state ||= 'state'
    merged.src ||= '1'
    merged.update_auth ||= '1'
    merged.openapi ||= '1010_1030'

    for (const [key, value] of Object.entries(formFields)) {
      if (key.startsWith('_')) {
        continue
      }
      if (!merged[key] && value) {
        merged[key] = value
      }
    }

    if ('api_choose' in formFields) {
      merged.api_choose = formFields.api_choose || 'qq'
    }
    return merged
  }

  private async finishLogin(authCookie: AuthCookie, credentialData: QQCredentialData, nickname: string): Promise<QRPollResult> {
    const options = this.credentialSaveOptions(credentialData)
    await credentialStore.saveCredentials(authCookie, options)
    this.currentQrsig = null
    this.qrStartedAt = 0
    this.updateStatus({
      status: LoginStatus.LoggedIn,
      userInfo: buildUserInfo(authCookie, nickname, credentialData.headurl),
    })
    return { status: 'confirmed', cookies: authCookie }
  }

  private async authorizeQQLogin(uin: string, sigx: string): Promise<QQCredentialData> {
    // ptsigx 有效期极短（几秒），必须优先使用，否则会因过期返回 1000
    // 先尝试直接用 ptsigx 换 musickey，失败后再走 check_sig 重定向链
    try {
      return await this.loginWithPtsigxDirect(uin, sigx)
    } catch (ptsigxError) {
      console.warn('[QQMusic] ptsigx direct login failed, falling back to check_sig redirect chain:',
        ptsigxError instanceof Error ? ptsigxError.message : ptsigxError)
    }

    // 降级：通过 check_sig 重定向链收集 cookie 换取凭据
    const checkSigUrl = 'https://ssl.ptlogin2.graph.qq.com/check_sig?' + new URLSearchParams({
      uin,
      pttype: '1',
      service: 'ptqrlogin',
      nodirect: '0',
      ptsigx: sigx,
      s_url: 'https://y.qq.com',
      ptlang: '2052',
      ptredirect: '100',
      aid: QQ_QR_APP_ID,
      daid: QQ_QR_DAID,
      j_later: '0',
      low_login_hour: '0',
      regmaster: '0',
      pt_login_type: '3',
      pt_aid: '0',
      pt_aaid: '16',
      pt_light: '0',
      pt_3rd_aid: QQ_MUSIC_CLIENT_ID,
    }).toString()

    const { cookies: allCookies, finalUrl } = await this.followRedirectsCollectingCookiesAndUrl(
      checkSigUrl,
      { Referer: QQ_LOGIN_REFERER, 'User-Agent': this.userAgent },
    )

    // 如果重定向链带回了 OAuth code，走标准流程
    const code = /(?:\?|&)code=([^&]+)/.exec(finalUrl)?.[1]
    if (code) {
      return await this.callQQLoginWithCode(decodeMaybe(code))
    }

    // 检查是否直接拿到了 QQ 音乐的 key
    const musicKey = allCookies.qqmusic_key || allCookies.qm_keyst || ''
    const musicId = allCookies.uin || allCookies.qqmusic_uin || uin
    if (musicKey && musicId) {
      return {
        musickey: musicKey,
        musicid: musicId.replace(/\D/g, ''),
        str_musicid: musicId.replace(/\D/g, ''),
        loginType: 1,
      }
    }

    // 用 pt4_token 调用 musicu QQLogin
    const pt4Token = allCookies.pt4_token || ''
    if (pt4Token) {
      try {
        const result = await this.callMusicu({
          req_0: {
            module: 'QQConnectLogin.LoginServer',
            method: 'QQLogin',
            param: { pt4_token: pt4Token, uin: Number(uin), pttype: 1 },
          },
          comm: { tmeLoginType: 2 },
        })
        return this.extractMusicuData(result)
      } catch (e) {
        console.warn('[QQMusic] pt4_token login failed:', e instanceof Error ? e.message : e)
      }
    }

    // 所有方法都失败
    throw new Error(
      `QQ Music login failed: all methods exhausted. ` +
      `uin=${uin}, cookies=${Object.keys(allCookies).join(', ') || 'none'}`,
    )
  }

  /**
   * 用 ptsigx 通过 musics.fcg 换取 musickey
   */
  private async loginWithPtsigxDirect(uin: string, sigx: string, cookies: CookieJar = {}): Promise<QQCredentialData> {
    // 尝试多种参数组合
    const attempts = [
      // 方式1：标准 QQLogin with ptsigx
      {
        module: 'QQConnectLogin.LoginServer',
        method: 'QQLogin',
        param: { ptsigx: sigx, uin: Number(uin), pttype: 1 },
        tmeLoginType: 2,
      },
      // 方式2：用 musicu 的 QQ 登录接口
      {
        module: 'music.login.LoginServer',
        method: 'Login',
        param: { ptsigx: sigx, uin: Number(uin) },
        tmeLoginType: 1,
      },
    ]

    let lastError: Error | null = null
    for (const attempt of attempts) {
      try {
        const result = await this.callMusicu({
          req_0: {
            module: attempt.module,
            method: attempt.method,
            param: attempt.param,
          },
          comm: { tmeLoginType: attempt.tmeLoginType },
        })
        return this.extractMusicuData(result)
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        console.warn(`[QQMusic] ${attempt.module}.${attempt.method} failed:`, lastError.message)
      }
    }

    throw new Error(
      `QQ Music login failed: all methods exhausted. ` +
      `Last error: ${lastError?.message}. ` +
      `uin=${uin}, cookies=${Object.keys(cookies).join(', ')}`,
    )
  }

  private async callQQLoginWithCode(code: string): Promise<QQCredentialData> {
    const result = await this.callMusicu({
      req_0: {
        module: 'QQConnectLogin.LoginServer',
        method: 'QQLogin',
        param: { code },
      },
      comm: {
        tmeLoginType: 2,
      },
    })
    return this.extractMusicuData(result)
  }

  /**
   * 用 Node.js https 模块跟随重定向链，收集所有 Set-Cookie 并返回最终 URL
   * 支持可选的 POST body（用于 authorize 请求）
   */
  private followRedirectsCollectingCookiesAndUrl(
    startUrl: string,
    baseHeaders: Record<string, string>,
    postBody?: string,
    maxRedirects = 8,
    initialCookies?: CookieJar,
  ): Promise<{ cookies: CookieJar; finalUrl: string }> {
    return new Promise((resolve, reject) => {
      const allCookies: CookieJar = { ...initialCookies }
      let redirectCount = 0

      const doRequest = (url: string, method: string, body?: string) => {
        let parsed: URL
        try {
          parsed = new URL(url)
        } catch {
          return resolve({ cookies: allCookies, finalUrl: url })
        }

        const isHttps = parsed.protocol === 'https:'
        const lib = isHttps ? https : http

        const headers: Record<string, string> = {
          ...baseHeaders,
          Cookie: cookieJarHeader(allCookies),
        }
        if (body) {
          headers['Content-Length'] = String(Buffer.byteLength(body))
        }

        const options = {
          hostname: parsed.hostname,
          port: parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method,
          headers,
          minVersion: 'TLSv1.2' as const,
          rejectUnauthorized: false,
        }

        const req = lib.request(options, (res) => {
          const rawSetCookie = res.headers['set-cookie']
          const items: string[] = Array.isArray(rawSetCookie) ? rawSetCookie
            : (typeof rawSetCookie === 'string' ? [rawSetCookie] : [])
          for (const item of items) {
            const nameValue = item.split(';')[0].trim()
            const eqIndex = nameValue.indexOf('=')
            if (eqIndex > 0) {
              const name = nameValue.slice(0, eqIndex).trim()
              const value = nameValue.slice(eqIndex + 1)
              if (name && (value || !allCookies[name])) allCookies[name] = value
            }
          }

          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
            const location = res.headers.location
            if (location && redirectCount < maxRedirects) {
              redirectCount++
              res.resume()
              try {
                const nextUrl = new URL(location, url).toString()
                const nextHost = new URL(nextUrl).hostname
                if (nextHost.endsWith('y.qq.com') || nextHost.endsWith('qq.com') && nextHost.startsWith('y.')) {
                  res.resume()
                  return resolve({ cookies: allCookies, finalUrl: nextUrl })
                }
                doRequest(nextUrl, 'GET')
              } catch {
                doRequest(location, 'GET')
              }
              return
            }
          }

          res.resume()
          resolve({ cookies: allCookies, finalUrl: url })
        })

        req.on('error', reject)
        req.setTimeout(12000, () => req.destroy(new Error('Request timeout')))

        if (body) {
          req.write(body)
        }
        req.end()
      }

      doRequest(startUrl, postBody ? 'POST' : 'GET', postBody)
    })
  }


  private parsePtuiCallback(text: string): string[] {
    const match = /ptuiCB\((.*?)\)/.exec(text)
    if (!match) {
      return []
    }

    const args: string[] = []
    const argRegex = /'((?:\\.|[^'])*)'/g
    let argMatch: RegExpExecArray | null
    while ((argMatch = argRegex.exec(match[1])) !== null) {
      args.push(argMatch[1].replace(/\\'/g, "'"))
    }
    return args
  }

  private updateStatus(statusInfo: LoginStatusInfo): void {
    const previousStatus = this.statusInfo.status
    const previousUser = this.statusInfo.userInfo?.uin
    this.statusInfo = statusInfo

    if (previousStatus === statusInfo.status && previousUser === statusInfo.userInfo?.uin) {
      return
    }

    for (const window of this.getWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.QQMUSIC_STATUS_CHANGED, this.statusInfo)
      }
    }
  }

  private async checkCredential(credentials: AuthCookie): Promise<boolean> {
    try {
      const result = await this.callMusicu({
        req_0: {
          module: 'music.UserInfo.userInfoServer',
          method: 'GetLoginUserInfo',
          param: {},
        },
      }, credentials)
      const code = Number(asRecord(result.req_0).code || 0)
      // 明确的登录失效错误码
      if ([1000, 104401, 104400].includes(code)) {
        return false
      }
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // 只有明确的认证失败才返回 false，网络错误保守地返回 true
      if (/1000|104401|104400/.test(message)) {
        return false
      }
      // 网络错误、超时等情况：保守地认为凭据仍然有效
      console.warn('[QQMusic] checkCredential network error, assuming valid:', message)
      return true
    }
  }

  private async refreshWithLoginServer(
    credentials: AuthCookie,
  ): Promise<{ cookies: AuthCookie; options: CredentialSaveOptions } | null> {
    const refreshKey = String(credentials.refresh_key || '')
    const refreshToken = String(credentials.refresh_token || '')

    if (refreshKey || refreshToken) {
      const result = await this.callMusicu({
        req_0: {
          module: 'music.login.LoginServer',
          method: 'Login',
          param: {
            refresh_key: refreshKey,
            refresh_token: refreshToken,
            musickey: credentials.qqmusic_key,
            musicid: Number(credentials.uin),
          },
        },
        comm: {
          tmeLoginType: credentials.login_type,
        },
      }, credentials)
      const credentialData = this.extractMusicuData(result)
      const cookies = extractAuthCookieFromCredential(credentialData)
      return cookies ? { cookies, options: this.credentialSaveOptions(credentialData) } : null
    }

    const payload = {
      req1: {
        module: 'QQConnectLogin.LoginServer',
        method: 'QQLogin',
        param: {
          expired_in: 7776000,
          musicid: credentials.uin,
          musickey: credentials.qqmusic_key,
        },
      },
    }
    const url = `https://u6.y.qq.com/cgi-bin/musics.fcg?sign=${sign(payload)}&format=json&inCharset=utf8&outCharset=utf-8&data=${encodeURIComponent(JSON.stringify(payload))}`
    const { text: refreshText } = await httpsGet(url, {
      Cookie: buildCookieHeader(credentials),
      Referer: 'https://y.qq.com/',
      'User-Agent': this.userAgent,
    })
    const result = asRecord(parseJsonText(refreshText))
    const data = getNestedRecord(result, ['req1', 'data'])
    const musicKey = String(data.musickey || '')

    if (!musicKey) {
      return null
    }

    const cookies = {
      ...credentials,
      qqmusic_key: musicKey,
      qm_keyst: musicKey,
    }
    return {
      cookies,
      options: {
        expiryTime: Date.now() + DEFAULT_SESSION_EXPIRES_MS,
      },
    }
  }

  private credentialSaveOptions(data: QQCredentialData): CredentialSaveOptions {
    const createTime = Number(data.musickeyCreateTime || 0)
    const expiresIn = Number(data.keyExpiresIn || 0)

    if (createTime > 0 && expiresIn > 0) {
      return {
        expiryTime: (createTime + expiresIn) * 1000,
      }
    }

    return {
      expiryTime: Date.now() + DEFAULT_SESSION_EXPIRES_MS,
    }
  }

  /** callMusicu 的变体，直接传 Cookie 字符串（用于 p_skey 等非标准凭据） */
  private async callMusicuRaw(
    data: Record<string, unknown>,
    cookieHeader?: string,
  ): Promise<Record<string, unknown>> {
    const url = new URL('https://u.y.qq.com/cgi-bin/musicu.fcg')
    const bodyData = this.withDefaultComm(data, undefined)
    url.searchParams.set('sign', sign(bodyData))

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Origin': 'https://y.qq.com',
      'Referer': 'https://y.qq.com/',
      'User-Agent': this.userAgent,
    }
    if (cookieHeader) headers.Cookie = cookieHeader

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    let response: Response
    try {
      response = await netFetch(url.toString(), {
        method: 'POST', headers, body: JSON.stringify(bodyData), signal: controller.signal,
      })
    } finally { clearTimeout(timeoutId) }

    if (!response.ok) throw new Error(`QQ Music HTTP error: ${response.status}`)
    const result = asRecord(await parseJsonResponse(response))
    const topCode = Number(result.code ?? 0)
    if (topCode !== 0) {
      if ([1000, 104401, 104400, 301].includes(topCode)) {
        throw new Error(`QQ Music login expired: ${topCode}`)
      }
      throw new Error(`QQ Music API error: ${topCode}`)
    }
    return result
  }

  private async callMusicu(
    data: Record<string, unknown>,
    credentials?: AuthCookie,
    useSign = true,
  ): Promise<Record<string, unknown>> {
    const url = new URL('https://u.y.qq.com/cgi-bin/musicu.fcg')
    const bodyData = this.withDefaultComm(data, credentials)
    if (useSign) {
      url.searchParams.set('sign', sign(bodyData))
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Origin': 'https://y.qq.com',
      'Referer': 'https://y.qq.com/',
      'User-Agent': this.userAgent,
    }
    if (credentials) {
      headers.Cookie = buildCookieHeader(credentials)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    let response: Response
    try {
      response = await netFetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyData),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      throw new Error(`QQ Music HTTP error: ${response.status}`)
    }

    const result = asRecord(await parseJsonResponse(response))
    const topCode = Number(result.code ?? 0)

    // 顶层 code 非 0 表示全局错误（如签名失败、频率限制等）
    if (topCode !== 0) {
      // 登录失效错误码
      if ([1000, 104401, 104400, 301].includes(topCode)) {
        throw new Error(`QQ Music login expired: ${topCode}`)
      }
      throw new Error(`QQ Music API error: ${topCode}`)
    }

    return result
  }

  private withDefaultComm(data: Record<string, unknown>, credentials?: AuthCookie): Record<string, unknown> {
    const incomingComm = asRecord(data.comm)
    return {
      ...data,
      comm: {
        // 基础标识
        ct: 11,           // 客户端类型：11=PC Web
        cv: 0,            // 客户端版本
        v: 0,
        tmeAppID: 'qqmusic',
        // 用户信息
        uin: credentials ? Number(credentials.uin) : 0,
        authst: credentials?.qqmusic_key || '',
        // 格式
        format: 'json',
        inCharset: 'utf-8',
        outCharset: 'utf-8',
        // 平台
        platform: 'yqq.json',
        // 其他
        g_tk: 5381,
        notice: 0,
        needNewCode: 0,
        // 调用方可覆盖
        ...incomingComm,
      },
    }
  }

  private extractMusicuData(result: Record<string, unknown>): QQCredentialData {
    const req0 = asRecord(result.req_0)
    const code = Number(req0.code || 0)
    if (code !== 0) {
      const errMsg = String(asRecord(req0).errMsg || asRecord(req0).msg || '')
      throw new Error(`QQ Music login failed: ${code}${errMsg ? ` (${errMsg})` : ''}`)
    }
    return asRecord(req0.data) as QQCredentialData
  }

  private normalizeEndpoint(endpoint: string, payload: Record<string, unknown>): NormalizedEndpoint {
    const cleanEndpoint = endpoint.replace(/^\/+/, '')
    const aliases: Record<string, string> = {
      getSearchByKey: 'search',
      getSmartbox: 'search/quick',
      getMusicPlay: 'song/url',
      getLyric: 'lyric',
    }
    return {
      endpoint: aliases[cleanEndpoint] || cleanEndpoint,
      payload,
    }
  }

  private async search(payload: Record<string, unknown>, credentials: AuthCookie): Promise<ApiResponse> {
    const key = String(payload.key || payload.keyword || '')
    if (!key.trim()) {
      return { success: false, error: 'Search keyword is required', code: 500 }
    }

    const pageNo = Number(payload.pageNo || payload.page || 1)
    const pageSize = Number(payload.pageSize || payload.limit || 20)
    const searchType = Number(payload.t || 0) // 0=歌曲, 2=专辑, 3=歌手

    const result = await this.callMusicu({
      req_0: {
        module: 'music.search.SearchCgiService',
        method: 'DoSearchForQQMusicDesktop',
        param: {
          remoteplace: 'txt.yqq.song',
          searchid: String(Date.now()),
          query: key,
          search_type: searchType,
          num_per_page: pageSize,
          page_num: pageNo,
        },
      },
    }, credentials)

    const req0 = asRecord(result.req_0)
    const req0Code = Number(req0.code || 0)
    if (req0Code !== 0) {
      return { success: false, error: `Search failed: ${req0Code}`, code: req0Code }
    }

    const data = asRecord(req0.data)
    const body = asRecord(data.body)
    const songList = asRecord(body.song)
    const list = Array.isArray(songList.list) ? songList.list : []
    const totalNum = Number(songList.totalnum || 0)

    return {
      success: true,
      code: 100,
      data: {
        list,
        pageNo,
        pageSize,
        total: totalNum,
        key,
        t: searchType,
        type: 'song',
      },
    }
  }

  private async searchSuggestions(payload: Record<string, unknown>, credentials: AuthCookie): Promise<ApiResponse> {
    const key = String(payload.key || payload.keyword || '')
    if (!key.trim()) {
      return { success: true, data: { song: { itemlist: [] } }, code: 100 }
    }

    const result = await this.callMusicu({
      req_0: {
        module: 'music.search.SearchCgiService',
        method: 'DoSearchForQQMusicDesktop',
        param: {
          remoteplace: 'txt.yqq.song',
          searchid: String(Date.now()),
          query: key,
          search_type: 0,
          num_per_page: 8,
          page_num: 1,
        },
      },
    }, credentials)

    const req0 = asRecord(result.req_0)
    const data = asRecord(req0.data)
    const body = asRecord(data.body)
    const songList = asRecord(body.song)
    const list = Array.isArray(songList.list) ? songList.list : []

    // 将搜索结果转换为建议格式
    const itemlist = list.slice(0, 8).map((item: unknown) => {
      const song = asRecord(item)
      const singers = Array.isArray(song.singer)
        ? (song.singer as unknown[]).map(s => String(asRecord(s).name || '')).filter(Boolean).join(' / ')
        : String(song.singername || '')
      const name = String(song.songname || song.name || '')
      return singers ? { name, singer: singers } : { name, singer: '' }
    })

    return { success: true, data: { song: { itemlist } }, code: 100 }
  }

  private async getTrackUrl(payload: Record<string, unknown>, credentials: AuthCookie): Promise<ApiResponse> {
    const id = String(payload.id || payload.songmid || payload.trackId || '')
    // mediaId 是文件 hash，有时与 songmid 相同，有时不同
    const mediaId = String(payload.mediaId || payload.strMediaMid || id)
    const type = String(payload.type || '128')

    const typeMap: Record<string, { prefix: string; ext: string }> = {
      m4a:  { prefix: 'C400', ext: '.m4a' },
      '128': { prefix: 'M500', ext: '.mp3' },
      '320': { prefix: 'M800', ext: '.mp3' },
      ape:  { prefix: 'A000', ext: '.ape' },
      flac: { prefix: 'F000', ext: '.flac' },
    }
    const selectedType = typeMap[type] ?? typeMap['128']

    if (!id) {
      return { success: false, error: 'Invalid song id', code: 500 }
    }

    // 文件名格式：{prefix}{songmid}{mediaId}{ext}
    const filename = `${selectedType.prefix}${id}${mediaId}${selectedType.ext}`

    const result = await this.callMusicu({
      req_0: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param: {
          filename: [filename],
          guid: String(Math.floor(Math.random() * 1e10)),
          songmid: [id],
          songtype: [0],
          uin: String(credentials.uin),
          loginflag: 1,
          platform: '20',
        },
      },
      comm: {
        uin: Number(credentials.uin),
        ct: 24,
        cv: 0,
        authst: credentials.qqmusic_key,
      },
    }, credentials)

    const data = getNestedRecord(result, ['req_0', 'data'])
    const midurlinfo = Array.isArray(data.midurlinfo) ? data.midurlinfo : []
    const sip = Array.isArray(data.sip) ? data.sip.map(String) : []
    const purl = String(asRecord(midurlinfo[0]).purl || '')

    if (!purl) {
      // purl 为空通常意味着需要 VIP 或歌曲不可用
      return {
        success: false,
        error: '该歌曲暂时无法播放（可能需要 VIP 或版权限制）',
        code: 403,
      }
    }

    // 优先选择 HTTPS CDN，避免 ws 开头的内网地址
    const domain = sip.find(s => s.startsWith('https://')) ||
                   sip.find(s => s.startsWith('http://') && !s.startsWith('http://ws')) ||
                   sip[0] || 'https://dl.stream.qqmusic.qq.com/'

    return { success: true, data: `${domain}${purl}`, code: 100 }
  }

  private async getLyrics(payload: Record<string, unknown>, credentials: AuthCookie): Promise<ApiResponse> {
    const songmid = String(payload.songmid || payload.id || payload.trackId || '')
    if (!songmid) {
      return { success: false, error: 'songmid is required', code: 500 }
    }

    const result = await this.callMusicu({
      req_0: {
        module: 'music.musichallSong.PlayLyricInfo',
        method: 'GetPlayLyricInfo',
        param: {
          songMID: songmid,
          songID: 0,
        },
      },
    }, credentials)

    const req0 = asRecord(result.req_0)
    const data = asRecord(req0.data)
    const lyricEncoded = String(data.lyric || '')
    const transEncoded = String(data.trans || '')

    return {
      success: true,
      code: 100,
      data: {
        lyric: lyricEncoded ? Buffer.from(lyricEncoded, 'base64').toString('utf8') : '',
        trans: transEncoded ? Buffer.from(transEncoded, 'base64').toString('utf8') : '',
      },
    }
  }

  private async getSonglist(payload: Record<string, unknown>, credentials: AuthCookie): Promise<ApiResponse> {
    const id = String(payload.id || payload.disstid || '')
    if (!id) {
      return { success: false, error: 'playlist id is required', code: 500 }
    }

    const result = await this.callMusicu({
      req_0: {
        module: 'music.srfDissInfo.aiDissInfo',
        method: 'uniform_get_Dissinfo',
        param: {
          disstid: Number(id),
          onlysong: 0,
          tag: 1,
          userinfo: 1,
          song_begin: 0,
          song_num: 300,
        },
      },
    }, credentials)

    const req0 = asRecord(result.req_0)
    const req0Code = Number(req0.code || 0)
    if (req0Code !== 0) {
      return { success: false, error: `Get songlist failed: ${req0Code}`, code: req0Code }
    }

    return { success: true, data: asRecord(req0.data), code: 100 }
  }

  private async callRawMusicu(
    endpoint: string,
    payload: Record<string, unknown>,
    credentials: AuthCookie,
  ): Promise<ApiResponse> {
    const request = asRecord(payload.request) as Partial<MusicuRequest>
    if (!request.module || !request.method) {
      return {
        success: false,
        error: `Unsupported QQ Music API endpoint: ${endpoint}`,
        code: 404,
      }
    }

    const result = await this.callMusicu({
      req_0: {
        module: request.module,
        method: request.method,
        param: asRecord(request.param),
      },
      comm: asRecord(payload.comm),
    }, credentials)
    return { success: true, data: result, code: 100 }
  }

  private get userAgent(): string {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  }
}
