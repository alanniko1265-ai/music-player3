import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '../src/types/ipc'

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Storage
  saveData: (key: string, data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.STORAGE_SAVE, key, data),
  loadData: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.STORAGE_LOAD, key),
  removeData: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.STORAGE_REMOVE, key),

  // Window management
  minimizeToTray: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE_TO_TRAY),
  restoreWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_RESTORE),

  // Network status listener
  onNetworkStatusChanged: (callback: (online: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, online: boolean) => {
      callback(online)
    }
    ipcRenderer.on(IPC_CHANNELS.NETWORK_STATUS_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.NETWORK_STATUS_CHANGED, listener)
  },

  // QQ Music login and direct API bridge
  qqMusic: {
    startLogin: (method?: string) => ipcRenderer.invoke(IPC_CHANNELS.QQMUSIC_START_LOGIN, method),
    pollQRStatus: (qrsig: string) => ipcRenderer.invoke(IPC_CHANNELS.QQMUSIC_POLL_QR_STATUS, qrsig),
    cancelLogin: () => ipcRenderer.invoke(IPC_CHANNELS.QQMUSIC_CANCEL_LOGIN),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.QQMUSIC_GET_STATUS),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.QQMUSIC_LOGOUT),
    callApi: (endpoint: string, data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.QQMUSIC_CALL_API, endpoint, data),
    refreshSession: () => ipcRenderer.invoke(IPC_CHANNELS.QQMUSIC_REFRESH_SESSION),
    onStatusChanged: (callback: (status: unknown) => void) => {
      const listener = (_event: IpcRendererEvent, status: unknown) => {
        callback(status)
      }
      ipcRenderer.on(IPC_CHANNELS.QQMUSIC_STATUS_CHANGED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.QQMUSIC_STATUS_CHANGED, listener)
    },
  },

  // Netease Cloud Music direct API bridge (calls NeteaseCloudMusicApi in main process)
  netease: {
    search: (keyword: string, page: number, pageSize: number) =>
      ipcRenderer.invoke('netease:search', keyword, page, pageSize),
    getTrackUrl: (trackId: string, level?: string) =>
      ipcRenderer.invoke('netease:track-url', trackId, level),
    getLyrics: (trackId: string) =>
      ipcRenderer.invoke('netease:lyrics', trackId),
    getSuggestions: (keyword: string) =>
      ipcRenderer.invoke('netease:suggestions', keyword),
    startLogin: () => ipcRenderer.invoke(IPC_CHANNELS.NETEASE_START_LOGIN),
    pollQRStatus: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.NETEASE_POLL_QR_STATUS, key),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.NETEASE_GET_STATUS),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.NETEASE_LOGOUT),
    getPlaylistDetail: (playlistId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.NETEASE_PLAYLIST_DETAIL, playlistId),
    onStatusChanged: (callback: (status: unknown) => void) => {
      const listener = (_event: IpcRendererEvent, status: unknown) => {
        callback(status)
      }
      ipcRenderer.on(IPC_CHANNELS.NETEASE_STATUS_CHANGED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.NETEASE_STATUS_CHANGED, listener)
    },
  },
})
