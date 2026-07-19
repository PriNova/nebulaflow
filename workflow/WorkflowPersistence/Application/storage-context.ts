import * as path from 'node:path'
import { toProtocolPayload } from '../../Application/messaging/converters'
import type { StorageScopeInfo } from '../../Core/Contracts/Protocol'
import { getCustomNodes, getSubflows } from '../../DataAccess/fs'
import type { IHostEnvironment, IMessagePort } from '../../Shared/Host/index'
import { safePost } from '../../Shared/Infrastructure/messaging/safePost'

export function readStorageScope(host: IHostEnvironment): StorageScopeInfo {
    const scope =
        host.workspace.getConfiguration<string>('nebulaFlow.storageScope', 'user') === 'workspace'
            ? 'workspace'
            : 'user'
    const basePath = host.workspace.getConfiguration<string>('nebulaFlow.globalStoragePath', '')
    const workspacePath = host.workspace.workspaceFolders[0]

    return {
        scope,
        basePath,
        workspaceAvailable: workspacePath !== undefined,
        ...(workspacePath
            ? { workspacePath, workspaceName: path.basename(workspacePath) || workspacePath }
            : {}),
    }
}

export async function publishStorageContext(
    host: IHostEnvironment,
    port: IMessagePort,
    isDev: boolean
): Promise<void> {
    const [nodes, subflows] = await Promise.all([getCustomNodes(), getSubflows()])

    await safePost(port, { type: 'storage_scope', data: readStorageScope(host) }, { strict: isDev })
    await safePost(
        port,
        {
            type: 'provide_custom_nodes',
            data: toProtocolPayload({ nodes, edges: [] }).nodes!,
        },
        { strict: isDev }
    )
    await safePost(port, { type: 'provide_subflows', data: subflows }, { strict: isDev })
}
