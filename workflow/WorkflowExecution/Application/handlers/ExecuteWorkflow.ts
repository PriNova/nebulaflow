import * as vscode from 'vscode'
import { NodeType, PausedError } from '../../../Core/models'
import type { ApprovalResult, Edge, ExtensionToWorkflow, WorkflowNodes } from '../../../Core/models'
import { safePost } from '../../../Shared/Infrastructure/messaging/safePost'
import { type ParallelCallbacks, executeWorkflowParallel } from '../../Core/engine/parallel-scheduler'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { replaceIndexedInputs } from '../../Core/execution/inputs'
import { executeCLINode } from '../node-runners/run-cli'
import { executeIfElseNode } from '../node-runners/run-if-else'
import { executeInputNode } from '../node-runners/run-input'
import { executeLLMNode } from '../node-runners/run-llm'
import { executePreviewNode } from '../node-runners/run-preview'
import { runSubflowWrapper } from '../subflow/run-subflow'
import { routeNodeExecution } from './NodeDispatch'

const DEFAULT_LLM_TIMEOUT_MS = 300_000

// Panel-scoped subflow cache is provided by the caller and passed through to subflow execution.

interface IndexedEdges {
    bySource: Map<string, Edge[]>
    byTarget: Map<string, Edge[]>
    byId: Map<string, Edge>
}

export interface IndexedExecutionContext {
    nodeOutputs: Map<string, string | string[]>
    nodeIndex: Map<string, WorkflowNodes>
    edgeIndex: IndexedEdges
    loopStates: Map<string, { currentIteration: number; maxIterations: number; variable: string }>
    accumulatorValues?: Map<string, string>
    cliMetadata?: Map<string, { exitCode: string }>
    variableValues?: Map<string, string>
    ifelseSkipPaths?: Map<string, Set<string>>
}

// Parallel is default now; keep helpers for potential future gating.

export async function executeWorkflow(
    nodes: WorkflowNodes[],
    edges: Edge[],
    webview: vscode.Webview,
    abortSignal: AbortSignal,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>,
    resume?: { fromNodeId: string; seeds?: { outputs?: Record<string, string> } },
    pauseRef?: { isPaused: () => boolean },
    subflowCache?: Map<string, Record<string, string>>
): Promise<void> {
    // Early guard: invalid resume target
    if (resume?.fromNodeId && !nodes.some(n => n.id === resume.fromNodeId)) {
        void vscode.window.showErrorMessage(`Resume failed: node ${resume.fromNodeId} not found`)
        await safePost(webview, { type: 'execution_completed' } as ExtensionToWorkflow)
        return
    }

    // Parallel scheduler path (default for all runs)
    let lastExecutedNodeId: string | null = null
    let interruptedNodeId: string | null = null
    let paused = false
    await safePost(webview, { type: 'execution_started' } as ExtensionToWorkflow)
    try {
        const callbacks: ParallelCallbacks = {
            runNode: async (node, pctx, signal) => {
                const ctx = pctx as unknown as IndexedExecutionContext
                return await routeNodeExecution(node, 'workflow', {
                    runCLI: (..._args: any[]) =>
                        executeCLINode(node, signal, webview, approvalHandler, ctx),
                    runLLM: (..._args: any[]) =>
                        executeLLMNode(node, ctx, signal, webview, approvalHandler),
                    runPreview: (..._args: any[]) => executePreviewNode(node.id, webview, ctx),
                    runInput: (..._args: any[]) => executeInputNode(node, ctx),
                    runIfElse: (..._args: any[]) => executeIfElseNode(ctx, node),
                    runAccumulator: async (..._args: any[]) => {
                        const inputs = combineParentOutputsByConnectionOrder(node.id, ctx)
                        const inputValue = node.data.content
                            ? replaceIndexedInputs(node.data.content, inputs, ctx)
                            : ''
                        const variableName = (node as any).data.variableName as string
                        const initialValue = (node as any).data.initialValue as string | undefined
                        let accumulatedValue =
                            ctx.accumulatorValues?.get(variableName) || initialValue || ''
                        accumulatedValue += '\n' + inputValue
                        ctx.accumulatorValues?.set(variableName, accumulatedValue)
                        return accumulatedValue
                    },
                    runVariable: async (..._args: any[]) => {
                        const inputs = combineParentOutputsByConnectionOrder(node.id, ctx)
                        const inputValue = node.data.content
                            ? replaceIndexedInputs(node.data.content, inputs, ctx)
                            : ''
                        const variableName = (node as any).data.variableName as string
                        const initialValue = (node as any).data.initialValue as string | undefined
                        let variableValue = ctx.variableValues?.get(variableName) || initialValue || ''
                        variableValue = inputValue
                        ctx.variableValues?.set(variableName, variableValue)
                        return variableValue
                    },
                    runLoopStart: undefined,
                    runLoopEnd: undefined,
                    runSubflow: async (..._args: any[]) =>
                        runSubflowWrapper(node, ctx, signal, webview, subflowCache),
                })
            },
            onStatus: payload => {
                if (payload.status === 'completed') {
                    lastExecutedNodeId = payload.nodeId
                } else if (payload.status === 'interrupted') {
                    interruptedNodeId = payload.nodeId
                }
                return safePost(webview, {
                    type: 'node_execution_status',
                    data: payload,
                } as ExtensionToWorkflow)
            },
        }

        const options = {
            onError: 'fail-fast',
            perType: { [NodeType.LLM]: 2, [NodeType.CLI]: 2 },
            seeds: resume?.seeds,
            pause: pauseRef,
        } as const
        await executeWorkflowParallel(nodes, edges, callbacks, options, abortSignal)
    } catch (err) {
        // Check if this is a pause signal (not an error)
        if (err instanceof PausedError) {
            const stoppedAt = interruptedNodeId || lastExecutedNodeId
            const event: ExtensionToWorkflow = {
                type: 'execution_paused',
                ...(stoppedAt ? { stoppedAtNodeId: stoppedAt } : {}),
            }
            await safePost(webview, event)
            paused = true
            return
        }
        // Surface error and finish
        const msg = err instanceof Error ? err.message : String(err)
        void vscode.window.showErrorMessage(`Workflow Error: ${msg}`)
    } finally {
        // Do not post completion if paused
        if (!paused) {
            const stoppedAt = interruptedNodeId || lastExecutedNodeId
            const event: ExtensionToWorkflow = {
                type: 'execution_completed',
                ...(stoppedAt ? { stoppedAtNodeId: stoppedAt } : {}),
            }
            await safePost(webview, event)
        }
    }
    return

    /* Legacy sequential path disabled
    const edgeIndex = createEdgeIndex(edges)
    const nodeIndex = new Map(nodes.map(node => [node.id, node]))

    // Guard: invalid resume target (already checked above, but preserve existing logic)
    const resumeFromId = resume?.fromNodeId
    if (resumeFromId && !nodeIndex.has(resumeFromId!)) {
        void vscode.window.showErrorMessage(`Resume failed: node ${resumeFromId!} not found`)
        await safePost(webview, { type: 'execution_completed' } as ExtensionToWorkflow)
        return
    }

    const context: IndexedExecutionContext = {
        nodeOutputs: new Map(),
        nodeIndex,
        edgeIndex,
        loopStates: new Map(),
        accumulatorValues: new Map(),
        cliMetadata: new Map(),
        variableValues: new Map(),
        ifelseSkipPaths: new Map(),
    }

    const resumeSeedOutputs = resume?.seeds?.outputs
    if (resumeSeedOutputs) {
        for (const [nodeId, value] of Object.entries(resumeSeedOutputs as Record<string, string>)) {
            context.nodeOutputs.set(nodeId, value)
            const n = nodeIndex.get(nodeId)
            if (n?.type === NodeType.VARIABLE) {
                const varName = ((n as any).data?.variableName ?? '') as string
                if (varName) context.variableValues?.set(varName, value)
            }
            if (n?.type === NodeType.ACCUMULATOR) {
                const varName = ((n as any).data?.variableName ?? '') as string
                if (varName) context.accumulatorValues?.set(varName, value)
            }
        }
    }

  const allInactiveNodes = new Set<string>()
    for (const node of nodes) {
        if (node.data.active === false) {
            const dependentInactiveNodes = getInactiveNodes(edges, node.id)
            for (const id of dependentInactiveNodes) {
                allInactiveNodes.add(id)
            }
        }
    }
    const sortedNodes = processGraphComposition(nodes, edges, true)

    // Precompute IF/ELSE skip paths based on reachability to resume node
    const resumeFrom = resume?.fromNodeId
    if (resumeFrom) {
        const allEdges = Array.from(edgeIndex.byId.values())
        const isReachable = (start: string, target: string): boolean => {
            if (start === target) return true
            const visited = new Set<string>()
            const q: string[] = [start]
            while (q.length) {
                const cur = q.shift()!
                if (cur === target) return true
                if (visited.has(cur)) continue
                visited.add(cur)
                for (const e of allEdges) {
                    if (e.source === cur) q.push(e.target)
                }
            }
            return false
        }
        for (const node of sortedNodes) {
            if ((node as WorkflowNodes).type !== NodeType.IF_ELSE) continue
            const out = edgeIndex.bySource.get(node.id) || []
            const tE = out.find(e => e.sourceHandle === 'true')
            const fE = out.find(e => e.sourceHandle === 'false')
            if (!tE || !fE) continue
            const reachesTrue = isReachable(tE!.target, resumeFrom!)
            const reachesFalse = isReachable(fE!.target, resumeFrom!)
            if (reachesTrue === reachesFalse) continue // ambiguous or neither
            const nonTakenTarget = reachesTrue ? fE!.target : tE!.target
            const newSkipNodes = new Set<string>()
            context.ifelseSkipPaths?.set(node.id, newSkipNodes)
            const nodesToSkip = getInactiveNodes(allEdges, nonTakenTarget)
            for (const nid of nodesToSkip) newSkipNodes.add(nid)
        }
    }

    // Limit execution to the reachable subgraph when resuming from a specific node
    const allowedNodes: Set<string> | undefined = (() => {
        if (!resumeFrom) return undefined
        const allEdges = Array.from(edgeIndex.byId.values())
        return getInactiveNodes(allEdges, resumeFrom!)
    })()

    await safePost(webview, { type: 'execution_started' } as ExtensionToWorkflow)

    let resumeStarted = !resume?.fromNodeId

    for (const node of sortedNodes) {
        if (!resumeStarted) {
            if (node.id === resume?.fromNodeId) {
                resumeStarted = true
            } else {
                continue
            }
        }

        // Skip nodes outside the reachable subgraph when resuming
        if (resumeFrom) {
            const allow = allowedNodes ?? new Set<string>()
            if (!allow.has(node.id)) {
                continue
            }
        }
        const shouldSkip = Array.from(context.ifelseSkipPaths?.values() ?? []).some(skipNodes =>
            skipNodes.has(node.id)
        )
        if (shouldSkip) {
            continue
        }
        if (allInactiveNodes.has(node.id)) {
            continue
        }

        await safePost(webview, {
            type: 'node_execution_status',
            data: { nodeId: node.id, status: 'running' },
        } as ExtensionToWorkflow)

        let result: string | string[] = ''
        try {
            switch (node.type) {
                case NodeType.CLI: {
                    result = await executeCLINode(node, abortSignal, webview, approvalHandler, context)
                    break
                }
                case NodeType.LLM: {
                    result = await executeLLMNode(node, context, abortSignal, webview, approvalHandler)
                    break
                }
                case NodeType.PREVIEW: {
                    result = await executePreviewNode(node.id, webview, context)
                    break
                }
                case NodeType.INPUT: {
                    result = await executeInputNode(node, context)
                    break
                }
                case NodeType.LOOP_START: {
                    result = await executeLoopStartNode(node, context)
                    break
                }
                case NodeType.LOOP_END: {
                    result = await executePreviewNode(node.id, webview, context)
                    break
                }
                case NodeType.ACCUMULATOR: {
                    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
                    const inputValue = node.data.content
                        ? replaceIndexedInputs(node.data.content, inputs, context)
                        : ''
                    const variableName = (node as any).data.variableName as string
                    const initialValue = (node as any).data.initialValue as string | undefined
                    let accumulatedValue =
                        context.accumulatorValues?.get(variableName) || initialValue || ''
                    accumulatedValue += '\n' + inputValue
                    context.accumulatorValues?.set(variableName, accumulatedValue)
                    result = accumulatedValue
                    break
                }
                case NodeType.IF_ELSE: {
                    result = await executeIfElseNode(context, node)
                    break
                }
                case NodeType.VARIABLE: {
                    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
                    const inputValue = node.data.content
                        ? replaceIndexedInputs(node.data.content, inputs, context)
                        : ''
                    const variableName = (node as any).data.variableName as string
                    const initialValue = (node as any).data.initialValue as string | undefined
                    let variableValue = context.variableValues?.get(variableName) || initialValue || ''
                    variableValue = inputValue
                    context.variableValues?.set(variableName, variableValue)
                    result = variableValue
                    break
                }
                default:
                    throw new Error(`Unknown node type: ${(node as WorkflowNodes).type}`)
            }
        } catch (error: unknown) {
            if (abortSignal.aborted) {
                await safePost(webview, {
                    type: 'node_execution_status',
                    data: { nodeId: node.id, status: 'interrupted' },
                } as ExtensionToWorkflow)
                await safePost(webview, { type: 'execution_completed' } as ExtensionToWorkflow)
                return
            }
            if (error instanceof AbortedError) {
                await safePost(webview, {
                    type: 'node_execution_status',
                    data: { nodeId: node.id, status: 'interrupted' },
                } as ExtensionToWorkflow)
                await safePost(webview, { type: 'execution_completed' } as ExtensionToWorkflow)
                return
            }
            const errorMessage = error instanceof Error ? error.message : String(error)
            void vscode.window.showErrorMessage(`Node Error: ${errorMessage}`)
            await safePost(webview, {
                type: 'node_execution_status',
                data: { nodeId: node.id, status: 'error', result: errorMessage },
            } as ExtensionToWorkflow)
            await safePost(webview, { type: 'execution_completed' } as ExtensionToWorkflow)
            return
        }

        context.nodeOutputs.set(node.id, result)
        const safeResult = Array.isArray(result)
            ? (result as string[]).join('\n')
            : typeof result === 'string'
              ? result
              : JSON.stringify(result)
        await safePost(webview, {
            type: 'node_execution_status',
            data: { nodeId: node.id, status: 'completed', result: safeResult },
        } as ExtensionToWorkflow)
    }

    await safePost(webview, { type: 'execution_completed' } as ExtensionToWorkflow)
*/
}

export function createEdgeIndex(edges: Edge[]): IndexedEdges {
    const bySource = new Map<string, Edge[]>()
    const byTarget = new Map<string, Edge[]>()
    const byId = new Map<string, Edge>()

    for (const edge of edges) {
        const sourceEdges = bySource.get(edge.source) || []
        sourceEdges.push(edge)
        bySource.set(edge.source, sourceEdges)

        const targetEdges = byTarget.get(edge.target) || []
        targetEdges.push(edge)
        byTarget.set(edge.target, targetEdges)

        byId.set(edge.id, edge)
    }

    return { bySource, byTarget, byId }
}
