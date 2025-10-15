import { useCallback, useEffect, useState } from 'react'

export const useSidebarResize = (initialWidth = 256, minWidth = 200, maxWidth = 600) => {
    const [sidebarWidth, setSidebarWidth] = useState(initialWidth)
    const [isResizing, setIsResizing] = useState(false)
    const [startX, setStartX] = useState(0)
    const [startWidth, setStartWidth] = useState(0)

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            setIsResizing(true)
            setStartX(e.clientX)
            setStartWidth(sidebarWidth)
            e.preventDefault()
        },
        [sidebarWidth]
    )

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isResizing) return
            const delta = e.clientX - startX
            const newWidth = Math.min(Math.max(startWidth + delta, minWidth), maxWidth)
            setSidebarWidth(newWidth)
        },
        [isResizing, startX, startWidth, minWidth, maxWidth]
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

export const useRightSidebarResize = (initialWidth = 256, minWidth = 200, maxWidth = 800) => {
    const [rightSidebarWidth, setRightSidebarWidth] = useState(initialWidth)
    const [isResizing, setIsResizing] = useState(false)
    const [startX, setStartX] = useState(0)
    const [startWidth, setStartWidth] = useState(0)

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            setIsResizing(true)
            setStartX(e.clientX)
            setStartWidth(rightSidebarWidth)
            e.preventDefault()
        },
        [rightSidebarWidth]
    )

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isResizing) return
            const delta = startX - e.clientX
            const newWidth = Math.min(Math.max(startWidth + delta, minWidth), maxWidth)
            setRightSidebarWidth(newWidth)
        },
        [isResizing, startX, startWidth, minWidth, maxWidth]
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
