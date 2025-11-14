import type { WorkflowNodes } from '@nodes/Nodes'
import { useEffect } from 'react'

/**
 * Hook to merge in-memory subflow outputs into the active subflow view.
 */
export const useSubflowState = (
    activeSubflowId: string | null,
    setNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>,
    setNodeResults: React.Dispatch<React.SetStateAction<Map<string, string>>>
) => {
    useEffect(() => {
        const handler = (e: any) => {
            const info = (e?.detail || {}) as { id?: string; outputs?: Record<string, string> }
            if (!info?.id || !info.outputs) return
            if (activeSubflowId && info.id === activeSubflowId) {
                const outputs = info.outputs
                setNodes(prev =>
                    prev.map(n =>
                        outputs[n.id]
                            ? ({
                                  ...n,
                                  data: { ...n.data, output: outputs[n.id] },
                              } as any)
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
        window.addEventListener('nebula-subflow-state' as any, handler as any)
        return () => window.removeEventListener('nebula-subflow-state' as any, handler as any)
    }, [activeSubflowId, setNodes, setNodeResults])
}
