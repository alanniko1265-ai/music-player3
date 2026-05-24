<template>
  <div id="app">
    <!-- Network status banner -->
    <NetworkBanner />

    <!-- Global blur background -->
    <BlurBackground :cover-url="playerStore.currentTrack?.coverUrl" />

    <!-- Sidebar navigation -->
    <nav class="sidebar" aria-label="主导航">
      <div class="sidebar__logo">
        <svg class="sidebar__logo-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
        <span class="sidebar__title">Music</span>
      </div>

      <ul class="sidebar__menu">
        <li>
          <router-link
            to="/"
            class="sidebar__link"
            :class="{ 'sidebar__link--active': isActive('search') }"
            aria-label="搜索"
          >
            <svg class="sidebar__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <span class="sidebar__label">搜索</span>
          </router-link>
        </li>
        <li>
          <router-link
            to="/playlists"
            class="sidebar__link"
            :class="{ 'sidebar__link--active': isActive('playlists') || isActive('playlist-detail') }"
            aria-label="歌单"
          >
            <svg class="sidebar__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
            </svg>
            <span class="sidebar__label">歌单</span>
          </router-link>
        </li>
        <li>
          <router-link
            to="/favorites"
            class="sidebar__link"
            :class="{ 'sidebar__link--active': isActive('favorites') }"
            aria-label="收藏"
          >
            <svg class="sidebar__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span class="sidebar__label">收藏</span>
          </router-link>
        </li>
        <li>
          <router-link
            to="/player"
            class="sidebar__link"
            :class="{ 'sidebar__link--active': isActive('player') }"
            aria-label="播放中"
          >
            <svg class="sidebar__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
            <span class="sidebar__label">播放中</span>
          </router-link>
        </li>
      </ul>

      <div class="sidebar__bottom">
        <MusicSourceSelector @change="setMusicSource" />
        <QQMusicUserStatus />
        <NeteaseUserStatus />
      </div>
    </nav>

    <!-- Main content area -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade-slide" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- Bottom player bar -->
    <PlayerBar />

    <transition name="fade-slide">
      <div v-if="sessionToastVisible" class="session-toast">
        QQ 音乐登录已过期
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePlayerStore } from '@/stores/player-store'
import { useQQMusicLoginStore } from '@/stores/qq-music-login-store'
import { useAppInit } from '@/composables/useAppInit'
import { LoginStatus } from '@/types/qq-music-login'
import BlurBackground from '@/components/BlurBackground.vue'
import PlayerBar from '@/components/PlayerBar.vue'
import NetworkBanner from '@/components/NetworkBanner.vue'
import QQMusicUserStatus from '@/components/QQMusicUserStatus.vue'
import NeteaseUserStatus from '@/components/NeteaseUserStatus.vue'
import MusicSourceSelector from '@/components/MusicSourceSelector.vue'

const route = useRoute()
const playerStore = usePlayerStore()
const qqMusicLoginStore = useQQMusicLoginStore()
const { initialize, setMusicSource } = useAppInit()
const sessionToastVisible = ref(false)
let sessionToastTimer: ReturnType<typeof setTimeout> | null = null

// 应用启动时初始化所有 store 并恢复状态
onMounted(() => {
  initialize()
})

watch(
  () => qqMusicLoginStore.status,
  (status) => {
    if (status !== LoginStatus.Expired) {
      return
    }
    sessionToastVisible.value = true
    if (sessionToastTimer) {
      clearTimeout(sessionToastTimer)
    }
    sessionToastTimer = setTimeout(() => {
      sessionToastVisible.value = false
      sessionToastTimer = null
    }, 3200)
  },
)

function isActive(routeName: string): boolean {
  return route.name === routeName
}
</script>

<style lang="scss">
#app {
  width: 100%;
  height: 100vh;
  background-color: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-family);
  overflow: hidden;
  display: flex;
  position: relative;
}

// ===== Sidebar =====
.sidebar {
  width: 200px;
  height: 100vh;
  padding: var(--spacing-lg) 0;
  display: flex;
  flex-direction: column;
  background: rgba(13, 13, 13, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-right: 1px solid var(--color-border);
  z-index: 1;
  flex-shrink: 0;
  padding-bottom: 72px;

  &__logo {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 0 var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
  }

  &__logo-icon {
    width: 28px;
    height: 28px;
    color: var(--color-primary);
  }

  &__title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
  }

  &__menu {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  &__bottom {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  &__link {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    color: var(--color-text-secondary);
    text-decoration: none;
    border-radius: 0;
    transition: color var(--transition-fast), background-color var(--transition-fast);
    position: relative;

    &:hover {
      color: var(--color-text);
      background: var(--color-surface-hover);
    }

    &--active {
      color: var(--color-text);
      background: var(--color-surface);

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 60%;
        background: var(--color-primary);
        border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      }
    }
  }

  &__icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  &__label {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
  }
}

// ===== Main Content =====
.main-content {
  flex: 1;
  height: 100vh;
  overflow-y: auto;
  padding-bottom: 72px;
  position: relative;
  z-index: 1;
  scroll-behavior: smooth;
}

.session-toast {
  position: fixed;
  right: 24px;
  bottom: 96px;
  z-index: 20;
  max-width: min(320px, calc(100vw - 48px));
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.34);
  font-size: 14px;
}

// ===== Route Transition =====
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity var(--transition-base), transform var(--transition-base);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
