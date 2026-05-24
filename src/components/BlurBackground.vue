<template>
  <div class="blur-background" :style="backgroundStyle" aria-hidden="true"></div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

interface Props {
  coverUrl?: string
}

const props = defineProps<Props>()

const dominantColor = ref<string>('rgba(29, 185, 84, 0.8)')
const defaultColor = 'rgba(29, 185, 84, 0.8)'

const backgroundStyle = computed(() => ({
  background: `linear-gradient(135deg, ${dominantColor.value} 0%, var(--color-background, #0D0D0D) 100%)`,
  filter: 'blur(80px)',
  opacity: 0.6,
}))

/**
 * Extract the dominant color from an image URL using Canvas pixel sampling.
 * Samples a grid of pixels and computes the average color, ignoring
 * very dark and very light pixels to get a more vibrant result.
 */
function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(defaultColor)
          return
        }

        // Scale down for faster sampling
        const sampleSize = 64
        canvas.width = sampleSize
        canvas.height = sampleSize
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize)

        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize)
        const pixels = imageData.data

        let r = 0, g = 0, b = 0, count = 0

        // Sample every 4th pixel for performance
        for (let i = 0; i < pixels.length; i += 16) {
          const pr = pixels[i]
          const pg = pixels[i + 1]
          const pb = pixels[i + 2]

          // Skip very dark pixels (shadows) and very light pixels (highlights)
          const brightness = (pr + pg + pb) / 3
          if (brightness > 30 && brightness < 220) {
            r += pr
            g += pg
            b += pb
            count++
          }
        }

        if (count === 0) {
          resolve(defaultColor)
          return
        }

        r = Math.round(r / count)
        g = Math.round(g / count)
        b = Math.round(b / count)

        resolve(`rgba(${r}, ${g}, ${b}, 0.8)`)
      } catch {
        resolve(defaultColor)
      }
    }

    img.onerror = () => {
      resolve(defaultColor)
    }

    img.src = imageUrl
  })
}

async function updateColor(url: string | undefined) {
  if (!url) {
    dominantColor.value = defaultColor
    return
  }
  dominantColor.value = await extractDominantColor(url)
}

watch(() => props.coverUrl, (newUrl) => {
  updateColor(newUrl)
})

onMounted(() => {
  updateColor(props.coverUrl)
})
</script>

<style scoped lang="scss">
.blur-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  pointer-events: none;
  transition: background var(--transition-slow, 350ms ease);
}
</style>
