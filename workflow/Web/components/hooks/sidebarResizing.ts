import { useCallback, useEffect, useRef, useState } from 'react'

export const useSidebarResize = (
    initialWidth = 256,
    minWidth = 200,
    maxWidth = 600,
    options?: { minCenterGap?: number; getCenterWidth?: () => number }
) => {
    const [sidebarWidth, setSidebarWidth] = useState(initialWidth)
    const [isResizing, setIsResizing] = useState(false)
    const [startX, setStartX] = useState(0)
    const [startWidth, setStartWidth] = useState(0)
    const startCenterWidthRef = useRef(0)
    const minCenterGap = options?.minCenterGap ?? 0

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            setIsResizing(true)
            setStartX(e.clientX)
            setStartWidth(sidebarWidth)
            startCenterWidthRef.current = options?.getCenterWidth?.() ?? 0
            e.preventDefault()
        },
        [sidebarWidth, options]
    )

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isResizing) return
            let delta = e.clientX - startX
            if (startCenterWidthRef.current > 0) {
                const maxDelta = Math.max(0, startCenterWidthRef.current - minCenterGap)
                if (delta > maxDelta) delta = maxDelta
            }
            const newWidth = Math.min(Math.max(startWidth + delta, minWidth), maxWidth)
            setSidebarWidth(newWidth)
        },
        [isResizing, startX, startWidth, minWidth, maxWidth, minCenterGap]
    )

    const handleMouseUp = useCallback(() => {
        setIsResizing(false)
    }, [])

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, handleMouseMove, handleMouseUp])

    return { sidebarWidth, handleMouseDown }
}

export const useRightSidebarResize = (
    initialWidth = 256,
    minWidth = 200,
    maxWidth?: number,
    options?: { minCenterGap?: number; getCenterWidth?: () => number }
) => {
    const [rightSidebarWidth, setRightSidebarWidth] = useState(initialWidth)
    const [isResizing, setIsResizing] = useState(false)
    const [startX, setStartX] = useState(0)
    const [startWidth, setStartWidth] = useState(0)
    const startCenterWidthRef = useRef(0)
    const minCenterGap = options?.minCenterGap ?? 0

    const handleMouseDown = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            setIsResizing(true)
            setStartX(e.clientX)
            setStartWidth(rightSidebarWidth)
            startCenterWidthRef.current = options?.getCenterWidth?.() ?? 0
            e.preventDefault()
        },
        [rightSidebarWidth, options]
    )

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isResizing) return
            let delta = startX - e.clientX
            if (startCenterWidthRef.current > 0) {
                const maxDelta = Math.max(0, startCenterWidthRef.current - minCenterGap)
                if (delta > maxDelta) delta = maxDelta
            }
            let candidate = Math.max(startWidth + delta, minWidth)
            if (typeof maxWidth === 'number' && Number.isFinite(maxWidth)) {
                candidate = Math.min(candidate, maxWidth)
            }
            setRightSidebarWidth(candidate)
        },
        [isResizing, startX, startWidth, minWidth, maxWidth, minCenterGap]
    )

    const handleMouseUp = useCallback(() => {
        setIsResizing(false)
    }, [])

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, handleMouseMove, handleMouseUp])

    return { rightSidebarWidth, handleMouseDown }
}
