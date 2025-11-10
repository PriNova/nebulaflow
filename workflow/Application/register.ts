import * as path from 'node:path'
import * as vscode from 'vscode'
import { isWorkflowToExtension } from '../Core/Contracts/guards'
import type { ApprovalResult, ExtensionToWorkflow } from '../Core/models'
import {
    deleteCustomNode,
    getCustomNodes,
    getSubflows,
    loadSubflow,
    loadWorkflow,
    renameCustomNode,
    saveCustomNode,
    saveSubflow,
    saveWorkflow,
} from '../DataAccess/fs'
import { executeSingleNode } from './handlers/ExecuteSingleNode'
import { executeWorkflow } from './handlers/ExecuteWorkflow'
import { fromProtocolPayload, toProtocolPayload } from './messaging/converters'
import { safePost } from './messaging/safePost'
import { setActiveWorkflowUri } from './workspace'

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

        const isDev = context.extensionMode === vscode.ExtensionMode.Development
        webview.onDidReceiveMessage(
            async (message: unknown) => {
                if (!isWorkflowToExtension(message)) {
                    return
                }
                switch (message.type) {
                    case 'create_subflow': {
                        try {
                            const result = await saveSubflow((message as any).data)
                            if ('id' in result) {
                                await safePost(
                                    webview,
                                    {
                                        type: 'subflow_saved',
                                        data: { id: (result as any).id },
                                    } as ExtensionToWorkflow,
                                    { strict: isDev }
                                )
                            } else {
                                void vscode.window.showErrorMessage('Failed to save subflow')
                            }
                        } catch (e: any) {
                            void vscode.window.showErrorMessage(
                                `Failed to save subflow: ${e?.message ?? e}`
                            )
                        }
                        break
                    }
                    case 'get_subflow': {
                        try {
                            const id = (message as any).data?.id as string
                            const def = await loadSubflow(id)
                            if (def) {
                                await safePost(
                                    webview,
                                    { type: 'provide_subflow', data: def } as ExtensionToWorkflow,
                                    { strict: isDev }
                                )
                            } else {
                                void vscode.window.showErrorMessage(`Subflow not found: ${id}`)
                            }
                        } catch (e: any) {
                            void vscode.window.showErrorMessage(
                                `Failed to load subflow: ${e?.message ?? e}`
                            )
                        }
                        break
                    }
                    case 'get_subflows': {
                        try {
                            const list = await getSubflows()
                            await safePost(
                                webview,
                                { type: 'provide_subflows', data: list } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        } catch (e: any) {
                            void vscode.window.showErrorMessage(
                                `Failed to list subflows: ${e?.message ?? e}`
                            )
                        }
                        break
                    }
                    case 'duplicate_subflow': {
                        try {
                            const payload = (message as any).data || {}
                            const id = (payload as any).id as string
                            const nodeId = (payload as any).nodeId as string
                            const def = await loadSubflow(id)
                            if (!def) {
                                void vscode.window.showErrorMessage(`Subflow not found: ${id}`)
                                break
                            }
                            const copy = { ...(def as any), id: '' } as any
                            const result = await saveSubflow(copy)
                            if ('id' in result) {
                                await safePost(
                                    webview,
                                    {
                                        type: 'subflow_copied',
                                        data: { nodeId, oldId: id, newId: (result as any).id },
                                    } as ExtensionToWorkflow,
                                    { strict: isDev }
                                )
                            } else {
                                void vscode.window.showErrorMessage('Failed to duplicate subflow')
                            }
                        } catch (e: any) {
                            void vscode.window.showErrorMessage(
                                `Failed to duplicate subflow: ${e?.message ?? e}`
                            )
                        }
                        break
                    }
                    case 'get_models': {
                        try {
                            // Dynamically require to avoid hard failure when SDK is not linked
                            const sdk = require('@prinova/amp-sdk') as any
                            const listModels:
                                | (() => Array<{ key: string; displayName: string }>)
                                | undefined = sdk?.listModels
                            const models =
                                typeof listModels === 'function'
                                    ? listModels().map((m: any) => ({ id: m.key, title: m.displayName }))
                                    : []
                            await safePost(
                                webview,
                                { type: 'models_loaded', data: models } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        } catch {
                            await safePost(
                                webview,
                                { type: 'models_loaded', data: [] } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        }
                        break
                    }
                    case 'get_storage_scope': {
                        const info = readStorageScope()
                        await safePost(
                            webview,
                            { type: 'storage_scope', data: info } as ExtensionToWorkflow,
                            { strict: isDev }
                        )
                        break
                    }
                    case 'toggle_storage_scope': {
                        const cfg = vscode.workspace.getConfiguration('nebulaFlow')
                        const current =
                            cfg.get<string>('storageScope', 'user') === 'workspace'
                                ? 'workspace'
                                : 'user'
                        const next = current === 'workspace' ? 'user' : 'workspace'
                        const target = vscode.workspace.workspaceFolders?.length
                            ? vscode.ConfigurationTarget.Workspace
                            : vscode.ConfigurationTarget.Global
                        await cfg.update('storageScope', next, target)
                        // onDidChangeConfiguration handler will refresh content and badge
                        break
                    }
                    case 'save_workflow': {
                        const result = await saveWorkflow(message.data)
                        if (result && 'uri' in result) {
                            currentWorkflowUri = result.uri
                            panel.title = formatPanelTitle(currentWorkflowUri)
                            setActiveWorkflowUri(currentWorkflowUri)
                            await safePost(
                                webview,
                                {
                                    type: 'workflow_saved',
                                    data: { path: result.uri.fsPath },
                                } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        } else if (result && 'error' in result) {
                            await safePost(
                                webview,
                                {
                                    type: 'workflow_save_failed',
                                    data: { error: result.error },
                                } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        } else {
                            await safePost(
                                webview,
                                {
                                    type: 'workflow_save_failed',
                                    data: { error: 'cancelled' },
                                } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        }
                        break
                    }
                    case 'reset_results': {
                        const panelContext = getOrCreatePanelContext(webview)
                        panelContext.subflowCache.clear()
                        break
                    }
                    case 'load_workflow': {
                        const result = await loadWorkflow()
                        if (result) {
                            currentWorkflowUri = result.uri
                            panel.title = formatPanelTitle(currentWorkflowUri)
                            setActiveWorkflowUri(currentWorkflowUri)
                            await safePost(
                                webview,
                                { type: 'workflow_loaded', data: result.dto } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        }
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
                        if (message.data?.nodes && message.data?.edges) {
                            panelContext.abortController = new AbortController()
                            activeAbortControllers.add(panelContext.abortController)
                            try {
                                const { nodes, edges } = fromProtocolPayload(message.data)
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
                        const text = message.data.text || ''
                        await safePost(
                            webview,
                            {
                                type: 'token_count',
                                data: { nodeId: message.data.nodeId, count: text.length },
                            } as ExtensionToWorkflow,
                            { strict: isDev }
                        )
                        break
                    }
                    case 'node_approved': {
                        const panelContext = getOrCreatePanelContext(webview)
                        if (panelContext.pendingApproval) {
                            panelContext.pendingApproval.removeAbortListener?.()
                            panelContext.pendingApproval.resolve({
                                type: 'approved',
                                command: message.data.modifiedCommand,
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
                    case 'open_external_link': {
                        try {
                            const uri = vscode.Uri.parse(message.url)
                            const scheme = uri.scheme.toLowerCase()
                            // Open HTTP(S)/mailto/tel externally via OS/browser
                            if (
                                scheme === 'http' ||
                                scheme === 'https' ||
                                scheme === 'mailto' ||
                                scheme === 'tel'
                            ) {
                                await vscode.env.openExternal(uri)
                                break
                            }
                            // Open file-like URIs inside VS Code (supports remote workspaces)
                            if (
                                scheme === 'file' ||
                                scheme === 'vscode-remote' ||
                                scheme === 'vscode-file' ||
                                scheme === 'vscode'
                            ) {
                                // Extract optional line range from fragment: #L10 or #L10-L20
                                let range: [number, number] | null = null
                                const frag = uri.fragment
                                const match = /^L(\d+)(?:-L(\d+))?$/.exec(frag)
                                if (match) {
                                    const start = Math.max(0, Number.parseInt(match[1], 10) - 1)
                                    const end = Math.max(
                                        0,
                                        Number.parseInt(match[2] ?? match[1], 10) - 1
                                    )
                                    range = [start, end]
                                }
                                const openUri = uri.with({ fragment: '' })
                                try {
                                    const stat = await vscode.workspace.fs.stat(openUri)
                                    if (stat.type === vscode.FileType.Directory) {
                                        await vscode.commands.executeCommand('revealInExplorer', openUri)
                                    } else {
                                        const doc = await vscode.workspace.openTextDocument(openUri)
                                        const editor = await vscode.window.showTextDocument(doc, {
                                            preview: false,
                                        })
                                        if (range) {
                                            const from = new vscode.Position(range[0], 0)
                                            const to = new vscode.Position(range[1], 0)
                                            const selRange = new vscode.Range(from, to)
                                            editor.revealRange(
                                                selRange,
                                                vscode.TextEditorRevealType.InCenter
                                            )
                                            editor.selection = new vscode.Selection(from, from)
                                        }
                                    }
                                } catch {
                                    // Fallback to external for non-workspace URIs
                                    await vscode.env.openExternal(uri)
                                }
                                break
                            }
                            // Fallback: open externally
                            await vscode.env.openExternal(uri)
                        } catch (e: any) {
                            await vscode.window.showWarningMessage(
                                `Could not open link: ${e?.message ?? String(e)}`
                            )
                        }
                        break
                    }
                    case 'save_customNode': {
                        await saveCustomNode(
                            fromProtocolPayload({ nodes: [message.data], edges: [] }).nodes[0]
                        )
                        const nodes = await getCustomNodes()
                        const msg = {
                            type: 'provide_custom_nodes',
                            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
                        } as ExtensionToWorkflow
                        await safePost(webview, msg, { strict: isDev })
                        break
                    }
                    case 'get_custom_nodes': {
                        const nodes = await getCustomNodes()
                        const msg = {
                            type: 'provide_custom_nodes',
                            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
                        } as ExtensionToWorkflow
                        await safePost(webview, msg, { strict: isDev })
                        // Also provide current storage scope so UI can display badge
                        const info = readStorageScope()
                        await safePost(
                            webview,
                            { type: 'storage_scope', data: info } as ExtensionToWorkflow,
                            { strict: isDev }
                        )
                        break
                    }
                    case 'delete_customNode': {
                        await deleteCustomNode(message.data)
                        const nodes = await getCustomNodes()
                        const msg = {
                            type: 'provide_custom_nodes',
                            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
                        } as ExtensionToWorkflow
                        await safePost(webview, msg, { strict: isDev })
                        break
                    }
                    case 'rename_customNode': {
                        await renameCustomNode(message.data.oldNodeTitle, message.data.newNodeTitle)
                        const nodes = await getCustomNodes()
                        const msg = {
                            type: 'provide_custom_nodes',
                            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
                        } as ExtensionToWorkflow
                        await safePost(webview, msg, { strict: isDev })
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
