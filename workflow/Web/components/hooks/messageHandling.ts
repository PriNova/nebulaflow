import { useCallback, useEffect } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import type { GenericVSCodeWrapper } from '../../utils/vscode'
import type { Edge } from '../CustomOrderedEdge'
import { NodeType, type WorkflowNodes } from '../nodes/Nodes'

export const useMessageHandler = (
    nodes: WorkflowNodes[],
    setNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>,
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
    setNodeErrors: React.Dispatch<React.SetStateAction<Map<string, string>>>,
    setNodeResults: React.Dispatch<React.SetStateAction<Map<string, string>>>,
    setInterruptedNodeId: React.Dispatch<React.SetStateAction<string | null>>,
    setExecutingNodeId: React.Dispatch<React.SetStateAction<string | null>>,
    setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>,
    onNodeUpdate: (nodeId: string, data: Partial<WorkflowNodes['data']>) => void,
    calculatePreviewNodeTokens: (nodes: WorkflowNodes[]) => void,
    setPendingApprovalNodeId: React.Dispatch<React.SetStateAction<string | null>>,
    setModels: React.Dispatch<React.SetStateAction<{ id: string; title?: string }[]>>,
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>,
    setCustomNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>,
    notify: (p: { type: 'success' | 'error'; text: string }) => void
) => {
    const batchUpdateNodeResults = useCallback(
        (updates: Map<string, string>) => {
            setNodeResults(prev => new Map([...prev, ...updates]))
        },
        [setNodeResults]
    )

    useEffect(() => {
        vscodeAPI.postMessage({ type: 'get_models' } as any)
    }, [vscodeAPI])

    useEffect(() => {
        const messageHandler = (event: MessageEvent<ExtensionToWorkflow>) => {
            switch (event.data.type) {
                case 'workflow_loaded': {
                    const { nodes, edges } = event.data.data
                    if (nodes && edges) {
                        calculatePreviewNodeTokens(nodes as any)
                        setNodes(nodes as any)
                        setEdges(edges as any)
                        setNodeErrors(new Map())
                    }
                    break
                }
                case 'workflow_saved': {
                    notify({ type: 'success', text: `Saved: ${event.data.data?.path ?? ''}` })
                    break
                }
                case 'workflow_save_failed': {
                    notify({ type: 'error', text: event.data.data?.error ?? 'Save failed' })
                    break
                }
                case 'node_execution_status': {
                    const { nodeId, status, result } = event.data.data as any
                    if (nodeId && status) {
                        if (status === 'interrupted') {
                            setInterruptedNodeId(nodeId)
                        }
                        if (status === 'pending_approval') {
                            setPendingApprovalNodeId(nodeId)
                        } else if (status === 'running') {
                            setExecutingNodeId(nodeId)
                            setNodeErrors(prev => {
                                const updated = new Map(prev)
                                updated.delete(nodeId)
                                return updated
                            })
                        } else if (status === 'error') {
                            setExecutingNodeId(null)
                            setNodeErrors(prev => new Map(prev).set(nodeId, result ?? ''))
                        } else if (status === 'completed') {
                            setExecutingNodeId(null)
                            const node = nodes.find(n => n.id === nodeId)
                            if (node?.type === NodeType.PREVIEW) {
                                onNodeUpdate(node.id, { content: result as any })
                            }
                        } else {
                            setExecutingNodeId(null)
                        }
                        setNodeResults(prev => new Map(prev).set(nodeId, result ?? ''))
                    }
                    break
                }
                case 'execution_started':
                    setIsExecuting(true)
                    break
                case 'execution_completed':
                    setIsExecuting(false)
                    break
                case 'token_count': {
                    const { count, nodeId } = event.data.data as any
                    const updates = new Map([[`${nodeId}_tokens`, String(count)]])
                    batchUpdateNodeResults(updates)
                    break
                }
                case 'models_loaded': {
                    const models = event.data.data as any
                    if (models) {
                        setModels(models)
                    }
                    break
                }
                case 'provide_custom_nodes': {
                    const customNodes = event.data.data as any
                    if (customNodes) {
                        setCustomNodes(customNodes as any)
                    }
                    break
                }
            }
        }
        const off = vscodeAPI.onMessage(messageHandler as any)
        return () => off()
    }, [
        nodes,
        onNodeUpdate,
        setEdges,
        setExecutingNodeId,
        setInterruptedNodeId,
        setIsExecuting,
        setNodeErrors,
        setNodeResults,
        setNodes,
        calculatePreviewNodeTokens,
        setPendingApprovalNodeId,
        batchUpdateNodeResults,
        setModels,
        setCustomNodes,
        vscodeAPI,
        notify,
    ])
}
