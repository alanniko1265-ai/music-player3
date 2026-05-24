import { LoginStatus, type UserInfo } from './qq-music-login'

export interface NeteaseLoginStatusInfo {
  status: LoginStatus
  userInfo?: UserInfo
}

export interface NeteaseQRCodeResult {
  success: boolean
  key?: string
  qrImageBase64?: string
  error?: string
}

export interface NeteaseQRPollResult {
  status: 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'error'
  error?: string
}
