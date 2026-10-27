import { useSyncExternalStore } from 'react'

// localStorage-backed string shared by every component using the same key,
// so a change made on one screen is seen immediately on the others.
const listeners = new Map<string, Set<() => void>>()

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

export function useLocalStorageValue(key: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      const set = listeners.get(key) ?? new Set()
      listeners.set(key, set)
      set.add(cb)
      return () => { set.delete(cb) }
    },
    () => read(key),
  )

  function setValue(next: string) {
    try {
      if (next) localStorage.setItem(key, next)
      else localStorage.removeItem(key)
    } catch {
      // ignore
    }
    listeners.get(key)?.forEach((cb) => cb())
  }

  return [value, setValue]
}
