import type { Connection } from '@xyflow/react'
import type { Edge } from '../CustomOrderedEdge'
import type { WorkflowNodes } from '../nodes/Nodes'

export const isValidEdgeConnection = (
    connection: Connection,
    existingEdges: Edge[],
    nodes?: WorkflowNodes[]
): boolean => {
    if (connection.source === connection.target) return false

    const targetNode = nodes?.find(n => n.id === connection.target)
    const isFanInTarget = targetNode?.data && (targetNode.data as any).fanInEnabled === true

    // For fan-in targets, only allow connecting to the rightmost free handle.
    if (isFanInTarget) {
        // Must target a concrete handle (no body drop)
        if (!connection.targetHandle) return false
        const usedIdx = new Set<number>()
        for (const e of existingEdges) {
            if (e.target === connection.target) {
                const m = ((e as any).targetHandle as string | undefined | null)?.match(/^in-(\d+)$/)
                if (m) {
                    const idx = Number.parseInt(m[1], 10)
                    if (!Number.isNaN(idx)) usedIdx.add(idx)
                }
            }
        }
        const maxUsed = usedIdx.size > 0 ? Math.max(...Array.from(usedIdx)) : -1
        const expected = `in-${maxUsed + 1}`
        // Only the rightmost free handle is valid
        if (connection.targetHandle !== expected) return false
    }

    // Prevent duplicate edges (same endpoints and handles)
    return !existingEdges.some(
        edge =>
            edge.source === connection.source &&
            edge.target === connection.target &&
            edge.sourceHandle === (connection.sourceHandle ?? null) &&
            edge.targetHandle === (connection.targetHandle ?? null)
    )
}
