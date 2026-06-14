// Type-only imports from pi ESM packages cause TS1541 in CJS context.
// We use dynamic import() for values; types are used via declaration merging.
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

/**
 * List all available models from pi's built-in model registry.
 * Returns models in NebulaFlow's webview format: { id, title }.
 * Uses dynamic import to handle pi's ESM packages from CJS context.
 */
export async function listPiModels(): Promise<Array<{ id: string; provider: string; title: string }>> {
    const { getModels, getProviders } = await import('@earendil-works/pi-ai')
    const providers = getProviders()
    const models: Array<{ id: string; provider: string; title: string }> = []

    for (const provider of providers) {
        const providerModels = getModels(provider as any) as any[]
        for (const model of providerModels) {
            // pi model objects store id and provider separately.
            // Combine them so downstream code (ModelSelector grouping,
            // resolvePiModel) treats the full qualified key as the id.
            // Carry provider for reliable ModelSelector grouping.
            // Example: provider="openai", model.id="gpt-5.1" → id="openai/gpt-5.1"
            models.push({
                id: `${model.provider}/${model.id}`,
                provider: model.provider,
                title: model.name,
            })
        }
    }

    return models
}

/**
 * Resolve a model key to a pi Model object.
 * The key should be in qualified format: "provider/model-id" (e.g., "openai/gpt-5.1").
 * Legacy keys like "openai-completions/gpt-5.1" are mapped to the correct pi provider.
 * Returns undefined if no match is found.
 */
export async function resolvePiModel(modelKey: string): Promise<{ id: string; provider: string; name: string; api: any } | undefined> {
    const { getModels, getProviders } = await import('@earendil-works/pi-ai')
    const providers = getProviders()

    // Map legacy provider prefixes to pi's actual provider keys
    const key = normalizeLegacyProviderPrefix(modelKey)

    for (const provider of providers) {
        const providerModels = getModels(provider as any) as any[]
        const found = providerModels.find(
            (m: any) =>
                m.id === key ||
                `${m.provider}/${m.id}` === key
        )
        if (found) return found
    }
    return undefined
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
