import type { WorkflowNodes } from '@nodes/Nodes'
import { useEffect } from 'react'

/**
 * Hook to handle run-from-here events from the node UI.
 */
export const useRunFromHere = (
    nodeResults: Map<string, string>,
    nodes: WorkflowNodes[],
    onResume: (nodeId: string, outputs: Record<string, string>) => void,
    isPaused: boolean
) => {
    useEffect(() => {
        const handler = (e: any) => {
            const nodeId = e?.detail?.nodeId
            if (!nodeId) return
            if (isPaused) return
            const outputs: Record<string, string> = {}
            const nodeIdSet = new Set(nodes.map(n => n.id))
            for (const [k, v] of nodeResults) {
                if (nodeIdSet.has(k) && k !== nodeId) outputs[k] = v
            }
            onResume(nodeId, outputs)
        }
        window.addEventListener('nebula-run-from-here' as any, handler as any)
        return () => window.removeEventListener('nebula-run-from-here' as any, handler as any)
    }, [nodeResults, nodes, onResume, isPaused])
}
