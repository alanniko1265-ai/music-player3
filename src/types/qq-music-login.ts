/**
 * QQ 音乐登录相关的 TypeScript 类型定义
 */

/** QQ 音乐认证 Cookie */
export interface AuthCookie {
  qqmusic_key: string
  qm_keyst: string
  uin: string
  login_type: number // 1=QQ登录, 2=微信登录
  wxuin?: string // 微信登录时的 uin
  [key: string]: string | number | undefined // 其他可能的 cookie 字段
}

/** QQ 音乐扫码登录方式 */
export type QQMusicLoginMethod = 'qq' | 'wechat'

/** 登录状态枚举 */
export enum LoginStatus {
  LoggedOut = 'logged_out',
  Scanning = 'scanning', // QR 码已展示，等待扫码
  Confirming = 'confirming', // 已扫码，等待确认
  LoggedIn = 'logged_in',
  Expired = 'expired',
}

/** 用户信息 */
export interface UserInfo {
  uin: string
  nickname: string
  avatarUrl: string
}

/** 登录状态详情 */
export interface LoginStatusInfo {
  status: LoginStatus
  userInfo?: UserInfo
}

/** QR 码结果 */
export interface QRCodeResult {
  success: boolean
  qrImageBase64?: string // base64 编码的 QR 码图片
  qrsig?: string // 用于轮询的签名标识
  method?: QQMusicLoginMethod
  error?: string
}

/** QR 码轮询结果 */
export interface QRPollResult {
  status: 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'error'
  cookies?: AuthCookie // 确认授权后返回的 cookie
  error?: string
}

/** 会话刷新结果 */
export interface RefreshResult {
  success: boolean
  newMusicKey?: string
  error?: string
}

/** API 调用响应 */
export interface ApiResponse {
  success: boolean
  data?: unknown
  error?: string
  code?: number
}

/** 凭据存储 Schema */
export interface CredentialSchema {
  authCookie: AuthCookie | null
  lastRefreshTime: number // 上次刷新时间戳
  expiryTime: number // 预估过期时间戳
}
