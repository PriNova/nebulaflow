import { getPiModelRuntime } from './pi-model-runtime'

// Type-only imports from pi ESM packages cause TS1541 in CJS context.
// Runtime values are loaded through dynamic import().

export interface PiModelInfo {
    id: string
    provider: string
    name: string
    api: unknown
}

/**
 * List all available models from pi's built-in model registry.
 * Returns models in NebulaFlow's webview format: { id, title }.
 * Uses dynamic import to handle pi's ESM packages from CJS context.
 */
export async function listPiModels(): Promise<Array<{ id: string; provider: string; title: string }>> {
    const modelRuntime = await getPiModelRuntime()
    return modelRuntime.getAvailableSnapshot().map((model) => ({
        id: `${model.provider}/${model.id}`,
        provider: model.provider,
        title: model.name,
    }))
}

/**
 * Resolve a model key to a pi Model object.
 * The key should be in qualified format: "provider/model-id" (e.g., "openai/gpt-5.1").
 * Legacy keys like "openai-completions/gpt-5.1" are mapped to the correct pi provider.
 * Returns undefined if no match is found.
 */
export async function resolvePiModel(modelKey: string): Promise<PiModelInfo | undefined> {
    const modelRuntime = await getPiModelRuntime()
    const key = normalizeLegacyProviderPrefix(modelKey)
    const separator = key.indexOf('/')

    if (separator > 0) {
        const provider = key.slice(0, separator)
        const modelId = key.slice(separator + 1)
        return modelRuntime.getModel(provider, modelId)
    }

    return modelRuntime.getModels().find((model) => model.id === key)
}

/**
 * Map legacy NebulaFlow provider prefixes to pi's actual provider keys.
 * Legacy: "openai-completions/gpt-5.1" -> "openai/gpt-5.1"
 * Legacy: "anthropic-messages/claude-sonnet-4" -> "anthropic/claude-sonnet-4"
 */
function normalizeLegacyProviderPrefix(modelKey: string): string {
    const LEGACY_TO_PI: Record<string, string> = {
        'openai-completions': 'openai',
        'anthropic-messages': 'anthropic',
        'google-generative-ai': 'google',
        'mistral-conversations': 'mistral',
    }
    const idx = modelKey.indexOf('/')
    if (idx > 0) {
        const legacyPrefix = modelKey.slice(0, idx)
        const piPrefix = LEGACY_TO_PI[legacyPrefix]
        if (piPrefix) {
            return piPrefix + '/' + modelKey.slice(idx + 1)
        }
    }
    return modelKey
}

/**
 * Migrate an Amp SDK model ID to pi-compatible qualified format.
 * Amp uses "openrouter/anthropic/claude-sonnet-4-20250514"
 * pi qualified format: "anthropic/claude-sonnet-4-20250514"
 *
 * If the ID is already pi-compatible, returns the qualified key.
 * If unrecognized, returns undefined (caller should use default).
 */
export async function migrateAmpModelId(ampModelId: string): Promise<string | undefined> {
    // Already pi-compatible (contains provider/model format that pi uses)
    const piModel = await resolvePiModel(ampModelId)
    if (piModel) return `${piModel.provider}/${piModel.id}`

    // Try common Amp → pi mappings
    const OPENROUTER_PROVIDER_MAP: Record<string, string> = {
        openai: 'openai',
        anthropic: 'anthropic',
        google: 'google',
        mistralai: 'mistral',
        meta: 'openai',
    }

    // Detect OpenRouter-style key: "openrouter/provider/model"
    if (ampModelId.startsWith('openrouter/')) {
        const parts = ampModelId.slice('openrouter/'.length).split('/')
        const providerPart = parts[0] ?? ''
        const modelPart = parts.slice(1).join('/')

        const piProvider = OPENROUTER_PROVIDER_MAP[providerPart]
        if (piProvider && modelPart) {
            const candidateId = modelPart
            const resolved = await resolvePiModel(candidateId)
            if (resolved) return resolved.id
        }
        return undefined
    }

    // Try as direct provider/model (sans openrouter/ prefix)
    const directParts = ampModelId.split('/')
    if (directParts.length >= 2) {
        const providerPart = directParts[0] ?? ''
        const modelPart = directParts.slice(1).join('/')
        const piProvider = OPENROUTER_PROVIDER_MAP[providerPart]
        if (piProvider) {
            const resolved = await resolvePiModel(modelPart)
            if (resolved) return resolved.id
        }
    }

    return undefined
}
