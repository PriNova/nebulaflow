import * as vscode from 'vscode'
import { fromProtocolPayload, toProtocolPayload } from '../../Application/messaging/converters'
import type { ExtensionToWorkflow } from '../../Core/models'
import { deleteCustomNode, getCustomNodes, renameCustomNode, saveCustomNode } from '../../DataAccess/fs'
import { safePost } from '../../Shared/Infrastructure/messaging/safePost'

export type SliceEnv = { webview: import('vscode').Webview; isDev: boolean }
export type Router = Map<string, (message: any, env: SliceEnv) => Promise<void> | void>

function readStorageScope(): { scope: 'workspace' | 'user'; basePath?: string } {
    const cfg = vscode.workspace.getConfiguration('nebulaFlow')
    const scope = cfg.get<string>('storageScope', 'user') === 'workspace' ? 'workspace' : 'user'
    const basePath = cfg.get<string>('globalStoragePath', '')
    return { scope, basePath }
}

export function registerHandlers(router: Router): void {
    router.set('save_customNode', async (message: any, env: SliceEnv) => {
        const node = fromProtocolPayload({ nodes: [message.data], edges: [] }).nodes[0]
        await saveCustomNode(node)
        const nodes = await getCustomNodes()
        const msg: ExtensionToWorkflow = {
            type: 'provide_custom_nodes',
            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
        } as ExtensionToWorkflow
        await safePost(env.webview, msg, { strict: env.isDev })
    })

    router.set('get_custom_nodes', async (_message: any, env: SliceEnv) => {
        const nodes = await getCustomNodes()
        const provideMsg: ExtensionToWorkflow = {
            type: 'provide_custom_nodes',
            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
        } as ExtensionToWorkflow
        await safePost(env.webview, provideMsg, { strict: env.isDev })

        const info = readStorageScope()
        const scopeMsg: ExtensionToWorkflow = {
            type: 'storage_scope',
            data: info,
        } as ExtensionToWorkflow
        await safePost(env.webview, scopeMsg, { strict: env.isDev })
    })

    router.set('delete_customNode', async (message: any, env: SliceEnv) => {
        await deleteCustomNode(message.data)
        const nodes = await getCustomNodes()
        const msg: ExtensionToWorkflow = {
            type: 'provide_custom_nodes',
            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
        } as ExtensionToWorkflow
        await safePost(env.webview, msg, { strict: env.isDev })
    })

    router.set('rename_customNode', async (message: any, env: SliceEnv) => {
        await renameCustomNode(message.data.oldNodeTitle, message.data.newNodeTitle)
        const nodes = await getCustomNodes()
        const msg: ExtensionToWorkflow = {
            type: 'provide_custom_nodes',
            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
        } as ExtensionToWorkflow
        await safePost(env.webview, msg, { strict: env.isDev })
    })
}
