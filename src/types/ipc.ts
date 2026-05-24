/**
 * IPC 通道类型定义
 * 定义主进程与渲染进程之间的通信协议
 */

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

/** IPC 通道名称常量 */
export const IPC_CHANNELS = {
  /** 存储相关通道 */
  STORAGE_SAVE: 'storage:save',
  STORAGE_LOAD: 'storage:load',
  STORAGE_REMOVE: 'storage:remove',

  /** 窗口管理通道 */
  WINDOW_MINIMIZE_TO_TRAY: 'window:minimize-to-tray',
  WINDOW_RESTORE: 'window:restore',

  /** 网络状态通道 */
  NETWORK_STATUS_CHANGED: 'network:status-changed',

  /** QQ 音乐登录相关通道 */
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
} as const;

/** IPC 通道名称类型 */
export type IPCChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** IPC 通道处理器映射 */
export interface IPCChannelHandlers {
  /** 保存数据到本地存储 */
  [IPC_CHANNELS.STORAGE_SAVE]: (key: string, data: unknown) => Promise<void>;
  /** 从本地存储加载数据 */
  [IPC_CHANNELS.STORAGE_LOAD]: (key: string) => Promise<unknown>;
  /** 从本地存储删除数据 */
  [IPC_CHANNELS.STORAGE_REMOVE]: (key: string) => Promise<void>;
  /** 最小化到系统托盘 */
  [IPC_CHANNELS.WINDOW_MINIMIZE_TO_TRAY]: () => void;
  /** 从托盘恢复窗口 */
  [IPC_CHANNELS.WINDOW_RESTORE]: () => void;
  /** 网络状态变更通知 */
  [IPC_CHANNELS.NETWORK_STATUS_CHANGED]: (online: boolean) => void;

  /** QQ 音乐：发起 QR 码登录 */
  [IPC_CHANNELS.QQMUSIC_START_LOGIN]: (method?: QQMusicLoginMethod) => Promise<QRCodeResult>;
  /** QQ 音乐：轮询 QR 码扫码状态 */
  [IPC_CHANNELS.QQMUSIC_POLL_QR_STATUS]: (qrsig: string) => Promise<QRPollResult>;
  /** QQ 音乐：取消登录流程 */
  [IPC_CHANNELS.QQMUSIC_CANCEL_LOGIN]: () => Promise<void>;
  /** QQ 音乐：获取当前登录状态 */
  [IPC_CHANNELS.QQMUSIC_GET_STATUS]: () => Promise<LoginStatusInfo>;
  /** QQ 音乐：登出 */
  [IPC_CHANNELS.QQMUSIC_LOGOUT]: () => Promise<void>;
  /** QQ 音乐：调用 API */
  [IPC_CHANNELS.QQMUSIC_CALL_API]: (endpoint: string, data: unknown) => Promise<ApiResponse>;
  /** QQ 音乐：刷新会话 */
  [IPC_CHANNELS.QQMUSIC_REFRESH_SESSION]: () => Promise<RefreshResult>;
  /** QQ 音乐：登录状态变更事件（主进程 -> 渲染进程） */
  [IPC_CHANNELS.QQMUSIC_STATUS_CHANGED]: (status: LoginStatusInfo) => void;
  [IPC_CHANNELS.NETEASE_START_LOGIN]: () => Promise<NeteaseQRCodeResult>;
  [IPC_CHANNELS.NETEASE_POLL_QR_STATUS]: (key: string) => Promise<NeteaseQRPollResult>;
  [IPC_CHANNELS.NETEASE_GET_STATUS]: () => Promise<NeteaseLoginStatusInfo>;
  [IPC_CHANNELS.NETEASE_LOGOUT]: () => Promise<void>;
  [IPC_CHANNELS.NETEASE_PLAYLIST_DETAIL]: (playlistId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  [IPC_CHANNELS.NETEASE_STATUS_CHANGED]: (status: NeteaseLoginStatusInfo) => void;
}

/** 渲染进程可调用的 IPC API 接口 */
export interface ElectronAPI {
  /** 保存数据 */
  saveData: (key: string, data: unknown) => Promise<void>;
  /** 加载数据 */
  loadData: (key: string) => Promise<unknown>;
  /** 删除数据 */
  removeData: (key: string) => Promise<void>;
  /** 最小化到托盘 */
  minimizeToTray: () => void;
  /** 恢复窗口 */
  restoreWindow: () => void;
  /** 监听网络状态变化 */
  onNetworkStatusChanged: (callback: (online: boolean) => void) => (() => void) | void;

  /** QQ 音乐登录相关 API */
  qqMusic: {
    startLogin: (method?: QQMusicLoginMethod) => Promise<QRCodeResult>;
    pollQRStatus: (qrsig: string) => Promise<QRPollResult>;
    cancelLogin: () => Promise<void>;
    getStatus: () => Promise<LoginStatusInfo>;
    logout: () => Promise<void>;
    callApi: (endpoint: string, data: unknown) => Promise<ApiResponse>;
    refreshSession: () => Promise<RefreshResult>;
    onStatusChanged: (callback: (status: LoginStatusInfo) => void) => (() => void) | void;
  };

  /** 网易云音乐 API */
  netease: {
    search: (keyword: string, page: number, pageSize: number) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    getTrackUrl: (trackId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    getLyrics: (trackId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    getSuggestions: (keyword: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    startLogin: () => Promise<NeteaseQRCodeResult>;
    pollQRStatus: (key: string) => Promise<NeteaseQRPollResult>;
    getStatus: () => Promise<NeteaseLoginStatusInfo>;
    logout: () => Promise<void>;
    getPlaylistDetail: (playlistId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    onStatusChanged: (callback: (status: NeteaseLoginStatusInfo) => void) => (() => void) | void;
  };
}

/** 扩展 Window 接口以包含 Electron API */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
