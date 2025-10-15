import { useCallback, useState } from 'react'
import type { GenericVSCodeWrapper } from '../../../webview/utils/vscode'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import type { Edge } from '../CustomOrderedEdge'
import { NodeType, type WorkflowNodes } from '../nodes/Nodes'

export const useWorkflowExecution = (
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>,
    nodes: WorkflowNodes[],
    edges: Edge[],
    setNodes: (nodes: WorkflowNodes[]) => void,
    setEdges: (edges: Edge[]) => void
) => {
    const [isExecuting, setIsExecuting] = useState(false)
    const [abortController, setAbortController] = useState<AbortController | null>(null)
    const [nodeErrors, setNodeErrors] = useState<Map<string, string>>(new Map())
    const [executingNodeId, setExecutingNodeId] = useState<string | null>(null)
    const [interruptedNodeId, setInterruptedNodeId] = useState<string | null>(null)
    const [nodeResults, setNodeResults] = useState<Map<string, string>>(new Map())

    const resetExecutionState = useCallback(() => {
        setNodes([])
        setEdges([])
        setIsExecuting(false)
        setNodeErrors(new Map())
        setExecutingNodeId(null)
        setInterruptedNodeId(null)
        setAbortController(null)
        setNodeResults(new Map())
    }, [setEdges, setNodes])

    const onExecute = useCallback(() => {
        const invalidNodes = nodes.filter(
            node => node.type === NodeType.LLM && (!node.data.content || node.data.content.trim() === '')
        )
        if (invalidNodes.length > 0) {
            const newErrors = new Map<string, string>()
            for (const node of invalidNodes) {
                newErrors.set(
                    node.id,
                    node.type === NodeType.CLI ? 'Command field is required' : 'Prompt field is required'
                )
            }
            setNodeErrors(newErrors)
            return
        }
        const updatedNodes = nodes.map(node =>
            node.type === NodeType.PREVIEW
                ? { ...node, data: { ...node.data, content: '', tokenCount: 0 } }
                : node
        )
        setNodes(updatedNodes)
        setNodeResults(new Map())
        setNodeErrors(new Map())
        const controller = new AbortController()
        setAbortController(controller)
        setIsExecuting(true)
        setInterruptedNodeId(null)
        vscodeAPI.postMessage({ type: 'execute_workflow', data: { nodes: updatedNodes, edges } } as any)
    }, [nodes, edges, setNodes, vscodeAPI])

    const onAbort = useCallback(() => {
        if (abortController) {
            abortController.abort()
            setAbortController(null)
            setIsExecuting(false)
            vscodeAPI.postMessage({ type: 'abort_workflow' } as any)
        }
    }, [abortController, vscodeAPI])

    return {
        isExecuting,
        executingNodeId,
        nodeErrors,
        nodeResults,
        interruptedNodeId,
        onExecute,
        onAbort,
        resetExecutionState,
        setExecutingNodeId,
        setIsExecuting,
        setInterruptedNodeId,
        setNodeResults,
        setNodeErrors,
    }
}
