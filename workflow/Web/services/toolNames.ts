// Local copy of Amp SDK's tool name metadata, kept environment-agnostic so it
// can be used safely in the webview bundle. This should be kept in sync with
// @prinova/amp-sdk's tool-aliases module.

export const BUILTIN_TOOL_NAMES = {
    // File system operations
    LIST_DIRECTORY: 'list_directory',
    READ: 'Read',
    EDIT_FILE: 'edit_file',
    CREATE_FILE: 'create_file',
    UNDO_EDIT: 'undo_edit',
    FORMAT_FILE: 'format_file',
    GLOB: 'glob',

    // Search and analysis
    GREP: 'Grep',
    CODEBASE_SEARCH_AGENT: 'codebase_search_agent',
    LIBRARIAN: 'librarian',
    WEB_CRAWLER: 'web_crawler',

    // Execution
    BASH: 'Bash',
    RUN_JAVASCRIPT: 'run_javascript',

    // Development tools
    GET_DIAGNOSTICS: 'get_diagnostics',
    PRUNE_CONTEXT: 'prune_context',
    MULTIPLE_CHOICE: 'multiple_choice',
    TODO_READ: 'todo_read',
    TODO_WRITE: 'todo_write',
    MERMAID: 'mermaid',

    // Sub-agent orchestration
    TASK: 'Task',
    ORACLE: 'oracle',

    // Git operations
    GIT_DIFF: 'summarize_git_diff',
    COMMIT: 'commit',
} as const

const SDK_TOOL_NAME_ALIASES = {
    // Direct matches (prefer exact tool registration names)
    list_directory: 'list_directory',
    Grep: 'Grep',
    glob: 'glob',
    Read: 'Read',
    Bash: 'Bash',
    edit_file: 'edit_file',
    create_file: 'create_file',
    undo_edit: 'undo_edit',
    format_file: 'format_file',

    codebase_search_agent: 'codebase_search_agent',
    librarian: 'librarian',
    web_crawler: 'web_crawler',
    get_diagnostics: 'get_diagnostics',

    run_javascript: 'run_javascript',
    Task: 'Task',
    oracle: 'oracle',
    GitDiff: 'summarize_git_diff',
    commit: 'commit',
    multiple_choice: 'multiple_choice',
    todo_read: 'todo_read',
    todo_write: 'todo_write',
    mermaid: 'mermaid',
    prune_context: 'prune_context',
} as const

// NebulaFlow-specific convenience aliases (kept for backwards compatibility)
const LOCAL_ALIASES: Record<string, string> = {
    read: 'Read',
    edit: 'edit_file',
    create: 'create_file',
    bash: 'Bash',
    grep: 'Grep',
    search: 'web_crawler',
    js: 'run_javascript',
    javascript: 'run_javascript',
    format: 'format_file',
    diagnostics: 'get_diagnostics',
    web: 'web_crawler',
    GitDiff: 'summarize_git_diff',
}

export const TOOL_NAME_ALIASES: Record<string, string> = {
    ...SDK_TOOL_NAME_ALIASES,
    ...LOCAL_ALIASES,
}

export function getAllToolNames(): string[] {
    return Object.values(BUILTIN_TOOL_NAMES)
}

export function resolveToolName(nameOrAlias: string): string | undefined {
    // Check if it's already an official tool name
    if (Object.values(BUILTIN_TOOL_NAMES).includes(nameOrAlias as any)) {
        return nameOrAlias
    }

    // Check aliases (including NebulaFlow-specific ones)
    return TOOL_NAME_ALIASES[nameOrAlias.trim()]
}

export function isToolEnabled(toolName: string, disabledTools: string[] = []): boolean {
    const resolved = resolveToolName(toolName)
    if (!resolved) return false
    return !disabledTools.includes(resolved)
}
