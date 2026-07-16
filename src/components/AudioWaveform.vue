<template>
  <div
    class="audio-waveform"
    :class="{
      'audio-waveform--compact': compact,
      'audio-waveform--active': isPlaying || isDecaying,
    }"
    role="img"
    aria-label="播放音浪"
    :style="waveformStyle"
  >
    <span
      v-for="(level, index) in renderedLevels"
      :key="index"
      class="audio-waveform__bar"
      :style="{ transform: `scaleY(${Math.max(Math.min(level, 0.82), 0.08)})` }"
    ></span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createSpectrumLevels, getAudioAnalyserGraph } from '@/services/audio-visualizer'

interface Props {
  audio: HTMLAudioElement | null
  isPlaying: boolean
  compact?: boolean
  barCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  barCount: 28,
})

const levels = ref<number[]>(Array.from({ length: props.barCount }, () => 0.08))
const isDecaying = ref(false)

let animationFrame = 0
let analyser: AnalyserNode | null = null
let frequencyData: Uint8Array | null = null
let useFallback = false

const renderedLevels = computed(() => {
  if (levels.value.length === props.barCount) {
    return levels.value
  }

  return Array.from({ length: props.barCount }, (_, index) => levels.value[index] ?? 0.08)
})

const waveformStyle = computed(() => ({
  '--bar-count': props.barCount,
}))

watch(
  () => [props.audio, props.isPlaying, props.barCount] as const,
  async () => {
    stopAnimation()

    if (!props.audio || !isPageVisible()) {
      resetLevels()
      return
    }

    if (!props.isPlaying) {
      startDecay()
      return
    }

    isDecaying.value = false
    await ensureVisualizer()
    if (props.isPlaying && isPageVisible()) {
      startAnimation()
    }
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  stopAnimation()
  analyser = null
  frequencyData = null
})

async function ensureVisualizer(): Promise<void> {
  if (!props.audio || analyser || useFallback) {
    return
  }

  const graph = await getAudioAnalyserGraph(props.audio)
  if (!graph) {
    useFallback = true
    return
  }

  analyser = graph.analyser
  frequencyData = new Uint8Array(analyser.frequencyBinCount)
}

function startAnimation(): void {
  stopAnimation()
  isDecaying.value = false

  const tick = () => {
    if (!props.isPlaying || !isPageVisible()) {
      animationFrame = 0
      return
    }

    if (analyser && frequencyData) {
      analyser.getByteFrequencyData(frequencyData)
      updateFromFrequencyData(frequencyData)
    } else {
      updateFallbackLevels()
    }

    animationFrame = requestAnimationFrame(tick)
  }

  animationFrame = requestAnimationFrame(tick)
}

function startDecay(): void {
  stopAnimation()

  if (!levels.value.some((level) => level > 0.085)) {
    resetLevels()
    return
  }

  const startLevels = [...levels.value]
  const startedAt = performance.now()
  const duration = 360
  isDecaying.value = true

  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    levels.value = startLevels.map((level) => clampLevel(level + (0.08 - level) * eased))

    if (progress < 1 && isPageVisible() && !props.isPlaying) {
      animationFrame = requestAnimationFrame(tick)
      return
    }

    animationFrame = 0
    resetLevels()
  }

  animationFrame = requestAnimationFrame(tick)
}

function stopAnimation(): void {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = 0
  }
}

function updateFromFrequencyData(data: Uint8Array): void {
  levels.value = createSpectrumLevels(data, {
    sampleRate: analyser?.context.sampleRate ?? 44100,
    barCount: props.barCount,
    previousLevels: levels.value,
  })
}

function updateFallbackLevels(): void {
  const now = performance.now() / 180
  const center = (props.barCount - 1) / 2

  levels.value = Array.from({ length: props.barCount }, (_, index) => {
    const distance = Math.abs(index - center) / Math.max(center, 1)
    const mirroredIndex = Math.round(Math.abs(index - center))
    const wave =
      Math.sin(now + mirroredIndex * 0.46) * 0.24 +
      Math.sin(now * 0.62 + mirroredIndex * 0.2) * 0.18 +
      0.42
    const target = clampLevel(wave * (1 - distance * 0.34) + 0.08)
    const previous = levels.value[index] ?? 0.12
    const response = target >= previous ? 0.26 : 0.1
    return clampLevel(previous + (target - previous) * response)
  })
}

function clampLevel(level: number): number {
  return Math.min(1, Math.max(0.08, level))
}

function resetLevels(): void {
  levels.value = Array.from({ length: props.barCount }, () => 0.08)
  isDecaying.value = false
}

function isPageVisible(): boolean {
  return typeof document === 'undefined' || !document.hidden
}

async function handleVisibilityChange(): Promise<void> {
  stopAnimation()

  if (!props.audio || !isPageVisible()) {
    resetLevels()
    return
  }

  if (!props.isPlaying) {
    startDecay()
    return
  }

  await ensureVisualizer()
  startAnimation()
}
</script>

<style scoped lang="scss">
.audio-waveform {
  display: grid;
  grid-template-columns: repeat(var(--bar-count), minmax(0, 1fr));
  align-items: end;
  justify-items: center;
  gap: 5px;
  min-height: 48px;
  height: 48px;
  -webkit-mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent);
  mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent);

  &--compact {
    min-height: 30px;
    height: 30px;
    gap: 4px;
  }

  &__bar {
    width: 2px;
    height: 100%;
    border-radius: 999px;
    transform-origin: center bottom;
    transition: transform 75ms linear, opacity var(--transition-base);
    background: var(--color-primary);
    opacity: 0.18;
  }

  &--active &__bar {
    opacity: 0.68;
  }
}
</style>
