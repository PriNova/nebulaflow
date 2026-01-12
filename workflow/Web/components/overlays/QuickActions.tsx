import type { Edge } from '@graph/CustomOrderedEdge'
import { NodeType, type WorkflowNodes } from '@nodes/Nodes'
import type React from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '../../ui/shadcn/ui/button'
import { toWorkflowNodeDTO } from '../../utils/nodeDto'

interface QuickActionsProps {
    selectedNodes: WorkflowNodes[]
    nodes: WorkflowNodes[]
    edges: Edge[]
    computeDisabledOutputHandles: (
        dtoNodes: Array<{ id: string; type: string; data?: any }>,
        dtoEdges: Array<{ source: string; target: string }>
    ) => Set<string>
    setNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
    setSelectedNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>
}

/**
 * Quick actions overlay for multi-node selection.
 * Currently provides "Create Subflow from Selection" functionality.
 */
export const QuickActions: React.FC<QuickActionsProps> = ({
    selectedNodes,
    nodes,
    edges,
    computeDisabledOutputHandles,
    setNodes,
    setEdges,
    setSelectedNodes,
}) => {
    if (selectedNodes.length <= 1) return null

    const handleCreateSubflow = () => {
        // Create subflow from current selection
        const selectedIds = new Set(selectedNodes.map(n => n.id))
        const incoming = edges.filter(e => !selectedIds.has(e.source) && selectedIds.has(e.target))
        const outgoing = edges.filter(e => selectedIds.has(e.source) && !selectedIds.has(e.target))

        // Inputs mapping (multi-input): one input per unique external source feeding the selection
        const groupedBySource = new Map<string, typeof incoming>()
        for (const e of incoming) {
            const arr = groupedBySource.get(e.source) || []
            arr.push(e)
            groupedBySource.set(e.source, arr)
        }
        const inputSourcesWithPos = Array.from(groupedBySource.keys())
            .map(sourceId => ({
                sourceId,
                node: nodes.find(n => n.id === sourceId),
                targets: Array.from(new Set((groupedBySource.get(sourceId) || []).map(ed => ed.target))),
            }))
            .sort(
                (a, b) =>
                    (a.node?.position.x ?? 0) - (b.node?.position.x ?? 0) ||
                    (a.node?.position.y ?? 0) - (b.node?.position.y ?? 0) ||
                    a.sourceId.localeCompare(b.sourceId)
            )
        const inputs = inputSourcesWithPos.map((s, idx) => ({
            id: `in-${idx}`,
            name: s.node?.data?.title ? String(s.node.data.title) : `Input ${idx + 1}`,
            index: idx,
            sourceId: s.sourceId,
            targets: s.targets,
        }))

        // Build inner graph nodes (clone)
        const innerNodes = selectedNodes.map(n => ({ ...n })) as any
        const innerEdges = edges
            .filter(e => selectedIds.has(e.source) && selectedIds.has(e.target))
            .map(e => ({ ...e })) as any

        // Replace incoming edges by SubflowInput nodes (fan-out to all targets for that source)
        for (const inp of inputs) {
            const inputNodeId = `sfi-${uuidv4()}`
            innerNodes.push({
                id: inputNodeId,
                type: NodeType.SUBFLOW_INPUT,
                data: {
                    title: inp.name,
                    content: '',
                    active: true,
                    portId: inp.id,
                },
                position: { x: 0, y: 0 },
            } as any)

            // Check if the external source is a Variable or Accumulator Node (preserve variable semantics)
            const sourceNode = nodes.find(n => n.id === inp.sourceId)
            const isVarOrAccum =
                sourceNode?.type === NodeType.VARIABLE || sourceNode?.type === NodeType.ACCUMULATOR

            if (isVarOrAccum && sourceNode) {
                // Create a Variable/Accumulator node inside the subflow to preserve variable semantics
                const varNodeId = `var-${uuidv4()}`
                // Copy source node data (includes variableName, initialValue, etc.)
                const varNodeData = { ...sourceNode.data, active: true }
                innerNodes.push({
                    id: varNodeId,
                    type: sourceNode.type,
                    data: varNodeData,
                    position: { x: 0, y: 0 },
                } as any)
                // Connect SUBFLOW_INPUT to Variable/Accumulator node
                innerEdges.push({
                    id: uuidv4(),
                    source: inputNodeId,
                    target: varNodeId,
                } as any)
                // Connect Variable/Accumulator node to all targets
                for (const targetNodeId of inp.targets) {
                    innerEdges.push({
                        id: uuidv4(),
                        source: varNodeId,
                        target: targetNodeId,
                    } as any)
                }
            } else {
                // Default behavior: connect SUBFLOW_INPUT directly to targets
                for (const targetNodeId of inp.targets) {
                    innerEdges.push({
                        id: uuidv4(),
                        source: inputNodeId,
                        target: targetNodeId,
                    } as any)
                }
            }
        }

        // Outputs mapping (multi-output): one output per unique inner source with exit edges
        const uniqueSourceIds = Array.from(new Set(outgoing.map(e => e.source)))
        const sourcesWithPos = uniqueSourceIds
            .map(id => ({
                id,
                node: selectedNodes.find(n => n.id === id),
            }))
            .sort(
                (a, b) =>
                    (a.node?.position.x ?? 0) - (b.node?.position.x ?? 0) ||
                    (a.node?.position.y ?? 0) - (b.node?.position.y ?? 0) ||
                    a.id.localeCompare(b.id)
            )
        const outputDefs: Array<{
            id: string
            name: string
            index: number
        }> = []
        const sourceIndexById = new Map<string, number>()
        if (sourcesWithPos.length === 0) {
            // Fallback: single output from a representative inner source
            let repSource: string | null = null
            if (outgoing.length > 0) repSource = outgoing[0].source
            if (!repSource) {
                const selIds = new Set(selectedNodes.map(n => n.id))
                const hasOut = new Set(
                    edges.filter(e => selIds.has(e.source) && selIds.has(e.target)).map(e => e.source)
                )
                const candidate = selectedNodes.find(n => !hasOut.has(n.id))
                repSource = candidate?.id || selectedNodes[0].id
            }
            const sfoId = `sfo-${uuidv4()}`
            innerNodes.push({
                id: sfoId,
                type: NodeType.SUBFLOW_OUTPUT,
                data: {
                    title: 'Output 1',
                    content: '',
                    active: true,
                    portId: 'out-0',
                },
                position: { x: 0, y: 100 },
            } as any)
            if (repSource) {
                innerEdges.push({
                    id: `${repSource}-${sfoId}`,
                    source: repSource,
                    target: sfoId,
                } as any)
                sourceIndexById.set(repSource, 0)
            }
            outputDefs.push({ id: 'out-0', name: 'Output 1', index: 0 })
        } else {
            sourcesWithPos.forEach((s, idx) => {
                const outId = `out-${idx}`
                // Base title from inner source node
                let title = s.node?.data?.title ? String(s.node.data.title) : `Output ${idx + 1}`
                // If exactly one downstream target outside selection, prefer its title
                const outsFromSource = outgoing.filter(e => e.source === s.id).map(e => e.target)
                const uniqueTargets = Array.from(new Set(outsFromSource))
                if (uniqueTargets.length === 1) {
                    const dn = nodes.find(n => n.id === uniqueTargets[0])
                    const dnTitle = dn?.data?.title ? String(dn.data.title) : ''
                    if (dnTitle.trim().length > 0) title = dnTitle
                }
                const sfoId = `sfo-${uuidv4()}`
                innerNodes.push({
                    id: sfoId,
                    type: NodeType.SUBFLOW_OUTPUT,
                    data: {
                        title,
                        content: '',
                        active: true,
                        portId: outId,
                    },
                    position: {
                        x: s.node?.position.x ?? idx * 200,
                        y: (s.node?.position.y ?? 100) + 120,
                    },
                } as any)
                innerEdges.push({
                    id: `${s.id}-${sfoId}`,
                    source: s.id,
                    target: sfoId,
                } as any)
                outputDefs.push({ id: outId, name: title, index: idx })
                sourceIndexById.set(s.id, idx)
            })
        }

        const innerNodeDTOs = (innerNodes as any[]).map(n => toWorkflowNodeDTO(n))
        const innerEdgeDTOs = (innerEdges as any[]).map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: (e as any).sourceHandle,
            targetHandle: (e as any).targetHandle,
        }))

        // Determine disabled outputs from current inner graph
        const disabledOutHandles = Array.from(
            computeDisabledOutputHandles(innerNodeDTOs as any, innerEdgeDTOs as any)
        )

        // Build pending (unsaved) subflow payload
        const pending = {
            inputs: inputs.map(({ id, name }, idx) => ({
                id,
                name,
                index: idx,
            })),
            outputs: outputDefs.length > 0 ? outputDefs : [{ id: 'out-0', name: 'Output', index: 0 }],
            graph: { nodes: innerNodeDTOs, edges: innerEdgeDTOs },
        }

        // Replace selection with wrapper node and rewire edges
        const center = {
            x: selectedNodes.reduce((a, n) => a + n.position.x, 0) / selectedNodes.length,
            y: selectedNodes.reduce((a, n) => a + n.position.y, 0) / selectedNodes.length,
        }
        const wrapperId = uuidv4()
        const wrapper = {
            id: wrapperId,
            type: NodeType.SUBFLOW,
            data: {
                title: 'Subflow',
                content: '',
                active: true,
                // subflowId is undefined until saved
                inputPortCount: inputs.length,
                outputPortCount: pending.outputs.length || 1,
                pendingSubflow: pending,
                disabledOutputHandles: disabledOutHandles,
            },
            position: center,
        } as any

        const removedIds = new Set(selectedNodes.map(n => n.id))
        const nextNodes = nodes.filter(n => !removedIds.has(n.id))
        nextNodes.push(wrapper)

        // Remove internal edges and cross-boundary edges
        const internalEdgeIds = new Set(
            edges.filter(e => removedIds.has(e.source) && removedIds.has(e.target)).map(e => e.id)
        )
        const incomingEdges = edges.filter(e => !removedIds.has(e.source) && removedIds.has(e.target))
        const outgoingEdges = edges.filter(e => removedIds.has(e.source) && !removedIds.has(e.target))
        const nextEdges = edges.filter(
            e => !internalEdgeIds.has(e.id) && !incomingEdges.includes(e) && !outgoingEdges.includes(e)
        )

        // Rewire incoming -> wrapper
        for (let idx = 0; idx < inputs.length; idx++) {
            const inp = inputs[idx]
            nextEdges.push({
                id: uuidv4(),
                source: inp.sourceId,
                target: wrapperId,
                targetHandle: `in-${idx}`,
            } as any)
        }
        // Rewire outgoing from wrapper with per-source handle
        outgoingEdges.forEach((e, idx) => {
            const outIdx = sourceIndexById.get(e.source) ?? 0
            nextEdges.push({
                id: uuidv4(),
                source: wrapperId,
                target: e.target,
                sourceHandle: `out-${outIdx}`,
            } as any)
        })
        setNodes(nextNodes)
        setEdges(nextEdges)
        setSelectedNodes([wrapper as any])
    }

    return (
        <div className="tw-absolute tw-top-4 tw-left-4 tw-z-50">
            <Button variant="outline" size="sm" onClick={handleCreateSubflow}>
                Create Subflow from Selection
            </Button>
        </div>
    )
}
