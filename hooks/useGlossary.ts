import { useState, useEffect } from 'react'

const STORAGE_KEY = 'glossary'

export function useGlossary() {
  const [text, setText] = useState('')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setText(stored)
    } catch {
      // ignore
    }
  }, [])

  function save(value: string) {
    setText(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // ignore
    }
  }

  return { text, save }
}
