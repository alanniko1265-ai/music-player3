/**
 * CredentialStore 单元测试
 * 验证凭据存储模块的核心功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CredentialStore } from './qq-music-credential-store'
import type { AuthCookie } from '../src/types/qq-music-login'

// Mock electron-store
const mockStore = new Map<string, any>()

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      constructor(_opts?: any) {
        // Initialize with defaults if provided
        if (_opts?.defaults) {
          for (const [key, value] of Object.entries(_opts.defaults)) {
            if (!mockStore.has(key)) {
              mockStore.set(key, value)
            }
          }
        }
      }
      get(key: string) {
        return mockStore.get(key)
      }
      set(key: string, value: any) {
        mockStore.set(key, value)
      }
    },
  }
})

describe('CredentialStore', () => {
  let store: CredentialStore

  const validCookie: AuthCookie = {
    qqmusic_key: 'test-key-123',
    qm_keyst: 'test-keyst-456',
    uin: '123456789',
    login_type: 1,
  }

  beforeEach(() => {
    mockStore.clear()
    store = new CredentialStore()
  })

  describe('saveCredentials', () => {
    it('should save credentials and update timestamps', async () => {
      await store.saveCredentials(validCookie)

      expect(mockStore.get('authCookie')).toEqual(validCookie)
      expect(mockStore.get('lastRefreshTime')).toBeGreaterThan(0)
      expect(mockStore.get('expiryTime')).toBeGreaterThan(Date.now())
    })
  })

  describe('loadCredentials', () => {
    it('should return null when no credentials stored', async () => {
      const result = await store.loadCredentials()
      expect(result).toBeNull()
    })

    it('should return stored credentials', async () => {
      await store.saveCredentials(validCookie)
      const result = await store.loadCredentials()
      expect(result).toEqual(validCookie)
    })
  })

  describe('clearCredentials', () => {
    it('should clear all stored credentials', async () => {
      await store.saveCredentials(validCookie)
      await store.clearCredentials()

      const result = await store.loadCredentials()
      expect(result).toBeNull()
      expect(mockStore.get('lastRefreshTime')).toBe(0)
      expect(mockStore.get('expiryTime')).toBe(0)
    })
  })

  describe('isCredentialComplete', () => {
    it('should return true for valid complete credentials', () => {
      expect(store.isCredentialComplete(validCookie)).toBe(true)
    })

    it('should return false when qqmusic_key is empty', () => {
      const cookie: AuthCookie = { ...validCookie, qqmusic_key: '' }
      expect(store.isCredentialComplete(cookie)).toBe(false)
    })

    it('should return false when qm_keyst is empty', () => {
      const cookie: AuthCookie = { ...validCookie, qm_keyst: '' }
      expect(store.isCredentialComplete(cookie)).toBe(false)
    })

    it('should return false when uin is empty', () => {
      const cookie: AuthCookie = { ...validCookie, uin: '' }
      expect(store.isCredentialComplete(cookie)).toBe(false)
    })

    it('should return false when login_type is not a number', () => {
      const cookie = { ...validCookie, login_type: 'invalid' as any }
      expect(store.isCredentialComplete(cookie)).toBe(false)
    })

    it('should return true for WeChat login with wxuin', () => {
      const cookie: AuthCookie = {
        ...validCookie,
        login_type: 2,
        wxuin: 'wx-123',
      }
      expect(store.isCredentialComplete(cookie)).toBe(true)
    })

    it('should return false for whitespace-only fields', () => {
      const cookie: AuthCookie = { ...validCookie, qqmusic_key: '   ' }
      expect(store.isCredentialComplete(cookie)).toBe(false)
    })
  })
})
