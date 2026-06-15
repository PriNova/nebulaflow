import type { WorkflowNodes } from '@nodes/Nodes'
import { useEffect } from 'react'

interface SubflowStateDetail {
    id?: string
    outputs?: Record<string, string>
}

/**
 * Hook to merge in-memory subflow outputs into the active subflow view.
 */
export const useSubflowState = (
    activeSubflowId: string | null,
    setNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>,
    setNodeResults: React.Dispatch<React.SetStateAction<Map<string, string>>>
) => {
    useEffect(() => {
        const handler = (e: Event) => {
            const info: SubflowStateDetail | undefined = (
                e as CustomEvent<SubflowStateDetail>
            ).detail
            if (!info?.id || !info.outputs) return
            if (activeSubflowId && info.id === activeSubflowId) {
                const outputs = info.outputs
                setNodes(prev =>
                    prev.map(n =>
                        outputs[n.id]
                            ? {
                                  ...n,
                                  data: { ...n.data, output: outputs[n.id] },
                              }
                            : n
                    )
                )
                setNodeResults(prev => {
                    const next = new Map(prev)
                    for (const [k, v] of Object.entries(outputs)) next.set(k, v)
                    return next
                })
            }
        }
        window.addEventListener('nebula-subflow-state', handler)
        return () => window.removeEventListener('nebula-subflow-state', handler)
    }, [activeSubflowId, setNodes, setNodeResults])
}
