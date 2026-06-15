import { NodeType, PausedError } from '../../../Core/models'
import type {
    AccumulatorNode,
    ApprovalResult,
    Edge,
    ExtensionToWorkflow,
    VariableNode,
    WorkflowNodes,
} from '../../../Core/models'
import type { IHostEnvironment, IMessagePort } from '../../../Shared/Host/index'
import { safePost } from '../../../Shared/Infrastructure/messaging/safePost'
import { type ParallelCallbacks, executeWorkflowParallel } from '../../Core/engine/parallel-scheduler'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { evalTemplate } from '../../Core/execution/inputs'
import { executeCLINode } from '../node-runners/run-cli'
import { executeIfElseNode } from '../node-runners/run-if-else'
import { executeInputNode } from '../node-runners/run-input'
import { executeLLMNode } from '../node-runners/run-llm'
import { executeLoopEndNode } from '../node-runners/run-loop-end'
import { executeLoopStartNode } from '../node-runners/run-loop-start'
import { executePreviewNode } from '../node-runners/run-preview'
import { runSubflowWrapper } from '../subflow/run-subflow'
import { routeNodeExecution } from './NodeDispatch'

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
    port: IMessagePort,
    host: IHostEnvironment,
    abortSignal: AbortSignal,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>,
    resume?: { fromNodeId: string; seeds?: { outputs?: Record<string, string> } },
    pauseRef?: { isPaused: () => boolean },
    subflowCache?: Map<string, Record<string, string>>
): Promise<void> {
    // Early guard: invalid resume target
    if (resume?.fromNodeId && !nodes.some(n => n.id === resume.fromNodeId)) {
        void host.window.showErrorMessage(`Resume failed: node ${resume.fromNodeId} not found`)
        await safePost(port, { type: 'execution_completed' })
        return
    }

    // Parallel scheduler path (default for all runs)
    let lastExecutedNodeId: string | null = null
    let interruptedNodeId: string | null = null
    let paused = false
    await safePost(port, { type: 'execution_started' })
    try {
        const callbacks: ParallelCallbacks = {
            runNode: async (node, pctx, signal): Promise<string | string[]> => {
                const ctx = pctx as unknown as IndexedExecutionContext
                const res = await routeNodeExecution(node, 'workflow', {
                    runCLI: (..._args: unknown[]) =>
                        executeCLINode(node, signal, port, host, approvalHandler, ctx),
                    runLLM: (..._args: unknown[]) =>
                        executeLLMNode(node, ctx, signal, port, approvalHandler),
                    runPreview: (..._args: unknown[]) => executePreviewNode(node.id, port, ctx),
                    runInput: (..._args: unknown[]) => executeInputNode(node, ctx),
                    runIfElse: (..._args: unknown[]) => executeIfElseNode(ctx, node),
                    runAccumulator: (..._args: unknown[]) => {
                        const acc = node as AccumulatorNode
                        const inputs = combineParentOutputsByConnectionOrder(acc.id, ctx)
                        const template = acc.data.content || ''
                        const inputValue = evalTemplate(template, inputs, ctx)
                        const variableName = acc.data.variableName
                        const initialValue = acc.data.initialValue
                        let accumulatedValue =
                            ctx.accumulatorValues?.get(variableName) || initialValue || ''
                        accumulatedValue += '\n' + inputValue
                        ctx.accumulatorValues?.set(variableName, accumulatedValue)
                        return accumulatedValue
                    },
                    runVariable: (..._args: unknown[]) => {
                        const vn = node as VariableNode
                        const inputs = combineParentOutputsByConnectionOrder(vn.id, ctx)
                        const template = vn.data.content || ''
                        const inputValue = evalTemplate(template, inputs, ctx)
                        const variableName = vn.data.variableName
                        const initialValue = vn.data.initialValue
                        let variableValue = ctx.variableValues?.get(variableName) || initialValue || ''
                        variableValue = inputValue
                        ctx.variableValues?.set(variableName, variableValue)
                        return variableValue
                    },
                    runLoopStart: (..._args: unknown[]) => executeLoopStartNode(node, ctx),
                    runLoopEnd: (..._args: unknown[]) => executeLoopEndNode(node, ctx),
                    runSubflow: (..._args: unknown[]) =>
                        runSubflowWrapper(node, ctx, signal, port, host, subflowCache),
                })
                return (Array.isArray(res) ? res : [String(res)]) as string[]
            },
            onStatus: payload => {
                if (payload.status === 'completed') {
                    lastExecutedNodeId = payload.nodeId
                } else if (payload.status === 'interrupted') {
                    interruptedNodeId = payload.nodeId
                }
                return safePost(port, {
                    type: 'node_execution_status',
                    data: payload,
                })
            },
        }

        const options = {
            onError: 'fail-fast',
            perType: { [NodeType.LLM]: 8, [NodeType.CLI]: 8 },
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
            await safePost(port, event)
            paused = true
            return
        }
        // Surface error and finish
        const msg = err instanceof Error ? err.message : String(err)
        void host.window.showErrorMessage(`Workflow Error: ${msg}`)
    } finally {
        // Do not post completion if paused
        if (!paused) {
            const stoppedAt = interruptedNodeId || lastExecutedNodeId
            const event: ExtensionToWorkflow = {
                type: 'execution_completed',
                ...(stoppedAt ? { stoppedAtNodeId: stoppedAt } : {}),
            }
            await safePost(port, event)
        }
    }
    return
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
