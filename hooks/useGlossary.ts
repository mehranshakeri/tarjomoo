import { useLocalStorageValue } from './useLocalStorageValue'

const STORAGE_KEY = 'glossary'

export function useGlossary() {
  const [text, save] = useLocalStorageValue(STORAGE_KEY)
  return { text, save }
}
