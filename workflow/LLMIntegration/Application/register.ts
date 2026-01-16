import type { ExtensionToWorkflow } from '../../Core/models'
import type { IHostEnvironment, IMessagePort } from '../../Shared/Host/index'
import { safePost } from '../../Shared/Infrastructure/messaging/safePost'
import { readNebulaflowSettingsFromHost } from '../../Shared/Infrastructure/nebulaflow-settings'

export type SliceEnv = {
    port: IMessagePort
    host: IHostEnvironment
    isDev: boolean
    updatePanelTitle: (uri?: string) => void
}
export type Router = Map<string, (message: any, env: SliceEnv) => Promise<void> | void>

/**
 * Transforms an OpenRouter model ID (e.g., "openrouter/anthropic/claude-3-5-sonnet")
 * into a display title (e.g., "claude-3-5-sonnet").
 * If the model ID does not start with "openrouter/", returns the original ID as-is.
 */
function getOpenRouterDisplayTitle(modelId: string): string {
    // If it doesn't start with "openrouter/", return the full ID as-is
    if (!modelId.startsWith('openrouter/')) {
        return modelId
    }
    // Remove 'openrouter/' prefix and extract just the model name
    const withoutPrefix = modelId.slice('openrouter/'.length)
    const modelName = withoutPrefix.split('/').pop() ?? withoutPrefix
    return modelName
}

export function registerHandlers(router: Router): void {
    router.set('get_models', async (_message: any, env: SliceEnv) => {
        try {
            // Dynamically import to avoid hard failure when SDK is not linked
            const sdk = (await import('@prinova/amp-sdk')) as any
            const listModels: (() => Array<{ key: string; displayName: string }>) | undefined =
                sdk?.listModels
            const baseModels =
                typeof listModels === 'function'
                    ? listModels().map((m: any) => ({ id: m.key, title: m.displayName }))
                    : []

            const nebulaflowSettings = await readNebulaflowSettingsFromHost(env.host, {
                warnOnError: env.isDev,
                debugTag: 'LLMIntegration/register',
            })
            const configuredPrimary =
                (nebulaflowSettings['internal.primaryModel'] as string | undefined)?.trim() || undefined
            const openrouterModels = nebulaflowSettings['openrouter.models'] as
                | Array<{ model: string }>
                | undefined

            const extraModels: { id: string; title?: string }[] = []

            if (Array.isArray(openrouterModels)) {
                for (const entry of openrouterModels) {
                    if (entry && typeof entry.model === 'string') {
                        const modelId = entry.model
                        if (
                            !baseModels.some(m => m.id === modelId) &&
                            !extraModels.some(m => m.id === modelId)
                        ) {
                            extraModels.push({
                                id: modelId,
                                title: getOpenRouterDisplayTitle(modelId),
                            })
                        }
                    }
                }
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
