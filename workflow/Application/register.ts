import * as path from 'node:path'
import * as vscode from 'vscode'
import type { WorkflowPayloadDTO } from '../Core/Contracts/Protocol'
import { isWorkflowPayloadDTO, isWorkflowToExtension } from '../Core/Contracts/guards'
import type { ApprovalResult, ExtensionToWorkflow } from '../Core/models'
import { getCustomNodes } from '../DataAccess/fs'
import { registerHandlers as registerLLMHandlers } from '../LLMIntegration/Application/register'
import { registerHandlers as registerLibraryHandlers } from '../Library/Application/register'
import { safePost } from '../Shared/Infrastructure/messaging/safePost'
import { setActiveWorkflowUri } from '../Shared/Infrastructure/workspace'
import { registerHandlers as registerSubflowsHandlers } from '../Subflows/Application/register'
import { executeSingleNode } from '../WorkflowExecution/Application/handlers/ExecuteSingleNode'
import { executeWorkflow } from '../WorkflowExecution/Application/handlers/ExecuteWorkflow'
import { registerHandlers as registerPersistenceHandlers } from '../WorkflowPersistence/Application/register'
import { fromProtocolPayload, toProtocolPayload } from './messaging/converters'

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

const panelExecutionRegistry = new WeakMap<vscode.Webview, ExecutionContext>()
const activeAbortControllers = new Set<AbortController>()

let inMemoryClipboard: WorkflowPayloadDTO | null = null

function formatPanelTitle(uri?: vscode.Uri): string {
    if (!uri) {
        return 'NebulaFlow — Untitled'
    }
    const filename = path.basename(uri.fsPath)
    return `NebulaFlow — ${filename}`
}

function getOrCreatePanelContext(webview: vscode.Webview): ExecutionContext {
    let context = panelExecutionRegistry.get(webview)
    if (!context) {
        context = {
            abortController: null,
            pauseRequested: false,
            pendingApproval: null,
            subflowCache: new Map<string, Record<string, string>>(),
        }
        panelExecutionRegistry.set(webview, context)
    }
    return context
}

function createWaitForApproval(webview: vscode.Webview): (nodeId: string) => Promise<ApprovalResult> {
    return (_nodeId: string): Promise<ApprovalResult> => {
        return new Promise((resolve, reject) => {
            const context = getOrCreatePanelContext(webview)
            // Guard: reject concurrent approval requests
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

function readStorageScope(): { scope: 'workspace' | 'user'; basePath?: string } {
    const cfg = vscode.workspace.getConfiguration('nebulaFlow')
    const scope = cfg.get<string>('storageScope', 'user') === 'workspace' ? 'workspace' : 'user'
    const basePath = cfg.get<string>('globalStoragePath', '')
    return { scope, basePath }
}

export function activate(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand('nebulaFlow.openWorkflow', async () => {
        let currentWorkflowUri: vscode.Uri | undefined

        const panel = vscode.window.createWebviewPanel(
            'nebulaWorkflow',
            formatPanelTitle(currentWorkflowUri),
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
            }
        )

        // Capture the webview reference once to avoid property access after disposal
        const webview = panel.webview
        let isDisposed = false

        // Slice router composition
        const router = new Map<string, (message: any, env: any) => Promise<void> | void>()
        const updatePanelTitle = (uri?: vscode.Uri) => {
            panel.title = formatPanelTitle(uri)
        }
        registerPersistenceHandlers(router)
        registerLibraryHandlers(router)
        registerSubflowsHandlers(router)
        registerLLMHandlers(router)

        const isDev = context.extensionMode === vscode.ExtensionMode.Development
        webview.onDidReceiveMessage(
            async (message: unknown) => {
                if (!isWorkflowToExtension(message)) {
                    return
                }
                const handler = router.get((message as any).type)
                if (handler) {
                    await handler(message as any, { webview, isDev, updatePanelTitle })
                    return
                }
                switch (message.type) {
                    case 'reset_results': {
                        const panelContext = getOrCreatePanelContext(webview)
                        panelContext.subflowCache.clear()
                        break
                    }
                    case 'load_workflow': {
                        // Legacy path removed. Handled by WorkflowPersistence slice.
                        break
                    }
                    case 'pause_workflow': {
                        const panelContext = getOrCreatePanelContext(webview)
                        panelContext.pauseRequested = true
                        break
                    }

                    case 'execute_workflow': {
                        const panelContext = getOrCreatePanelContext(webview)
                        if (panelContext.abortController) {
                            void vscode.window.showInformationMessage(
                                'NebulaFlow Workflow Editor: execution already in progress'
                            )
                            await safePost(
                                webview,
                                { type: 'execution_completed' } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                            break
                        }
                        if ((message as any).data?.nodes && (message as any).data?.edges) {
                            panelContext.abortController = new AbortController()
                            activeAbortControllers.add(panelContext.abortController)
                            try {
                                const { nodes, edges } = fromProtocolPayload((message as any).data)
                                const resume = (message as any)?.data?.resume
                                const approvalHandler = createWaitForApproval(webview)

                                // Reset pause state when starting a new execution
                                panelContext.pauseRequested = false

                                let filteredResume = resume

                                // When resuming from a node, prune to the forward subgraph reachable from that node
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
                                    const seedIds = new Set(
                                        Object.keys(
                                            (resume?.seeds?.outputs as
                                                | Record<string, string>
                                                | undefined) || {}
                                        )
                                    )
                                    execEdges = edges.filter(e => allowed.has(e.target))

                                    // Filter seeds to exclude nodes in the forward subgraph that will be re-executed,
                                    // but preserve seeds for nodes marked with bypass=true
                                    const allowedIds = allowed
                                    const bypassIds = new Set(
                                        execNodes
                                            .filter(n => (n as any)?.data?.bypass === true)
                                            .map(n => n.id)
                                    )
                                    const outputsEntries = Object.entries(
                                        (resume?.seeds?.outputs as Record<string, string> | undefined) ||
                                            {}
                                    ).filter(([id]) => !allowedIds.has(id) || bypassIds.has(id))
                                    const decisionsEntries = Object.entries(
                                        (resume?.seeds?.decisions as
                                            | Record<string, 'true' | 'false'>
                                            | undefined) || {}
                                    ).filter(([id]) => !allowedIds.has(id) || bypassIds.has(id))
                                    filteredResume = {
                                        ...resume,
                                        seeds: {
                                            outputs: Object.fromEntries(outputsEntries),
                                            decisions: Object.fromEntries(decisionsEntries),
                                            // Keep variable seeds as-is (by name); they are safe to over-provide and will be
                                            // overwritten by re-executed Variable nodes where applicable
                                            variables: (resume?.seeds as any)?.variables,
                                        },
                                    }
                                } else if (
                                    resume?.seeds?.outputs &&
                                    process.env.NEBULAFLOW_FILTER_PAUSE_SEEDS
                                ) {
                                    // Optional guard: when resuming from pause, keep only bypass seeds (env-flagged)
                                    const bypassIds = new Set(
                                        nodes
                                            .filter(n => (n as any)?.data?.bypass === true)
                                            .map(n => n.id)
                                    )
                                    const outputsEntries = Object.entries(
                                        (resume?.seeds?.outputs as Record<string, string> | undefined) ||
                                            {}
                                    ).filter(([id]) => bypassIds.has(id))
                                    filteredResume = {
                                        ...resume,
                                        seeds: {
                                            outputs: Object.fromEntries(outputsEntries),
                                            decisions: (resume?.seeds as any)?.decisions,
                                            variables: (resume?.seeds as any)?.variables,
                                        },
                                    }
                                }

                                // Build pauseRef for pause gate
                                const pauseRef = { isPaused: () => panelContext.pauseRequested === true }

                                await executeWorkflow(
                                    execNodes,
                                    execEdges,
                                    webview,
                                    panelContext.abortController.signal,
                                    approvalHandler,
                                    filteredResume,
                                    pauseRef,
                                    panelContext.subflowCache
                                )
                            } finally {
                                const controller = panelContext.abortController
                                panelContext.abortController = null
                                if (controller) {
                                    activeAbortControllers.delete(controller)
                                }
                            }
                        }
                        break
                    }
                    case 'execute_node': {
                        const panelContext = getOrCreatePanelContext(webview)
                        if (panelContext.pauseRequested) {
                            void vscode.window.showInformationMessage(
                                'NebulaFlow Workflow Editor: cannot run a single node while paused'
                            )
                            break
                        }
                        if (panelContext.abortController) {
                            void vscode.window.showInformationMessage(
                                'NebulaFlow Workflow Editor: execution already in progress'
                            )
                            break
                        }
                        panelContext.abortController = new AbortController()
                        activeAbortControllers.add(panelContext.abortController)
                        try {
                            const approvalHandler = createWaitForApproval(webview)
                            await safePost(
                                webview,
                                { type: 'execution_started' } as ExtensionToWorkflow,
                                {
                                    strict: isDev,
                                }
                            )
                            await executeSingleNode(
                                (message as any).data,
                                webview,
                                panelContext.abortController.signal,
                                approvalHandler
                            )
                        } finally {
                            await safePost(
                                webview,
                                { type: 'execution_completed' } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                            const controller = panelContext.abortController
                            panelContext.abortController = null
                            if (controller) {
                                activeAbortControllers.delete(controller)
                            }
                        }
                        break
                    }

                    case 'abort_workflow': {
                        const panelContext = getOrCreatePanelContext(webview)
                        if (panelContext.pendingApproval) {
                            panelContext.pendingApproval.removeAbortListener?.()
                            panelContext.pendingApproval.resolve({ type: 'aborted' })
                            panelContext.pendingApproval = null
                        }
                        if (panelContext.abortController) {
                            const controller = panelContext.abortController
                            panelContext.abortController = null
                            controller.abort()
                            activeAbortControllers.delete(controller)
                        } else if (panelContext.pauseRequested) {
                            // If paused but no abort controller, still send completion
                            await safePost(
                                webview,
                                { type: 'execution_completed' } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        }
                        panelContext.pauseRequested = false
                        break
                    }
                    case 'calculate_tokens': {
                        const text = (message as any).data.text || ''
                        await safePost(
                            webview,
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
                            if (isDev) {
                                console.log('[NebulaFlow] copy_selection received', {
                                    nodeCount: payload.nodes?.length ?? 0,
                                    edgeCount: payload.edges?.length ?? 0,
                                })
                            }
                            try {
                                const serialized = JSON.stringify(payload)
                                await vscode.env.clipboard.writeText(serialized)
                            } catch (err) {
                                if (isDev) {
                                    console.error(
                                        '[NebulaFlow] Failed to write workflow selection to clipboard',
                                        err
                                    )
                                }
                            }
                        } else if (isDev) {
                            console.warn('[NebulaFlow] copy_selection received invalid payload')
                        }
                        break
                    }
                    case 'paste_selection': {
                        let payload: unknown = inMemoryClipboard
                        try {
                            const text = await vscode.env.clipboard.readText()
                            if (text) {
                                try {
                                    const parsed = JSON.parse(text)
                                    if (isWorkflowPayloadDTO(parsed)) {
                                        payload = parsed
                                        inMemoryClipboard = parsed
                                    }
                                } catch {
                                    if (isDev) {
                                        console.warn(
                                            '[NebulaFlow] paste_selection clipboard text was not valid JSON payload'
                                        )
                                    }
                                    // Ignore parse errors from non-NebulaFlow clipboard content
                                }
                            }
                        } catch (err) {
                            if (isDev) {
                                console.warn('[NebulaFlow] Failed to read from system clipboard', err)
                            }
                            // Ignore clipboard read errors; fall back to in-memory clipboard
                        }
                        if (payload && isWorkflowPayloadDTO(payload)) {
                            const typed = payload as WorkflowPayloadDTO
                            if (isDev) {
                                console.log('[NebulaFlow] paste_selection sending clipboard_paste', {
                                    nodeCount: typed.nodes?.length ?? 0,
                                    edgeCount: typed.edges?.length ?? 0,
                                })
                            }
                            await safePost(
                                webview,
                                { type: 'clipboard_paste', data: typed } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        } else {
                            if (isDev) {
                                console.log('[NebulaFlow] paste_selection had no valid payload to paste')
                            }
                            await safePost(webview, { type: 'clipboard_paste' } as ExtensionToWorkflow, {
                                strict: isDev,
                            })
                        }
                        break
                    }
                    case 'node_approved': {
                        const panelContext = getOrCreatePanelContext(webview)
                        if (panelContext.pendingApproval) {
                            panelContext.pendingApproval.removeAbortListener?.()
                            panelContext.pendingApproval.resolve({
                                type: 'approved',
                                command: (message as any).data.modifiedCommand,
                            })
                            panelContext.pendingApproval = null
                        }
                        break
                    }
                    case 'node_rejected': {
                        const panelContext = getOrCreatePanelContext(webview)
                        if (panelContext.pendingApproval) {
                            panelContext.pendingApproval.removeAbortListener?.()
                            panelContext.pendingApproval.reject(
                                new Error('Command execution rejected by user')
                            )
                            panelContext.pendingApproval = null
                        }
                        break
                    }
                }
            },
            undefined,
            context.subscriptions
        )

        panel.onDidDispose(() => {
            isDisposed = true
            const panelContext = getOrCreatePanelContext(webview)
            // Resolve any pending approval as aborted to unblock waiting code paths
            if (panelContext.pendingApproval) {
                panelContext.pendingApproval.removeAbortListener?.()
                panelContext.pendingApproval.resolve({ type: 'aborted' })
                panelContext.pendingApproval = null
            }
            // Abort any in-flight execution to stop further work and messaging
            if (panelContext.abortController) {
                panelContext.abortController.abort()
                panelContext.abortController = null
            }
            // Clear active workflow association on panel close
            setActiveWorkflowUri(undefined)
            // Clear slice router to release closures
            router.clear()
            // No need to call panel.dispose() inside onDidDispose
        })

        const webviewPath = vscode.Uri.joinPath(context.extensionUri, 'dist/webviews')
        const root = vscode.Uri.joinPath(webviewPath, 'workflow.html')

        async function render() {
            if (isDisposed) return
            try {
                const bytes = await vscode.workspace.fs.readFile(root)
                if (isDisposed) return
                const decoded = new TextDecoder('utf-8').decode(bytes)
                const resources = webview.asWebviewUri(webviewPath)
                webview.html = decoded
                    .replaceAll('./', `${resources.toString()}/`)
                    .replaceAll('{cspSource}', webview.cspSource)
            } catch (err) {
                const detail = err instanceof Error ? err.message : String(err)
                void vscode.window.showErrorMessage(
                    `NebulaFlow Workflow Editor: failed to load webview assets. Run \`npm run build\` or \`npm run watch:webview\` and try again. (${detail})`
                )
            }
        }

        await render()

        // React to configuration changes and refresh scope + library
        const cfgWatcher = vscode.workspace.onDidChangeConfiguration(async e => {
            if (
                e.affectsConfiguration('nebulaFlow.storageScope') ||
                e.affectsConfiguration('nebulaFlow.globalStoragePath')
            ) {
                try {
                    const nodes = await getCustomNodes()
                    await safePost(
                        webview,
                        {
                            type: 'provide_custom_nodes',
                            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
                        } as ExtensionToWorkflow,
                        { strict: isDev }
                    )
                    const info = readStorageScope()
                    await safePost(
                        webview,
                        { type: 'storage_scope', data: info } as ExtensionToWorkflow,
                        { strict: isDev }
                    )
                } catch {}
            }
        })

        if (context.extensionMode === vscode.ExtensionMode.Development) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(webviewPath, '**/*')
            )
            let reloadTimer: NodeJS.Timeout | undefined
            const debounced = () => {
                if (isDisposed) return
                clearTimeout(reloadTimer)
                reloadTimer = setTimeout(() => {
                    if (isDisposed) return
                    void render()
                }, 150)
            }
            watcher.onDidChange(debounced)
            watcher.onDidCreate(debounced)
            watcher.onDidDelete(debounced)
            panel.onDidDispose(() => {
                watcher.dispose()
                cfgWatcher.dispose()
                if (reloadTimer) clearTimeout(reloadTimer)
            })
        } else {
            panel.onDidDispose(() => {
                cfgWatcher.dispose()
            })
        }
    })

    context.subscriptions.push(disposable)
}

export function deactivate(): void {
    // Abort all active workflows deterministically to ensure clean shutdown
    // even if VS Code deactivates the extension while panels remain open (e.g., hot-reload)
    for (const controller of activeAbortControllers) {
        controller.abort()
    }
    activeAbortControllers.clear()
}
