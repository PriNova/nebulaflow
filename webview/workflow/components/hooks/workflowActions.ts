import { useCallback } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/WorkflowProtocol'
import type { Edge } from '../../workflow/components/CustomOrderedEdge'
import { NodeType, type WorkflowNodes } from '../nodes/Nodes'
import type { GenericVSCodeWrapper } from '../../../utils/vscode'

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

    const onLoad = useCallback(() => { vscodeAPI.postMessage({ type: 'load_workflow' } as any) }, [vscodeAPI])

    const calculatePreviewNodeTokens = useCallback((nodes: WorkflowNodes[]) => {
        for (const node of nodes) {
            if (node.type === NodeType.PREVIEW && node.data.content) {
                vscodeAPI.postMessage({ type: 'calculate_tokens', data: { text: node.data.content, nodeId: node.id } } as any)
            }
        }
    }, [vscodeAPI])

    const handleNodeApproval = (nodeId: string, approved: boolean, modifiedCommand?: string) => {
        if (approved) {
            setPendingApprovalNodeId(null)
            vscodeAPI.postMessage({ type: 'node_approved', data: { nodeId, modifiedCommand } } as any)
        } else {
            setPendingApprovalNodeId(null)
            setNodeErrors(prev => new Map(prev).set(nodeId, 'Command execution rejected by user'))
            setIsExecuting(false)
        }
    }
    return { onSave, onLoad, calculatePreviewNodeTokens, handleNodeApproval }
}
