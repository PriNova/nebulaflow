import type { NodeExecutionPayload } from '../../../Core/Contracts/Protocol'
import { fromProtocolPayload } from '../../../Application/messaging/converters'
import {
    NodeType,
    type AccumulatorNode,
    type SubflowNode,
    type VariableNode,
    type WorkflowNodes,
} from '../../../Core/models'
import { loadSubflow } from '../../../DataAccess/fs'
import type { IHostEnvironment, IMessagePort } from '../../../Shared/Host/index'
import { safePost } from '../../../Shared/Infrastructure/messaging/safePost'
import {
    type ParallelCallbacks,
    executeWorkflowParallel,
} from '../../Core/engine/parallel-scheduler'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { evalTemplate } from '../../Core/execution/inputs'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'
import { routeNodeExecution } from '../handlers/NodeDispatch'
import { executeCLINode } from '../node-runners/run-cli'
import { executeIfElseNode } from '../node-runners/run-if-else'
import { executeInputNode } from '../node-runners/run-input'
import { executeLLMNode } from '../node-runners/run-llm'
import { executeLoopEndNode } from '../node-runners/run-loop-end'
import { executeLoopStartNode } from '../node-runners/run-loop-start'
import { executePreviewNode } from '../node-runners/run-preview'

export async function runSubflowWrapper(
    wrapperNode: WorkflowNodes,
    outerCtx: IndexedExecutionContext,
    abortSignal: AbortSignal,
    port: IMessagePort,
    host: IHostEnvironment,
    subflowCache?: Map<string, Record<string, string>>
): Promise<string[]> {
    const subflowId = (wrapperNode as SubflowNode).data.subflowId
    if (!subflowId) throw new Error('Subflow node missing subflowId')

    const def = await loadSubflow(subflowId)
    if (!def) throw new Error(`Subflow not found: ${subflowId}`)

    // Prepare inner graph
    const inner = fromProtocolPayload({ nodes: def.graph.nodes, edges: def.graph.edges })
    const inputs = combineParentOutputsByConnectionOrder(wrapperNode.id, outerCtx)

    const seeds: Record<string, string> = {}
    // Prefer def.inputs order; expect SubflowInput nodes with data.portId matching inputs[].id
    for (let i = 0; i < def.inputs.length; i++) {
        const portDef = def.inputs[i]
        const val = inputs[i] ?? ''
        // Find SubflowInput node with matching port id
        const match = inner.nodes.find(
            n =>
                n.type === NodeType.SUBFLOW_INPUT &&
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
                (n.data as any).portId === portDef.id
        )
        if (match) seeds[match.id] = val
    }
    // Load previous inner results (in-memory) and seed only bypassed nodes to enable reuse semantics
    try {
        const prev = subflowCache?.get(subflowId)
        if (prev && typeof prev === 'object') {
            for (const [nid, val] of Object.entries(prev)) {
                const nn = inner.nodes.find(n => n.id === nid)
                if (nn && nn.data.bypass === true && typeof val === 'string') {
                    seeds[nid] = val
                }
            }
        }
    } catch {}

    // Identify all SubflowOutput nodes and map by portId
    const outNodes = inner.nodes.filter(n => n.type === NodeType.SUBFLOW_OUTPUT)
    if (!outNodes || outNodes.length === 0) throw new Error('Subflow definition missing output nodes')
    const outNodeIdToPortId = new Map<string, string>()
    for (const n of outNodes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const pid = (n.data as any).portId as string | undefined
        if (pid) outNodeIdToPortId.set(n.id, pid)
    }

    // Seed pass-through for bypass nodes where parents are already satisfiable from inputs
    try {
        // Minimal local edge index for parent lookups
        const byTarget = new Map<string, { source: string; target: string }[]>()
        const byIdEdge = new Map<string, { source: string; target: string }>()
        for (const e of inner.edges) {
            const arr = byTarget.get(e.target) || []
            arr.push({ source: e.source, target: e.target })
            byTarget.set(e.target, arr)
            byIdEdge.set(e.id, { source: e.source, target: e.target })
        }
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const tmpCtx = {
            nodeOutputs: new Map<string, string | string[]>(Object.entries(seeds)),
            nodeIndex: new Map(inner.nodes.map(n => [n.id, n])),
            edgeIndex: { byTarget, byId: byIdEdge },
        } as any as IndexedExecutionContext
        /* eslint-enable @typescript-eslint/no-explicit-any */
        // Iterate to propagate pass-through seeds along bypass chains
        const maxIters = inner.nodes.length
        for (let iter = 0; iter < maxIters; iter++) {
            let progressed = false
            for (const n of inner.nodes) {
                const isBypass = n.data.bypass === true
                if (!isBypass) continue
                if (tmpCtx.nodeOutputs?.has(n.id)) continue
                // Compute using currently available parent outputs
                const vals = combineParentOutputsByConnectionOrder(n.id, tmpCtx)
                if (vals && vals.length > 0) {
                    tmpCtx.nodeOutputs?.set(n.id, vals.join('\n'))
                    progressed = true
                }
            }
            if (!progressed) break
        }
        // Merge computed pass-through seeds back into seeds map
        if (tmpCtx.nodeOutputs) {
            for (const [k, v] of tmpCtx.nodeOutputs) {
                const s = Array.isArray(v) ? v.join('\n') : v
                seeds[k] = s
            }
        }
    } catch {
        // Best-effort; ignore seeding errors
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
    const lastOutputs = new Map<string, string>()

    // Proxy inner node events to subflow-scoped events for the outer webview
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
    const subflowWebviewProxy: IMessagePort = {
        postMessage: async (innerMsg) => {
            try {
                const msg = innerMsg as Record<string, unknown>
                if (msg.type === 'node_execution_status' && msg.data) {
                    await safePost(port, {
                        type: 'subflow_node_execution_status',
                        data: { subflowId, payload: msg.data as NodeExecutionPayload },
                    } as any)
                } else if (msg.type === 'node_assistant_content' && msg.data) {
                    await safePost(port, {
                        type: 'subflow_node_assistant_content',
                        data: {
                            subflowId,
                            ...(msg.data as any),
                        },
                    } as any)
                } else if (msg.type === 'node_sub_agent_content' && msg.data) {
                    await safePost(port, {
                        type: 'subflow_node_sub_agent_content',
                        data: {
                            subflowId,
                            ...(msg.data as any),
                        },
                    } as any)
                }
            } catch (err) {
                // Log forwarding failures so message delivery issues are diagnosable
                // eslint-disable-next-line no-console
                console.error('[subflowWebviewProxy] Failed to forward inner message', err)
            }
            return true
        },
        onDidReceiveMessage: () => {
            return { dispose: () => {} }
        },
    }
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

    const callbacks: ParallelCallbacks = {
        runNode: async (node, pctx, signal): Promise<string | string[]> => {
            const ctx = pctx as unknown as IndexedExecutionContext
            const res = await routeNodeExecution(node, 'workflow', {
                runCLI: (..._args: unknown[]) =>
                    executeCLINode(
                        node,
                        signal,
                        subflowWebviewProxy,
                        host,
                        // eslint-disable-next-line @typescript-eslint/require-await
                        async () => ({ type: 'approved' as const }),
                        ctx
                    ),
                runLLM: (..._args: unknown[]) =>
                    executeLLMNode(
                        node,
                        ctx,
                        signal,
                        subflowWebviewProxy,
                        // eslint-disable-next-line @typescript-eslint/require-await
                        async () => ({ type: 'approved' as const }),
                    ),
                runPreview: (..._args: unknown[]) =>
                    executePreviewNode(node.id, subflowWebviewProxy, ctx),
                runInput: (..._args: unknown[]) => executeInputNode(node, ctx),
                runIfElse: (..._args: unknown[]) => executeIfElseNode(ctx, node),
                runAccumulator: (..._args: unknown[]) => {
                    const acc = node as AccumulatorNode
                    const vals = combineParentOutputsByConnectionOrder(acc.id, ctx)
                    const template = acc.data.content || ''
                    const content = evalTemplate(template, vals, ctx)
                    const variableName = acc.data.variableName
                    const initialValue = acc.data.initialValue
                    let accumulatedValue =
                        ctx.accumulatorValues?.get(variableName) || initialValue || ''
                    accumulatedValue += '\n' + content
                    ctx.accumulatorValues?.set(variableName, accumulatedValue)
                    return accumulatedValue
                },
                runVariable: (..._args: unknown[]) => {
                    const vn = node as VariableNode
                    const vals = combineParentOutputsByConnectionOrder(vn.id, ctx)
                    const template = vn.data.content || ''
                    const text = evalTemplate(template, vals, ctx)
                    const variableName = vn.data.variableName
                    const initialValue = vn.data.initialValue
                    let variableValue =
                        ctx.variableValues?.get(variableName) || initialValue || ''
                    variableValue = text
                    ctx.variableValues?.set(variableName, variableValue)
                    return variableValue
                },
                runLoopStart: (..._args: unknown[]) => executeLoopStartNode(node, ctx),
                runLoopEnd: (..._args: unknown[]) => executeLoopEndNode(node, ctx),
                runSubflowOutput: (..._args: unknown[]) => {
                    const vals = combineParentOutputsByConnectionOrder(node.id, ctx)
                    return (vals || []).join('\n').trim()
                },
                runSubflowInput: (..._args: unknown[]) => {
                    // Should generally be seeded; return seeded value if any
                    const v = ctx.nodeOutputs.get(node.id)
                    return Array.isArray(v) ? v.join('\n') : v ?? ''
                },
            })
            return (Array.isArray(res) ? res : [String(res)]) as string[]
        },
        onStatus: payload => {
            // Forward inner node status while subflow view is open
            void safePost(port, {
                type: 'subflow_node_execution_status',
                data: { subflowId, payload },
            })

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
                    })
                }
            }
        },
    }

    const options = { onError: 'fail-fast', seeds: { outputs: seeds } } as const
    await executeWorkflowParallel(
        inner.nodes,
        inner.edges,
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
