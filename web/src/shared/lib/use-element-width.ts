import { useEffect, useState, type RefObject } from 'react'

/** Element kengligi (px) — grafik SVG'si aniq o'lchamda chiziladi (matn cho'zilmaydi). */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.clientWidth)
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [ref])
  return width
}
