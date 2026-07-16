import type {
  QRCodeResult,
  QRPollResult,
  LoginStatusInfo,
  ApiResponse,
  RefreshResult,
  QQMusicLoginMethod,
} from './qq-music-login'
import type {
  NeteaseLoginStatusInfo,
  NeteaseQRCodeResult,
  NeteaseQRPollResult,
} from './netease-login'

export const IPC_CHANNELS = {
  STORAGE_SAVE: 'storage:save',
  STORAGE_LOAD: 'storage:load',
  STORAGE_REMOVE: 'storage:remove',

  WINDOW_MINIMIZE_TO_TRAY: 'window:minimize-to-tray',
  WINDOW_RESTORE: 'window:restore',

  NETWORK_STATUS_CHANGED: 'network:status-changed',

  QQMUSIC_START_LOGIN: 'qqmusic:start-login',
  QQMUSIC_POLL_QR_STATUS: 'qqmusic:poll-qr-status',
  QQMUSIC_CANCEL_LOGIN: 'qqmusic:cancel-login',
  QQMUSIC_GET_STATUS: 'qqmusic:get-status',
  QQMUSIC_LOGOUT: 'qqmusic:logout',
  QQMUSIC_CALL_API: 'qqmusic:call-api',
  QQMUSIC_REFRESH_SESSION: 'qqmusic:refresh-session',
  QQMUSIC_STATUS_CHANGED: 'qqmusic:status-changed',

  NETEASE_START_LOGIN: 'netease:start-login',
  NETEASE_POLL_QR_STATUS: 'netease:poll-qr-status',
  NETEASE_GET_STATUS: 'netease:get-status',
  NETEASE_LOGOUT: 'netease:logout',
  NETEASE_PLAYLIST_DETAIL: 'netease:playlist-detail',
  NETEASE_STATUS_CHANGED: 'netease:status-changed',
} as const

export type IPCChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface IPCChannelHandlers {
  [IPC_CHANNELS.STORAGE_SAVE]: (key: string, data: unknown) => Promise<void>
  [IPC_CHANNELS.STORAGE_LOAD]: (key: string) => Promise<unknown>
  [IPC_CHANNELS.STORAGE_REMOVE]: (key: string) => Promise<void>
  [IPC_CHANNELS.WINDOW_MINIMIZE_TO_TRAY]: () => void
  [IPC_CHANNELS.WINDOW_RESTORE]: () => void
  [IPC_CHANNELS.NETWORK_STATUS_CHANGED]: (online: boolean) => void

  [IPC_CHANNELS.QQMUSIC_START_LOGIN]: (method?: QQMusicLoginMethod) => Promise<QRCodeResult>
  [IPC_CHANNELS.QQMUSIC_POLL_QR_STATUS]: (qrsig: string) => Promise<QRPollResult>
  [IPC_CHANNELS.QQMUSIC_CANCEL_LOGIN]: () => Promise<void>
  [IPC_CHANNELS.QQMUSIC_GET_STATUS]: () => Promise<LoginStatusInfo>
  [IPC_CHANNELS.QQMUSIC_LOGOUT]: () => Promise<void>
  [IPC_CHANNELS.QQMUSIC_CALL_API]: (endpoint: string, data: unknown) => Promise<ApiResponse>
  [IPC_CHANNELS.QQMUSIC_REFRESH_SESSION]: () => Promise<RefreshResult>
  [IPC_CHANNELS.QQMUSIC_STATUS_CHANGED]: (status: LoginStatusInfo) => void

  [IPC_CHANNELS.NETEASE_START_LOGIN]: () => Promise<NeteaseQRCodeResult>
  [IPC_CHANNELS.NETEASE_POLL_QR_STATUS]: (key: string) => Promise<NeteaseQRPollResult>
  [IPC_CHANNELS.NETEASE_GET_STATUS]: () => Promise<NeteaseLoginStatusInfo>
  [IPC_CHANNELS.NETEASE_LOGOUT]: () => Promise<void>
  [IPC_CHANNELS.NETEASE_PLAYLIST_DETAIL]: (playlistId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
  [IPC_CHANNELS.NETEASE_STATUS_CHANGED]: (status: NeteaseLoginStatusInfo) => void
}

export interface ElectronAPI {
  saveData: (key: string, data: unknown) => Promise<void>
  loadData: (key: string) => Promise<unknown>
  removeData: (key: string) => Promise<void>

  minimizeToTray: () => void
  restoreWindow: () => void
  minimizeWindow: () => void
  toggleMaximizeWindow: () => void
  closeWindow: () => void

  onNetworkStatusChanged: (callback: (online: boolean) => void) => (() => void) | void

  qqMusic: {
    startLogin: (method?: QQMusicLoginMethod) => Promise<QRCodeResult>
    pollQRStatus: (qrsig: string) => Promise<QRPollResult>
    cancelLogin: () => Promise<void>
    getStatus: () => Promise<LoginStatusInfo>
    logout: () => Promise<void>
    callApi: (endpoint: string, data: unknown) => Promise<ApiResponse>
    refreshSession: () => Promise<RefreshResult>
    onStatusChanged: (callback: (status: LoginStatusInfo) => void) => (() => void) | void
  }

  netease: {
    search: (keyword: string, page: number, pageSize: number) => Promise<{ success: boolean; data?: unknown; error?: string }>
    getTrackUrl: (trackId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
    getLyrics: (trackId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
    getSuggestions: (keyword: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
    startLogin: () => Promise<NeteaseQRCodeResult>
    pollQRStatus: (key: string) => Promise<NeteaseQRPollResult>
    getStatus: () => Promise<NeteaseLoginStatusInfo>
    logout: () => Promise<void>
    getPlaylistDetail: (playlistId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
    onStatusChanged: (callback: (status: NeteaseLoginStatusInfo) => void) => (() => void) | void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
