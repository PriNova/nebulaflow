import { useEffect } from 'react'

/**
 * Hook to handle node editing events from the UI.
 */
export const useEditNode = (onNodeUpdate: (id: string, partial: any) => void) => {
    useEffect(() => {
        const handleEditNode = (e: any) => {
            const detail = e?.detail
            if (!detail) return
            const { id, action, content, title } = detail
            if (!id) return

            switch (action) {
                case 'start':
                    onNodeUpdate(id, { isEditing: true })
                    break
                case 'commit': {
                    const updates: Record<string, any> = { isEditing: false }
                    if (content !== undefined) {
                        updates.content = content
                    }
                    if (title !== undefined) {
                        updates.title = title
                    }
                    onNodeUpdate(id, updates)
                    break
                }
                case 'cancel':
                    onNodeUpdate(id, { isEditing: false })
                    break
            }
        }
        window.addEventListener('nebula-edit-node' as any, handleEditNode as any)
        return () => window.removeEventListener('nebula-edit-node' as any, handleEditNode as any)
    }, [onNodeUpdate])
}
