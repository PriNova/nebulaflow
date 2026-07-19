import type { IHostEnvironment, IMessagePort } from '../../Shared/Host/index'
import { safePost } from '../../Shared/Infrastructure/messaging/safePost'
import { listPiModels } from '../../PiIntegration/Application/pi-models'

export type SliceEnv = {
    port: IMessagePort
    host: IHostEnvironment
    isDev: boolean
    updatePanelTitle: (uri?: string) => void
}
export type Router = Map<string, (message: unknown, env: SliceEnv) => Promise<void> | void>

export function registerHandlers(router: Router): void {
    router.set('get_models', async (_message: unknown, env: SliceEnv) => {
        try {
            // List models from pi's built-in registry
            console.log('[nebulaflow] get_models: calling listPiModels()')
            const piModels = await listPiModels()
            console.log('[nebulaflow] get_models: listPiModels() returned', piModels.length, 'models')
            if (piModels.length > 0) {
                console.log('[nebulaflow] get_models: first model', JSON.stringify(piModels[0]))
            }
            const models = piModels.map((model) => ({
                id: model.id,
                provider: model.provider,
                title: model.title,
            }))

            await safePost(env.port, { type: 'models_loaded', data: models }, {
                strict: env.isDev,
            })
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            const stack = error instanceof Error ? error.stack : undefined
            console.error('[nebulaflow] get_models: Failed to load pi models:', msg)
            if (stack) console.error('[nebulaflow] get_models: stack:', stack)

            // Fallback: provide at least the default model so the user can proceed.
            // This ensures the model selector dropdown is never completely empty
            // even when pi's model registry isn't available.
            const fallbackModels = [
                { id: 'openai/gpt-5.1', provider: 'openai', title: 'GPT-5.1' },
                { id: 'openai/gpt-5.1-codex', provider: 'openai', title: 'GPT-5.1 Codex' },
                { id: 'anthropic/claude-sonnet-4-20250514', provider: 'anthropic', title: 'Claude Sonnet 4' },
            ]
            console.log('[nebulaflow] get_models: sending fallback models:', fallbackModels.length)
            await safePost(
                env.port,
                { type: 'models_loaded', data: fallbackModels },
                { strict: env.isDev },
            )
        }
    })
}
