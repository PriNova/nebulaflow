import type { Edge } from '@graph/CustomOrderedEdge'
import type { WorkflowNodes } from '@nodes/Nodes'

/**
 * Remove edges that reference missing nodes.
 */
export const pruneEdgesForMissingNodes = (eds: Edge[], nodeList: WorkflowNodes[]): Edge[] => {
    const nodeIds = new Set(nodeList.map(n => n.id))
    return eds.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
}
