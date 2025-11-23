import * as path from 'node:path'
import * as vscode from 'vscode'
import type { ExtensionToWorkflow } from '../Core/Contracts/Protocol'
import { getCustomNodes, initializeHost } from '../DataAccess/fs'
import { VSCodeHost, VSCodeMessagePort } from '../Shared/Host/VSCodeHost'
import type { IHostEnvironment } from '../Shared/Host/index'
import { safePost } from '../Shared/Infrastructure/messaging/safePost'
import { initializeWorkspace, setActiveWorkflowUri } from '../Shared/Infrastructure/workspace'
import { toProtocolPayload as toProtocol } from './messaging/converters' // Alias to avoid name collision if needed
import {
    cancelAllActiveWorkflows,
    cleanupSession,
    setupWorkflowMessageHandling,
} from './workflow-session'

function formatPanelTitle(uri?: string): string {
    if (!uri) {
        return 'NebulaFlow — Untitled'
    }
    const filename = path.basename(uri)
    return `NebulaFlow — ${filename}`
}

function readStorageScope(host: IHostEnvironment): { scope: 'workspace' | 'user'; basePath?: string } {
    const scope =
        host.workspace.getConfiguration<string>('nebulaFlow.storageScope', 'user') === 'workspace'
            ? 'workspace'
            : 'user'
    const basePath = host.workspace.getConfiguration('nebulaFlow.globalStoragePath', '')
    return { scope, basePath }
}

export function activate(context: vscode.ExtensionContext): void {
    // Initialize Host Adapter
    const host = new VSCodeHost(context)
    initializeHost(host)
    initializeWorkspace(host)

    const disposable = vscode.commands.registerCommand('nebulaFlow.openWorkflow', async () => {
        let currentWorkflowUri: string | undefined

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

        const webview = panel.webview
        const port = new VSCodeMessagePort(webview)
        const isDev = context.extensionMode === vscode.ExtensionMode.Development

        setupWorkflowMessageHandling(host, port, isDev, uri => {
            currentWorkflowUri = uri
            panel.title = formatPanelTitle(uri)
        })

        let isDisposed = false
        panel.onDidDispose(() => {
            isDisposed = true
            cleanupSession(port)
            setActiveWorkflowUri(undefined)
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

        const cfgWatcher = vscode.workspace.onDidChangeConfiguration(async e => {
            if (
                e.affectsConfiguration('nebulaFlow.storageScope') ||
                e.affectsConfiguration('nebulaFlow.globalStoragePath')
            ) {
                try {
                    const nodes = await getCustomNodes()
                    await safePost(
                        port,
                        {
                            type: 'provide_custom_nodes',
                            data: toProtocol({ nodes, edges: [] }).nodes!,
                        } as ExtensionToWorkflow,
                        { strict: isDev }
                    )
                    const info = readStorageScope(host)
                    await safePost(port, { type: 'storage_scope', data: info } as ExtensionToWorkflow, {
                        strict: isDev,
                    })
                } catch {}
            }
        })

        if (isDev) {
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
    cancelAllActiveWorkflows()
}
