import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${String(MOBILE_BREAKPOINT - 1)}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener('change', onChange)
  return () => {
    mql.removeEventListener('change', onChange)
  }
}

const isMobileNow = () => window.matchMedia(MOBILE_QUERY).matches

/** Ekran mobil kenglikdami (< 768 px). matchMedia'ga obuna — effekt'siz. */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, isMobileNow, () => false)
}
