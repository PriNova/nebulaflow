const TOOL_ALIASES: Record<string, string> = {
    Bash: 'Bash',
    bash: 'Bash',
    Read: 'Read',
    read: 'Read',
    Grep: 'Grep',
    grep: 'Grep',
}

export function resolveToolName(nameOrAlias: string): string | undefined {
    const key = nameOrAlias.trim()
    return TOOL_ALIASES[key] || key
}

export function isToolDisabled(toolName: string, disabledTools: string[] | undefined): boolean {
    const resolved = resolveToolName(toolName)
    if (!resolved) return false
    return (disabledTools ?? []).includes(resolved)
}
