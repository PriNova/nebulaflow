import { fromProtocolPayload, toProtocolPayload } from '../../Application/messaging/converters'
import type {
    DeleteCustomNodeCommand,
    RenameCustomNodeCommand,
    SaveCustomNodeCommand,
} from '../../Core/Contracts/Protocol'
import type { ExtensionToWorkflow } from '../../Core/models'
import { deleteCustomNode, getCustomNodes, renameCustomNode, saveCustomNode } from '../../DataAccess/fs'
import type { IHostEnvironment, IMessagePort } from '../../Shared/Host/index'
import { safePost } from '../../Shared/Infrastructure/messaging/safePost'
import { readStorageScope } from '../../WorkflowPersistence/Application/storage-context'

export type SliceEnv = {
    port: IMessagePort
    host: IHostEnvironment
    isDev: boolean
    updatePanelTitle: (uri?: string) => void
}
export type Router = Map<string, (message: unknown, env: SliceEnv) => Promise<void> | void>

export function registerHandlers(router: Router): void {
    router.set('save_customNode', async (message: unknown, env: SliceEnv) => {
        const cmd = message as SaveCustomNodeCommand
        const node = fromProtocolPayload({ nodes: [cmd.data], edges: [] }).nodes[0]
        await saveCustomNode(node)
        const nodes = await getCustomNodes()
        const msg: ExtensionToWorkflow = {
            type: 'provide_custom_nodes',
            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
        }
        await safePost(env.port, msg, { strict: env.isDev })
    })

    router.set('get_custom_nodes', async (_message: unknown, env: SliceEnv) => {
        const nodes = await getCustomNodes()
        const provideMsg: ExtensionToWorkflow = {
            type: 'provide_custom_nodes',
            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
        }
        await safePost(env.port, provideMsg, { strict: env.isDev })

        const info = readStorageScope(env.host)
        const scopeMsg: ExtensionToWorkflow = {
            type: 'storage_scope',
            data: info,
        }
        await safePost(env.port, scopeMsg, { strict: env.isDev })
    })

    router.set('delete_customNode', async (message: unknown, env: SliceEnv) => {
        const cmd = message as DeleteCustomNodeCommand
        await deleteCustomNode(cmd.data)
        const nodes = await getCustomNodes()
        const msg: ExtensionToWorkflow = {
            type: 'provide_custom_nodes',
            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
        }
        await safePost(env.port, msg, { strict: env.isDev })
    })

    router.set('rename_customNode', async (message: unknown, env: SliceEnv) => {
        const cmd = message as RenameCustomNodeCommand
        await renameCustomNode(cmd.data.oldNodeTitle, cmd.data.newNodeTitle)
        const nodes = await getCustomNodes()
        const msg: ExtensionToWorkflow = {
            type: 'provide_custom_nodes',
            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
        }
        await safePost(env.port, msg, { strict: env.isDev })
    })
}
