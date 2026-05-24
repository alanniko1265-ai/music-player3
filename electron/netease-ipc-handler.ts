/**
 * NetEase Cloud Music IPC handler
 * Registers IPC handlers that call NeteaseCloudMusicApi directly in the main process
 * No external server needed
 */

import { BrowserWindow, ipcMain, net } from 'electron'
import QRCode from 'qrcode'
import { IPC_CHANNELS } from '../src/types/ipc'
import { LoginStatus, type LoginStatusInfo, type UserInfo } from '../src/types/qq-music-login'
import { neteaseCredentialStore } from './netease-credential-store'

// Dynamically import ESM module
let neteaseApi: any = null
let statusInfo: LoginStatusInfo = { status: LoginStatus.LoggedOut }
let currentQRKey: string | null = null
let qrStartedAt = 0

const NETEASE_QR_EXPIRES_MS = 5 * 60 * 1000

async function getApi() {
  if (!neteaseApi) {
    try {
      const module = await import('NeteaseCloudMusicApi')
      neteaseApi = module.default || module
      console.log('[Netease] API module loaded successfully')
    } catch (e) {
      console.error('[Netease] Failed to import NeteaseCloudMusicApi:', e)
      throw new Error('无法加载网易云音乐 API 模块，请确认依赖已正确安装')
    }
  }
  return neteaseApi
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
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
  return 'image/png'
}

function imageBufferToDataUri(buffer: Buffer): string {
  return `data:${detectImageMime(buffer)};base64,${buffer.toString('base64')}`
}

async function createQrDataUri(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    type: 'image/png',
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
  })
}

function normalizeQrImage(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (trimmed.startsWith('data:')) {
    return trimmed
  }

  return trimmed.replace(/^base64,/, '')
}

function normalizeSetCookie(rawCookie: unknown): string {
  const values = Array.isArray(rawCookie) ? rawCookie.map(String) : [String(rawCookie || '')]
  const cookies = new Map<string, string>()

  for (const item of values) {
    for (const part of item.split(/,(?=\s*[\w.-]+=)/)) {
      const pair = part.trim().split(';')[0]?.trim()
      const eqIndex = pair.indexOf('=')
      if (eqIndex <= 0) {
        continue
      }

      const name = pair.slice(0, eqIndex).trim()
      const value = pair.slice(eqIndex + 1).trim()
      if (name && value && !['Path', 'Domain', 'Expires', 'Max-Age', 'HttpOnly', 'Secure', 'SameSite'].includes(name)) {
        cookies.set(name, value)
      }
    }
  }

  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

function extractNeteaseCookie(result: unknown): string {
  const record = asRecord(result)
  const body = asRecord(record.body)
  const bodyCookie = body.cookie
  const normalizedBodyCookie = normalizeSetCookie(bodyCookie)
  if (normalizedBodyCookie) {
    return normalizedBodyCookie
  }

  const rawCookie = record.cookie
  const normalizedCookie = normalizeSetCookie(rawCookie)
  if (normalizedCookie) {
    return normalizedCookie
  }
  return ''
}

function updateStatus(info: LoginStatusInfo): void {
  const previousStatus = statusInfo.status
  const previousUser = statusInfo.userInfo?.uin
  statusInfo = info

  if (previousStatus === info.status && previousUser === info.userInfo?.uin) {
    return
  }

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.NETEASE_STATUS_CHANGED, statusInfo)
    }
  }
}

async function getStoredCookie(): Promise<string> {
  return neteaseCredentialStore.loadCookie()
}

async function loadUserInfo(api: any, cookie: string): Promise<UserInfo | undefined> {
  const result = await api.login_status({ cookie, timestamp: Date.now() })
  const body = asRecord(result.body)
  const code = Number(body.code || 0)
  if (code && code !== 200) {
    return undefined
  }

  const data = asRecord(body.data)
  const profile = asRecord(data.profile || body.profile)
  const account = asRecord(data.account || body.account)
  const userId = String(profile.userId || account.id || '')

  if (!userId) {
    return undefined
  }

  return {
    uin: userId,
    nickname: String(profile.nickname || '网易云音乐'),
    avatarUrl: String(profile.avatarUrl || ''),
  }
}

async function validateNeteaseSession(): Promise<LoginStatusInfo> {
  const cookie = await getStoredCookie()
  if (!cookie) {
    updateStatus({ status: LoginStatus.LoggedOut })
    return statusInfo
  }

  try {
    const api = await getApi()
    const userInfo = await loadUserInfo(api, cookie)
    if (userInfo) {
      await neteaseCredentialStore.saveCredentials(cookie, userInfo)
      updateStatus({ status: LoginStatus.LoggedIn, userInfo })
      return statusInfo
    }
  } catch (error) {
    console.warn('[Netease] login status check failed:', error instanceof Error ? error.message : error)
  }

  updateStatus({ status: LoginStatus.Expired })
  return statusInfo
}

async function withCookie(params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const cookie = await getStoredCookie()
  return cookie ? { ...params, cookie } : params
}

export interface NeteaseApiResponse {
  success: boolean
  data?: unknown
  error?: string
}

export function registerNeteaseIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.NETEASE_START_LOGIN, async () => {
    let lastError = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const api = await getApi()
        const keyResult = await api.login_qr_key({ timestamp: Date.now() })
        const keyBody = asRecord(keyResult.body)
        const keyData = asRecord(keyBody.data)
        const key = String(keyData.unikey || keyBody.unikey || '')
        if (!key) {
          console.error('[Netease] login_qr_key response:', JSON.stringify(keyResult.body).slice(0, 500))
          lastError = '网易云没有返回二维码登录 key'
          if (attempt < 1) { await new Promise(r => setTimeout(r, 1000)); continue }
          return { success: false, error: lastError }
        }

        const qrResult = await api.login_qr_create({ key, qrimg: true, timestamp: Date.now() })
        const qrBody = asRecord(qrResult.body)
        const qrData = asRecord(qrBody.data)

        // 多层级兼容查找 qrimg；部分版本只返回 qrurl，需要本地生成二维码图片。
        let qrImageBase64 = normalizeQrImage(String(qrData.qrimg || qrBody.qrimg || ''))
        const qrUrl = String(qrData.qrurl || qrBody.qrurl || '')

        if (!qrImageBase64 && qrUrl) {
          qrImageBase64 = await createQrDataUri(qrUrl)
        }

        // 如果返回的是完整 data URI，保留原样（渲染端已做兼容）
        // 如果返回的是 HTTP URL，下载并转为 base64
        if (qrImageBase64.startsWith('http')) {
          try {
            console.log('[Netease] QR image is a URL, downloading:', qrImageBase64.slice(0, 100))
            const response = await net.fetch(qrImageBase64)
            const buffer = Buffer.from(await response.arrayBuffer())
            qrImageBase64 = imageBufferToDataUri(buffer)
          } catch (downloadErr) {
            console.error('[Netease] Failed to download QR image:', downloadErr)
            lastError = '二维码图片下载失败，请检查网络连接'
            if (attempt < 1) { await new Promise(r => setTimeout(r, 1000)); continue }
            return { success: false, error: lastError }
          }
        }

        if (!qrImageBase64) {
          console.error('[Netease] QR create response (no qrimg found):', JSON.stringify(qrResult.body).slice(0, 500))
          lastError = '网易云没有返回二维码图片，请检查 NeteaseCloudMusicApi 版本'
          if (attempt < 1) { await new Promise(r => setTimeout(r, 1000)); continue }
          return { success: false, error: lastError }
        }

        currentQRKey = key
        qrStartedAt = Date.now()
        updateStatus({ status: LoginStatus.Scanning })

        return { success: true, key, qrImageBase64 }
      } catch (e) {
        lastError = (e as Error).message || 'Start NetEase login failed'
        console.warn(`[Netease] login attempt ${attempt + 1} failed:`, lastError)
        if (attempt < 1) await new Promise(r => setTimeout(r, 1000))
      }
    }
    return { success: false, error: lastError }
  })

  ipcMain.handle(IPC_CHANNELS.NETEASE_POLL_QR_STATUS, async (_event, key: string) => {
    if (!key || key !== currentQRKey) {
      return { status: 'error', error: 'Invalid NetEase QR login session' }
    }

    if (Date.now() - qrStartedAt > NETEASE_QR_EXPIRES_MS) {
      updateStatus({ status: LoginStatus.Expired })
      return { status: 'expired' }
    }

    try {
      const api = await getApi()
      const result = await api.login_qr_check({ key, timestamp: Date.now() })
      const body = asRecord(result.body)
      const code = Number(body.code || 0)

      switch (code) {
        case 801:
          updateStatus({ status: LoginStatus.Scanning })
          return { status: 'waiting' }
        case 802:
          updateStatus({ status: LoginStatus.Confirming })
          return { status: 'scanned' }
        case 803: {
          const cookie = extractNeteaseCookie(result)
          if (!cookie) {
            updateStatus({ status: LoginStatus.Expired })
            return { status: 'error', error: '网易云登录成功但没有返回 Cookie' }
          }

          const userInfo = await loadUserInfo(api, cookie)
          await neteaseCredentialStore.saveCredentials(cookie, userInfo)
          currentQRKey = null
          qrStartedAt = 0
          updateStatus({ status: LoginStatus.LoggedIn, userInfo })
          return { status: 'confirmed' }
        }
        case 800:
          updateStatus({ status: LoginStatus.Expired })
          return { status: 'expired' }
        default:
          return { status: 'error', error: String(body.message || `Unknown NetEase QR status: ${code}`) }
      }
    } catch (e) {
      return { status: 'error', error: (e as Error).message || 'Poll NetEase QR status failed' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.NETEASE_GET_STATUS, async () => validateNeteaseSession())

  ipcMain.handle(IPC_CHANNELS.NETEASE_LOGOUT, async () => {
    const api = await getApi()
    const cookie = await getStoredCookie()
    if (cookie) {
      await api.logout({ cookie }).catch(() => null)
    }
    await neteaseCredentialStore.clearCredentials()
    currentQRKey = null
    qrStartedAt = 0
    updateStatus({ status: LoginStatus.LoggedOut })
  })

  // Search
  ipcMain.handle('netease:search', async (_event, keyword: string, page: number, pageSize: number) => {
    try {
      const api = await getApi()
      const result = await api.cloudsearch(await withCookie({
        keywords: keyword,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        type: 1,
      }))
      return { success: true, data: result.body }
    } catch (e) {
      return { success: false, error: (e as Error).message || 'Search failed' }
    }
  })

  // Track URL
  ipcMain.handle('netease:track-url', async (_event, trackId: string, level?: string) => {
    try {
      const api = await getApi()
      const result = await api.song_url_v1(await withCookie({ id: trackId, level: level || 'standard' }))
      return { success: true, data: result.body }
    } catch (e) {
      return { success: false, error: (e as Error).message || 'Get track URL failed' }
    }
  })

  // Lyrics
  ipcMain.handle('netease:lyrics', async (_event, trackId: string) => {
    try {
      const api = await getApi()
      const result = await api.lyric(await withCookie({ id: trackId }))
      return { success: true, data: result.body }
    } catch (e) {
      return { success: false, error: (e as Error).message || 'Get lyrics failed' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.NETEASE_PLAYLIST_DETAIL, async (_event, playlistId: string) => {
    try {
      if (!playlistId) {
        return { success: false, error: 'playlist id is required' }
      }

      const api = await getApi()
      const params = await withCookie({ id: playlistId, limit: 1000, offset: 0 })
      const [detailResult, tracksResult] = await Promise.all([
        api.playlist_detail(params),
        api.playlist_track_all(params),
      ])

      return {
        success: true,
        data: {
          detail: detailResult.body,
          tracks: tracksResult.body,
        },
      }
    } catch (e) {
      return { success: false, error: (e as Error).message || 'Get NetEase playlist failed' }
    }
  })

  // Search suggestions
  ipcMain.handle('netease:suggestions', async (_event, keyword: string) => {
    try {
      const api = await getApi()
      const result = await api.search_suggest(await withCookie({ keywords: keyword, type: 'mobile' }))
      return { success: true, data: result.body }
    } catch (e) {
      return { success: false, error: (e as Error).message || 'Get suggestions failed' }
    }
  })
}
