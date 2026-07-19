import { loadLastWorkflow, loadWorkflow, saveWorkflow } from '../../DataAccess/fs'
import type { WorkflowPayloadDTO } from '../../Core/Contracts/Protocol'
import { ConfigurationTarget, type IHostEnvironment, type IMessagePort } from '../../Shared/Host/index'
import { safePost } from '../../Shared/Infrastructure/messaging/safePost'
import { setActiveWorkflowUri } from '../../Shared/Infrastructure/workspace'
import { publishStorageContext, readStorageScope } from './storage-context'

export type SliceEnv = {
    port: IMessagePort
    host: IHostEnvironment
    isDev: boolean
    updatePanelTitle: (uri?: string) => void
}

export type Router = Map<string, (_message: unknown, env: SliceEnv) => Promise<void> | void>

export function registerHandlers(router: Router): void {
    // get_storage_scope
    router.set('get_storage_scope', async (_message, env) => {
        const info = readStorageScope(env.host)
        await safePost(env.port, { type: 'storage_scope', data: info }, {
            strict: env.isDev,
        })
    })

    const setStorageScope = async (
        requestedScope: 'workspace' | 'user',
        env: SliceEnv
    ): Promise<void> => {
        if (requestedScope === 'workspace' && env.host.workspace.workspaceFolders.length === 0) {
            const selectedFolder = await env.host.workspace.selectWorkspaceFolder?.()
            if (!selectedFolder) {
                await safePost(
                    env.port,
                    { type: 'storage_scope', data: readStorageScope(env.host) },
                    { strict: env.isDev }
                )
                return
            }
        }

        const target = env.host.workspace.workspaceFolders.length
            ? ConfigurationTarget.Workspace
            : ConfigurationTarget.Global
        await env.host.workspace.updateConfiguration(
            'nebulaFlow.storageScope',
            requestedScope,
            target
        )
        await publishStorageContext(env.host, env.port, env.isDev)
    }

    router.set('set_storage_scope', async (message, env) => {
        const requestedScope = (message as { data: { scope: 'workspace' | 'user' } }).data.scope
        await setStorageScope(requestedScope, env)
    })

    // Backward compatibility for older webview bundles.
    router.set('toggle_storage_scope', async (_message, env) => {
        const current = readStorageScope(env.host).scope
        await setStorageScope(current === 'workspace' ? 'user' : 'workspace', env)
    })

    // save_workflow
    router.set('save_workflow', async (message, env) => {
        const data = (message as { data: WorkflowPayloadDTO }).data
        const result = await saveWorkflow(data)
        if (result && 'uri' in result) {
            const uri = result.uri
            setActiveWorkflowUri(uri)
            env.updatePanelTitle(uri)
            await safePost(
                env.port,
                { type: 'workflow_saved', data: { path: uri } }, // path is string
                { strict: env.isDev }
            )
        } else if (result && 'error' in result) {
            await safePost(
                env.port,
                { type: 'workflow_save_failed', data: { error: result.error } },
                { strict: env.isDev }
            )
        } else {
            await safePost(
                env.port,
                { type: 'workflow_save_failed', data: { error: 'cancelled' } },
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
            await safePost(env.port, { type: 'workflow_loaded', data: dto }, {
                strict: env.isDev,
            })
        }
    })

    // load_last_workflow
    router.set('load_last_workflow', async (_message, env) => {
        const result = await loadLastWorkflow()
        if (!result) return

        const { uri, dto } = result
        setActiveWorkflowUri(uri)
        env.updatePanelTitle(uri)
        await safePost(env.port, { type: 'workflow_loaded', data: dto }, {
            strict: env.isDev,
        })
    })

    // clear_workflow
    router.set('clear_workflow', (_message, env) => {
        setActiveWorkflowUri(undefined)
        env.updatePanelTitle(undefined)
    })

    // open_external_link
    router.set('open_external_link', async (message, env) => {
        try {
            const urlStr = (message as { url: string }).url
            let url: URL
            try {
                // Handle simple paths or full URLs
                if (urlStr.startsWith('/')) {
                    url = new URL(`file://${urlStr}`)
                } else {
                    url = new URL(urlStr)
                }
            } catch {
                // Fallback for potentially relative paths or other formats?
                // Assume external if fails
                await env.host.window.openExternal(urlStr)
                return
            }

            const scheme = url.protocol.replace(':', '').toLowerCase()

            // Open HTTP(S)/mailto/tel externally via OS/browser
            if (['http', 'https', 'mailto', 'tel'].includes(scheme)) {
                await env.host.window.openExternal(urlStr)
                return
            }

            // Open file-like URIs inside VS Code (supports remote workspaces)
            if (['file', 'vscode-remote', 'vscode-file', 'vscode'].includes(scheme)) {
                // Extract optional line range from fragment: #L10 or #L10-L20
                let range: { startLine: number; endLine: number } | undefined = undefined
                const frag = url.hash
                const match = /^#?L(\d+)(?:-L(\d+))?$/.exec(frag)
                if (match) {
                    const start = Math.max(0, Number.parseInt(match[1], 10) - 1)
                    const end = Math.max(0, Number.parseInt(match[2] ?? match[1], 10) - 1)
                    range = { startLine: start, endLine: end }
                }

                const path = decodeURIComponent(url.pathname)

                // Restrict to files within the current workspace folders (simple check)
                // Note: In VS Code remote, paths might be different, but for now we rely on string match
                const isInWorkspace = env.host.workspace.workspaceFolders.some(root =>
                    path.startsWith(root)
                )
                if (!isInWorkspace) {
                    // We just allow it for now or log, since we can't easily warn
                    // await env.host.window.showInformationMessage('Opening file outside workspace...')
                }

                try {
                    if (await env.host.fs.exists(path)) {
                        // TODO: Check if directory (revealInExplorer equivalent?)
                        // For now assume file
                        await env.host.window.openFile(path, range ? { selection: range } : undefined)
                        return
                    }
                } catch {
                    // Fallback
                }

                // Fallback: open externally
                await env.host.window.openExternal(urlStr)
                return
            }

            // Fallback: open externally
            await env.host.window.openExternal(urlStr)
        } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e)
            void env.host.window.showErrorMessage(`Could not open link: ${errMsg}`)
        }
    })
}
