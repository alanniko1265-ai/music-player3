import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../src/types/ipc'
import { QQMusicLoginService } from './qq-music-login-service'

let service: QQMusicLoginService | null = null

export function getQQMusicLoginService(): QQMusicLoginService {
  if (!service) {
    service = new QQMusicLoginService(() => BrowserWindow.getAllWindows())
  }
  return service
}

export function registerQQMusicIpcHandlers(): QQMusicLoginService {
  const loginService = getQQMusicLoginService()

  ipcMain.handle(IPC_CHANNELS.QQMUSIC_START_LOGIN, (_event, method?: string) => {
    return loginService.startQRLogin(method as 'qq' | 'wechat' | undefined)
  })

  ipcMain.handle(IPC_CHANNELS.QQMUSIC_POLL_QR_STATUS, (_event, qrsig: string) => {
    return loginService.pollQRStatus(qrsig)
  })

  ipcMain.handle(IPC_CHANNELS.QQMUSIC_CANCEL_LOGIN, () => {
    return loginService.cancelQRLogin()
  })

  ipcMain.handle(IPC_CHANNELS.QQMUSIC_GET_STATUS, () => {
    return loginService.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.QQMUSIC_LOGOUT, () => {
    return loginService.logout()
  })

  ipcMain.handle(IPC_CHANNELS.QQMUSIC_CALL_API, (_event, endpoint: string, data: unknown) => {
    return loginService.callApi(endpoint, data)
  })

  ipcMain.handle(IPC_CHANNELS.QQMUSIC_REFRESH_SESSION, () => {
    return loginService.refreshSession()
  })

  return loginService
}
