import { useEffect, useState } from 'react'

/** Qiymat `delayMs` davomida o'zgarmay tursa qaytadi — har harfda so'rov ketmasin. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value)
    }, delayMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [value, delayMs])
  return debounced
}
