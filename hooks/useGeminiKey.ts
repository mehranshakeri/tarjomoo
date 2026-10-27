import { useLocalStorageValue } from './useLocalStorageValue'

const STORAGE_KEY = 'gemini_api_key'

export function useGeminiKey() {
  const [apiKey, setApiKey] = useLocalStorageValue(STORAGE_KEY)
  return { apiKey, setApiKey }
}
