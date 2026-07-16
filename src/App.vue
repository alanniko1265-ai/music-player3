<template>
  <div id="app">
    <NetworkBanner />
    <BlurBackground :cover-url="playerStore.currentTrack?.coverUrl" />

    <div class="terminal-shell">
      <header class="terminal-shell__topbar">
        <div class="terminal-shell__window">
          <span class="terminal-shell__dot terminal-shell__dot--red"></span>
          <span class="terminal-shell__dot terminal-shell__dot--yellow"></span>
          <span class="terminal-shell__dot terminal-shell__dot--green"></span>
        </div>

        <div class="terminal-shell__title">
          <span class="terminal-shell__prompt">$</span>
          <span class="terminal-shell__title-text">music --ui=minimal</span>
        </div>

        <div class="terminal-shell__status">
          <span>{{ panelLabel }}</span>
          <span v-if="playerStore.currentTrack">now {{ playerStore.currentTrack.title }}</span>
          <span v-else>idle</span>
        </div>

        <div class="terminal-shell__controls">
          <button class="terminal-shell__control terminal-shell__control--min" type="button" aria-label="最小化" @click="minimizeWindow">_</button>
          <button class="terminal-shell__control terminal-shell__control--max" type="button" aria-label="最大化" @click="toggleMaximizeWindow">[]</button>
          <button class="terminal-shell__control terminal-shell__control--close" type="button" aria-label="关闭" @click="closeWindow">x</button>
        </div>
      </header>

      <div class="terminal-shell__body">
        <nav class="sidebar" aria-label="主导航">
          <div class="sidebar__task">
            <span class="sidebar__task-prompt">$</span>
            <span class="sidebar__task-label">task</span>
            <span class="sidebar__task-value">{{ panelLabel }}</span>
          </div>

          <ul class="sidebar__menu">
            <li>
              <router-link
                to="/"
                class="sidebar__link"
                :class="{ 'sidebar__link--active': isActive('search') }"
                aria-label="搜索"
              >
                <span class="sidebar__index">01</span>
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
                <span class="sidebar__index">02</span>
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
                <span class="sidebar__index">03</span>
                <span class="sidebar__label">收藏</span>
              </router-link>
            </li>
            <li>
              <router-link
                to="/player"
                class="sidebar__link"
                :class="{ 'sidebar__link--active': isActive('player') }"
                aria-label="正在播放"
              >
                <span class="sidebar__index">04</span>
                <span class="sidebar__label">正在播放</span>
              </router-link>
            </li>
          </ul>

          <div class="sidebar__meta">
            <div class="sidebar__meta-block">
              <div class="sidebar__meta-title">source</div>
              <MusicSourceSelector @change="setMusicSource" />
            </div>
            <div class="sidebar__meta-block">
              <div class="sidebar__meta-title">session</div>
              <QQMusicUserStatus />
              <NeteaseUserStatus />
            </div>
          </div>
        </nav>

        <main class="main-content">
          <div class="main-content__frame">
            <div class="main-content__header">
              <span class="main-content__line">$ open {{ panelLabel }}</span>
              <span class="main-content__hint">terminal music player</span>
            </div>

            <router-view v-slot="{ Component }">
              <transition name="fade-slide" mode="out-in">
                <component :is="Component" />
              </transition>
            </router-view>
          </div>
        </main>
      </div>
    </div>

    <PlayerBar />

    <transition name="fade-slide">
      <div v-if="sessionToastVisible" class="session-toast">
        [警告] QQ 音乐登录已过期
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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

const panelLabel = computed(() => {
  switch (route.name) {
    case 'search':
      return '搜索'
    case 'playlists':
      return '歌单'
    case 'playlist-detail':
      return '歌单详情'
    case 'favorites':
      return '收藏'
    case 'player':
      return '正在播放'
    default:
      return '面板'
  }
})

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

function minimizeWindow(): void {
  window.electronAPI?.minimizeWindow?.()
}

function toggleMaximizeWindow(): void {
  window.electronAPI?.toggleMaximizeWindow?.()
}

function closeWindow(): void {
  window.electronAPI?.closeWindow?.()
}
</script>

<style lang="scss">
#app {
  width: 100%;
  height: 100vh;
  background: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-family);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 0;
}

.terminal-shell {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  background: rgba(7, 9, 7, 0.98);
  overflow: hidden;

  &__topbar {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    align-items: center;
    gap: 12px;
    min-height: 40px;
    padding: 0 0 0 16px;
    border-bottom: 1px solid var(--color-border);
    background: rgba(10, 13, 10, 0.98);
    -webkit-app-region: drag;
  }

  &__window {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;

    &--red { background: #ff5f57; }
    &--yellow { background: #febc2e; }
    &--green { background: #28c840; }
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text);
    font-size: var(--font-size-base);
    letter-spacing: 0;
  }

  &__prompt {
    color: var(--color-accent);
    font-size: 18px;
  }

  &__title-text {
    white-space: nowrap;
  }

  &__status {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 18px;
    min-width: 0;
    padding-right: 8px;
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    white-space: nowrap;
    overflow: hidden;

    span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  &__controls {
    display: flex;
    align-items: stretch;
    justify-self: end;
    height: 100%;
    -webkit-app-region: no-drag;
  }

  &__control {
    width: 44px;
    height: 40px;
    display: grid;
    place-items: center;
    border-left: 1px solid var(--color-divider);
    color: var(--color-text-secondary);
    transition: background-color var(--transition-fast), color var(--transition-fast);

    &:hover {
      background: rgba(18, 24, 18, 0.9);
      color: var(--color-text);
    }

    &--close:hover {
      background: rgba(112, 36, 36, 0.9);
      color: #fff;
    }
  }

  &__body {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    min-height: 0;
    flex: 1;
  }
}

.sidebar {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding: 14px 12px;
  border-right: 1px solid var(--color-border);
  background: rgba(11, 15, 12, 0.9);

  &__task {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    padding: 4px 10px 12px;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  &__task-prompt {
    color: var(--color-accent);
  }

  &__task-label {
    color: var(--color-text-disabled);
  }

  &__task-value {
    min-width: 0;
    overflow: hidden;
    color: var(--color-text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__menu {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__link {
    display: grid;
    grid-template-columns: 30px 1fr;
    align-items: center;
    gap: 8px;
    padding: 9px 10px;
    border-left: 2px solid transparent;
    color: var(--color-text-secondary);
    text-decoration: none;
    transition: border-color var(--transition-fast), background-color var(--transition-fast), color var(--transition-fast);

    &:hover {
      color: var(--color-text);
      border-left-color: var(--color-divider);
      background: rgba(18, 24, 18, 0.52);
    }

    &--active {
      color: var(--color-text);
      border-left-color: var(--color-primary);
      background: rgba(18, 24, 18, 0.72);
    }
  }

  &__index {
    color: var(--color-accent);
    font-size: var(--font-size-sm);
  }

  &__label {
    font-size: var(--font-size-base);
    letter-spacing: 0;
  }

  &__meta {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  &__meta-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--color-divider);
  }

  &__meta-title {
    color: var(--color-accent);
    font-size: var(--font-size-xs);
    letter-spacing: 0;
  }
}

.main-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 0;
  overflow: hidden;

  &__frame {
    display: flex;
    flex: 1;
    min-height: 100%;
    flex-direction: column;
    background: rgba(8, 10, 8, 0.76);
    overflow: hidden;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  &__line {
    color: var(--color-primary);
  }

  &__hint {
    white-space: nowrap;
  }

  > .main-content__frame > *:last-child {
    flex: 1;
    min-height: 0;
  }
}

.session-toast {
  position: fixed;
  right: 24px;
  bottom: 108px;
  z-index: var(--z-toast);
  max-width: min(360px, calc(100vw - 48px));
  padding: 12px 16px;
  border: 1px solid rgba(255, 122, 122, 0.38);
  border-radius: var(--radius-base);
  background: rgba(30, 10, 10, 0.92);
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

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

@media (max-width: 1360px) {
  .terminal-shell {
    &__topbar {
      grid-template-columns: auto 1fr auto;
      gap: 12px;
    }

    &__status {
      display: none;
    }

    &__body {
      grid-template-columns: 184px minmax(0, 1fr);
    }
  }

  .sidebar {
    padding: 12px 10px;
  }
}

@media (max-width: 1100px) {
  .terminal-shell {
    &__topbar {
      padding-left: 12px;
    }

    &__title-text {
      font-size: var(--font-size-sm);
    }

    &__body {
      grid-template-columns: 152px minmax(0, 1fr);
    }
  }

  .sidebar {
    gap: 10px;
    padding: 10px 8px;

    &__menu {
      display: flex;
      gap: 4px;
    }

    &__link {
      grid-template-columns: 26px minmax(0, 1fr);
      justify-items: start;
      gap: 7px;
      padding: 8px;
    }

    &__meta {
      margin-top: auto;
      display: flex;
      gap: 12px;
    }
  }

  .main-content {
    &__header {
      gap: 12px;
    }

    &__hint {
      display: none;
    }
  }
}

@media (max-width: 760px) {
  .terminal-shell {
    &__topbar {
      grid-template-columns: auto 1fr auto;
      gap: 8px;
      min-height: 42px;
    }

    &__window {
      gap: 6px;
    }

    &__dot {
      width: 8px;
      height: 8px;
    }

    &__title-text {
      display: none;
    }

    &__control {
      width: 42px;
      height: 42px;
    }

    &__body {
      grid-template-columns: 1fr;
      grid-template-rows: auto minmax(0, 1fr);
    }
  }

  .sidebar {
    border-right: none;
    border-bottom: 1px solid var(--color-border);

    &__menu {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    &__meta {
      grid-template-columns: 1fr;
    }
  }
}
</style>
