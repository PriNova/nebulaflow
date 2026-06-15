import { isWorkflowPayloadDTO, isWorkflowToExtension } from '../Core/Contracts/guards'
import {
    AbortedError,
    type ApprovalResult,
    type ExtensionToWorkflow,
    NodeType,
    type WorkflowNodes,
} from '../Core/models'
import type {
    WorkflowPayloadDTO,
} from '../Core/Contracts/Protocol'
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

let inMemoryClipboard: WorkflowPayloadDTO | null = null

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
    const router = new Map<string, (message: unknown, env: SliceEnv) => Promise<void> | void>()

    registerPersistenceHandlers(router)
    registerLibraryHandlers(router)
    registerSubflowsHandlers(router)
    registerLLMHandlers(router)

    const env: SliceEnv = { port, host, isDev, updatePanelTitle }

    port.onDidReceiveMessage(async (message: unknown) => {
        if (!isWorkflowToExtension(message)) {
            return
        }
        // message is narrowed to WorkflowToExtension by the guard above
        const handler = router.get(message.type)
        if (handler) {
            await handler(message, env)
            return
        }

        switch (message.type) {
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

                const payload = message.data
                if (payload.nodes && payload.edges) {
                    // Parse nodes and edges
                    const { nodes, edges } = fromProtocolPayload(payload)
                    const resume = payload.resume

                    // Compute filtered nodes and edges based on resume (if any)
                    let filteredResume = resume
                    let execNodes = nodes
                    let execEdges = edges

                    if (resume?.fromNodeId) {
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
                        const allowedIds = allowed
                        const bypassIds = new Set(
                            execNodes.filter(n => n.data?.bypass === true).map(n => n.id)
                        )
                        const outputs = Object.entries(
                            resume?.seeds?.outputs ?? {}
                        ).filter(([id]) => !allowedIds.has(id) || bypassIds.has(id))
                        const decisions = Object.entries(
                            resume?.seeds?.decisions ?? {}
                        ).filter(([id]) => !allowedIds.has(id) || bypassIds.has(id))
                        filteredResume = {
                            ...resume,
                            seeds: {
                                outputs: Object.fromEntries(outputs),
                                decisions: Object.fromEntries(decisions),
                                variables: resume?.seeds?.variables,
                            },
                        }
                    } else if (resume?.seeds?.outputs && process.env.NEBULAFLOW_FILTER_PAUSE_SEEDS) {
                        const bypassIds = new Set(
                            nodes.filter(n => n.data?.bypass === true).map(n => n.id)
                        )
                        const outputs = Object.entries(
                            resume.seeds.outputs
                        ).filter(([id]) => bypassIds.has(id))
                        filteredResume = {
                            ...resume,
                            seeds: {
                                outputs: Object.fromEntries(outputs),
                                decisions: resume.seeds?.decisions,
                                variables: resume.seeds?.variables,
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
                        await safePost(port, { type: 'execution_completed' }, {
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
                            filteredResume as { fromNodeId: string; seeds?: { outputs?: Record<string, string> } } | undefined,
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
                const nodeDTO = message.data.node
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
                    await safePost(port, { type: 'execution_completed' }, {
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
                    await safePost(port, { type: 'execution_started' }, {
                        strict: isDev,
                    })
                    await executeSingleNode(
                        message.data,
                        port,
                        host,
                        abortController.signal,
                        approvalHandler
                    )
                } finally {
                    await safePost(port, { type: 'execution_completed' }, {
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
                // Parse node to count LLM nodes (should be 1)
                const { nodes } = fromProtocolPayload({ nodes: [message.data.node], edges: [] })
                const newLlmCount = countLlmNodes(nodes)
                const currentTotal = getTotalLlmRunning(ctx)
                if (currentTotal + newLlmCount > LLM_CAP) {
                    void host.window.showInformationMessage(
                        `Cannot start chat: LLM node limit of ${LLM_CAP} would be exceeded (currently ${currentTotal}, requested ${newLlmCount})`
                    )
                    await safePost(port, { type: 'execution_completed' }, {
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
                    await safePost(port, { type: 'execution_started' }, {
                        strict: isDev,
                    })
                    const node = nodes[0]
                    if (!node) {
                        void host.window.showErrorMessage('LLM chat failed: node not found')
                        break
                    }
                    nodeId = node.id
                    const statusMsg: ExtensionToWorkflow = {
                        type: 'node_execution_status',
                        data: { nodeId, status: 'running' },
                    }
                    await safePost(port, statusMsg)

                    try {
                        const result = await executeLLMChatTurn(
                            node,
                            message.data.threadID,
                            message.data.message,
                            abortController.signal,
                            port,
                            approvalHandler
                        )
                        const completedMsg: ExtensionToWorkflow = {
                            type: 'node_execution_status',
                            data: { nodeId, status: 'completed', result: result ?? '' },
                        }
                        await safePost(port, completedMsg)
                    } catch (error) {
                        const aborted = abortController.signal.aborted || error instanceof AbortedError
                        const errMsg = error instanceof Error ? error.message : String(error)
                        if (aborted) {
                            await safePost(port, {
                                type: 'node_execution_status',
                                data: { nodeId: nodeId ?? message.data.node.id, status: 'interrupted' },
                            })
                        } else {
                            void host.window.showErrorMessage(`LLM Chat Error: ${errMsg}`)
                            await safePost(port, {
                                type: 'node_execution_status',
                                data: {
                                    nodeId: nodeId ?? message.data.node.id,
                                    status: 'error',
                                    result: errMsg,
                                },
                            })
                        }
                    }
                } finally {
                    await safePost(port, { type: 'execution_completed' }, {
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
                    await safePost(port, { type: 'execution_completed' }, {
                        strict: isDev,
                    })
                }
                ctx.pauseRequested = false
                break
            }
            case 'calculate_tokens': {
                const text = message.data.text || ''
                await safePost(
                    port,
                    {
                        type: 'token_count',
                        data: { nodeId: message.data.nodeId, count: text.length },
                    },
                    { strict: isDev }
                )
                break
            }
            case 'copy_selection': {
                const payload = message.data
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
                        const parsed: unknown = JSON.parse(text)
                        if (isWorkflowPayloadDTO(parsed)) {
                            payload = parsed
                            inMemoryClipboard = parsed
                        }
                    }
                } catch {
                    // clipboard read or parse failed — use in-memory fallback
                }
                if (payload && isWorkflowPayloadDTO(payload)) {
                    await safePost(
                        port,
                        { type: 'clipboard_paste', data: payload },
                        { strict: isDev }
                    )
                } else {
                    await safePost(port, { type: 'clipboard_paste' }, {
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
                        command: message.data.modifiedCommand,
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
