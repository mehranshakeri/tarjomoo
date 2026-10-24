import { GoogleGenAI } from '@google/genai'

const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
const TIMEOUT_MS = 15_000
const MAX_RETRIES = 3

// Runtime-mutable — updated automatically when the API signals a deprecated model
// or when a faster available model is discovered via listModels.
let activeModel = DEFAULT_MODEL
// Ordered fallback list populated from the API; falls back to a static list.
let fallbackModels: string[] = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']

// Cache client per apiKey
const clientCache = new Map<string, GoogleGenAI>()

function getClient(apiKey: string): GoogleGenAI {
  const cached = clientCache.get(apiKey)
  if (cached) return cached
  const client = new GoogleGenAI({ apiKey })
  clientCache.set(apiKey, client)
  return client
}

// Fetch available flash/lite models from the API and pick the best one.
// Updates activeModel and fallbackModels in place.
async function refreshAvailableModels(apiKey: string): Promise<void> {
  try {
    const pager = await getClient(apiKey).models.list()
    const flash: string[] = []
    for await (const model of pager) {
      const id: string = model.name ?? ''
      // Keep only text-generation-capable flash/lite models
      if (id.includes('flash') || id.includes('flash-lite')) {
        flash.push(id)
      }
    }
    if (flash.length === 0) return

    // Prefer lite variants (cheapest/fastest), then recency by name sort descending
    flash.sort((a, b) => {
      const aLite = a.includes('lite') ? 0 : 1
      const bLite = b.includes('lite') ? 0 : 1
      if (aLite !== bLite) return aLite - bLite
      return b.localeCompare(a)
    })

    fallbackModels = flash
    // Only update activeModel if the current one isn't in the fresh list
    if (!flash.includes(activeModel)) {
      activeModel = flash[0]
      console.info(`[Gemini] Active model updated to "${activeModel}"`)
    }
  } catch {
    // Best-effort — keep existing defaults if the listing fails
  }
}

function nextFallback(current: string): string | null {
  const idx = fallbackModels.indexOf(current)
  // Return the next model in the list, or null if already at the end
  return fallbackModels[idx + 1] ?? null
}

function isDeprecatedModelError(msg: string): boolean {
  return (
    msg.includes('deprecated') ||
    msg.includes('not found') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('invalid model') ||
    msg.toLowerCase().includes('no longer supported')
  )
}

function makeConfig(systemInstruction: string, maxOutputTokens?: number) {
  return {
    systemInstruction,
    ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
  }
}

function isModelUnavailableError(msg: string): boolean {
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE')
  )
}

function isRetryableError(msg: string): boolean {
  return (
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('500') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('INTERNAL') ||
    msg.toLowerCase().includes('timeout') ||
    msg.toLowerCase().includes('network') ||
    msg.toLowerCase().includes('aborted') ||
    msg.toLowerCase().includes('econnreset') ||
    msg.toLowerCase().includes('fetch failed')
  )
}

function mapError(err: unknown, attempts: number): Error {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
    return new Error('Invalid API key. Check your key and try again.')
  }
  if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
    return new Error('Quota exceeded. Try again later.')
  }
  if (isRetryableError(msg)) {
    return new Error(`Translation failed after ${attempts} attempt${attempts !== 1 ? 's' : ''}: service unavailable. Try again.`)
  }
  return new Error(`Translation failed: ${msg}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Request timed out after ${ms / 1000}s`)), ms)
    promise.then(
      (val) => { clearTimeout(timer); resolve(val) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}

export async function validateGeminiKey(apiKey: string): Promise<void> {
  try {
    await withTimeout(
      getClient(apiKey).models.generateContent({
        model: activeModel,
        contents: 'hi',
        config: makeConfig('You are a professional translator.', 1),
      }),
      TIMEOUT_MS,
    )
  } catch (err) {
    throw mapError(err, 1)
  }
}

export async function warmUpGemini(apiKey: string, systemInstruction: string): Promise<void> {
  // Refresh model list first so the ping uses the best available model
  await refreshAvailableModels(apiKey)
  try {
    await withTimeout(
      getClient(apiKey).models.generateContent({
        model: activeModel,
        contents: '.',
        config: makeConfig(systemInstruction, 1),
      }),
      TIMEOUT_MS,
    )
  } catch {
    // best-effort — ignore errors
  }
}

export interface ModelSwitchNotification {
  from: string
  to: string
}

// Models that have rejected system instructions at runtime
const noSystemInstructionModels = new Set<string>()

function isNoSystemInstructionError(msg: string): boolean {
  return msg.includes('Developer instruction is not enabled')
}

async function streamTranslation(
  apiKey: string,
  model: string,
  systemInstruction: string,
  prompt: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const useSystemInstruction = !noSystemInstructionModels.has(model)
  const streamPromise = getClient(apiKey).models.generateContentStream({
    model,
    contents: prompt,
    config: useSystemInstruction ? makeConfig(systemInstruction) : {},
  })
  const stream = await withTimeout(streamPromise, TIMEOUT_MS)
  for await (const chunk of stream) {
    const text = chunk.text
    if (text) onChunk(text)
  }
}

export async function translateWithGemini(
  apiKey: string,
  systemInstruction: string,
  prompt: string,
  onChunk: (chunk: string) => void,
  onModelSwitch?: (notification: ModelSwitchNotification) => void,
): Promise<void> {
  let lastErr: unknown
  let modelToUse = activeModel

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await streamTranslation(apiKey, modelToUse, systemInstruction, prompt, onChunk)
      return
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)

      // Non-retryable: bad key or quota — fail immediately
      if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
        throw mapError(err, attempt)
      }
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        throw mapError(err, attempt)
      }

      // System instruction not supported — disable it for this model and retry
      if (isNoSystemInstructionError(msg)) {
        console.warn(`[Gemini] Model "${modelToUse}" does not support system instructions. Retrying without.`)
        noSystemInstructionModels.add(modelToUse)
        continue
      }

      // Deprecated model — try next in fallback list
      if (isDeprecatedModelError(msg)) {
        const next = nextFallback(modelToUse) ?? fallbackModels[0]
        if (next && next !== modelToUse) {
          const previous = modelToUse
          modelToUse = next
          activeModel = next
          console.warn(`[Gemini] Model "${previous}" deprecated. Switching to "${next}".`)
          onModelSwitch?.({ from: previous, to: next })
          continue
        }
      }

      // 503/UNAVAILABLE only — switch to next fallback model
      if (isModelUnavailableError(msg)) {
        const next = nextFallback(modelToUse)
        if (next) {
          const previous = modelToUse
          modelToUse = next
          activeModel = next
          console.warn(`[Gemini] "${previous}" unavailable. Switching to "${next}".`)
          onModelSwitch?.({ from: previous, to: next })
          continue
        }
      }

      // Other retryable errors (timeout, network, 500, 502) — backoff, same model
      if (attempt < MAX_RETRIES && isRetryableError(msg)) {
        const delay = 500 * 2 ** (attempt - 1)
        console.warn(`[Gemini] Attempt ${attempt} failed (${msg}). Retrying in ${delay}ms…`)
        await sleep(delay)
        continue
      }

      break
    }
  }

  throw mapError(lastErr, MAX_RETRIES)
}
