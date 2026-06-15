import type { Edge } from '@graph/CustomOrderedEdge'
import { NodeType, type WorkflowNodes } from '@nodes/Nodes'
import { useEffect } from 'react'
import type { VariableNode } from '../nodes/Variable_Node'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import { toWorkflowNodeDTO } from '../../utils/nodeDto'
import type { GenericVSCodeWrapper } from '../../utils/vscode'

interface RunOnlyThisDetail {
    nodeId?: string
}

/**
 * Hook to handle run-only-this events from the node UI.
 */
export const useRunOnlyThis = (
    edges: Edge[],
    nodeResults: Map<string, string>,
    nodes: WorkflowNodes[],
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>,
    isPaused: boolean
) => {
    useEffect(() => {
        const handler = (e: Event) => {
            const detail: RunOnlyThisDetail | undefined = (
                e as CustomEvent<RunOnlyThisDetail>
            ).detail
            const nodeId = detail?.nodeId
            if (!nodeId) return
            if (isPaused) return
            // Build ordered inputs from immediate parents using edge order
            const incoming = edges.filter(e => e.target === nodeId)
            const sorted = [...incoming].sort(
                (a, b) => (a.data?.orderNumber ?? 0) - (b.data?.orderNumber ?? 0)
            )
            const inputs: string[] = []
            for (const edge of sorted) {
                const val = nodeResults.get(edge.source)
                if (typeof val === 'string') inputs.push(val)
            }
            // Derive variables from VARIABLE nodes and current nodeResults
            const variables: Record<string, string> = {}
            for (const n of nodes) {
                if (n.type === NodeType.VARIABLE) {
                    const varNode = n as VariableNode
                    const varName = varNode.data.variableName
                    if (varName) {
                        const v = nodeResults.get(n.id)
                        if (typeof v === 'string') variables[varName] = v
                    }
                }
            }
            const node = nodes.find(n => n.id === nodeId)
            if (!node) return
            // Post single-node execution request
            vscodeAPI.postMessage({
                type: 'execute_node',
                data: { node: toWorkflowNodeDTO(node), inputs, variables },
            })
        }
        window.addEventListener('nebula-run-only-this', handler)
        return () => window.removeEventListener('nebula-run-only-this', handler)
    }, [edges, nodeResults, nodes, vscodeAPI, isPaused])
}
