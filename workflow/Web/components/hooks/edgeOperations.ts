import type { Edge } from '@graph/CustomOrderedEdge'
import { isValidEdgeConnection } from '@graph/utils/edgeValidation'
import type { WorkflowNodes } from '@nodes/Nodes'
import { type Connection, type EdgeChange, addEdge, applyEdgeChanges } from '@xyflow/react'
import type React from 'react'
import { useCallback, useMemo } from 'react'

interface IndexedOrder {
    bySourceTarget: Map<string, number>
    byTarget: Map<string, Edge[]>
}

export const useEdgeOperations = (
    edges: Edge[],
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
    nodes: WorkflowNodes[]
) => {
    const onEdgesDelete = useCallback(
        (deletedEdges: Edge[]) => {
            setEdges(prevEdges =>
                prevEdges.filter(edge => !deletedEdges.some(deleted => deleted.id === edge.id))
            )
        },
        [setEdges]
    )

    const edgeIndex = useMemo((): IndexedOrder => {
        const bySourceTarget = new Map<string, number>()
        const byTarget = new Map<string, Edge[]>()
        if (!edges) return { bySourceTarget, byTarget }
        for (const edge of edges) {
            const targetEdges = byTarget.get(edge.target) || []
            targetEdges.push(edge)
            byTarget.set(edge.target, targetEdges)
        }
        for (const [targetId, targetEdges] of byTarget) {
            targetEdges.forEach((edge, index) => {
                bySourceTarget.set(`${edge.source}-${targetId}`, index + 1)
            })
        }
        return { bySourceTarget, byTarget }
    }, [edges])

    const edgesWithOrder = useMemo(
        () =>
            edges.map(edge => ({
                ...edge,
                type: 'ordered-edge',
                data: {
                    ...edge.data,
                    orderNumber: edgeIndex.bySourceTarget.get(`${edge.source}-${edge.target}`) || 0,
                },
            })),
        [edges, edgeIndex]
    )

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdges(edges => [...applyEdgeChanges(changes, edges)])
        },
        [setEdges]
    )

    const onConnect = useCallback(
        (params: Connection) => {
            setEdges(eds => {
                if (!isValidEdgeConnection(params, eds, nodes)) return eds
                return [...addEdge({ ...params, data: { edgeStyle: 'bezier' } } as Edge, eds)]
            })
        },
        [setEdges, nodes]
    )

    return { onEdgesChange, onConnect, onEdgesDelete, orderedEdges: edgesWithOrder }
}
