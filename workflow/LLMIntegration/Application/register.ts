import type { ExtensionToWorkflow } from '../../Core/models'
import type { IHostEnvironment, IMessagePort } from '../../Shared/Host/index'
import { readAmpSettingsFromHost } from '../../Shared/Infrastructure/amp-settings'
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
            const baseModels =
                typeof listModels === 'function'
                    ? listModels().map((m: any) => ({ id: m.key, title: m.displayName }))
                    : []

            const ampSettings = await readAmpSettingsFromHost(env.host, {
                warnOnError: env.isDev,
                debugTag: 'LLMIntegration/register',
            })
            const configuredPrimary =
                (ampSettings['internal.primaryModel'] as string | undefined)?.trim() || undefined

            const extraModels: { id: string; title?: string }[] = []
            if (configuredPrimary && !baseModels.some(m => m.id === configuredPrimary)) {
                extraModels.push({
                    id: configuredPrimary,
                    title: `W: ${configuredPrimary}`,
                })
            }

            const models = [...baseModels, ...extraModels]

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
