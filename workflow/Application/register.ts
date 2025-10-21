import * as vscode from 'vscode'
import { isWorkflowToExtension } from '../Core/Contracts/guards'
import type { ApprovalResult, ExtensionToWorkflow } from '../Core/models'
import {
    deleteCustomNode,
    getCustomNodes,
    loadWorkflow,
    renameCustomNode,
    saveCustomNode,
    saveWorkflow,
} from '../DataAccess/fs'
import { executeWorkflow } from './handlers/ExecuteWorkflow'
import { fromProtocolPayload, toProtocolPayload } from './messaging/converters'
import { safePost } from './messaging/safePost'

let activeAbortController: AbortController | null = null
let pendingApproval: {
    resolve: (value: ApprovalResult) => void
    reject: (error: unknown) => void
    removeAbortListener?: () => void
} | null = null

function waitForApproval(_nodeId: string): Promise<ApprovalResult> {
    return new Promise((resolve, reject) => {
        const current: {
            resolve: (value: ApprovalResult) => void
            reject: (error: unknown) => void
            removeAbortListener?: () => void
        } = { resolve, reject }
        const signal = activeAbortController?.signal
        if (signal) {
            const onAbort = () => {
                current.resolve({ type: 'aborted' })
                if (pendingApproval === current) {
                    pendingApproval = null
                }
                current.removeAbortListener = undefined
            }
            signal.addEventListener('abort', onAbort, { once: true })
            current.removeAbortListener = () => signal.removeEventListener('abort', onAbort)
        }
        pendingApproval = current
    })
}

export function activate(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand('nebulaFlow.openWorkflow', async () => {
        const panel = vscode.window.createWebviewPanel(
            'nebulaWorkflow',
            'NebulaFlow Workflow Editor',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
            }
        )

        const isDev = context.extensionMode === vscode.ExtensionMode.Development
        panel.webview.onDidReceiveMessage(
            async (message: unknown) => {
                if (!isWorkflowToExtension(message)) {
                    return
                }
                switch (message.type) {
                    case 'get_models': {
                        try {
                            // Dynamically require to avoid hard failure when SDK is not linked
                            const sdk = require('@sourcegraph/amp-sdk') as any
                            const listModels:
                                | (() => Array<{ key: string; displayName: string }>)
                                | undefined = sdk?.listModels
                            const models =
                                typeof listModels === 'function'
                                    ? listModels().map(m => ({ id: m.key, title: m.displayName }))
                                    : []
                            await safePost(
                                panel.webview,
                                { type: 'models_loaded', data: models } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        } catch {
                            await safePost(
                                panel.webview,
                                { type: 'models_loaded', data: [] } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        }
                        break
                    }
                    case 'save_workflow': {
                        const result = await saveWorkflow(message.data)
                        if (result && 'uri' in result) {
                            await safePost(
                                panel.webview,
                                {
                                    type: 'workflow_saved',
                                    data: { path: result.uri.fsPath },
                                } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        } else if (result && 'error' in result) {
                            await safePost(
                                panel.webview,
                                {
                                    type: 'workflow_save_failed',
                                    data: { error: result.error },
                                } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        } else {
                            await safePost(
                                panel.webview,
                                {
                                    type: 'workflow_save_failed',
                                    data: { error: 'cancelled' },
                                } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        }
                        break
                    }
                    case 'load_workflow': {
                        const result = await loadWorkflow()
                        if (result) {
                            await safePost(
                                panel.webview,
                                { type: 'workflow_loaded', data: result } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                        }
                        break
                    }
                    case 'execute_workflow': {
                        if (activeAbortController) {
                            void vscode.window.showInformationMessage(
                                'NebulaFlow Workflow Editor: execution already in progress'
                            )
                            await safePost(
                                panel.webview,
                                { type: 'execution_completed' } as ExtensionToWorkflow,
                                { strict: isDev }
                            )
                            break
                        }
                        if (message.data?.nodes && message.data?.edges) {
                            activeAbortController = new AbortController()
                            try {
                                const { nodes, edges } = fromProtocolPayload(message.data)
                                await executeWorkflow(
                                    nodes,
                                    edges,
                                    panel.webview,
                                    activeAbortController.signal,
                                    waitForApproval
                                )
                            } finally {
                                activeAbortController = null
                            }
                        }
                        break
                    }
                    case 'abort_workflow': {
                        if (pendingApproval) {
                            pendingApproval.removeAbortListener?.()
                            pendingApproval.resolve({ type: 'aborted' })
                            pendingApproval = null
                        }
                        if (activeAbortController) {
                            activeAbortController.abort()
                            activeAbortController = null
                        }
                        break
                    }
                    case 'calculate_tokens': {
                        const text = message.data.text || ''
                        await safePost(
                            panel.webview,
                            {
                                type: 'token_count',
                                data: { nodeId: message.data.nodeId, count: text.length },
                            } as ExtensionToWorkflow,
                            { strict: isDev }
                        )
                        break
                    }
                    case 'node_approved': {
                        if (pendingApproval) {
                            pendingApproval.removeAbortListener?.()
                            pendingApproval.resolve({
                                type: 'approved',
                                command: message.data.modifiedCommand,
                            })
                            pendingApproval = null
                        }
                        break
                    }
                    case 'node_rejected': {
                        if (pendingApproval) {
                            pendingApproval.removeAbortListener?.()
                            pendingApproval.reject(new Error('Command execution rejected by user'))
                            pendingApproval = null
                        }
                        break
                    }
                    case 'open_external_link': {
                        const url = vscode.Uri.parse(message.url)
                        void vscode.env.openExternal(url)
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
                        await safePost(panel.webview, msg, { strict: isDev })
                        break
                    }
                    case 'get_custom_nodes': {
                        const nodes = await getCustomNodes()
                        const msg = {
                            type: 'provide_custom_nodes',
                            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
                        } as ExtensionToWorkflow
                        await safePost(panel.webview, msg, { strict: isDev })
                        break
                    }
                    case 'delete_customNode': {
                        await deleteCustomNode(message.data)
                        const nodes = await getCustomNodes()
                        const msg = {
                            type: 'provide_custom_nodes',
                            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
                        } as ExtensionToWorkflow
                        await safePost(panel.webview, msg, { strict: isDev })
                        break
                    }
                    case 'rename_customNode': {
                        await renameCustomNode(message.data.oldNodeTitle, message.data.newNodeTitle)
                        const nodes = await getCustomNodes()
                        const msg = {
                            type: 'provide_custom_nodes',
                            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
                        } as ExtensionToWorkflow
                        await safePost(panel.webview, msg, { strict: isDev })
                        break
                    }
                }
            },
            undefined,
            context.subscriptions
        )

        panel.onDidDispose(() => {
            if (activeAbortController) {
                activeAbortController.abort()
                activeAbortController = null
            }
            panel.dispose()
        })

        const webviewPath = vscode.Uri.joinPath(context.extensionUri, 'dist/webviews')
        const root = vscode.Uri.joinPath(webviewPath, 'workflow.html')

        async function render() {
            try {
                const bytes = await vscode.workspace.fs.readFile(root)
                const decoded = new TextDecoder('utf-8').decode(bytes)
                const resources = panel.webview.asWebviewUri(webviewPath)
                panel.webview.html = decoded
                    .replaceAll('./', `${resources.toString()}/`)
                    .replaceAll('{cspSource}', panel.webview.cspSource)
            } catch (err) {
                const detail = err instanceof Error ? err.message : String(err)
                void vscode.window.showErrorMessage(
                    `NebulaFlow Workflow Editor: failed to load webview assets. Run \`npm run build\` or \`npm run watch:webview\` and try again. (${detail})`
                )
            }
        }

        await render()

        if (context.extensionMode === vscode.ExtensionMode.Development) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(webviewPath, '**/*')
            )
            const debounced = (() => {
                let timeout: NodeJS.Timeout | undefined
                return () => {
                    clearTimeout(timeout)
                    timeout = setTimeout(() => void render(), 150)
                }
            })()
            watcher.onDidChange(debounced)
            watcher.onDidCreate(debounced)
            watcher.onDidDelete(debounced)
            panel.onDidDispose(() => watcher.dispose())
        }
    })

    context.subscriptions.push(disposable)
}

export function deactivate(): void {
    if (activeAbortController) {
        activeAbortController.abort()
        activeAbortController = null
    }
}
