import { useState, useEffect } from 'react'

const STORAGE_KEY = 'translation_params'

export interface TranslationParams {
  sourceLang: string
  targetLang: string
  tones: string[]
}

const DEFAULTS: TranslationParams = { sourceLang: 'English', targetLang: 'Persian/Farsi', tones: ['Professional & Business'] }

export function hasStoredParams(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY)
  } catch {
    return false
  }
}

export function useTranslationParams() {
  const [params, setParamsState] = useState<TranslationParams>(DEFAULTS)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setParamsState({ ...DEFAULTS, ...JSON.parse(stored) })
      } catch {
        // ignore malformed stored value
      }
    }
  }, [])

  function setParams(next: TranslationParams) {
    setParamsState(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return { params, setParams }
}
