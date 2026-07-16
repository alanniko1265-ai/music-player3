export interface AudioAnalyserGraph {
  context: AudioContext
  analyser: AnalyserNode
}

export interface SpectrumLevelOptions {
  sampleRate: number
  barCount: number
  previousLevels?: readonly number[]
}

const graphCache = new WeakMap<HTMLAudioElement, AudioAnalyserGraph>()
const graphPromises = new WeakMap<HTMLAudioElement, Promise<AudioAnalyserGraph | null>>()

export function createSpectrumLevels(
  data: Uint8Array,
  { sampleRate, barCount, previousLevels = [] }: SpectrumLevelOptions,
): number[] {
  const count = Math.max(0, Math.floor(barCount))
  if (!count || !data.length) return []

  const nyquist = Math.max(4000, sampleRate / 2)
  const minFrequency = 55
  const maxFrequency = Math.min(16000, nyquist * 0.92)
  const bandCount = Math.ceil(count / 2)
  const frequencyRatio = maxFrequency / minFrequency

  const bandLevels = Array.from({ length: bandCount }, (_, bandIndex) => {
    const startFrequency = minFrequency * Math.pow(frequencyRatio, bandIndex / bandCount)
    const endFrequency = minFrequency * Math.pow(frequencyRatio, (bandIndex + 1) / bandCount)
    const startIndex = Math.max(1, Math.floor((startFrequency / nyquist) * data.length))
    const endIndex = Math.min(
      data.length,
      Math.max(startIndex + 1, Math.ceil((endFrequency / nyquist) * data.length)),
    )

    let energy = 0
    for (let index = startIndex; index < endIndex; index += 1) {
      const normalized = data[index] / 255
      energy += normalized * normalized
    }

    const samples = Math.max(1, endIndex - startIndex)
    const rms = Math.sqrt(energy / samples)
    const centerFrequency = Math.sqrt(startFrequency * endFrequency)
    const gain = centerFrequency < 180 ? 1.24 : centerFrequency < 2500 ? 1.04 : 1.16
    const target = rms < 0.025 ? 0.08 : Math.pow(rms, 0.72) * gain + 0.04
    return clampSpectrumLevel(target)
  })

  const center = (count - 1) / 2
  return Array.from({ length: count }, (_, index) => {
    const distance = count === 1 ? 0 : Math.abs(index - center) / Math.max(center, 0.5)
    const bandIndex = Math.min(bandCount - 1, Math.floor(distance * bandCount))
    const target = bandLevels[bandIndex]
    const previous = previousLevels[index] ?? 0.08
    const response = target >= previous ? 0.38 : 0.14
    return clampSpectrumLevel(previous + (target - previous) * response)
  })
}

function clampSpectrumLevel(level: number): number {
  return Math.min(1, Math.max(0.08, level))
}

export async function getAudioAnalyserGraph(
  audio: HTMLAudioElement,
): Promise<AudioAnalyserGraph | null> {
  const cached = graphCache.get(audio)
  if (cached) {
    await resumeContext(cached.context)
    return cached
  }

  const pending = graphPromises.get(audio)
  if (pending) {
    return pending
  }

  const graphPromise = createGraph(audio)
  graphPromises.set(audio, graphPromise)

  try {
    const graph = await graphPromise
    if (graph) {
      graphCache.set(audio, graph)
    }
    return graph
  } finally {
    graphPromises.delete(audio)
  }
}

async function createGraph(audio: HTMLAudioElement): Promise<AudioAnalyserGraph | null> {
  const AudioContextCtor =
    globalThis.AudioContext ||
    // @ts-expect-error webkitAudioContext exists in some Chromium environments.
    globalThis.webkitAudioContext

  if (!AudioContextCtor) {
    return null
  }

  let context: AudioContext | null = null

  try {
    context = new AudioContextCtor()
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    analyser.minDecibels = -88
    analyser.maxDecibels = -18
    analyser.smoothingTimeConstant = 0.72

    const source = context.createMediaElementSource(audio)
    source.connect(analyser)
    analyser.connect(context.destination)

    await resumeContext(context)
    return { context, analyser }
  } catch {
    if (context && context.state !== 'closed') {
      void context.close()
    }
    return null
  }
}

async function resumeContext(context: AudioContext): Promise<void> {
  if (context.state !== 'suspended') {
    return
  }

  try {
    await context.resume()
  } catch {
    // Playback remains available even when the visualizer cannot resume.
  }
}
