import type { LLMNode, WorkflowNodes } from '../../Core/models'
import { PI_TOOL_NAMES } from '../../PiIntegration/Application/pi-tools'

/**
 * Compute pi Agent settings from a NebulaFlow LLM node configuration.
 * Replaces the old computeLLMAmpSettings which used Amp SDK's resolveToolName.
 */
export function computePiAgentSettings(node: WorkflowNodes): {
    settings: Record<string, unknown>
    debug: { disabledTools: string[]; dangerouslyAllowAll: boolean; reasoningEffort: string }
} {
    const llmNode = node as LLMNode
    const data = llmNode.data

    const disabledToolsRaw = data.disabledTools
    const disabledTools: string[] = Array.isArray(disabledToolsRaw)
        ? disabledToolsRaw.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        : []

    const rawReasoningEffort = data.reasoningEffort
    const validEfforts = new Set<string>(['minimal', 'low', 'medium', 'high'])
    const reasoningEffort = rawReasoningEffort && validEfforts.has(rawReasoningEffort)
        ? rawReasoningEffort
        : 'medium'

    const dangerouslyAllowAll: boolean = data.dangerouslyAllowAll === true

    // pi tools use different names than Amp tools. Normalize disabled list.
    const normalizedDisabled = normalizeDisabledTools(disabledTools)

    const bashDisabled = normalizedDisabled.some(
        (t) => t === PI_TOOL_NAMES.BASH || t === 'bash'
    )
    const shouldApplyAllowAll = dangerouslyAllowAll && !bashDisabled

    const settings: Record<string, unknown> = {
        'reasoning.effort': reasoningEffort,
    }
    if (normalizedDisabled.length > 0) settings['tools.disable'] = normalizedDisabled
    if (shouldApplyAllowAll) {
        settings['pi.dangerouslyAllowAll'] = true
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

/**
 * Normalize a list of tool names to pi's official tool names.
 * pi tool names: read, bash, edit, write, ls, find, grep
 * Also handles Amp-era aliases for backward compatibility.
 */
function normalizeDisabledTools(list: string[]): string[] {
    const ampToPi: Record<string, string> = {
        // Amp SDK names → pi names
        Read: PI_TOOL_NAMES.READ,
        Bash: PI_TOOL_NAMES.BASH,
        edit_file: PI_TOOL_NAMES.EDIT,
        create_file: PI_TOOL_NAMES.WRITE,
        Grep: PI_TOOL_NAMES.GREP,
        glob: PI_TOOL_NAMES.FIND,
        list_directory: PI_TOOL_NAMES.LS,
        // Common aliases
        read: PI_TOOL_NAMES.READ,
        bash: PI_TOOL_NAMES.BASH,
        edit: PI_TOOL_NAMES.EDIT,
        write: PI_TOOL_NAMES.WRITE,
        grep: PI_TOOL_NAMES.GREP,
        find: PI_TOOL_NAMES.FIND,
        ls: PI_TOOL_NAMES.LS,
    }

    const normalized = new Set<string>()
    for (const raw of list) {
        const trimmed = raw.trim()
        const resolved = ampToPi[trimmed] ?? trimmed.toLowerCase()
        if (Object.values(PI_TOOL_NAMES).includes(resolved as typeof PI_TOOL_NAMES[keyof typeof PI_TOOL_NAMES])) {
            normalized.add(resolved)
        }
    }
    return Array.from(normalized)
}

/**
 * Legacy compatibility: re-export the old computeLLMAmpSettings name.
 * Existing callers in ExecuteWorkflow.ts may still reference this.
 */
export const computeLLMAmpSettings = computePiAgentSettings
