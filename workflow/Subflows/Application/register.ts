import type {
    CreateSubflowCommand,
    DuplicateSubflowCommand,
    GetSubflowCommand,
} from '../../Core/Contracts/Protocol'
import { getSubflows, loadSubflow, saveSubflow } from '../../DataAccess/fs'
import type { IHostEnvironment, IMessagePort } from '../../Shared/Host/index'
import { safePost } from '../../Shared/Infrastructure/messaging/safePost'

export type SliceEnv = {
    port: IMessagePort
    host: IHostEnvironment
    isDev: boolean
    updatePanelTitle: (uri?: string) => void
}
export type Router = Map<string, (message: unknown, env: SliceEnv) => Promise<void> | void>

export function registerHandlers(router: Router): void {
    // create_subflow
    router.set('create_subflow', async (message: unknown, env: SliceEnv) => {
        try {
            const cmd = message as CreateSubflowCommand
            const result = await saveSubflow(cmd.data)
            if ('id' in result) {
                await safePost(
                    env.port,
                    { type: 'subflow_saved', data: { id: result.id } },
                    { strict: env.isDev }
                )
            } else {
                void env.host.window.showErrorMessage('Failed to save subflow')
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            void env.host.window.showErrorMessage(`Failed to save subflow: ${msg}`)
        }
    })

    // get_subflow
    router.set('get_subflow', async (message: unknown, env: SliceEnv) => {
        try {
            const cmd = message as GetSubflowCommand
            const id = cmd.data.id
            const def = await loadSubflow(id)
            if (def) {
                await safePost(env.port, { type: 'provide_subflow', data: def }, {
                    strict: env.isDev,
                })
            } else {
                void env.host.window.showErrorMessage(`Subflow not found: ${id}`)
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            void env.host.window.showErrorMessage(`Failed to load subflow: ${msg}`)
        }
    })

    // get_subflows
    router.set('get_subflows', async (_message: unknown, env: SliceEnv) => {
        try {
            const list = await getSubflows()
            await safePost(env.port, { type: 'provide_subflows', data: list }, {
                strict: env.isDev,
            })
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            void env.host.window.showErrorMessage(`Failed to list subflows: ${msg}`)
        }
    })

    // duplicate_subflow
    router.set('duplicate_subflow', async (message: unknown, env: SliceEnv) => {
        try {
            const cmd = message as DuplicateSubflowCommand
            const { id, nodeId } = cmd.data
            const def = await loadSubflow(id)
            if (!def) {
                void env.host.window.showErrorMessage(`Subflow not found: ${id}`)
                return
            }
            const copy = { ...def, id: '' }
            const result = await saveSubflow(copy)
            if ('id' in result) {
                await safePost(
                    env.port,
                    {
                        type: 'subflow_copied',
                        data: { nodeId, oldId: id, newId: result.id },
                    },
                    { strict: env.isDev }
                )
            } else {
                void env.host.window.showErrorMessage('Failed to duplicate subflow')
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            void env.host.window.showErrorMessage(`Failed to duplicate subflow: ${msg}`)
        }
    })
}
