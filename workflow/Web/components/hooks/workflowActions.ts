import type { Edge } from '@graph/CustomOrderedEdge'
import { NodeType, type WorkflowNodes } from '@nodes/Nodes'
import { useCallback } from 'react'
import type {
    ExtensionToWorkflow,
    WorkflowPayloadDTO,
    WorkflowToExtension,
} from '../../services/Protocol'
import { toWorkflowNodeDTO } from '../../utils/nodeDto'
import type { GenericVSCodeWrapper } from '../../utils/vscode'

export const useWorkflowActions = (
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>,
    nodes: WorkflowNodes[],
    edges: Edge[],
    setPendingApprovalNodeId: React.Dispatch<React.SetStateAction<string | null>>,
    setNodeErrors: React.Dispatch<React.SetStateAction<Map<string, string>>>,
    setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>,
    nodeResults: Map<string, string>,
    ifElseDecisions: Map<string, 'true' | 'false'>
) => {
    const onSave = useCallback(() => {
        const nodeIds = new Set(nodes.map(n => n.id))
        const hasNodes = nodeIds.size > 0
        const state =
            hasNodes && (nodeResults.size > 0 || ifElseDecisions.size > 0)
                ? {
                      nodeResults: Object.fromEntries(
                          Array.from(nodeResults.entries())
                              .filter(([nodeId]) => nodeIds.has(nodeId))
                              .map(([nodeId, output]) => [
                                  nodeId,
                                  { status: 'completed' as const, output },
                              ])
                      ),
                      ifElseDecisions:
                          ifElseDecisions.size > 0 ? Object.fromEntries(ifElseDecisions) : undefined,
                  }
                : undefined
        const workflowData: WorkflowPayloadDTO = {
            nodes: nodes.map(node => toWorkflowNodeDTO(node)),
            edges: edges.map(edge => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle ?? undefined,
                targetHandle: edge.targetHandle ?? undefined,
            })),
            state,
        }
        vscodeAPI.postMessage({ type: 'save_workflow', data: workflowData } as any)
    }, [nodes, edges, nodeResults, ifElseDecisions, vscodeAPI])

    const onLoad = useCallback(() => {
        vscodeAPI.postMessage({ type: 'load_workflow' } as any)
    }, [vscodeAPI])

    const calculatePreviewNodeTokens = useCallback(
        (nodes: WorkflowNodes[]) => {
            for (const node of nodes) {
                if (node.type === NodeType.PREVIEW && node.data.content) {
                    vscodeAPI.postMessage({
                        type: 'calculate_tokens',
                        data: { text: node.data.content, nodeId: node.id },
                    } as any)
                }
            }
        },
        [vscodeAPI]
    )

    const handleNodeApproval = (nodeId: string, approved: boolean, modifiedCommand?: string) => {
        if (approved) {
            setPendingApprovalNodeId(null)
            vscodeAPI.postMessage({ type: 'node_approved', data: { nodeId, modifiedCommand } } as any)
        } else {
            setPendingApprovalNodeId(null)
            vscodeAPI.postMessage({ type: 'node_rejected', data: { nodeId } } as any)
        }
    }
    return { onSave, onLoad, calculatePreviewNodeTokens, handleNodeApproval }
}
