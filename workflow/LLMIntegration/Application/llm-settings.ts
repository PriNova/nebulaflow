import type { WorkflowNodes } from '../../Core/models'
import { resolveToolName as resolveToolNameLocal } from '../../Core/toolUtils.js'

/**
 * Normalize a list of tool names to official names using the Amp SDK resolver.
 * Falls back to the raw value if the resolver is unavailable.
 */
async function normalizeDisabledTools(list: unknown): Promise<string[]> {
    if (!Array.isArray(list)) return []
    const sdk = await safeRequireSDK()
    const resolveToolName: ((name: string) => string | undefined) | undefined = sdk?.resolveToolName
    const normalized = new Set<string>()
    for (const raw of list) {
        if (typeof raw !== 'string' || raw.trim() === '') continue
        const resolved = (resolveToolName?.(raw) ?? resolveToolNameLocal(raw)) as string
        if (resolved) normalized.add(resolved)
    }
    return Array.from(normalized)
}

async function safeRequireSDK(): Promise<any | undefined> {
    try {
        return await import('@prinova/amp-sdk')
    } catch {
        return undefined
    }
}

function isBashDisabled(disabledTools: string[]): boolean {
    return disabledTools.some(t => typeof t === 'string' && t.trim().toLowerCase() === 'bash')
}

export async function computeLLMAmpSettings(node: WorkflowNodes): Promise<{
    settings: Record<string, unknown>
    debug: { disabledTools: string[]; dangerouslyAllowAll: boolean; reasoningEffort: string }
}> {
    const data = (node as any)?.data ?? {}

    const normalizedDisabled = await normalizeDisabledTools(data.disabledTools)

    const rawReasoningEffort: string | undefined = data.reasoningEffort
    const validEfforts = new Set(['minimal', 'low', 'medium', 'high'])
    const reasoningEffort = validEfforts.has(rawReasoningEffort as any)
        ? (rawReasoningEffort as 'minimal' | 'low' | 'medium' | 'high')
        : 'medium'

    const dangerouslyAllowAll: boolean = data.dangerouslyAllowAll === true
    const bashDisabled = isBashDisabled(normalizedDisabled)
    const shouldApplyAllowAll = dangerouslyAllowAll && !bashDisabled

    const settings: Record<string, unknown> = {
        'reasoning.effort': reasoningEffort,
    }
    if (normalizedDisabled.length > 0) settings['tools.disable'] = normalizedDisabled
    if (shouldApplyAllowAll) {
        settings['amp.dangerouslyAllowAll'] = true
        settings['amp.experimental.commandApproval.enabled'] = false
        settings['amp.commands.allowlist'] = ['*']
        settings['amp.commands.strict'] = false
    }

    return {
        settings,
        debug: {
            disabledTools: normalizedDisabled,
            dangerouslyAllowAll,
            reasoningEffort,
        },
    }
}
