import { fromProtocolPayload } from '../../../Application/messaging/converters'
import { NodeType, type WorkflowNodes } from '../../../Core/models'
import { loadSubflow } from '../../../DataAccess/fs'
import type { IHostEnvironment, IMessagePort } from '../../../Shared/Host/index'
import { safePost } from '../../../Shared/Infrastructure/messaging/safePost'
import { type ParallelCallbacks, executeWorkflowParallel } from '../../Core/engine/parallel-scheduler'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { replaceIndexedInputs } from '../../Core/execution/inputs'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'
import { routeNodeExecution } from '../handlers/NodeDispatch'
import { executeCLINode } from '../node-runners/run-cli'
import { executeIfElseNode } from '../node-runners/run-if-else'
import { executeInputNode } from '../node-runners/run-input'
import { executeLLMNode } from '../node-runners/run-llm'
import { executePreviewNode } from '../node-runners/run-preview'

export async function runSubflowWrapper(
    wrapperNode: WorkflowNodes,
    outerCtx: IndexedExecutionContext,
    abortSignal: AbortSignal,
    port: IMessagePort,
    host: IHostEnvironment,
    subflowCache?: Map<string, Record<string, string>>
): Promise<string[]> {
    const subflowId = (wrapperNode as any)?.data?.subflowId as string | undefined
    if (!subflowId) throw new Error('Subflow node missing subflowId')

    const def = await loadSubflow(subflowId)
    if (!def) throw new Error(`Subflow not found: ${subflowId}`)

    // Prepare inner graph
    const inner = fromProtocolPayload({ nodes: def.graph.nodes as any, edges: def.graph.edges as any })
    // Index for seeds: map SubflowInput nodes by port id
    const byId = new Map(inner.nodes.map(n => [n.id, n]))
    const inputs = combineParentOutputsByConnectionOrder(wrapperNode.id, outerCtx)

    const seeds: Record<string, string> = {}
    // Prefer def.inputs order; expect SubflowInput nodes with data.portId matching inputs[].id
    for (let i = 0; i < def.inputs.length; i++) {
        const portDef = def.inputs[i]
        const val = inputs[i] ?? ''
        // Find SubflowInput node with matching port id
        const match = inner.nodes.find(
            n => (n as any).type === NodeType.SUBFLOW_INPUT && (n as any).data?.portId === portDef.id
        )
        if (match) seeds[match.id] = val
    }
    // Load previous inner results (in-memory) and seed only bypassed nodes to enable reuse semantics
    try {
        const prev = subflowCache?.get(subflowId)
        if (prev && typeof prev === 'object') {
            for (const [nid, val] of Object.entries(prev)) {
                const nn: any = inner.nodes.find(n => n.id === nid)
                if (nn && nn.data?.bypass === true && typeof val === 'string') {
                    seeds[nid] = val
                }
            }
        }
    } catch {}

    // Identify all SubflowOutput nodes and map by portId
    const outNodes = inner.nodes.filter(n => (n as any).type === NodeType.SUBFLOW_OUTPUT)
    if (!outNodes || outNodes.length === 0) throw new Error('Subflow definition missing output nodes')
    const outNodeIdToPortId = new Map<string, string>()
    for (const n of outNodes) {
        const pid = (n as any)?.data?.portId as string | undefined
        if (pid) outNodeIdToPortId.set(n.id, pid)
    }

    // Seed pass-through for bypass nodes where parents are already satisfiable from inputs
    try {
        // Minimal local edge index for parent lookups
        const byTarget = new Map<string, { source: string; target: string }[]>()
        const byId = new Map<string, { source: string; target: string }>()
        for (const e of inner.edges as any[]) {
            const arr = byTarget.get(e.target) || []
            arr.push({ source: e.source, target: e.target })
            byTarget.set(e.target, arr)
            byId.set(e.id, { source: e.source, target: e.target })
        }
        const tmpCtx: any = {
            nodeOutputs: new Map<string, string | string[]>(Object.entries(seeds)),
            nodeIndex: new Map(inner.nodes.map(n => [n.id, n])),
            edgeIndex: { byTarget, byId },
        }
        // Iterate to propagate pass-through seeds along bypass chains
        const maxIters = inner.nodes.length
        for (let iter = 0; iter < maxIters; iter++) {
            let progressed = false
            for (const n of inner.nodes) {
                const isBypass = (n as any)?.data?.bypass === true
                if (!isBypass) continue
                if (tmpCtx.nodeOutputs.has(n.id)) continue
                // Compute using currently available parent outputs
                const vals = combineParentOutputsByConnectionOrder(n.id, tmpCtx)
                if (vals && vals.length > 0) {
                    tmpCtx.nodeOutputs.set(n.id, vals.join('\n'))
                    progressed = true
                }
            }
            if (!progressed) break
        }
        // Merge computed pass-through seeds back into seeds map
        for (const [k, v] of tmpCtx.nodeOutputs as Map<string, string | string[]>) {
            const s = Array.isArray(v) ? v.join('\n') : (v as string)
            seeds[k] = s
        }
    } catch {
        // Best-effort; ignore seeding errors
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
    const lastOutputs = new Map<string, string>()

    // Proxy inner node events to subflow-scoped events for the outer webview
    const subflowWebviewProxy: IMessagePort = {
        postMessage: async (innerMsg: any) => {
            try {
                if (innerMsg?.type === 'node_execution_status' && innerMsg?.data) {
                    await safePost(port, {
                        type: 'subflow_node_execution_status',
                        data: { subflowId, payload: innerMsg.data },
                    } as any)
                } else if (innerMsg?.type === 'node_assistant_content' && innerMsg?.data) {
                    await safePost(port, {
                        type: 'subflow_node_assistant_content',
                        data: {
                            subflowId,
                            nodeId: innerMsg.data.nodeId,
                            threadID: innerMsg.data.threadID,
                            content: innerMsg.data.content,
                        },
                    } as any)
                }
            } catch (err) {
                // Log forwarding failures so message delivery issues are diagnosable
                console.error('[subflowWebviewProxy] Failed to forward inner message', err)
            }
            return true
        },
        onDidReceiveMessage: () => {
            return { dispose: () => {} }
        },
    }

    const callbacks: ParallelCallbacks = {
        runNode: async (node, pctx, signal) => {
            const ctx = pctx as unknown as IndexedExecutionContext
            return await routeNodeExecution(node, 'workflow', {
                runCLI: (..._args: any[]) =>
                    executeCLINode(
                        node,
                        signal,
                        subflowWebviewProxy,
                        host,
                        async () => ({ type: 'approved' }),
                        ctx
                    ),
                runLLM: (..._args: any[]) =>
                    executeLLMNode(node, ctx, signal, subflowWebviewProxy, async () => ({
                        type: 'approved',
                    })),
                runPreview: (..._args: any[]) => executePreviewNode(node.id, subflowWebviewProxy, ctx),
                runInput: (..._args: any[]) => executeInputNode(node, ctx),
                runIfElse: (..._args: any[]) => executeIfElseNode(ctx, node),
                runAccumulator: async (..._args: any[]) => {
                    const vals = combineParentOutputsByConnectionOrder(node.id, ctx)
                    const content = node.data.content
                        ? replaceIndexedInputs(node.data.content, vals, ctx)
                        : ''
                    const variableName = (node as any).data.variableName as string
                    const initialValue = (node as any).data.initialValue as string | undefined
                    let accumulatedValue = ctx.accumulatorValues?.get(variableName) || initialValue || ''
                    accumulatedValue += '\n' + content
                    ctx.accumulatorValues?.set(variableName, accumulatedValue)
                    return accumulatedValue
                },
                runVariable: async (..._args: any[]) => {
                    const vals = combineParentOutputsByConnectionOrder(node.id, ctx)
                    const text = node.data.content
                        ? replaceIndexedInputs(node.data.content, vals, ctx)
                        : ''
                    const variableName = (node as any).data.variableName as string
                    const initialValue = (node as any).data.initialValue as string | undefined
                    let variableValue = ctx.variableValues?.get(variableName) || initialValue || ''
                    variableValue = text
                    ctx.variableValues?.set(variableName, variableValue)
                    return variableValue
                },
                runLoopStart: undefined,
                runLoopEnd: undefined,
                runSubflowOutput: async (..._args: any[]) => {
                    const vals = combineParentOutputsByConnectionOrder(node.id, ctx)
                    return (vals || []).join('\n').trim()
                },
                runSubflowInput: async (..._args: any[]) => {
                    // Should generally be seeded; return seeded value if any
                    const v = ctx.nodeOutputs.get(node.id)
                    return Array.isArray(v) ? v.join('\n') : v ?? ''
                },
            })
        },
        onStatus: payload => {
            // Forward inner node status while subflow view is open
            void safePost(port, {
                type: 'subflow_node_execution_status',
                data: { subflowId, payload },
            } as any)

            if (payload.status === 'completed' && payload.nodeId) {
                if (outNodeIdToPortId.has(payload.nodeId)) {
                    const pid = outNodeIdToPortId.get(payload.nodeId)!
                    resultByPortId.set(pid, payload.result ?? '')
                }
                if (typeof payload.result === 'string') {
                    lastOutputs.set(payload.nodeId, payload.result)
                }
            }
            if (
                payload.status === 'completed' &&
                payload.nodeId &&
                eligibleInnerIds.has(payload.nodeId)
            ) {
                completedInner += 1
                // Emit wrapper-only aggregate progress
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

    const options = { onError: 'fail-fast', seeds: { outputs: seeds } } as const
    await executeWorkflowParallel(
        inner.nodes as any,
        inner.edges as any,
        callbacks,
        options,
        abortSignal
    )

    // Persist inner node outputs in-memory (used for resume/bypass seeding)
    try {
        const toSave: Record<string, string> = {}
        for (const [k, v] of lastOutputs) toSave[k] = v
        if (subflowCache) subflowCache.set(subflowId, toSave)
        // Note: intentional no-op post. UI does not consume subflow_state; avoid sending invalid message type.
    } catch {}

    // Order results by def.outputs
    const final: string[] = def.outputs.map(o => resultByPortId.get(o.id) ?? '')
    return final
}
