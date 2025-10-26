import { useCallback, useState } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import type { GenericVSCodeWrapper } from '../../utils/vscode'
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
    const [executingNodeIds, setExecutingNodeIds] = useState<Set<string>>(new Set())
    const [interruptedNodeId, setInterruptedNodeId] = useState<string | null>(null)
    const [stoppedAtNodeId, setStoppedAtNodeId] = useState<string | null>(null)
    const [nodeResults, setNodeResults] = useState<Map<string, string>>(new Map())
    const [nodeAssistantContent, setNodeAssistantContent] = useState<Map<string, any[]>>(new Map())
    const [ifElseDecisions, setIfElseDecisions] = useState<Map<string, 'true' | 'false'>>(new Map())
    const [executionRunId, setExecutionRunId] = useState(0)

    const resetExecutionState = useCallback(() => {
        setNodes([])
        setEdges([])
        setIsExecuting(false)
        setNodeErrors(new Map())
        setExecutingNodeIds(new Set())
        setInterruptedNodeId(null)
        setStoppedAtNodeId(null)
        setAbortController(null)
        setNodeResults(new Map())
        setNodeAssistantContent(new Map())
        setIfElseDecisions(new Map())
    }, [setEdges, setNodes])

    const onExecute = useCallback(() => {
        const invalidNodes = nodes.filter(node => {
            const isLLM = node.type === NodeType.LLM
            const isCLI = node.type === NodeType.CLI
            const empty = !node.data.content || node.data.content.trim() === ''
            return (isLLM || isCLI) && empty
        })
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
        setNodeAssistantContent(new Map())
        setExecutionRunId(prev => prev + 1)
        const controller = new AbortController()
        setAbortController(controller)
        setIsExecuting(true)
        setInterruptedNodeId(null)
        setStoppedAtNodeId(null)
        vscodeAPI.postMessage({ type: 'execute_workflow', data: { nodes: updatedNodes, edges } } as any)
    }, [nodes, edges, setNodes, vscodeAPI])

    const onResume = useCallback(
        (fromNodeId: string, seedsOutputs: Record<string, string>) => {
            const controller = new AbortController()
            setAbortController(controller)
            setIsExecuting(true)
            setInterruptedNodeId(null)
            setStoppedAtNodeId(null)
            // Do not clear existing node results or nodes; we want to reuse them
            // Include If/Else decisions from previous execution in seeds to ensure branch consistency
            const seedsDecisions = Object.fromEntries(ifElseDecisions)
            // Also include variable seeds: map variableName -> last known value
            const seedsVariables: Record<string, string> = {}
            for (const n of nodes) {
                if (n.type === NodeType.VARIABLE) {
                    const varName = (n as any).data?.variableName as string | undefined
                    if (varName) {
                        const v = (seedsOutputs as any)[n.id] ?? undefined
                        // Prefer explicit node result if present; otherwise fall back to current state map if available later
                        if (typeof v === 'string') seedsVariables[varName] = v
                    }
                }
            }
            vscodeAPI.postMessage({
                type: 'execute_workflow',
                data: {
                    nodes,
                    edges,
                    resume: {
                        fromNodeId,
                        seeds: {
                            outputs: seedsOutputs,
                            decisions: seedsDecisions,
                            variables: seedsVariables,
                        },
                    },
                },
            } as any)
        },
        [nodes, edges, ifElseDecisions, vscodeAPI]
    )

    const onAbort = useCallback(() => {
        if (abortController) {
            abortController.abort()
            setAbortController(null)
        }
        setIsExecuting(false)
        vscodeAPI.postMessage({ type: 'abort_workflow' } as any)
    }, [abortController, vscodeAPI])

    return {
        isExecuting,
        executingNodeIds,
        nodeErrors,
        nodeResults,
        interruptedNodeId,
        stoppedAtNodeId,
        nodeAssistantContent,
        ifElseDecisions,
        executionRunId,
        onExecute,
        onResume,
        onAbort,
        resetExecutionState,
        setExecutingNodeIds,
        setIsExecuting,
        setInterruptedNodeId,
        setStoppedAtNodeId,
        setNodeResults,
        setNodeErrors,
        setNodeAssistantContent,
        setIfElseDecisions,
    }
}
