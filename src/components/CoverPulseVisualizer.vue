<template>
  <div
    class="vinyl-player"
    :class="{ 'vinyl-player--active': isPlaying }"
    :style="containerStyle"
    role="img"
    :aria-label="alt"
  >
    <div class="vinyl-player__plinth" aria-hidden="true"></div>

    <div class="vinyl-player__disc">
      <div class="vinyl-player__grooves" aria-hidden="true"></div>
      <div class="vinyl-player__label">
        <div v-if="loading" class="vinyl-player__placeholder">
          <div class="vinyl-player__skeleton" />
        </div>

        <div v-else-if="hasError || !src" class="vinyl-player__fallback">
          <span class="vinyl-player__fallback-mark" aria-hidden="true">$</span>
        </div>

        <img
          v-show="src && !loading && !hasError"
          :src="src"
          :alt="alt"
          class="vinyl-player__image"
          @load="onLoad"
          @error="onError"
        />
      </div>
      <div class="vinyl-player__spindle" aria-hidden="true"></div>
    </div>

    <div class="vinyl-player__tonearm" :style="tonearmStyle" aria-hidden="true">
      <div class="vinyl-player__pivot"></div>
      <div class="vinyl-player__arm"></div>
      <div class="vinyl-player__needle"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface Props {
  src: string
  alt?: string
  size?: number
  isPlaying: boolean
  currentTime?: number
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  alt: '专辑封面',
  size: 360,
})

const loading = ref(Boolean(props.src))
const hasError = ref(false)

const resolvedSize = computed(() => props.size)

const containerStyle = computed(() => ({
  width: `min(100%, ${resolvedSize.value}px)`,
  aspectRatio: '1 / 1',
}))

const tonearmStyle = computed(() => {
  const duration = props.duration ?? 0
  const hasTrack = Boolean(props.src) && duration > 0
  const progress = hasTrack
    ? Math.min(1, Math.max(0, (props.currentTime ?? 0) / duration))
    : 0
  const parkedAngle = -30
  const grooveStartAngle = -19
  const grooveEndAngle = -8
  const angle = hasTrack
    ? grooveStartAngle + (grooveEndAngle - grooveStartAngle) * progress
    : parkedAngle

  return {
    transform: `rotate(${angle}deg)`,
  }
})

watch(
  () => props.src,
  (src) => {
    loading.value = Boolean(src)
    hasError.value = false
  },
)

function onLoad() {
  loading.value = false
  hasError.value = false
}

function onError() {
  loading.value = false
  hasError.value = true
}
</script>

<style scoped lang="scss">
.vinyl-player {
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;

  &__plinth {
    position: absolute;
    inset: 7%;
    border: 1px solid var(--color-divider);
    border-radius: 50%;
    background:
      radial-gradient(circle, rgba(159, 247, 177, 0.11), transparent 58%),
      rgba(8, 10, 8, 0.38);
    filter: blur(0.2px);
  }

  &__disc {
    position: relative;
    display: grid;
    place-items: center;
    width: 78%;
    height: 78%;
    border-radius: 50%;
    border: 1px solid rgba(238, 246, 239, 0.12);
    background:
      radial-gradient(circle, transparent 0 10%, rgba(255, 255, 255, 0.04) 10.5% 11%, transparent 11.5% 20%),
      repeating-radial-gradient(circle, rgba(238, 246, 239, 0.055) 0 1px, transparent 1px 8px),
      radial-gradient(circle at 34% 24%, rgba(255, 255, 255, 0.12), transparent 22%),
      #050705;
    box-shadow:
      0 0 0 1px rgba(159, 247, 177, 0.08),
      0 22px 54px rgba(0, 0, 0, 0.38),
      0 0 34px rgba(159, 247, 177, 0.08);
    transform-origin: center;
  }

  &--active &__disc {
    animation: vinyl-spin 14s linear infinite;
  }

  &__grooves {
    position: absolute;
    inset: 10%;
    border-radius: 50%;
    border: 1px solid rgba(238, 246, 239, 0.045);
    box-shadow:
      inset 0 0 0 18px rgba(255, 255, 255, 0.012),
      inset 0 0 0 38px rgba(255, 255, 255, 0.01),
      inset 0 0 0 64px rgba(255, 255, 255, 0.008);
  }

  &__label {
    position: relative;
    z-index: 1;
    width: 39%;
    height: 39%;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: 50%;
    background: rgba(13, 18, 14, 0.96);
  }

  &__image,
  &__placeholder,
  &__fallback,
  &__skeleton {
    width: 100%;
    height: 100%;
  }

  &__image {
    object-fit: cover;
  }

  &__placeholder,
  &__fallback {
    display: grid;
    place-items: center;
  }

  &__skeleton {
    background: linear-gradient(
      120deg,
      rgba(9, 15, 11, 0.9) 20%,
      rgba(23, 36, 27, 0.96) 48%,
      rgba(9, 15, 11, 0.9) 76%
    );
    background-size: 200% 100%;
    animation: vinyl-shimmer 1.6s linear infinite;
  }

  &__fallback {
    color: rgba(159, 247, 177, 0.72);
    background:
      radial-gradient(circle, transparent 0 21%, rgba(159, 247, 177, 0.18) 22% 24%, transparent 25% 46%, rgba(159, 247, 177, 0.09) 47% 49%, transparent 50%),
      rgba(6, 12, 8, 0.96);
  }

  &__fallback-mark {
    position: absolute;
    top: 8%;
    left: 50%;
    font-size: 28px;
    line-height: 1;
    transform: translateX(-50%);
  }

  &__spindle {
    position: absolute;
    z-index: 2;
    width: 4.8%;
    height: 4.8%;
    border-radius: 50%;
    background: var(--color-text);
    box-shadow: 0 0 0 4px rgba(8, 10, 8, 0.68);
  }

  &__tonearm {
    position: absolute;
    right: 11%;
    top: 17%;
    z-index: 3;
    width: 43%;
    height: 43%;
    transform-origin: 88% 18%;
    transition: transform 900ms linear;
  }

  &__pivot {
    position: absolute;
    right: 0;
    top: 0;
    width: 24%;
    height: 24%;
    border: 1px solid var(--color-border);
    border-radius: 50%;
    background:
      radial-gradient(circle, rgba(238, 246, 239, 0.28), transparent 32%),
      rgba(10, 13, 10, 0.96);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
  }

  &__arm {
    position: absolute;
    right: 15%;
    top: 11%;
    width: 76%;
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(238, 246, 239, 0.68), rgba(159, 247, 177, 0.42));
    transform: rotate(33deg);
    transform-origin: right center;
  }

  &__needle {
    position: absolute;
    left: 8%;
    top: 48%;
    width: 18px;
    height: 10px;
    border-radius: 2px;
    background: rgba(214, 189, 122, 0.78);
    transform: rotate(33deg);
    box-shadow: 0 0 12px rgba(214, 189, 122, 0.12);

    &::after {
      content: '';
      position: absolute;
      left: 2px;
      top: 8px;
      width: 1px;
      height: 14px;
      background: rgba(238, 246, 239, 0.72);
      transform: rotate(-12deg);
      transform-origin: top center;
    }
  }
}

@keyframes vinyl-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes vinyl-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>
