import * as vscode from 'vscode'
import type { ExtensionToWorkflow } from '../../Core/models'
import { getSubflows, loadSubflow, saveSubflow } from '../../DataAccess/fs'
import { safePost } from '../../Shared/Infrastructure/messaging/safePost'

export type SliceEnv = { webview: import('vscode').Webview; isDev: boolean }
export type Router = Map<string, (message: any, env: SliceEnv) => Promise<void> | void>

export function registerHandlers(router: Router): void {
    // create_subflow
    router.set('create_subflow', async (message: any, env: SliceEnv) => {
        try {
            const result = await saveSubflow(message?.data)
            if ('id' in result) {
                await safePost(
                    env.webview,
                    { type: 'subflow_saved', data: { id: (result as any).id } } as ExtensionToWorkflow,
                    { strict: env.isDev }
                )
            } else {
                void vscode.window.showErrorMessage('Failed to save subflow')
            }
        } catch (e: any) {
            void vscode.window.showErrorMessage(`Failed to save subflow: ${e?.message ?? e}`)
        }
    })

    // get_subflow
    router.set('get_subflow', async (message: any, env: SliceEnv) => {
        try {
            const id = message?.data?.id as string
            const def = await loadSubflow(id)
            if (def) {
                await safePost(
                    env.webview,
                    { type: 'provide_subflow', data: def } as ExtensionToWorkflow,
                    { strict: env.isDev }
                )
            } else {
                void vscode.window.showErrorMessage(`Subflow not found: ${id}`)
            }
        } catch (e: any) {
            void vscode.window.showErrorMessage(`Failed to load subflow: ${e?.message ?? e}`)
        }
    })

    // get_subflows
    router.set('get_subflows', async (_message: any, env: SliceEnv) => {
        try {
            const list = await getSubflows()
            await safePost(
                env.webview,
                { type: 'provide_subflows', data: list } as ExtensionToWorkflow,
                { strict: env.isDev }
            )
        } catch (e: any) {
            void vscode.window.showErrorMessage(`Failed to list subflows: ${e?.message ?? e}`)
        }
    })

    // duplicate_subflow
    router.set('duplicate_subflow', async (message: any, env: SliceEnv) => {
        try {
            const payload = message?.data || {}
            const id = (payload as any).id as string
            const nodeId = (payload as any).nodeId as string
            const def = await loadSubflow(id)
            if (!def) {
                void vscode.window.showErrorMessage(`Subflow not found: ${id}`)
                return
            }
            const copy = { ...(def as any), id: '' } as any
            const result = await saveSubflow(copy)
            if ('id' in result) {
                await safePost(
                    env.webview,
                    {
                        type: 'subflow_copied',
                        data: { nodeId, oldId: id, newId: (result as any).id },
                    } as ExtensionToWorkflow,
                    { strict: env.isDev }
                )
            } else {
                void vscode.window.showErrorMessage('Failed to duplicate subflow')
            }
        } catch (e: any) {
            void vscode.window.showErrorMessage(`Failed to duplicate subflow: ${e?.message ?? e}`)
        }
    })
}
