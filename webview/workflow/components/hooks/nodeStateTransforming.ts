import { useMemo } from 'react'
import { processGraphComposition } from '../../../../src/engine/node-sorting'
import type { Edge as ProtocolEdge } from '../../../../src/protocol/WorkflowProtocol'
import type { Edge as FlowEdge } from '../CustomOrderedEdge'
import { NodeType, type WorkflowNodes } from '../nodes/Nodes'

export const useNodeStateTransformation = (
    nodes: WorkflowNodes[],
    selectedNodes: WorkflowNodes[],
    movingNodeId: string | null,
    executingNodeId: string | null,
    nodeErrors: Map<string, string>,
    nodeResults: Map<string, string>,
    interruptedNodeId: string | null,
    edges: FlowEdge[]
): WorkflowNodes[] => {
    const selectedNodeIds = useMemo(() => new Set(selectedNodes.map(node => node.id)), [selectedNodes])

    const allInactiveNodes = useMemo(() => {
        const inactiveSet = new Set<string>()
        const hasInactiveNodes = nodes.some(node => node.data.active === false)
        if (hasInactiveNodes) {
            for (const node of nodes) {
                if (node.data.active === false) {
                    const dependentInactiveNodes = getInactiveNodes(edges, node.id)
                    for (const id of dependentInactiveNodes) {
                        inactiveSet.add(id)
                    }
                }
            }
        }
        return inactiveSet
    }, [nodes, edges])

    return useMemo(() => {
        return nodes.map(node => {
            const nodeId = node.id
            const nodeIsSelected = selectedNodeIds.has(nodeId)
            const nodeIsMoving = nodeId === movingNodeId
            const nodeIsExecuting = nodeId === executingNodeId
            const nodeIsInterrupted = nodeId === interruptedNodeId
            const nodeHasError = nodeErrors.has(nodeId)
            const nodeResult = nodeResults.get(nodeId)
            const nodeIsActive = !allInactiveNodes.has(nodeId) && node.data.active !== false
            const tokenCount =
                node.type === NodeType.PREVIEW
                    ? Number.parseInt(nodeResults.get(`${nodeId}_tokens`) || '0', 10)
                    : undefined

            return {
                ...node,
                selected: nodeIsSelected,
                data: {
                    ...node.data,
                    moving: nodeIsMoving,
                    executing: nodeIsExecuting,
                    interrupted: nodeIsInterrupted,
                    error: nodeHasError,
                    result: nodeResult,
                    active: nodeIsActive,
                    tokenCount,
                },
            }
        })
    }, [
        nodes,
        selectedNodeIds,
        movingNodeId,
        executingNodeId,
        nodeErrors,
        nodeResults,
        interruptedNodeId,
        allInactiveNodes,
    ])
}

export function getInactiveNodes(edges: FlowEdge[], startNodeId: string): Set<string> {
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

export const memoizedTopologicalSort = (nodes: WorkflowNodes[], edges: FlowEdge[]) => {
    const sanitized: ProtocolEdge[] = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: (e as any).sourceHandle ?? undefined,
        targetHandle: (e as any).targetHandle ?? undefined,
    }))
    return processGraphComposition(nodes, sanitized, false)
}
