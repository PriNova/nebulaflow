import * as vscode from 'vscode'
import { executeWorkflow } from './engine/executor'
import { saveWorkflow, loadWorkflow, getCustomNodes, saveCustomNode, deleteCustomNode, renameCustomNode } from './engine/fs'
import type { ExtensionToWorkflow, WorkflowToExtension } from './protocol/WorkflowProtocol'

let activeAbortController: AbortController | null = null
let pendingApprovalResolve: ((value: { command?: string }) => void) | null = null

function waitForApproval(_nodeId: string): Promise<{ command?: string }> {
    return new Promise(resolve => {
        pendingApprovalResolve = resolve
    })
}

export function activate(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand('ampEditor.openWorkflow', async () => {
        const panel = vscode.window.createWebviewPanel(
            'ampWorkflow',
            'Amp Workflow Editor',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
            }
        )

        panel.webview.onDidReceiveMessage(
            async (message: WorkflowToExtension) => {
                switch (message.type) {
                    case 'get_models': {
                        await panel.webview.postMessage({
                            type: 'models_loaded',
                            data: [],
                        } as ExtensionToWorkflow)
                        break
                    }
                    case 'save_workflow': {
                        await saveWorkflow(message.data)
                        break
                    }
                    case 'load_workflow': {
                        const result = await loadWorkflow()
                        if (result) {
                            await panel.webview.postMessage({
                                type: 'workflow_loaded',
                                data: result,
                            } as ExtensionToWorkflow)
                        }
                        break
                    }
                    case 'execute_workflow': {
                        if (message.data?.nodes && message.data?.edges) {
                            activeAbortController = new AbortController()
                            try {
                                await executeWorkflow(
                                    message.data.nodes,
                                    message.data.edges,
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
                        if (activeAbortController) {
                            activeAbortController.abort()
                            activeAbortController = null
                        }
                        break
                    }
                    case 'calculate_tokens': {
                        const text = message.data.text || ''
                        await panel.webview.postMessage({
                            type: 'token_count',
                            data: { nodeId: message.data.nodeId, count: text.length },
                        } as ExtensionToWorkflow)
                        break
                    }
                    case 'node_approved': {
                        if (pendingApprovalResolve) {
                            pendingApprovalResolve({ command: message.data.modifiedCommand })
                            pendingApprovalResolve = null
                        }
                        break
                    }
                    case 'open_external_link': {
                        const url = vscode.Uri.parse(message.url)
                        void vscode.env.openExternal(url)
                        break
                    }
                    case 'save_customNode': {
                        await saveCustomNode(message.data)
                        const nodes = await getCustomNodes()
                        await panel.webview.postMessage({
                            type: 'provide_custom_nodes',
                            data: nodes,
                        } as ExtensionToWorkflow)
                        break
                    }
                    case 'get_custom_nodes': {
                        const nodes = await getCustomNodes()
                        await panel.webview.postMessage({
                            type: 'provide_custom_nodes',
                            data: nodes,
                        } as ExtensionToWorkflow)
                        break
                    }
                    case 'delete_customNode': {
                        await deleteCustomNode(message.data)
                        const nodes = await getCustomNodes()
                        await panel.webview.postMessage({
                            type: 'provide_custom_nodes',
                            data: nodes,
                        } as ExtensionToWorkflow)
                        break
                    }
                    case 'rename_customNode': {
                        await renameCustomNode(message.data.oldNodeTitle, message.data.newNodeTitle)
                        const nodes = await getCustomNodes()
                        await panel.webview.postMessage({
                            type: 'provide_custom_nodes',
                            data: nodes,
                        } as ExtensionToWorkflow)
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
        const bytes = await vscode.workspace.fs.readFile(root)
        const decoded = new TextDecoder('utf-8').decode(bytes)
        const resources = panel.webview.asWebviewUri(webviewPath)
        panel.webview.html = decoded
            .replaceAll('./', `${resources.toString()}/`)
            .replaceAll('{cspSource}', panel.webview.cspSource)
    })

    context.subscriptions.push(disposable)
}

export function deactivate(): void {
    if (activeAbortController) {
        activeAbortController.abort()
        activeAbortController = null
    }
}
