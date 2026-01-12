import { isWorkflowPayloadDTO, isWorkflowToExtension } from '../Core/Contracts/guards'
import {
    AbortedError,
    type ApprovalResult,
    type ExtensionToWorkflow,
    NodeType,
    type WorkflowNodes,
} from '../Core/models'
import {
    type SliceEnv,
    registerHandlers as registerLLMHandlers,
} from '../LLMIntegration/Application/register'
import { registerHandlers as registerLibraryHandlers } from '../Library/Application/register'
import type { IHostEnvironment, IMessagePort } from '../Shared/Host/index'
import { safePost } from '../Shared/Infrastructure/messaging/safePost'
import { registerHandlers as registerSubflowsHandlers } from '../Subflows/Application/register'
import { executeSingleNode } from '../WorkflowExecution/Application/handlers/ExecuteSingleNode'
import { executeWorkflow } from '../WorkflowExecution/Application/handlers/ExecuteWorkflow'
import { executeLLMChatTurn } from '../WorkflowExecution/Application/node-runners/run-llm'
import { registerHandlers as registerPersistenceHandlers } from '../WorkflowPersistence/Application/register'
import { fromProtocolPayload } from './messaging/converters'

// Helper to count LLM nodes in a list of nodes
function countLlmNodes(nodes: WorkflowNodes[]): number {
    return nodes.filter(n => n.type === NodeType.LLM).length
}

// Global LLM cap (must match the per‑type cap in ExecuteWorkflow.ts)
const LLM_CAP = 8

// Compute total currently running LLM nodes across all active executions in a session
function getTotalLlmRunning(context: ExecutionContext): number {
    let total = 0
    for (const count of Array.from(context.activeExecutions.values())) {
        total += count
    }
    return total
}

interface ExecutionContext {
    abortController: AbortController | null
    pauseRequested: boolean
    pendingApproval: {
        resolve: (value: ApprovalResult) => void
        reject: (error: unknown) => void
        removeAbortListener?: () => void
    } | null
    subflowCache: Map<string, Record<string, string>>
    activeExecutions: Map<AbortController, number>
}

// Use IMessagePort as the key for session state
const sessionRegistry = new WeakMap<IMessagePort, ExecutionContext>()
const activeAbortControllers = new Set<AbortController>()

let inMemoryClipboard: any | null = null

function getOrCreateSessionContext(port: IMessagePort): ExecutionContext {
    let context = sessionRegistry.get(port)
    if (!context) {
        context = {
            abortController: null,
            pauseRequested: false,
            pendingApproval: null,
            subflowCache: new Map<string, Record<string, string>>(),
            activeExecutions: new Map<AbortController, number>(),
        }
        sessionRegistry.set(port, context)
    }
    return context
}

function createWaitForApproval(
    port: IMessagePort,
    signal?: AbortSignal
): (nodeId: string) => Promise<ApprovalResult> {
    return (_nodeId: string): Promise<ApprovalResult> => {
        return new Promise((resolve, reject) => {
            const context = getOrCreateSessionContext(port)
            if (context.pendingApproval) {
                reject(new Error('Approval already pending; concurrent approvals not allowed'))
                return
            }
            const current: {
                resolve: (value: ApprovalResult) => void
                reject: (error: unknown) => void
                removeAbortListener?: () => void
            } = { resolve, reject }
            // Use provided signal, fallback to context.abortController?.signal for backward compatibility
            const sig = signal ?? context.abortController?.signal
            if (sig) {
                const onAbort = () => {
                    current.resolve({ type: 'aborted' })
                    if (context.pendingApproval === current) {
                        context.pendingApproval = null
                    }
                    current.removeAbortListener = undefined
                }
                sig.addEventListener('abort', onAbort, { once: true })
                current.removeAbortListener = () => sig.removeEventListener('abort', onAbort)
            }
            context.pendingApproval = current
        })
    }
}

export function cleanupSession(port: IMessagePort) {
    const context = sessionRegistry.get(port)
    if (context) {
        if (context.pendingApproval) {
            context.pendingApproval.removeAbortListener?.()
            context.pendingApproval.resolve({ type: 'aborted' })
            context.pendingApproval = null
        }
        if (context.activeExecutions.size > 0) {
            for (const [controller] of Array.from(context.activeExecutions)) {
                controller.abort()
                activeAbortControllers.delete(controller)
            }
            context.activeExecutions.clear()
        } else if (context.abortController) {
            context.abortController.abort()
            context.abortController = null
        }
        sessionRegistry.delete(port)
    }
}

export function setupWorkflowMessageHandling(
    host: IHostEnvironment,
    port: IMessagePort,
    isDev: boolean,
    updatePanelTitle: (uri?: string) => void
) {
    const router = new Map<string, (message: any, env: SliceEnv) => Promise<void> | void>()

    registerPersistenceHandlers(router)
    registerLibraryHandlers(router)
    registerSubflowsHandlers(router)
    registerLLMHandlers(router)

    const env: SliceEnv = { port, host, isDev, updatePanelTitle }

    port.onDidReceiveMessage(async (message: unknown) => {
        if (!isWorkflowToExtension(message)) {
            return
        }
        const handler = router.get((message as any).type)
        if (handler) {
            await handler(message as any, env)
            return
        }

        switch ((message as any).type) {
            case 'reset_results': {
                const ctx = getOrCreateSessionContext(port)
                ctx.subflowCache.clear()
                break
            }
            case 'load_workflow':
                break
            case 'pause_workflow': {
                const ctx = getOrCreateSessionContext(port)
                ctx.pauseRequested = true
                break
            }
            case 'execute_workflow': {
                const ctx = getOrCreateSessionContext(port)

                const data = (message as any).data
                if (data?.nodes && data?.edges) {
                    // Parse nodes and edges
                    const { nodes, edges } = fromProtocolPayload(data)
                    const resume = data.resume

                    // Compute filtered nodes and edges based on resume (if any)
                    let filteredResume = resume
                    let execNodes = nodes
                    let execEdges = edges

                    if (resume?.fromNodeId) {
                        // ... (same pruning logic as before)
                        const allowed = new Set<string>()
                        const bySource = new Map<string, typeof edges>()
                        for (const e of edges) {
                            const arr = bySource.get(e.source) || []
                            arr.push(e)
                            bySource.set(e.source, arr)
                        }
                        const q: string[] = [resume.fromNodeId]
                        while (q.length) {
                            const cur = q.shift()!
                            if (allowed.has(cur)) continue
                            allowed.add(cur)
                            for (const e of bySource.get(cur) || []) {
                                q.push(e.target)
                            }
                        }
                        execNodes = nodes.filter(n => allowed.has(n.id))
                        execEdges = edges.filter(e => allowed.has(e.target))
                        // ... seeds filtering ...
                        const allowedIds = allowed
                        const bypassIds = new Set(
                            execNodes.filter(n => (n as any)?.data?.bypass === true).map(n => n.id)
                        )
                        const outputs = Object.entries(
                            (resume?.seeds?.outputs as Record<string, string>) || {}
                        ).filter(([id]) => !allowedIds.has(id) || bypassIds.has(id))
                        const decisions = Object.entries(
                            (resume?.seeds?.decisions as Record<string, 'true' | 'false'>) || {}
                        ).filter(([id]) => !allowedIds.has(id) || bypassIds.has(id))
                        filteredResume = {
                            ...resume,
                            seeds: {
                                outputs: Object.fromEntries(outputs),
                                decisions: Object.fromEntries(decisions),
                                variables: (resume?.seeds as any)?.variables,
                            },
                        }
                    } else if (resume?.seeds?.outputs && process.env.NEBULAFLOW_FILTER_PAUSE_SEEDS) {
                        const bypassIds = new Set(
                            nodes.filter(n => (n as any)?.data?.bypass === true).map(n => n.id)
                        )
                        const outputs = Object.entries(
                            (resume?.seeds?.outputs as Record<string, string>) || {}
                        ).filter(([id]) => bypassIds.has(id))
                        filteredResume = {
                            ...resume,
                            seeds: {
                                outputs: Object.fromEntries(outputs),
                                decisions: (resume?.seeds as any)?.decisions,
                                variables: (resume?.seeds as any)?.variables,
                            },
                        }
                    }

                    // Count LLM nodes that will actually be executed
                    const newLlmCount = countLlmNodes(execNodes)
                    const currentTotal = getTotalLlmRunning(ctx)
                    if (currentTotal + newLlmCount > LLM_CAP) {
                        void host.window.showInformationMessage(
                            `Cannot start workflow: LLM node limit of ${LLM_CAP} would be exceeded (currently ${currentTotal}, requested ${newLlmCount})`
                        )
                        await safePost(port, { type: 'execution_completed' } as ExtensionToWorkflow, {
                            strict: isDev,
                        })
                        break
                    }

                    // Create abort controller for this execution
                    const abortController = new AbortController()
                    ctx.activeExecutions.set(abortController, newLlmCount)
                    activeAbortControllers.add(abortController)
                    ctx.abortController = null

                    try {
                        const approvalHandler = createWaitForApproval(port, abortController.signal)
                        ctx.pauseRequested = false

                        const pauseRef = { isPaused: () => ctx.pauseRequested === true }
                        await executeWorkflow(
                            execNodes,
                            execEdges,
                            port,
                            host,
                            abortController.signal,
                            approvalHandler,
                            filteredResume,
                            pauseRef,
                            ctx.subflowCache
                        )
                    } finally {
                        ctx.activeExecutions.delete(abortController)
                        activeAbortControllers.delete(abortController)
                    }
                }
                break
            }
            case 'execute_node': {
                const ctx = getOrCreateSessionContext(port)
                if (ctx.pauseRequested) {
                    void host.window.showInformationMessage('Cannot run node while paused')
                    break
                }
                // Parse node
                const nodeDTO = (message as any).data.node
                if (!nodeDTO) {
                    void host.window.showErrorMessage('No node data provided')
                    break
                }
                // Convert to internal node representation to get type
                const { nodes } = fromProtocolPayload({ nodes: [nodeDTO], edges: [] })
                const node = nodes[0]
                if (!node) {
                    void host.window.showErrorMessage('Node not found')
                    break
                }
                const newLlmCount = node.type === NodeType.LLM ? 1 : 0
                const currentTotal = getTotalLlmRunning(ctx)
                if (currentTotal + newLlmCount > LLM_CAP) {
                    void host.window.showInformationMessage(
                        `Cannot start node: LLM node limit of ${LLM_CAP} would be exceeded (currently ${currentTotal}, requested ${newLlmCount})`
                    )
                    await safePost(port, { type: 'execution_completed' } as ExtensionToWorkflow, {
                        strict: isDev,
                    })
                    break
                }
                // Create abort controller for this execution
                const abortController = new AbortController()
                ctx.activeExecutions.set(abortController, newLlmCount)
                activeAbortControllers.add(abortController)
                ctx.abortController = null
                try {
                    const approvalHandler = createWaitForApproval(port, abortController.signal)
                    await safePost(port, { type: 'execution_started' } as ExtensionToWorkflow, {
                        strict: isDev,
                    })
                    await executeSingleNode(
                        (message as any).data,
                        port,
                        host,
                        abortController.signal,
                        approvalHandler
                    )
                } finally {
                    await safePost(port, { type: 'execution_completed' } as ExtensionToWorkflow, {
                        strict: isDev,
                    })
                    ctx.activeExecutions.delete(abortController)
                    activeAbortControllers.delete(abortController)
                }
                break
            }
            case 'llm_node_chat': {
                const ctx = getOrCreateSessionContext(port)
                if (ctx.pauseRequested) {
                    void host.window.showInformationMessage('Cannot start chat while paused')
                    break
                }
                const data = (message as any).data
                // Parse node to count LLM nodes (should be 1)
                const { nodes } = fromProtocolPayload({ nodes: [data.node], edges: [] })
                const newLlmCount = countLlmNodes(nodes)
                const currentTotal = getTotalLlmRunning(ctx)
                if (currentTotal + newLlmCount > LLM_CAP) {
                    void host.window.showInformationMessage(
                        `Cannot start chat: LLM node limit of ${LLM_CAP} would be exceeded (currently ${currentTotal}, requested ${newLlmCount})`
                    )
                    await safePost(port, { type: 'execution_completed' } as ExtensionToWorkflow, {
                        strict: isDev,
                    })
                    break
                }

                // Create abort controller for this execution
                const abortController = new AbortController()
                ctx.activeExecutions.set(abortController, newLlmCount)
                activeAbortControllers.add(abortController)
                ctx.abortController = null

                let nodeId: string | undefined
                try {
                    const approvalHandler = createWaitForApproval(port, abortController.signal)
                    await safePost(port, { type: 'execution_started' } as ExtensionToWorkflow, {
                        strict: isDev,
                    })
                    const node = nodes[0] as any
                    if (!node) {
                        void host.window.showErrorMessage('LLM chat failed: node not found')
                        break
                    }
                    nodeId = node.id
                    await safePost(port, {
                        type: 'node_execution_status',
                        data: { nodeId, status: 'running' },
                    } as ExtensionToWorkflow)

                    try {
                        const result = await executeLLMChatTurn(
                            node,
                            data.threadID as string,
                            data.message as string,
                            abortController.signal,
                            port,
                            approvalHandler
                        )
                        await safePost(port, {
                            type: 'node_execution_status',
                            data: { nodeId, status: 'completed', result: result ?? '' },
                        } as ExtensionToWorkflow)
                    } catch (error) {
                        const aborted = abortController.signal.aborted || error instanceof AbortedError
                        const msg = error instanceof Error ? error.message : String(error)
                        if (aborted) {
                            await safePost(port, {
                                type: 'node_execution_status',
                                data: { nodeId: nodeId ?? data.node?.id, status: 'interrupted' },
                            } as ExtensionToWorkflow)
                        } else {
                            void host.window.showErrorMessage(`LLM Chat Error: ${msg}`)
                            await safePost(port, {
                                type: 'node_execution_status',
                                data: {
                                    nodeId: nodeId ?? data.node?.id,
                                    status: 'error',
                                    result: msg,
                                },
                            } as ExtensionToWorkflow)
                        }
                    }
                } finally {
                    await safePost(port, { type: 'execution_completed' } as ExtensionToWorkflow, {
                        strict: isDev,
                    })
                    ctx.activeExecutions.delete(abortController)
                    activeAbortControllers.delete(abortController)
                }
                break
            }
            case 'abort_workflow': {
                const ctx = getOrCreateSessionContext(port)
                if (ctx.pendingApproval) {
                    ctx.pendingApproval.removeAbortListener?.()
                    ctx.pendingApproval.resolve({ type: 'aborted' })
                    ctx.pendingApproval = null
                }
                if (ctx.activeExecutions.size > 0) {
                    for (const [controller] of Array.from(ctx.activeExecutions)) {
                        controller.abort()
                        activeAbortControllers.delete(controller)
                    }
                    ctx.activeExecutions.clear()
                } else if (ctx.abortController) {
                    const c = ctx.abortController
                    ctx.abortController = null
                    c.abort()
                    activeAbortControllers.delete(c)
                } else if (ctx.pauseRequested) {
                    await safePost(port, { type: 'execution_completed' } as ExtensionToWorkflow, {
                        strict: isDev,
                    })
                }
                ctx.pauseRequested = false
                break
            }
            case 'calculate_tokens': {
                const text = (message as any).data.text || ''
                await safePost(
                    port,
                    {
                        type: 'token_count',
                        data: { nodeId: (message as any).data.nodeId, count: text.length },
                    } as ExtensionToWorkflow,
                    { strict: isDev }
                )
                break
            }
            case 'copy_selection': {
                const payload = (message as any).data
                if (payload && isWorkflowPayloadDTO(payload)) {
                    inMemoryClipboard = payload
                    try {
                        await host.clipboard.writeText(JSON.stringify(payload))
                    } catch (e) {
                        console.error(e)
                    }
                }
                break
            }
            case 'paste_selection': {
                let payload: unknown = inMemoryClipboard
                try {
                    const text = await host.clipboard.readText()
                    if (text) {
                        const parsed = JSON.parse(text)
                        if (isWorkflowPayloadDTO(parsed)) {
                            payload = parsed
                            inMemoryClipboard = parsed
                        }
                    }
                } catch {}
                if (payload && isWorkflowPayloadDTO(payload)) {
                    await safePost(
                        port,
                        { type: 'clipboard_paste', data: payload } as ExtensionToWorkflow,
                        { strict: isDev }
                    )
                } else {
                    await safePost(port, { type: 'clipboard_paste' } as ExtensionToWorkflow, {
                        strict: isDev,
                    })
                }
                break
            }
            case 'node_approved': {
                const ctx = getOrCreateSessionContext(port)
                if (ctx.pendingApproval) {
                    ctx.pendingApproval.removeAbortListener?.()
                    ctx.pendingApproval.resolve({
                        type: 'approved',
                        command: (message as any).data.modifiedCommand,
                    })
                    ctx.pendingApproval = null
                }
                break
            }
            case 'node_rejected': {
                const ctx = getOrCreateSessionContext(port)
                if (ctx.pendingApproval) {
                    ctx.pendingApproval.removeAbortListener?.()
                    ctx.pendingApproval.reject(new Error('Rejected'))
                    ctx.pendingApproval = null
                }
                break
            }
        }
    })
}

export function cancelAllActiveWorkflows() {
    for (const controller of Array.from(activeAbortControllers)) {
        controller.abort()
    }
    activeAbortControllers.clear()
}
