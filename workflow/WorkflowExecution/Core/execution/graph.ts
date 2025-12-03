import type { Edge, WorkflowNodes } from '../../../Core/models'
import { NodeType } from '../../../Core/models'

export function envFlagEnabled(name: string): boolean {
    const v = process.env[name]
    return !!v && /^(1|true|yes|on)$/i.test(v)
}

export function hasUnsupportedNodesForParallel(nodes: WorkflowNodes[]): boolean {
    // Escape hatch: allow disabling hybrid parallel execution for looped graphs via env.
    // When NEBULAFLOW_DISABLE_HYBRID_PARALLEL is truthy, treat any workflow that
    // contains loop nodes as unsupported for the parallel scheduler so callers can
    // fall back to the sequential executor without changing APIs.
    if (envFlagEnabled('NEBULAFLOW_DISABLE_HYBRID_PARALLEL')) {
        return nodes.some(n => n.type === NodeType.LOOP_START || n.type === NodeType.LOOP_END)
    }
    return false
}

export function getInactiveNodes(edges: Edge[], startNodeId: string): Set<string> {
    const inactiveNodes = new Set<string>()
    const queue = [startNodeId]
    while (queue.length > 0) {
        const currentId = queue.shift()!
        inactiveNodes.add(currentId)
        for (const edge of edges) {
            if (edge.source === currentId && !inactiveNodes.has(edge.target)) {
                queue.push(edge.target)
            }
        }
    }
    return inactiveNodes
}
