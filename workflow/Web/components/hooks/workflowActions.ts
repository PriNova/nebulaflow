import { useCallback } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import type { GenericVSCodeWrapper } from '../../utils/vscode'
import type { Edge } from '../CustomOrderedEdge'
import { NodeType, type WorkflowNodes } from '../nodes/Nodes'

export const useWorkflowActions = (
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>,
    nodes: WorkflowNodes[],
    edges: Edge[],
    setPendingApprovalNodeId: React.Dispatch<React.SetStateAction<string | null>>,
    setNodeErrors: React.Dispatch<React.SetStateAction<Map<string, string>>>,
    setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>
) => {
    const onSave = useCallback(() => {
        const workflowData = { nodes, edges }
        vscodeAPI.postMessage({ type: 'save_workflow', data: workflowData } as any)
    }, [nodes, edges, vscodeAPI])

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
