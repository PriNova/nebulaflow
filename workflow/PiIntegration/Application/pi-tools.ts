// AgentTool type from pi-agent-core. Imported dynamically at runtime;
// type is referenced via inference from the dynamic import return.

/**
 * pi tool names used by NebulaFlow.
 * These are the actual tool.name values from pi's defineTool() calls.
 * Kept as a constant for webview compatibility.
 */
export const PI_TOOL_NAMES = {
    READ: 'read',
    BASH: 'bash',
    EDIT: 'edit',
    WRITE: 'write',
    LS: 'ls',
    FIND: 'find',
    GREP: 'grep',
} as const

/** All pi tool name values */
export const ALL_PI_TOOL_NAMES: string[] = Object.values(PI_TOOL_NAMES)

export interface PiToolOptions {
    cwd: string
    /** Tool names to exclude (from node's disabledTools config) */
    disabledTools?: string[]
    /** If true, all tools are enabled (dangerous mode — no approval) */
    allowAll?: boolean
}

/**
 * Build the set of AgentTool objects for an LLM node execution.
 * Returns only the tools that are enabled per node config.
 * Uses dynamic import to handle pi's ESM packages from CJS context.
 */
export async function buildPiTools(options: PiToolOptions): Promise<any[]> {
    const {
        createBashTool,
        createReadTool,
        createEditTool,
        createWriteTool,
        createLsTool,
        createFindTool,
        createGrepTool,
    } = await import('@earendil-works/pi-coding-agent')

    const { cwd, disabledTools = [], allowAll = false } = options
    const disabledSet = new Set(
        disabledTools
            .filter((t) => typeof t === 'string')
            .map((t) => t.trim().toLowerCase())
    )

    const tools: any[] = []

    if (!disabledSet.has(PI_TOOL_NAMES.BASH)) {
        tools.push(createBashTool(cwd))
    }
    if (!disabledSet.has(PI_TOOL_NAMES.READ)) {
        tools.push(createReadTool(cwd))
    }
    if (!disabledSet.has(PI_TOOL_NAMES.EDIT)) {
        tools.push(createEditTool(cwd))
    }
    if (!disabledSet.has(PI_TOOL_NAMES.WRITE)) {
        tools.push(createWriteTool(cwd))
    }
    if (!disabledSet.has(PI_TOOL_NAMES.LS)) {
        tools.push(createLsTool(cwd))
    }
    if (!disabledSet.has(PI_TOOL_NAMES.FIND)) {
        tools.push(createFindTool(cwd))
    }
    if (!disabledSet.has(PI_TOOL_NAMES.GREP)) {
        tools.push(createGrepTool(cwd))
    }

    return tools
}
