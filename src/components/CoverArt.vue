<template>
  <div
    class="cover-art"
    :style="containerStyle"
    role="img"
    :aria-label="alt"
  >
    <!-- Loading skeleton placeholder -->
    <div v-if="loading" class="cover-art__placeholder">
      <div class="cover-art__skeleton" />
    </div>

    <!-- Error fallback with music note icon -->
    <div v-else-if="hasError" class="cover-art__fallback">
      <svg
        class="cover-art__icon"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"
          fill="currentColor"
        />
      </svg>
    </div>

    <!-- Actual cover image -->
    <img
      v-show="!loading && !hasError"
      :src="src"
      :alt="alt"
      class="cover-art__image"
      @load="onLoad"
      @error="onError"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

export interface CoverArtProps {
  src: string
  alt?: string
  size?: string | number
}

const props = withDefaults(defineProps<CoverArtProps>(), {
  alt: '专辑封面',
  size: '100%'
})

const loading = ref(true)
const hasError = ref(false)

const containerStyle = computed(() => {
  const sizeValue = typeof props.size === 'number' ? `${props.size}px` : props.size
  return {
    width: sizeValue,
    height: sizeValue
  }
})

function onLoad() {
  loading.value = false
  hasError.value = false
}

function onError() {
  loading.value = false
  hasError.value = true
}

// Reset state when src changes
watch(() => props.src, () => {
  loading.value = true
  hasError.value = false
})
</script>

<style scoped lang="scss">
.cover-art {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md, 12px);
  box-shadow: var(--shadow-base, 0 4px 12px rgba(0, 0, 0, 0.4));
  background-color: var(--color-surface, #1A1A2E);
  flex-shrink: 0;

  &__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: opacity var(--transition-base, 250ms ease);
  }

  &__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__skeleton {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--color-surface, #1A1A2E) 25%,
      var(--color-surface-hover, #222240) 50%,
      var(--color-surface, #1A1A2E) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  &__fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color-surface, #1A1A2E);
  }

  &__icon {
    width: 40%;
    height: 40%;
    color: var(--color-text-secondary, #B3B3B3);
    opacity: 0.6;
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style>
