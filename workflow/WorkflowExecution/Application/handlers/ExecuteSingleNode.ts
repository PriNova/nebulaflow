import { fromProtocolPayload } from '../../../Application/messaging/converters'
import type { ExtensionToWorkflow, WorkflowNodeDTO } from '../../../Core/Contracts/Protocol'
import type { ApprovalResult } from '../../../Core/models'
import { AbortedError } from '../../../Core/models'
import type { SubflowNode, WorkflowNodes } from '../../../Core/models'
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

const DEFAULT_LLM_TIMEOUT_MS = 300_000

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
    const node = nodes[0] as WorkflowNodes

    await safePost(port, {
        type: 'node_execution_status',
        data: { nodeId: node.id, status: 'running' },
    })

    try {
        const result = await routeNodeExecution(node, 'single-node', {
            runCLI: (..._args: any[]) =>
                executeSingleCLINode(node, inputs, abortSignal, port, host, approvalHandler, variables),
            runLLM: (..._args: any[]) =>
                executeSingleLLMNode(node, inputs, abortSignal, port, approvalHandler, variables),
            runPreview: (..._args: any[]) => executeSinglePreviewNode(node, inputs, port, variables),
            runInput: (..._args: any[]) => executeSingleInputNode(node, inputs, variables),
            runVariable: (..._args: any[]) => executeSingleVariableNode(node, inputs, variables),
            runIfElse: (..._args: any[]) => executeSingleIfElseNode(node, inputs, variables),
            runAccumulator: undefined,
            runLoopStart: undefined,
            runLoopEnd: undefined,
            runSubflow: async (..._args: any[]) =>
                runSingleSubflow(node, inputs, abortSignal, port, host),
        })

        const safeResult = Array.isArray(result) ? result.join('\n') : String(result)
        await safePost(port, {
            type: 'node_execution_status',
            data: { nodeId: node.id, status: 'completed', result: safeResult },
        })
        const completedEvent: ExtensionToWorkflow = {
            type: 'execution_completed',
            stoppedAtNodeId: node.id,
        }
        await safePost(port, completedEvent)
    } catch (error) {
        if (abortSignal.aborted || error instanceof AbortedError) {
            await safePost(port, {
                type: 'node_execution_status',
                data: { nodeId: nodeDTO.id, status: 'interrupted' },
            })
            const interruptedEvent: ExtensionToWorkflow = {
                type: 'execution_completed',
                stoppedAtNodeId: nodeDTO.id,
            }
            await safePost(port, interruptedEvent)
            return
        }
        const msg = error instanceof Error ? error.message : String(error)
        void host.window.showErrorMessage(`Node Error: ${msg}`)
        await safePost(port, {
            type: 'node_execution_status',
            data: { nodeId: nodeDTO.id, status: 'error', result: msg },
        })
        const errorEvent: ExtensionToWorkflow = {
            type: 'execution_completed',
            stoppedAtNodeId: nodeDTO.id,
        }
        await safePost(port, errorEvent)
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
    const template = ((node as any).data?.content || '').toString()
    const hasTemplate = template.trim().length > 0
    const hasParentResult = (inputs || []).some(v => typeof v === 'string' && v.trim().length > 0)
    if (!hasTemplate && !hasParentResult) {
        throw new Error('LLM Node requires content or an input from a parent node')
    }

    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) as any }
        : undefined
    const prompt = hasTemplate
        ? replaceIndexedInputs(template, inputs, ctx as any)
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
    const template = ((node as any).data?.content || '').toString()
    const hasTemplate = template.trim().length > 0
    const hasParentResult = (inputs || []).some(v => typeof v === 'string' && v.trim().length > 0)
    if (!hasTemplate && !hasParentResult) {
        throw new Error('CLI Node requires content or an input from a parent node')
    }

    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) as any }
        : undefined

    const mode = (((node as any).data?.mode as any) || 'command') as 'command' | 'script'
    const base = hasTemplate
        ? replaceIndexedInputs(template, inputs, ctx as any)
        : (inputs[0] ?? '').toString()

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
        ? { variableValues: new Map(Object.entries(variables)) as any }
        : undefined
    const processed = evalTemplate(inputJoined, inputs, ctx)
    const trimmed = processed.trim()
    const tokenCount = trimmed.length
    await safePost(port, { type: 'token_count', data: { nodeId: node.id, count: tokenCount } })
    return trimmed
}

async function executeSingleInputNode(
    node: WorkflowNodes,
    inputs: string[],
    variables?: Record<string, string>
): Promise<string> {
    const template = ((node as any).data?.content || '').toString()
    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) as any }
        : undefined
    const text = evalTemplate(template, inputs, ctx)
    return text.trim()
}

async function executeSingleVariableNode(
    node: WorkflowNodes,
    inputs: string[],
    variables?: Record<string, string>
): Promise<string> {
    const template = ((node as any).data?.content || '').toString()
    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) as any }
        : undefined
    const value = evalTemplate(template, inputs, ctx)
    return value
}

async function executeSingleIfElseNode(
    node: WorkflowNodes,
    inputs: string[],
    variables?: Record<string, string>
): Promise<string> {
    const template = ((node as any).data?.content || '').toString()
    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) as any }
        : undefined
    const condition = template ? replaceIndexedInputs(template, inputs, ctx as any) : ''
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

    const inner = fromProtocolPayload({ nodes: def.graph.nodes as any, edges: def.graph.edges as any })
    const seeds: Record<string, string> = {}
    for (let i = 0; i < def.inputs.length; i++) {
        const port = def.inputs[i]
        const val = inputs[i] ?? ''
        const match = inner.nodes.find(
            n => (n as any).type === NodeType.SUBFLOW_INPUT && (n as any).data?.portId === port.id
        )
        if (match) seeds[match.id] = val
    }
    const outNodes = inner.nodes.filter(n => (n as any).type === NodeType.SUBFLOW_OUTPUT)
    if (!outNodes || outNodes.length === 0) throw new Error('Subflow definition missing output nodes')
    const outNodeIdToPortId = new Map<string, string>()
    for (const n of outNodes) {
        const pid = (n as any)?.data?.portId as string | undefined
        if (pid) outNodeIdToPortId.set(n.id, pid)
    }

    // Aggregate progress (exclude boundary and inactive nodes)
    const eligibleInnerIds = new Set(
        inner.nodes
            .filter(
                n =>
                    (n as any).data?.active !== false &&
                    (n as any).type !== NodeType.SUBFLOW_INPUT &&
                    (n as any).type !== NodeType.SUBFLOW_OUTPUT
            )
            .map(n => n.id)
    )
    const totalInner = eligibleInnerIds.size
    let completedInner = 0
    if (totalInner > 0) {
        await safePost(port, {
            type: 'node_execution_status',
            data: {
                nodeId: wrapperNode.id,
                status: 'running',
                result: `${completedInner}/${totalInner}`,
            },
        } as any)
    }

    const resultByPortId = new Map<string, string>()
    const callbacks: ParallelCallbacks = {
        runNode: async (node, _pctx, _signal) => {
            return await routeNodeExecution(node, 'single-node', {
                runCLI: (..._args: any[]) =>
                    executeSingleCLINode(node, [], abortSignal, port, host, async () => ({
                        type: 'approved',
                    })),
                runLLM: (..._args: any[]) =>
                    executeSingleLLMNode(node as any, [], abortSignal, port, async () => ({
                        type: 'approved',
                    })),
                runPreview: (..._args: any[]) => executeSinglePreviewNode(node as any, [], port),
                runInput: (..._args: any[]) => executeSingleInputNode(node as any, []),
                runVariable: (..._args: any[]) => executeSingleVariableNode(node as any, []),
                runIfElse: (..._args: any[]) => executeSingleIfElseNode(node as any, []),
                runAccumulator: undefined,
                runLoopStart: undefined,
                runLoopEnd: undefined,
                runSubflowOutput: async (..._args: any[]) => '',
                runSubflowInput: async (..._args: any[]) => '',
            })
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
                    } as any)
                }
            }
        },
    }
    await executeWorkflowParallel(
        inner.nodes as any,
        inner.edges as any,
        callbacks,
        { onError: 'fail-fast', seeds: { outputs: seeds } },
        abortSignal
    )
    const final: string[] = def.outputs.map(o => resultByPortId.get(o.id) ?? '')
    return final
}
