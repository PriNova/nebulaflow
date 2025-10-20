export const BUILTIN_TOOL_NAMES = {
    LIST_DIRECTORY: 'list_directory',
    READ: 'Read',
    EDIT_FILE: 'edit_file',
    CREATE_FILE: 'create_file',
    UNDO_EDIT: 'undo_edit',
    FORMAT_FILE: 'format_file',
    GLOB: 'glob',

    GREP: 'Grep',
    CODEBASE_SEARCH_AGENT: 'codebase_search_agent',
    LIBRARIAN: 'librarian',
    WEB_CRAWLER: 'web_crawler',

    BASH: 'Bash',
    RUN_JAVASCRIPT: 'run_javascript',

    GET_DIAGNOSTICS: 'get_diagnostics',
    PRUNE_CONTEXT: 'prune_context',
    MULTIPLE_CHOICE: 'multiple_choice',
    TODO_READ: 'todo_read',
    TODO_WRITE: 'todo_write',
    MERMAID: 'mermaid',

    TASK: 'Task',
    ORACLE: 'oracle',

    GIT_DIFF: 'summarize_git_diff',
    COMMIT: 'commit',
} as const

export const TOOL_NAME_ALIASES: Record<string, string> = {
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

    // convenience
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
}

export function getAllToolNames(): string[] {
    return Object.values(BUILTIN_TOOL_NAMES)
}

export function resolveToolName(nameOrAlias: string): string | undefined {
    const officialNames = Object.values(BUILTIN_TOOL_NAMES) as string[]
    const key = nameOrAlias.trim()
    if (officialNames.includes(key)) return key
    return TOOL_NAME_ALIASES[key]
}
