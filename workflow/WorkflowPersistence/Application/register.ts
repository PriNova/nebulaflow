import * as vscode from 'vscode'
import type { ExtensionToWorkflow } from '../../Core/models'
import { loadWorkflow, saveWorkflow } from '../../DataAccess/fs'
import { safePost } from '../../Shared/Infrastructure/messaging/safePost'
import { setActiveWorkflowUri } from '../../Shared/Infrastructure/workspace'

export type SliceEnv = {
    webview: import('vscode').Webview
    isDev: boolean
    updatePanelTitle: (uri?: import('vscode').Uri) => void
}

export type Router = Map<string, (message: any, env: SliceEnv) => Promise<void> | void>

function readStorageScope(): { scope: 'workspace' | 'user'; basePath?: string } {
    const cfg = vscode.workspace.getConfiguration('nebulaFlow')
    const scope = cfg.get<string>('storageScope', 'user') === 'workspace' ? 'workspace' : 'user'
    const basePath = cfg.get<string>('globalStoragePath', '')
    return { scope, basePath }
}

export function registerHandlers(router: Router): void {
    // get_storage_scope
    router.set('get_storage_scope', async (_message, env) => {
        const info = readStorageScope()
        await safePost(env.webview, { type: 'storage_scope', data: info } as ExtensionToWorkflow, {
            strict: env.isDev,
        })
    })

    // toggle_storage_scope
    router.set('toggle_storage_scope', async (_message, _env) => {
        const cfg = vscode.workspace.getConfiguration('nebulaFlow')
        const current = cfg.get<string>('storageScope', 'user') === 'workspace' ? 'workspace' : 'user'
        const next = current === 'workspace' ? 'user' : 'workspace'
        const target = vscode.workspace.workspaceFolders?.length
            ? vscode.ConfigurationTarget.Workspace
            : vscode.ConfigurationTarget.Global
        await cfg.update('storageScope', next, target)
        // onDidChangeConfiguration handler in the host will refresh content and badge
    })

    // save_workflow
    router.set('save_workflow', async (message, env) => {
        const result = await saveWorkflow(message.data)
        if (result && 'uri' in result) {
            const uri = result.uri
            setActiveWorkflowUri(uri)
            env.updatePanelTitle(uri)
            await safePost(
                env.webview,
                { type: 'workflow_saved', data: { path: uri.fsPath } } as ExtensionToWorkflow,
                { strict: env.isDev }
            )
        } else if (result && 'error' in result) {
            await safePost(
                env.webview,
                { type: 'workflow_save_failed', data: { error: result.error } } as ExtensionToWorkflow,
                { strict: env.isDev }
            )
        } else {
            await safePost(
                env.webview,
                { type: 'workflow_save_failed', data: { error: 'cancelled' } } as ExtensionToWorkflow,
                { strict: env.isDev }
            )
        }
    })

    // load_workflow
    router.set('load_workflow', async (_message, env) => {
        const result = await loadWorkflow()
        if (result) {
            const { uri, dto } = result
            setActiveWorkflowUri(uri)
            env.updatePanelTitle(uri)
            await safePost(env.webview, { type: 'workflow_loaded', data: dto } as ExtensionToWorkflow, {
                strict: env.isDev,
            })
        }
    })

    // open_external_link
    router.set('open_external_link', async (message, _env) => {
        try {
            const uri = vscode.Uri.parse((message as any).url)
            const scheme = uri.scheme.toLowerCase()
            // Open HTTP(S)/mailto/tel externally via OS/browser
            if (scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel') {
                await vscode.env.openExternal(uri)
                return
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
                    const end = Math.max(0, Number.parseInt(match[2] ?? match[1], 10) - 1)
                    range = [start, end]
                }
                const openUri = uri.with({ fragment: '' })
                // Restrict to files within the current workspace folders
                const wf = vscode.workspace.getWorkspaceFolder(openUri)
                if (!wf) {
                    await vscode.window.showWarningMessage('Refusing to open file outside the workspace')
                    return
                }
                try {
                    const stat = await vscode.workspace.fs.stat(openUri)
                    if (stat.type === vscode.FileType.Directory) {
                        await vscode.commands.executeCommand('revealInExplorer', openUri)
                    } else {
                        const doc = await vscode.workspace.openTextDocument(openUri)
                        const editor = await vscode.window.showTextDocument(doc, { preview: false })
                        if (range) {
                            const from = new vscode.Position(range[0], 0)
                            const to = new vscode.Position(range[1], 0)
                            const selRange = new vscode.Range(from, to)
                            editor.revealRange(selRange, vscode.TextEditorRevealType.InCenter)
                            editor.selection = new vscode.Selection(from, from)
                        }
                    }
                } catch {
                    // Fallback to external for workspace URIs only
                    await vscode.env.openExternal(uri)
                }
                return
            }
            // Fallback: open externally
            await vscode.env.openExternal(uri)
        } catch (e: any) {
            await vscode.window.showWarningMessage(`Could not open link: ${e?.message ?? String(e)}`)
        }
    })
}
