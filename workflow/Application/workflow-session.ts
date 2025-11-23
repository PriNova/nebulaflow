import { isWorkflowPayloadDTO, isWorkflowToExtension } from '../Core/Contracts/guards'
import type { ApprovalResult, ExtensionToWorkflow } from '../Core/models'
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
import { registerHandlers as registerPersistenceHandlers } from '../WorkflowPersistence/Application/register'
import { fromProtocolPayload } from './messaging/converters'

interface ExecutionContext {
    abortController: AbortController | null
    pauseRequested: boolean
    pendingApproval: {
        resolve: (value: ApprovalResult) => void
        reject: (error: unknown) => void
        removeAbortListener?: () => void
    } | null
    subflowCache: Map<string, Record<string, string>>
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
        }
        sessionRegistry.set(port, context)
    }
    return context
}

function createWaitForApproval(port: IMessagePort): (nodeId: string) => Promise<ApprovalResult> {
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
            const signal = context.abortController?.signal
            if (signal) {
                const onAbort = () => {
                    current.resolve({ type: 'aborted' })
                    if (context.pendingApproval === current) {
                        context.pendingApproval = null
                    }
                    current.removeAbortListener = undefined
                }
                signal.addEventListener('abort', onAbort, { once: true })
                current.removeAbortListener = () => signal.removeEventListener('abort', onAbort)
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
        if (context.abortController) {
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
                if (ctx.abortController) {
                    void host.window.showInformationMessage(
                        'NebulaFlow Workflow Editor: execution already in progress'
                    )
                    await safePost(port, { type: 'execution_completed' } as ExtensionToWorkflow, {
                        strict: isDev,
                    })
                    break
                }
                const data = (message as any).data
                if (data?.nodes && data?.edges) {
                    ctx.abortController = new AbortController()
                    activeAbortControllers.add(ctx.abortController)
                    try {
                        const { nodes, edges } = fromProtocolPayload(data)
                        const resume = data.resume
                        const approvalHandler = createWaitForApproval(port)

                        ctx.pauseRequested = false

                        let filteredResume = resume
                        let execNodes = nodes
                        let execEdges = edges

                        // Resume logic (simplified copy)
                        if (resume?.fromNodeId) {
                            // ... (same pruning logic as before)
                            // For brevity, I'll include the full logic or import it?
                            // It's better to keep it here.
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

                        const pauseRef = { isPaused: () => ctx.pauseRequested === true }
                        await executeWorkflow(
                            execNodes,
                            execEdges,
                            port,
                            host,
                            ctx.abortController.signal,
                            approvalHandler,
                            filteredResume,
                            pauseRef,
                            ctx.subflowCache
                        )
                    } finally {
                        const controller = ctx.abortController
                        ctx.abortController = null
                        if (controller) activeAbortControllers.delete(controller)
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
                if (ctx.abortController) {
                    void host.window.showInformationMessage('Execution already in progress')
                    break
                }
                ctx.abortController = new AbortController()
                activeAbortControllers.add(ctx.abortController)
                try {
                    const approvalHandler = createWaitForApproval(port)
                    await safePost(port, { type: 'execution_started' } as ExtensionToWorkflow, {
                        strict: isDev,
                    })
                    await executeSingleNode(
                        (message as any).data,
                        port,
                        host,
                        ctx.abortController.signal,
                        approvalHandler
                    )
                } finally {
                    await safePost(port, { type: 'execution_completed' } as ExtensionToWorkflow, {
                        strict: isDev,
                    })
                    const controller = ctx.abortController
                    ctx.abortController = null
                    if (controller) activeAbortControllers.delete(controller)
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
                if (ctx.abortController) {
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
    for (const controller of activeAbortControllers) {
        controller.abort()
    }
    activeAbortControllers.clear()
}
