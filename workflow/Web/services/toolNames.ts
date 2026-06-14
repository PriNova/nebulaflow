/**
 * pi SDK tool name metadata, kept environment-agnostic for the webview bundle.
 *
 * Previously this file mirrored Amp SDK tool names. Now it mirrors pi SDK tool names.
 * pi tools are registered via @earendil-works/pi-coding-agent's create*Tool() factories.
 * Tool names correspond to the actual tool.name values from those factories.
 */

export const BUILTIN_TOOL_NAMES = {
    // File system operations
    LS: 'ls',
    READ: 'read',
    EDIT: 'edit',
    WRITE: 'write',

    // Search
    FIND: 'find',
    GREP: 'grep',

    // Execution
    BASH: 'bash',
} as const

/** All recognized tool names (canonical). */
export function getAllToolNames(): string[] {
    return Object.values(BUILTIN_TOOL_NAMES)
}

/**
 * Resolve a tool name (or alias) to its canonical pi tool name.
 * Supports Amp-era aliases for backward compatibility with existing workflows.
 */
export function resolveToolName(nameOrAlias: string): string | undefined {
    const trimmed = nameOrAlias.trim()

    // Direct match
    if (Object.values(BUILTIN_TOOL_NAMES).includes(trimmed as any)) {
        return trimmed
    }

    // Amp-era aliases (backward compat)
    const aliases: Record<string, string> = {
        Read: BUILTIN_TOOL_NAMES.READ,
        Bash: BUILTIN_TOOL_NAMES.BASH,
        Grep: BUILTIN_TOOL_NAMES.GREP,
        edit_file: BUILTIN_TOOL_NAMES.EDIT,
        create_file: BUILTIN_TOOL_NAMES.WRITE,
        format_file: BUILTIN_TOOL_NAMES.EDIT,
        undo_edit: BUILTIN_TOOL_NAMES.EDIT,
        glob: BUILTIN_TOOL_NAMES.FIND,
        list_directory: BUILTIN_TOOL_NAMES.LS,
        read: BUILTIN_TOOL_NAMES.READ,
        edit: BUILTIN_TOOL_NAMES.EDIT,
        bash: BUILTIN_TOOL_NAMES.BASH,
        grep: BUILTIN_TOOL_NAMES.GREP,
        find: BUILTIN_TOOL_NAMES.FIND,
        ls: BUILTIN_TOOL_NAMES.LS,
        write: BUILTIN_TOOL_NAMES.WRITE,
        search: BUILTIN_TOOL_NAMES.GREP,
        web: BUILTIN_TOOL_NAMES.GREP,
    }

    return aliases[trimmed]
}

/**
 * Check if a tool is enabled (not in the disabled list).
 */
export function isToolEnabled(toolName: string, disabledTools: string[] = []): boolean {
    const resolved = resolveToolName(toolName)
    if (!resolved) return false
    return !disabledTools.includes(resolved)
}
