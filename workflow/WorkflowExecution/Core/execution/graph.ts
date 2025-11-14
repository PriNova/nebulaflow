import { type Edge, NodeType, type WorkflowNodes } from '../../../Core/models'

export function envFlagEnabled(name: string): boolean {
    const v = process.env[name]
    return !!v && /^(1|true|yes|on)$/i.test(v)
}

export function hasUnsupportedNodesForParallel(nodes: WorkflowNodes[]): boolean {
    return nodes.some(
        n =>
            n.type === NodeType.IF_ELSE || n.type === NodeType.LOOP_START || n.type === NodeType.LOOP_END
    )
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
