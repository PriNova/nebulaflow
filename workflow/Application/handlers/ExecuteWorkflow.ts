import * as vscode from 'vscode'
import { type ParallelCallbacks, executeWorkflowParallel } from '../../Core/engine/parallel-scheduler'
import { AbortedError, PausedError } from '../../Core/models'
import type { ApprovalResult, AssistantContentItem, ExtensionToWorkflow } from '../../Core/models'
import {
    type Edge,
    type IfElseNode,
    NodeType,
    type WorkflowNode,
    type WorkflowNodes,
} from '../../Core/models'
import { isToolDisabled } from '../../Core/toolUtils'
import { expandHome, execute as shellExecute } from '../../DataAccess/shell'
import { safePost } from '../messaging/safePost'
import { routeNodeExecution } from './NodeDispatch'

const DEFAULT_LLM_TIMEOUT_MS = 300_000

function isBashDisabled(disabledTools: string[] | undefined): boolean {
    return isToolDisabled('Bash', disabledTools)
}

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

function envFlagEnabled(name: string): boolean {
    const v = process.env[name]
    return !!v && /^(1|true|yes|on)$/i.test(v)
}

function hasUnsupportedNodesForParallel(nodes: WorkflowNodes[]): boolean {
    return nodes.some(
        n =>
            n.type === NodeType.IF_ELSE || n.type === NodeType.LOOP_START || n.type === NodeType.LOOP_END
    )
}

// Parallel is default now; keep helpers for potential future gating.

export async function executeWorkflow(
    nodes: WorkflowNodes[],
    edges: Edge[],
    webview: vscode.Webview,
    abortSignal: AbortSignal,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>,
    resume?: { fromNodeId: string; seeds?: { outputs?: Record<string, string> } },
    pauseRef?: { isPaused: () => boolean }
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

export function replaceIndexedInputs(
    template: string,
    parentOutputs: string[],
    context?: IndexedExecutionContext
): string {
    let result = template.replace(/\${(\d+)}(?!\w)/g, (_match, index) => {
        const adjustedIndex = Number.parseInt(index, 10) - 1
        return adjustedIndex >= 0 && adjustedIndex < parentOutputs.length
            ? parentOutputs[adjustedIndex]
            : ''
    })

    if (context) {
        if (context.loopStates) {
            for (const [, loopState] of context.loopStates) {
                result = result.replace(
                    new RegExp(`\\$\{${loopState.variable}}(?!\\w)`, 'g'),
                    String(loopState.currentIteration)
                )
            }
        }
        const accumulatorVars = context.accumulatorValues
            ? Array.from(context.accumulatorValues.keys())
            : []
        for (const varName of accumulatorVars) {
            result = result.replace(
                new RegExp(`\\$\{${varName}}(?!\\w)`, 'g'),
                context.accumulatorValues?.get(varName) || ''
            )
        }
        const variableVars = context.variableValues ? Array.from(context.variableValues.keys()) : []
        for (const varName of variableVars) {
            result = result.replace(
                new RegExp(`\\$\{${varName}}(?!\\w)`, 'g'),
                context.variableValues?.get(varName) || ''
            )
        }
    }
    return result
}

export function combineParentOutputsByConnectionOrder(
    nodeId: string,
    context?: IndexedExecutionContext,
    visited?: Set<string>
): string[] {
    const parentEdges = context?.edgeIndex.byTarget.get(nodeId) || []
    const localVisited = visited || new Set<string>()

    if (localVisited.has(nodeId)) {
        return []
    }
    localVisited.add(nodeId)

    return parentEdges
        .map(edge => {
            const parentNode = context?.nodeIndex.get(edge.source)

            if (parentNode?.type === NodeType.INPUT && parentNode.data?.active !== false) {
                const parentInputs = combineParentOutputsByConnectionOrder(
                    parentNode.id,
                    context,
                    localVisited
                )
                const template = ((parentNode as any).data?.content || '').toString()
                const text = template ? replaceIndexedInputs(template, parentInputs, context) : ''
                return text.replace(/\r\n/g, '\n')
            }

            let output = context?.nodeOutputs.get(edge.source)
            if (Array.isArray(output)) {
                output = output.join('\n')
            }
            if (output === undefined) {
                return ''
            }
            return output.replace(/\r\n/g, '\n')
        })
        .filter(output => output !== undefined)
}

async function executeLLMNode(
    node: WorkflowNodes,
    context: IndexedExecutionContext,
    abortSignal: AbortSignal,
    webview: vscode.Webview,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>
): Promise<string> {
    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
    const template = ((node as any).data?.content || '').toString()
    const prompt = template
        ? replaceIndexedInputs(template, inputs, context).trim()
        : (inputs[0] || '').trim()
    if (!prompt) {
        throw new Error('LLM Node requires a non-empty prompt')
    }

    let createAmp: any
    try {
        ;({ createAmp } = require('@sourcegraph/amp-sdk'))
    } catch {
        throw new Error('Amp SDK not available')
    }

    const apiKey = process.env.AMP_API_KEY
    if (!apiKey) {
        throw new Error('AMP_API_KEY is not set')
    }

    const { getActiveWorkspaceRoots } = await import('../workspace.js')
    const workspaceRoots = getActiveWorkspaceRoots()
    console.debug('executeLLMNode: ', JSON.stringify(workspaceRoots, null, 2))

    // Determine model key from node selection, validating with SDK when available
    const defaultModelKey = 'anthropic/claude-sonnet-4-5-20250929'
    const modelId = (node as any)?.data?.model?.id as string | undefined
    let selectedKey: string | undefined
    if (modelId) {
        try {
            const sdk = require('@sourcegraph/amp-sdk') as any
            const resolveModel:
                | ((args: { key: string } | { displayName: string; provider?: any }) => { key: string })
                | undefined = sdk?.resolveModel
            if (typeof resolveModel === 'function') {
                const { key } = resolveModel({ key: modelId })
                selectedKey = key
            }
        } catch {
            // Ignore and fall back
        }
    }

    const disabledTools: string[] | undefined = (node as any)?.data?.disabledTools
    const dangerouslyAllowAll: boolean | undefined = (node as any)?.data?.dangerouslyAllowAll
    const rawReasoningEffort: string | undefined = (node as any)?.data?.reasoningEffort
    const validReasoningEfforts = new Set(['minimal', 'low', 'medium', 'high'])
    const reasoningEffort =
        rawReasoningEffort && validReasoningEfforts.has(rawReasoningEffort)
            ? rawReasoningEffort
            : 'medium'
    const bashDisabled = isBashDisabled(disabledTools)
    const shouldApplyAllowAll = dangerouslyAllowAll && !bashDisabled
    if (bashDisabled && dangerouslyAllowAll) {
        console.debug('[ExecuteWorkflow] Bash is disabled; ignoring dangerouslyAllowAll flag for safety')
    }
    const amp = await createAmp({
        apiKey,
        workspaceRoots,
        settings: {
            'internal.primaryModel': selectedKey ?? defaultModelKey,
            ...(disabledTools && disabledTools.length > 0 ? { 'tools.disable': disabledTools } : {}),
            'reasoning.effort': reasoningEffort as any,
            ...(shouldApplyAllowAll
                ? {
                      'amp.dangerouslyAllowAll': true,
                      'amp.experimental.commandApproval.enabled': false,
                      'amp.commands.allowlist': ['*'],
                      'amp.commands.strict': false,
                  }
                : {}),
        },
    })
    try {
        let finalText = ''
        const handledBlocked = new Set<string>()
        const streamP = (async () => {
            for await (const event of amp.runJSONL({ prompt })) {
                abortSignal.throwIfAborted()
                if (event.type === 'messages') {
                    const thread = event.thread as any
                    const items = extractAssistantTimeline(thread)
                    await safePost(webview, {
                        type: 'node_assistant_content',
                        data: {
                            nodeId: node.id,
                            threadID: thread.id,
                            content: items,
                        },
                    } as ExtensionToWorkflow)

                    // Detect blocked-on-user tool results and request approval
                    try {
                        const blocked: Array<{
                            toolUseID: string
                            toAllow?: string[]
                            reason?: string
                            tokens?: { percent?: number; threshold?: number }
                        }> = []
                        for (const msg of thread?.messages || []) {
                            if (msg.role === 'user') {
                                for (const block of msg.content || []) {
                                    if (block.type === 'tool_result') {
                                        const run = block.run || {}
                                        if (run?.status === 'blocked-on-user' && block.toolUseID) {
                                            blocked.push({
                                                toolUseID: block.toolUseID,
                                                toAllow: run.toAllow,
                                                reason: run.reason,
                                                tokens: run.tokens,
                                            })
                                        }
                                    }
                                }
                            }
                        }
                        for (const b of blocked) {
                            if (handledBlocked.has(b.toolUseID)) continue
                            handledBlocked.add(b.toolUseID)

                            // Auto-approve when dangerouslyAllowAll is enabled, regardless of toAllow content
                            if (shouldApplyAllowAll) {
                                if (!b.toAllow || b.toAllow.length === 0) {
                                    console.warn(
                                        '[ExecuteWorkflow] Auto-approving toolUseID=%s with no explicit toAllow',
                                        b.toolUseID
                                    )
                                }
                                await amp.sendToolInput({
                                    threadID: thread.id,
                                    toolUseID: b.toolUseID,
                                    value: { accepted: true },
                                })
                                continue
                            }

                            const summaryLines: string[] = []
                            if (b.toAllow && Array.isArray(b.toAllow) && b.toAllow.length > 0) {
                                summaryLines.push('Command(s) awaiting approval:')
                                for (const c of b.toAllow) summaryLines.push(`- ${c}`)
                            }
                            if (b.reason) summaryLines.push(`Reason: ${b.reason}`)
                            if (b.tokens && (b.tokens.percent != null || b.tokens.threshold != null)) {
                                const pct = b.tokens.percent != null ? `${b.tokens.percent}%` : 'n/a'
                                const thr = b.tokens.threshold != null ? `${b.tokens.threshold}` : 'n/a'
                                summaryLines.push(`Tokens: ${pct} (threshold ${thr})`)
                            }
                            const display = summaryLines.join('\n') || 'Approval required'

                            await safePost(webview, {
                                type: 'node_execution_status',
                                data: { nodeId: node.id, status: 'pending_approval', result: display },
                            } as ExtensionToWorkflow)

                            let accepted = false
                            try {
                                const decision = await approvalHandler(node.id)
                                if ((decision as any)?.type === 'aborted') {
                                    throw new AbortedError()
                                }
                                accepted = true
                            } catch {
                                accepted = false
                            }

                            await amp.sendToolInput({
                                threadID: thread.id,
                                toolUseID: b.toolUseID,
                                value: { accepted },
                            })
                        }
                    } catch (e) {
                        // If approval wait aborted, surface abort
                        if (e instanceof AbortedError) throw e
                        // Otherwise, continue streaming; errors here shouldn't crash the node
                    }

                    // Update latest assistant text for final result only
                    const lastAssistantMessage = thread.messages?.findLast(
                        (m: any) => m.role === 'assistant'
                    )
                    if (lastAssistantMessage) {
                        const textBlocks = (lastAssistantMessage.content || []).filter(
                            (b: any) => b.type === 'text'
                        )
                        if (textBlocks.length > 0) {
                            finalText = textBlocks
                                .map((b: any) => b.text)
                                .join('\n')
                                .trim()
                        }
                    }
                }
            }
        })()

        let abortHandler: (() => void) | undefined
        const abortP = new Promise<never>((_, rej) => {
            abortHandler = () => rej(new AbortedError())
            abortSignal.addEventListener('abort', abortHandler)
        }).catch(() => {})
        const sec = Number((node as any)?.data?.timeoutSec)
        const disableTimeout = sec === 0
        const timeoutMs =
            Number.isFinite(sec) && sec > 0 ? Math.floor(sec * 1000) : DEFAULT_LLM_TIMEOUT_MS
        let timer: ReturnType<typeof setTimeout> | undefined
        const timeoutP = disableTimeout
            ? undefined
            : new Promise<never>((_, rej) => {
                  timer = setTimeout(() => rej(new Error('LLM request timed out')), timeoutMs)
              })

        try {
            const racePromises = timeoutP ? [streamP, abortP, timeoutP] : [streamP, abortP]
            await Promise.race(racePromises)
        } finally {
            if (timer) clearTimeout(timer)
            if (abortHandler) abortSignal.removeEventListener('abort', abortHandler)
        }
        return finalText
    } finally {
        await amp.dispose()
    }
}

function extractAssistantTimeline(thread: any): AssistantContentItem[] {
    const items: AssistantContentItem[] = []

    for (const msg of thread?.messages || []) {
        if (msg.role === 'assistant') {
            for (const block of msg.content || []) {
                if (block.type === 'text') {
                    items.push({ type: 'text', text: block.text || '' })
                } else if (block.type === 'thinking') {
                    items.push({ type: 'thinking', thinking: block.thinking || '' })
                } else if (block.type === 'tool_use') {
                    const inputJSON = block.inputPartialJSON?.json || JSON.stringify(block.input || {})
                    items.push({ type: 'tool_use', id: block.id, name: block.name, inputJSON })
                } else if (block.type === 'server_tool_use') {
                    const inputJSON = JSON.stringify(block.input || {})
                    items.push({ type: 'server_tool_use', name: block.name, inputJSON })
                } else if (block.type === 'server_web_search_result') {
                    const resultJSON = safeSafeStringify(block.result)
                    items.push({
                        type: 'server_web_search_result',
                        query: (block as any).query,
                        resultJSON,
                    })
                }
            }
        } else if (msg.role === 'user') {
            for (const block of msg.content || []) {
                if (block.type === 'tool_result') {
                    const run = block.run || {}
                    const resultJSON = safeSafeStringify(run)
                    items.push({ type: 'tool_result', toolUseID: block.toolUseID, resultJSON })
                }
            }
        }
    }

    return items
}

function safeSafeStringify(obj: any, maxLength = 100000): string {
    try {
        const str = JSON.stringify(obj, null, 2)
        if (str.length > maxLength) {
            return str.slice(0, maxLength) + '\n... (truncated)'
        }
        return str
    } catch {
        return String(obj)
    }
}

export async function executeCLINode(
    node: WorkflowNodes,
    abortSignal: AbortSignal,
    webview: vscode.Webview,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>,
    context?: IndexedExecutionContext
): Promise<string> {
    abortSignal.throwIfAborted()
    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
    const command = node.data.content ? replaceIndexedInputs(node.data.content, inputs, context) : ''
    if (!command.trim()) {
        throw new Error('CLI Node requires a non-empty command')
    }

    let filteredCommand = expandHome(command) || ''

    if (node.data.needsUserApproval) {
        await safePost(webview, {
            type: 'node_execution_status',
            data: { nodeId: node.id, status: 'pending_approval', result: `${filteredCommand}` },
        } as ExtensionToWorkflow)
        const approval = await approvalHandler(node.id)
        if (approval.type === 'aborted') {
            throw new AbortedError()
        }
        if (approval.type === 'approved' && approval.command) {
            filteredCommand = approval.command
        }
    }

    if (commandsNotAllowed.some(cmd => sanitizeForShell(filteredCommand).startsWith(cmd))) {
        void vscode.window.showErrorMessage('Command cannot be executed')
        throw new Error('Command cannot be executed')
    }

    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!cwd) {
        void vscode.window.showInformationMessage(
            'No workspace folder found. CLI command will run in the extension process directory.'
        )
    }

    try {
        const { output, exitCode } = await shellExecute(filteredCommand, abortSignal, { cwd })
        if (exitCode !== '0' && (node as any).data?.shouldAbort) {
            throw new Error(output)
        }
        context?.cliMetadata?.set(node.id, { exitCode: exitCode })
        return output
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`CLI Node execution failed: ${errorMessage}`)
    }
}

async function executePreviewNode(
    nodeId: string,
    webview: vscode.Webview,
    context: IndexedExecutionContext
): Promise<string> {
    const input = combineParentOutputsByConnectionOrder(nodeId, context).join('\n')
    const processedInput = replaceIndexedInputs(input, [], context)
    const trimmedInput = processedInput.trim()
    const tokenCount = trimmedInput.length
    await safePost(webview, {
        type: 'token_count',
        data: { nodeId, count: tokenCount },
    } as ExtensionToWorkflow)
    return trimmedInput
}

async function executeInputNode(node: WorkflowNode, context: IndexedExecutionContext): Promise<string> {
    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
    const text = node.data.content ? replaceIndexedInputs(node.data.content, inputs, context) : ''
    return text.trim()
}

async function executeIfElseNode(
    context: IndexedExecutionContext,
    node: WorkflowNode | IfElseNode
): Promise<string> {
    let result = ''
    const parentEdges = context.edgeIndex.byTarget.get(node.id) || []
    let cliNode: WorkflowNodes | undefined
    let cliExitCode: string | undefined

    for (const edge of parentEdges) {
        const parentNode = context.nodeIndex.get(edge.source)
        if (parentNode?.type === NodeType.CLI) {
            cliNode = parentNode
            cliExitCode = context.cliMetadata?.get(parentNode.id)?.exitCode
            break
        }
    }

    let hasResult: boolean

    if (cliNode) {
        hasResult = cliExitCode === '0'
        result = context.nodeOutputs.get(cliNode.id) as string
    } else {
        const inputs = combineParentOutputsByConnectionOrder(node.id, context)
        const condition = node.data.content
            ? replaceIndexedInputs(node.data.content, inputs, context)
            : ''
        const [leftSide, operator, rightSide] = condition.trim().split(/\s+(===|!==)\s+/)
        hasResult = operator === '===' ? leftSide === rightSide : leftSide !== rightSide
        result = hasResult ? 'true' : 'false'
    }

    context.ifelseSkipPaths?.set(node.id, new Set<string>())
    const edges = context.edgeIndex.bySource.get(node.id) || []
    const nonTakenPath = edges.find(edge => edge.sourceHandle === (hasResult ? 'false' : 'true'))
    if (nonTakenPath) {
        if (!context.ifelseSkipPaths) {
            context.ifelseSkipPaths = new Map<string, Set<string>>()
        }
        let skipNodes = context.ifelseSkipPaths?.get(node.id)
        skipNodes = new Set<string>()
        context.ifelseSkipPaths?.set(node.id, skipNodes)
        const allEdges = Array.from(context.edgeIndex.byId.values())
        const nodesToSkip = getInactiveNodes(allEdges, nonTakenPath.target)
        for (const nodeId of nodesToSkip) {
            skipNodes.add(nodeId)
        }
    }
    return result
}

function getInactiveNodes(edges: Edge[], startNodeId: string): Set<string> {
    const inactiveNodes = new Set<string>()
    const queue = [startNodeId]
    while (queue.length > 0) {
        const currentId = queue.shift()!
        inactiveNodes.add(currentId)
        for (const edge of edges) {
            if (edge.source === currentId && !inactiveNodes.has(edge.target)) {
                queue.push(edge.target)
            }
        }
    }
    return inactiveNodes
}

export function sanitizeForShell(input: string): string {
    let sanitized = input.replace(/\\/g, '\\\\')
    sanitized = sanitized.replace(/\${/g, '\\${')
    sanitized = sanitized.replace(/\"/g, '\\"')
    for (const char of ["'", ';']) {
        sanitized = sanitized.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`)
    }
    return sanitized
}

async function executeLoopStartNode(
    node: WorkflowNodes,
    context: IndexedExecutionContext
): Promise<string> {
    const getInputsByHandle = (handleType: string) =>
        combineParentOutputsByConnectionOrder(node.id, {
            ...context,
            edgeIndex: {
                ...context.edgeIndex,
                byTarget: new Map([
                    [
                        node.id,
                        (context.edgeIndex.byTarget.get(node.id) || []).filter(
                            edge => edge.targetHandle === handleType
                        ),
                    ],
                ]),
            },
        })

    const mainInputs = getInputsByHandle('main')
    const iterationOverrides = getInputsByHandle('iterations-override')

    let loopState = context.loopStates.get(node.id)

    if (!loopState) {
        const maxIterations =
            iterationOverrides.length > 0
                ? Number.parseInt(iterationOverrides[0], 10) || (node as any).data.iterations
                : (node as any).data.iterations
        loopState = { currentIteration: 0, maxIterations, variable: (node as any).data.loopVariable }
        context.loopStates.set(node.id, loopState)
    } else if (loopState.currentIteration < loopState.maxIterations - 1) {
        context.loopStates.set(node.id, {
            ...loopState,
            currentIteration: loopState.currentIteration + 1,
        })
    }
    return mainInputs.join('\n')
}

const commandsNotAllowed = [
    'rm',
    'chmod',
    'shutdown',
    'history',
    'user',
    'sudo',
    'su',
    'passwd',
    'chown',
    'chgrp',
    'kill',
    'reboot',
    'poweroff',
    'init',
    'systemctl',
    'journalctl',
    'dmesg',
    'lsblk',
    'lsmod',
    'modprobe',
    'insmod',
    'rmmod',
    'lsusb',
    'lspci',
]
