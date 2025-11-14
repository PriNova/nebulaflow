import type { Edge } from '@graph/CustomOrderedEdge'
import { NodeType, type WorkflowNodes } from '@nodes/Nodes'
import { useCallback, useState } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import type { GenericVSCodeWrapper } from '../../utils/vscode'

export const useWorkflowExecution = (
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>,
    nodes: WorkflowNodes[],
    edges: Edge[],
    setNodes: (nodes: WorkflowNodes[]) => void,
    setEdges: (edges: Edge[]) => void,
    currentNodeResults?: Map<string, string>
) => {
    const [isExecuting, setIsExecuting] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [abortController, setAbortController] = useState<AbortController | null>(null)
    const [nodeErrors, setNodeErrors] = useState<Map<string, string>>(new Map())
    const [executingNodeIds, setExecutingNodeIds] = useState<Set<string>>(new Set())
    const [interruptedNodeId, setInterruptedNodeId] = useState<string | null>(null)
    const [stoppedAtNodeId, setStoppedAtNodeId] = useState<string | null>(null)
    const [nodeResults, setNodeResults] = useState<Map<string, string>>(new Map())
    const [nodeAssistantContent, setNodeAssistantContent] = useState<Map<string, any[]>>(new Map())
    const [ifElseDecisions, setIfElseDecisions] = useState<Map<string, 'true' | 'false'>>(new Map())
    const [executionRunId, setExecutionRunId] = useState(0)
    const [completedThisRun, setCompletedThisRun] = useState<Set<string>>(new Set())

    const resetExecutionState = useCallback(() => {
        setNodes([])
        setEdges([])
        setIsExecuting(false)
        setIsPaused(false)
        setNodeErrors(new Map())
        setExecutingNodeIds(new Set())
        setInterruptedNodeId(null)
        setStoppedAtNodeId(null)
        setAbortController(null)
        setNodeResults(new Map())
        setNodeAssistantContent(new Map())
        setIfElseDecisions(new Map())
        setCompletedThisRun(new Set())
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
        setNodeErrors(new Map())
        setNodeAssistantContent(new Map())
        setExecutionRunId(prev => prev + 1)
        const controller = new AbortController()
        setAbortController(controller)
        setIsExecuting(true)
        setIsPaused(false)
        setInterruptedNodeId(null)
        setStoppedAtNodeId(null)

        // Compute bypass seeds from current nodeResults before clearing
        const bypassSeedOutputs: Record<string, string> = {}
        if (currentNodeResults) {
            for (const n of nodes) {
                if ((n.data as any).bypass === true) {
                    bypassSeedOutputs[n.id] = currentNodeResults.get(n.id) ?? ''
                }
            }
        }

        // Clear results only after collecting bypass seeds
        setNodeResults(new Map())

        vscodeAPI.postMessage({
            type: 'execute_workflow',
            data: {
                nodes: updatedNodes,
                edges,
                resume:
                    Object.keys(bypassSeedOutputs).length > 0
                        ? { seeds: { outputs: bypassSeedOutputs } }
                        : undefined,
            },
        } as any)
    }, [nodes, edges, setNodes, vscodeAPI, currentNodeResults])

    const onResume = useCallback(
        (fromNodeId: string, seedsOutputs: Record<string, string>) => {
            const controller = new AbortController()
            setAbortController(controller)
            setIsExecuting(true)
            setIsPaused(false)
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

            // Merge bypass seeds with existing seeds
            const bypassSeedOutputs: Record<string, string> = {}
            if (currentNodeResults) {
                for (const n of nodes) {
                    if ((n.data as any).bypass === true) {
                        bypassSeedOutputs[n.id] = currentNodeResults.get(n.id) ?? ''
                    }
                }
            }
            const mergedOutputs = { ...seedsOutputs, ...bypassSeedOutputs }

            vscodeAPI.postMessage({
                type: 'execute_workflow',
                data: {
                    nodes,
                    edges,
                    resume: {
                        fromNodeId,
                        seeds: {
                            outputs: mergedOutputs,
                            decisions: seedsDecisions,
                            variables: seedsVariables,
                        },
                    },
                },
            } as any)
        },
        [nodes, edges, ifElseDecisions, vscodeAPI, currentNodeResults]
    )

    const onAbort = useCallback(() => {
        if (abortController) {
            abortController.abort()
            setAbortController(null)
        }
        setIsExecuting(false)
        setIsPaused(false)
        vscodeAPI.postMessage({ type: 'abort_workflow' } as any)
    }, [abortController, vscodeAPI])

    const onPauseToggle = useCallback(() => {
        if (!isPaused) {
            // Request pause
            vscodeAPI.postMessage({ type: 'pause_workflow' } as any)
            setIsPaused(true)
        } else {
            // Resume from pause: seed only nodes that completed in THIS run + bypass seeds
            const outputs: Record<string, string> = {}
            if (currentNodeResults) {
                for (const nodeId of completedThisRun) {
                    const v = currentNodeResults.get(nodeId)
                    if (typeof v === 'string') outputs[nodeId] = v
                }
            }
            // Merge bypass seeds so bypass frontiers have cached outputs immediately
            const bypassSeedOutputs: Record<string, string> = {}
            if (currentNodeResults) {
                for (const n of nodes) {
                    if ((n as any).data?.bypass === true) {
                        bypassSeedOutputs[n.id] = currentNodeResults.get(n.id) ?? ''
                    }
                }
            }
            const mergedOutputs = { ...outputs, ...bypassSeedOutputs }

            const decisions = Object.fromEntries(ifElseDecisions)
            const variables: Record<string, string> = {}
            for (const n of nodes) {
                if (n.type === NodeType.VARIABLE) {
                    const varName = (n as any).data?.variableName as string | undefined
                    if (varName && currentNodeResults) {
                        const v = currentNodeResults.get(n.id)
                        if (typeof v === 'string') variables[varName] = v
                    }
                }
            }
            setIsPaused(false)
            setIsExecuting(true)
            // Create a new AbortController for the resumed execution
            const newController = new AbortController()
            setAbortController(newController)
            vscodeAPI.postMessage({
                type: 'execute_workflow',
                data: {
                    nodes,
                    edges,
                    resume: { seeds: { outputs: mergedOutputs, decisions, variables } },
                },
            } as any)
        }
    }, [isPaused, currentNodeResults, ifElseDecisions, nodes, edges, vscodeAPI, completedThisRun])

    return {
        isExecuting,
        isPaused,
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
        onPauseToggle,
        resetExecutionState,
        setExecutingNodeIds,
        setIsExecuting,
        setIsPaused,
        setInterruptedNodeId,
        setStoppedAtNodeId,
        setNodeResults,
        setNodeErrors,
        setNodeAssistantContent,
        setIfElseDecisions,
        setCompletedThisRun,
    }
}
