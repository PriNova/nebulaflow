import type { ExtensionToWorkflow } from '../../Core/models'
import type { IHostEnvironment, IMessagePort } from '../../Shared/Host/index'
import { safePost } from '../../Shared/Infrastructure/messaging/safePost'

export type SliceEnv = {
    port: IMessagePort
    host: IHostEnvironment
    isDev: boolean
    updatePanelTitle: (uri?: string) => void
}
export type Router = Map<string, (message: any, env: SliceEnv) => Promise<void> | void>

export function registerHandlers(router: Router): void {
    router.set('get_models', async (_message: any, env: SliceEnv) => {
        try {
            // Dynamically require to avoid hard failure when SDK is not linked
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const sdk = require('@prinova/amp-sdk') as any
            const listModels: (() => Array<{ key: string; displayName: string }>) | undefined =
                sdk?.listModels
            const models =
                typeof listModels === 'function'
                    ? listModels().map((m: any) => ({ id: m.key, title: m.displayName }))
                    : []
            await safePost(env.port, { type: 'models_loaded', data: models } as ExtensionToWorkflow, {
                strict: env.isDev,
            })
        } catch {
            await safePost(env.port, { type: 'models_loaded', data: [] } as ExtensionToWorkflow, {
                strict: env.isDev,
            })
        }
    })
}
