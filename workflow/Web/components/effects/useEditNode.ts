import { useEffect } from 'react'

interface EditNodeDetail {
    id?: string
    action?: string
    content?: string
    title?: string
}

/**
 * Hook to handle node editing events from the UI.
 */
export const useEditNode = (onNodeUpdate: (id: string, partial: Record<string, unknown>) => void) => {
    useEffect(() => {
        const handleEditNode = (e: Event) => {
            const detail: EditNodeDetail | undefined = (e as CustomEvent<EditNodeDetail>).detail
            if (!detail) return
            const { id, action, content, title } = detail
            if (!id) return

            switch (action) {
                case 'start':
                    onNodeUpdate(id, { isEditing: true })
                    break
                case 'commit': {
                    const updates: Record<string, unknown> = { isEditing: false }
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
        window.addEventListener('nebula-edit-node', handleEditNode)
        return () => window.removeEventListener('nebula-edit-node', handleEditNode)
    }, [onNodeUpdate])
}
