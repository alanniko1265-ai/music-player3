import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'search',
    alias: '/search',
    component: () => import('@/views/SearchView.vue'),
    meta: { transition: 'fade' }
  },
  {
    path: '/player',
    name: 'player',
    component: () => import('@/views/PlayerView.vue'),
    meta: { transition: 'slide-up' }
  },
  {
    path: '/playlists',
    name: 'playlists',
    component: () => import('@/views/PlaylistView.vue'),
    meta: { transition: 'fade' }
  },
  {
    path: '/playlists/:id',
    name: 'playlist-detail',
    component: () => import('@/views/PlaylistDetailView.vue'),
    meta: { transition: 'slide-left' }
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: () => import('@/views/FavoritesView.vue'),
    meta: { transition: 'fade' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
