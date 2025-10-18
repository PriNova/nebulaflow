import type { Connection } from '@xyflow/react'
import type { Edge } from '../CustomOrderedEdge'

export const isValidEdgeConnection = (connection: Connection, existingEdges: Edge[]): boolean => {
    if (connection.source === connection.target) return false
    return !existingEdges.some(
        edge =>
            edge.source === connection.source &&
            edge.target === connection.target &&
            edge.sourceHandle === (connection.sourceHandle ?? null) &&
            edge.targetHandle === (connection.targetHandle ?? null)
    )
}
