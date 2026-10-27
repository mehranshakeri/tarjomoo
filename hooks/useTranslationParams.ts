import { useMemo } from 'react'
import { useLocalStorageValue } from './useLocalStorageValue'

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
  const [stored, setStored] = useLocalStorageValue(STORAGE_KEY)

  const params = useMemo<TranslationParams>(() => {
    if (!stored) return DEFAULTS
    try {
      return { ...DEFAULTS, ...JSON.parse(stored) }
    } catch {
      return DEFAULTS
    }
  }, [stored])

  function setParams(next: TranslationParams) {
    setStored(JSON.stringify(next))
  }

  return { params, setParams }
}
