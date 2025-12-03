import type { Edge as FlowEdge } from '@graph/CustomOrderedEdge'
import { NodeType, type WorkflowNodes } from '@nodes/Nodes'
import { useMemo } from 'react'
import type { Edge as ProtocolEdge } from '../../../Core/models'
import { processGraphComposition } from '../../../WorkflowExecution/Core/engine/node-sorting'

function computeFanInPortCount(nodeId: string, edges: FlowEdge[]): number {
    const toNode = edges.filter(e => e.target === nodeId)
    if (toNode.length === 0) return 1

    let maxIdx = -1
    for (const e of toNode) {
        const m = (e as any).targetHandle?.match(/^in-(\d+)$/)
        if (m) {
            const idx = Number.parseInt(m[1], 10)
            if (!Number.isNaN(idx)) maxIdx = Math.max(maxIdx, idx)
        }
    }
    if (maxIdx >= 0) return maxIdx + 2
    return toNode.length + 1
}

function computeHandleEdgeMap(
    nodeId: string,
    edges: FlowEdge[],
    nodes: WorkflowNodes[]
): Record<string, string> {
    const nodeById = new Map(nodes.map(n => [n.id, n]))
    const map: Record<string, string> = {}
    for (const e of edges) {
        if (e.target !== nodeId) continue
        const h = (e as any).targetHandle as string | undefined
        if (!h) continue
        const order = (e as any).data?.orderNumber
        const src = nodeById.get(e.source)
        const title = (src as any)?.data?.title || (src as any)?.data?.content || ''
        const label =
            typeof order === 'number' ? `${order} - ${title || e.source}` : title || (e as any).id
        map[h] = label
    }
    return map
}

function computeLoopIterationOverride(
    nodeId: string,
    baseIterations: number,
    nodes: WorkflowNodes[],
    edges: FlowEdge[],
    nodeResults: Map<string, string>
): { active: true; effectiveIterations: number } | { active: false } {
    const overrideEdges = edges.filter(
        e => e.target === nodeId && (e as any).targetHandle === 'iterations-override'
    )

    if (overrideEdges.length === 0) return { active: false }

    const nodeById = new Map(nodes.map(node => [node.id, node]))

    const parseOverride = (raw: string | undefined): number | undefined => {
        const min = 1
        const max = 100

        const trimmed = raw?.trim() ?? ''
        if (!/^\d+$/.test(trimmed)) {
            return undefined
        }

        const parsed = Number.parseInt(trimmed, 10)
        if (Number.isNaN(parsed)) {
            return undefined
        }

        return Math.min(max, Math.max(min, parsed))
    }

    for (const edge of overrideEdges) {
        const sourceNode = nodeById.get(edge.source)

        const runtimeRaw = nodeResults.get(edge.source)
        const runtimeParsed = parseOverride(runtimeRaw)
        if (runtimeParsed !== undefined) {
            return { active: true, effectiveIterations: runtimeParsed }
        }

        if (sourceNode?.type === NodeType.INPUT) {
            const staticRaw = (sourceNode as any).data?.content as string | undefined
            const staticParsed = parseOverride(staticRaw)
            if (staticParsed !== undefined) {
                return { active: true, effectiveIterations: staticParsed }
            }
        }
    }

    return { active: false }
}

export const useNodeStateTransformation = (
    nodes: WorkflowNodes[],
    selectedNodes: WorkflowNodes[],
    movingNodeId: string | null,
    executingNodeIds: Set<string>,
    nodeErrors: Map<string, string>,
    nodeResults: Map<string, string>,
    interruptedNodeId: string | null,
    stoppedAtNodeId: string | null,
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
            const nodeIsExecuting = executingNodeIds.has(nodeId)
            const nodeIsInterrupted = nodeId === interruptedNodeId || nodeId === stoppedAtNodeId
            const nodeHasError = nodeErrors.has(nodeId)
            const nodeResult = nodeResults.get(nodeId)
            const nodeIsActive = !allInactiveNodes.has(nodeId) && node.data.active !== false
            const tokenCount =
                node.type === NodeType.PREVIEW
                    ? Number.parseInt(nodeResults.get(`${nodeId}_tokens`) || '0', 10)
                    : undefined

            const fanInEnabled = (node.data as any).fanInEnabled === true
            const inputPortCount = fanInEnabled ? computeFanInPortCount(nodeId, edges) : undefined
            const inputEdgeIdByHandle = fanInEnabled
                ? computeHandleEdgeMap(nodeId, edges, nodes)
                : undefined

            let extraLoopFields: Record<string, unknown> = {}

            if (node.type === NodeType.LOOP_START) {
                const baseIterations = ((node.data as any).iterations ?? 1) as number
                const overrideInfo = computeLoopIterationOverride(
                    nodeId,
                    baseIterations,
                    nodes,
                    edges,
                    nodeResults
                )

                if (overrideInfo.active) {
                    extraLoopFields = {
                        iterations: overrideInfo.effectiveIterations,
                        overrideIterations: true,
                    }
                } else {
                    extraLoopFields = {
                        overrideIterations: false,
                    }
                }
            }

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
                    ...(fanInEnabled ? { inputPortCount, inputEdgeIdByHandle } : {}),
                    ...extraLoopFields,
                },
            }
        })
    }, [
        nodes,
        selectedNodeIds,
        movingNodeId,
        executingNodeIds,
        nodeErrors,
        nodeResults,
        interruptedNodeId,
        stoppedAtNodeId,
        allInactiveNodes,
        edges,
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
    return processGraphComposition(nodes, sanitized, false, { mode: 'display' })
}
