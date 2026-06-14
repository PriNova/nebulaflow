import { useEffect, useState } from 'react'

/** Breakpoint below which the UI switches to mobile overlay mode. */
const MOBILE_BREAKPOINT = 768

/**
 * Tracks whether the viewport is narrow enough to warrant mobile layout.
 * Re-evaluates on resize via matchMedia.
 */
export function useResponsiveLayout(): { isMobile: boolean } {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
    )

    useEffect(() => {
        if (typeof window === 'undefined') return
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        // Sync initial state in case it changed between SSR and hydration.
        setIsMobile(mql.matches)
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
    }, [])

    return { isMobile }
}
