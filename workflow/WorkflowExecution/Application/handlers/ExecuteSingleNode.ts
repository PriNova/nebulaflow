import { fromProtocolPayload } from '../../../Application/messaging/converters'
import type { WorkflowNodeDTO } from '../../../Core/Contracts/Protocol'
import type { ApprovalResult } from '../../../Core/models'
import { AbortedError } from '../../../Core/models'
import type { CLINode, SubflowNode, WorkflowNodes } from '../../../Core/models'
import { NodeType } from '../../../Core/models'
import { loadSubflow } from '../../../DataAccess/fs'
import type { IHostEnvironment, IMessagePort } from '../../../Shared/Host/index'
import { safePost } from '../../../Shared/Infrastructure/messaging/safePost'
import { type ParallelCallbacks, executeWorkflowParallel } from '../../Core/engine/parallel-scheduler'
import { evalTemplate, replaceIndexedInputs } from '../../Core/execution/inputs'
import { runCLICore } from '../node-runners/run-cli'
import { runLLMCore } from '../node-runners/run-llm'
import type { IndexedExecutionContext } from './ExecuteWorkflow'
import { routeNodeExecution } from './NodeDispatch'

export interface ExecuteNodePayload {
    node: WorkflowNodeDTO
    inputs?: string[]
    runId?: number
    variables?: Record<string, string>
}

export async function executeSingleNode(
    payload: ExecuteNodePayload,
    port: IMessagePort,
    host: IHostEnvironment,
    abortSignal: AbortSignal,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>
): Promise<void> {
    const { node: nodeDTO, inputs = [], variables } = payload

    const { nodes } = fromProtocolPayload({ nodes: [nodeDTO], edges: [] })
    const node = nodes[0]

    await safePost(port, {
        type: 'node_execution_status',
        data: { nodeId: node.id, status: 'running' },
    })

    try {
        const result = await routeNodeExecution(node, 'single-node', {
            runCLI: (..._args: unknown[]) =>
                executeSingleCLINode(node, inputs, abortSignal, port, host, approvalHandler, variables),
            runLLM: (..._args: unknown[]) =>
                executeSingleLLMNode(node, inputs, abortSignal, port, approvalHandler, variables),
            runPreview: (..._args: unknown[]) => executeSinglePreviewNode(node, inputs, port, variables),
            runInput: (..._args: unknown[]) => executeSingleInputNode(node, inputs, variables),
            runVariable: (..._args: unknown[]) => executeSingleVariableNode(node, inputs, variables),
            runIfElse: (..._args: unknown[]) => executeSingleIfElseNode(node, inputs, variables),
            runAccumulator: undefined,
            runLoopStart: undefined,
            runLoopEnd: undefined,
            runSubflow: (..._args: unknown[]) =>
                runSingleSubflow(node, inputs, abortSignal, port, host),
        })

        const safeResult = Array.isArray(result) ? result.join('\n') : String(result)
        void safePost(port, {
            type: 'node_execution_status',
            data: { nodeId: node.id, status: 'completed', result: safeResult },
        })
        void safePost(port, {
            type: 'execution_completed',
            stoppedAtNodeId: node.id,
        })
    } catch (error) {
        if (abortSignal.aborted || error instanceof AbortedError) {
            void safePost(port, {
                type: 'node_execution_status',
                data: { nodeId: nodeDTO.id, status: 'interrupted' },
            })
            void safePost(port, {
                type: 'execution_completed',
                stoppedAtNodeId: nodeDTO.id,
            })
            return
        }
        const msg = error instanceof Error ? error.message : String(error)
        void host.window.showErrorMessage(`Node Error: ${msg}`)
        void safePost(port, {
            type: 'node_execution_status',
            data: { nodeId: nodeDTO.id, status: 'error', result: msg },
        })
        void safePost(port, {
            type: 'execution_completed',
            stoppedAtNodeId: nodeDTO.id,
        })
    }
}

async function executeSingleLLMNode(
    node: WorkflowNodes,
    inputs: string[],
    abortSignal: AbortSignal,
    port: IMessagePort,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>,
    variables?: Record<string, string>
): Promise<string> {
    const template = node.data.content || ''
    const hasTemplate = template.trim().length > 0
    const hasParentResult = (inputs || []).some(v => typeof v === 'string' && v.trim().length > 0)
    if (!hasTemplate && !hasParentResult) {
        throw new Error('LLM Node requires content or an input from a parent node')
    }

    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) }
        : undefined
    const prompt = hasTemplate
        ? replaceIndexedInputs(template, inputs, ctx as IndexedExecutionContext)
        : (inputs[0] ?? '').toString()

    const { getActiveWorkspaceRoots } = await import('../../../Shared/Infrastructure/workspace.js')
    const workspaceRoots = getActiveWorkspaceRoots()
    console.debug('executeSingleLLMNode: ', JSON.stringify(workspaceRoots, null, 2))

    return await runLLMCore({
        node,
        prompt,
        workspaceRoots,
        abortSignal,
        port,
        approvalHandler,
        mode: 'single-node',
    })
}

async function executeSingleCLINode(
    node: WorkflowNodes,
    inputs: string[],
    abortSignal: AbortSignal,
    port: IMessagePort,
    host: IHostEnvironment,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>,
    variables?: Record<string, string>
): Promise<string> {
    abortSignal.throwIfAborted()
    const template = node.data.content || ''
    const hasTemplate = template.trim().length > 0
    const hasParentResult = (inputs || []).some(v => typeof v === 'string' && v.trim().length > 0)
    if (!hasTemplate && !hasParentResult) {
        throw new Error('CLI Node requires content or an input from a parent node')
    }

    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) }
        : undefined

    const cliNode = node as CLINode
    const mode: 'command' | 'script' = cliNode.data.mode || 'command'
    const base = hasTemplate
        ? replaceIndexedInputs(template, inputs, ctx as IndexedExecutionContext)
        : (inputs[0] ?? '').toString()

    const onChunk = (chunk: string, stream: 'stdout' | 'stderr') => {
        void safePost(port, {
            type: 'node_output_chunk',
            data: {
                nodeId: node.id,
                chunk,
                stream,
            },
        })
    }

    const { output } = await runCLICore({
        node,
        baseCommandOrScript: base,
        mode,
        inputs,
        abortSignal,
        port,
        host,
        approvalHandler,
        context: ctx,
        onChunk,
    })

    return output
}

async function executeSinglePreviewNode(
    node: WorkflowNodes,
    inputs: string[],
    port: IMessagePort,
    variables?: Record<string, string>
): Promise<string> {
    const inputJoined = (inputs || []).join('\n')
    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) }
        : undefined
    const processed = evalTemplate(inputJoined, inputs, ctx)
    const trimmed = processed.trim()
    const tokenCount = trimmed.length
    await safePost(port, { type: 'token_count', data: { nodeId: node.id, count: tokenCount } })
    return trimmed
}

function executeSingleInputNode(
    node: WorkflowNodes,
    inputs: string[],
    variables?: Record<string, string>
): string {
    const template = node.data.content || ''
    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) }
        : undefined
    const text = evalTemplate(template, inputs, ctx)
    return text.trim()
}

function executeSingleVariableNode(
    node: WorkflowNodes,
    inputs: string[],
    variables?: Record<string, string>
): string {
    const template = node.data.content || ''
    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) }
        : undefined
    const value = evalTemplate(template, inputs, ctx)
    return value
}

function executeSingleIfElseNode(
    node: WorkflowNodes,
    inputs: string[],
    variables?: Record<string, string>
): string {
    const template = node.data.content || ''
    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) }
        : undefined
    const condition = template ? replaceIndexedInputs(template, inputs, ctx as IndexedExecutionContext) : ''
    const parts = condition.trim().split(/\s+(===|!==)\s+/)
    if (parts.length !== 3) {
        // Fallback: non-standard condition resolves to false
        return 'false'
    }
    const [leftSide, operator, rightSide] = parts
    const isTrue = operator === '===' ? leftSide === rightSide : leftSide !== rightSide
    return isTrue ? 'true' : 'false'
}

async function runSingleSubflow(
    wrapperNode: WorkflowNodes,
    inputs: string[],
    abortSignal: AbortSignal,
    port: IMessagePort,
    host: IHostEnvironment
): Promise<string[]> {
    const subflowId = (wrapperNode as SubflowNode).data.subflowId
    if (!subflowId) throw new Error('Subflow node missing subflowId')
    const def = await loadSubflow(subflowId)
    if (!def) throw new Error(`Subflow not found: ${subflowId}`)

    const inner = fromProtocolPayload({ nodes: def.graph.nodes, edges: def.graph.edges })
    const seeds: Record<string, string> = {}
    for (let i = 0; i < def.inputs.length; i++) {
        const port = def.inputs[i]
        const val = inputs[i] ?? ''
        const match = inner.nodes.find(
            n =>
                n.type === NodeType.SUBFLOW_INPUT &&
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
                (n.data as any).portId === port.id
        )
        if (match) seeds[match.id] = val
    }
    const outNodes = inner.nodes.filter(n => n.type === NodeType.SUBFLOW_OUTPUT)
    if (!outNodes || outNodes.length === 0) throw new Error('Subflow definition missing output nodes')
    const outNodeIdToPortId = new Map<string, string>()
    for (const n of outNodes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const pid = (n.data as any).portId as string | undefined
        if (pid) outNodeIdToPortId.set(n.id, pid)
    }

    // Aggregate progress (exclude boundary and inactive nodes)
    const eligibleInnerIds = new Set(
        inner.nodes
            .filter(
                n =>
                    n.data.active !== false &&
                    n.type !== NodeType.SUBFLOW_INPUT &&
                    n.type !== NodeType.SUBFLOW_OUTPUT
            )
            .map(n => n.id)
    )
    const totalInner = eligibleInnerIds.size
    let completedInner = 0
    if (totalInner > 0) {
        void safePost(port, {
            type: 'node_execution_status',
            data: {
                nodeId: wrapperNode.id,
                status: 'running',
                result: `${completedInner}/${totalInner}`,
            },
        })
    }

    const resultByPortId = new Map<string, string>()
    const callbacks: ParallelCallbacks = {
        runNode: async (node, _pctx, _signal): Promise<string | string[]> => {
            const res = await routeNodeExecution(node, 'single-node', {
                runCLI: (..._args: unknown[]) =>
                    executeSingleCLINode(
                        node,
                        [],
                        abortSignal,
                        port,
                        host,
                        // eslint-disable-next-line @typescript-eslint/require-await
                        async () => ({ type: 'approved' as const }),
                    ),
                runLLM: (..._args: unknown[]) =>
                    executeSingleLLMNode(
                        node,
                        [],
                        abortSignal,
                        port,
                        // eslint-disable-next-line @typescript-eslint/require-await
                        async () => ({ type: 'approved' as const }),
                    ),
                runPreview: (..._args: unknown[]) => executeSinglePreviewNode(node, [], port),
                runInput: (..._args: unknown[]) => executeSingleInputNode(node, []),
                runVariable: (..._args: unknown[]) => executeSingleVariableNode(node, []),
                runIfElse: (..._args: unknown[]) => executeSingleIfElseNode(node, []),
                runAccumulator: undefined,
                runLoopStart: undefined,
                runLoopEnd: undefined,
                runSubflowOutput: (..._args: unknown[]) => '',
                runSubflowInput: (..._args: unknown[]) => '',
            })
            return (Array.isArray(res) ? res : [String(res)]) as string[]
        },
        onStatus: payload => {
            if (
                payload.status === 'completed' &&
                payload.nodeId &&
                outNodeIdToPortId.has(payload.nodeId)
            ) {
                const pid = outNodeIdToPortId.get(payload.nodeId)!
                resultByPortId.set(pid, payload.result ?? '')
            }
            if (
                payload.status === 'completed' &&
                payload.nodeId &&
                eligibleInnerIds.has(payload.nodeId)
            ) {
                completedInner += 1
                if (totalInner > 0) {
                    void safePost(port, {
                        type: 'node_execution_status',
                        data: {
                            nodeId: wrapperNode.id,
                            status: 'running',
                            result: `${completedInner}/${totalInner}`,
                        },
                    })
                }
            }
        },
    }
    await executeWorkflowParallel(
        inner.nodes,
        inner.edges,
        callbacks,
        { onError: 'fail-fast', seeds: { outputs: seeds } },
        abortSignal
    )
    const final: string[] = def.outputs.map(o => resultByPortId.get(o.id) ?? '')
    return final
}
