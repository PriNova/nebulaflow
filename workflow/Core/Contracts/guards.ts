// Runtime type-guards for shared protocol contracts
// Keep checks narrow and low-cost; avoid external deps.

import type {
    AssistantContentItem,
    BaseWorkflowMessage,
    EdgeDTO,
    ExtensionToWorkflow,
    NodeExecutionPayload,
    NodeSavedState,
    WorkflowNodeDTO,
    WorkflowPayloadDTO,
    WorkflowStateDTO,
    WorkflowToExtension,
} from './Protocol'

// A non-any loose object type for type-narrowing guards that must
// inspect properties on externally originating JSON-like values.
type UnknownRecord = Record<string, unknown>

function isObject(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
    return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
}

export function isBaseWorkflowMessage(value: unknown): value is BaseWorkflowMessage {
    return isObject(value) && isString(value.type)
}

export function isEdgeDTO(value: unknown): value is EdgeDTO {
    if (!isObject(value)) return false
    if (!isString(value.id) || !isString(value.source) || !isString(value.target))
        return false
    if (
        'sourceHandle' in value &&
        value.sourceHandle !== undefined &&
        !isString(value.sourceHandle)
    )
        return false
    if (
        'targetHandle' in value &&
        value.targetHandle !== undefined &&
        !isString(value.targetHandle)
    )
        return false
    return true
}

export function isWorkflowNodeDTO(value: unknown): value is WorkflowNodeDTO {
    if (!isObject(value)) return false
    if (!isString(value.id) || !isString(value.type)) return false
    if (!isObject(value.data)) return false
    const pos = value.position
    if (!isObject(pos) || !isNumber(pos.x) || !isNumber(pos.y)) return false
    if (
        'selected' in value &&
        value.selected !== undefined &&
        typeof value.selected !== 'boolean'
    )
        return false
    return true
}

function isNodeSavedState(value: unknown): value is NodeSavedState {
    if (!isObject(value)) return false
    const status = value.status
    if (typeof status !== 'string') return false
    if (!['completed', 'error', 'interrupted'].includes(status)) return false
    if (!isString(value.output)) return false
    if (
        'error' in value &&
        value.error !== undefined &&
        !isString(value.error)
    )
        return false
    if (
        'tokenCount' in value &&
        value.tokenCount !== undefined &&
        !isNumber(value.tokenCount)
    )
        return false
    return true
}

function isWorkflowStateDTO(value: unknown): value is WorkflowStateDTO {
    if (!isObject(value)) return false
    const nodeResults = value.nodeResults
    if (!isObject(nodeResults)) return false
    for (const result of Object.values(nodeResults)) {
        if (!isNodeSavedState(result)) return false
    }
    if ('ifElseDecisions' in value && value.ifElseDecisions !== undefined) {
        const decisions = value.ifElseDecisions
        if (!isObject(decisions)) return false
        for (const decision of Object.values(decisions)) {
            if (typeof decision !== 'string' || !['true', 'false'].includes(decision)) return false
        }
    }
    if ('nodeAssistantContent' in value && value.nodeAssistantContent !== undefined) {
        const content = value.nodeAssistantContent
        if (!isObject(content)) return false
        for (const items of Object.values(content)) {
            if (!Array.isArray(items)) return false
        }
    }
    if ('nodeThreadIDs' in value && value.nodeThreadIDs !== undefined) {
        const threads = value.nodeThreadIDs
        if (!isObject(threads)) return false
        for (const id of Object.values(threads)) {
            if (!isString(id)) return false
        }
    }
    return true
}

export function isWorkflowPayloadDTO(value: unknown): value is WorkflowPayloadDTO {
    if (!isObject(value)) return false
    if ('nodes' in value && value.nodes !== undefined) {
        const nodes = value.nodes
        if (!Array.isArray(nodes) || !nodes.every(isWorkflowNodeDTO))
            return false
    }
    if ('edges' in value && value.edges !== undefined) {
        const edges = value.edges
        if (!Array.isArray(edges) || !edges.every(isEdgeDTO)) return false
    }
    if ('state' in value && value.state !== undefined) {
        if (!isWorkflowStateDTO(value.state)) return false
    }
    return true
}

export function isNodeExecutionPayload(value: unknown): value is NodeExecutionPayload {
    if (!isObject(value)) return false
    if (!isString(value.nodeId)) return false
    const status = value.status
    if (typeof status !== 'string') return false
    if (!['running', 'completed', 'error', 'interrupted', 'pending_approval'].includes(status))
        return false
    if (
        'result' in value &&
        value.result !== undefined &&
        !isString(value.result)
    )
        return false
    if (
        'multi' in value &&
        value.multi !== undefined &&
        !(Array.isArray(value.multi) && value.multi.every((v: unknown) => isString(v)))
    )
        return false
    if (
        'command' in value &&
        value.command !== undefined &&
        !isString(value.command)
    )
        return false
    return true
}

// Message guard helper: extracts the type string from a message, or returns null.
function getMessageType(value: unknown): string | null {
    if (!isBaseWorkflowMessage(value)) return null
    const msg = value as unknown as UnknownRecord
    const t = msg.type
    return typeof t === 'string' ? t : null
}

// Message guards (webview -> extension)
export function isWorkflowToExtension(value: unknown): value is WorkflowToExtension {
    const msgType = getMessageType(value)
    if (!msgType) return false
    const msg = value as UnknownRecord
    switch (msgType) {
        case 'open_external_link':
            return isString(msg.url)
        case 'save_workflow':
            return isWorkflowPayloadDTO(msg.data)
        case 'load_workflow':
            return true
        case 'load_last_workflow':
            return true
        case 'execute_workflow':
            return isWorkflowPayloadDTO(msg.data)
        case 'abort_workflow':
            return true
        case 'pause_workflow':
            return true
        case 'get_models':
            return true
        case 'save_customNode':
            return isWorkflowNodeDTO(msg.data)
        case 'delete_customNode':
            return isString(msg.data)
        case 'rename_customNode':
            return (
                isObject(msg.data) && isString(msg.data.oldNodeTitle) && isString(msg.data.newNodeTitle)
            )
        case 'get_custom_nodes':
            return true
        case 'get_storage_scope':
            return true
        case 'toggle_storage_scope':
            return true
        case 'set_storage_scope':
            return (
                isObject(msg.data) &&
                (msg.data.scope === 'workspace' || msg.data.scope === 'user')
            )
        case 'calculate_tokens':
            return isObject(msg.data) && isString(msg.data.text) && isString(msg.data.nodeId)
        case 'create_subflow': {
            const d = msg.data
            if (!isObject(d)) return false
            if (!isString(d.id) || !isString(d.title) || !isString(d.version))
                return false
            const g = d.graph
            if (!isObject(g)) return false
            const nodes = g.nodes
            const edges = g.edges
            if (!Array.isArray(nodes) || !nodes.every(isWorkflowNodeDTO)) return false
            if (!Array.isArray(edges) || !edges.every(isEdgeDTO)) return false
            const inputs = d.inputs
            const outputs = d.outputs
            if (!Array.isArray(inputs) || !Array.isArray(outputs)) return false
            return true
        }
        case 'get_subflow': {
            const d = msg.data
            return isObject(d) && isString(d.id)
        }
        case 'get_subflows':
            return true
        case 'duplicate_subflow': {
            const d = msg.data
            return isObject(d) && isString(d.id) && isString(d.nodeId)
        }
        case 'execute_node': {
            const data = msg.data
            if (!isObject(data)) return false
            if (!('node' in data) || !isWorkflowNodeDTO(data.node)) return false
            if (
                'inputs' in data &&
                data.inputs !== undefined &&
                !(
                    Array.isArray(data.inputs) &&
                    data.inputs.every((v: unknown) => isString(v))
                )
            )
                return false
            if ('runId' in data && data.runId !== undefined && !isNumber(data.runId))
                return false
            if (
                'variables' in data &&
                data.variables !== undefined &&
                !(
                    isObject(data.variables) &&
                    Object.values(data.variables).every(v => isString(v))
                )
            )
                return false
            return true
        }
        case 'llm_node_chat': {
            const data = msg.data
            if (!isObject(data)) return false
            if (!('node' in data) || !isWorkflowNodeDTO(data.node)) return false
            if (!isString(data.threadID)) return false
            if (!isString(data.message)) return false
            if (
                'mode' in data &&
                data.mode !== undefined &&
                data.mode !== 'single-node' &&
                data.mode !== 'workflow'
            ) {
                return false
            }
            return true
        }
        case 'node_approved':
            return (
                isObject(msg.data) &&
                isString(msg.data.nodeId) &&
                (msg.data.modifiedCommand === undefined || isString(msg.data.modifiedCommand))
            )
        case 'node_rejected':
            return (
                isObject(msg.data) &&
                isString(msg.data.nodeId) &&
                (msg.data.reason === undefined || isString(msg.data.reason))
            )
        case 'copy_selection':
            return isWorkflowPayloadDTO(msg.data)
        case 'paste_selection':
            return true
        case 'reset_results':
            return true
        case 'clear_workflow':
            return true
        default:
            return false
    }
}

// Runtime validator for assistant content items
function isAssistantContentItem(value: unknown): value is AssistantContentItem {
    if (!isObject(value)) return false
    const t = value.type
    if (!isString(t)) return false
    switch (t) {
        case 'text':
            return isString(value.text)
        case 'user_message':
            return isString(value.text)
        case 'thinking':
            return isString(value.thinking)
        case 'tool_use':
            return (
                isString(value.id) &&
                isString(value.name) &&
                (value.inputJSON === undefined || isString(value.inputJSON))
            )
        case 'tool_result':
            return (
                isString(value.toolUseID) &&
                (value.resultJSON === undefined || isString(value.resultJSON))
            )
        case 'server_tool_use':
            return (
                isString(value.name) &&
                (value.inputJSON === undefined || isString(value.inputJSON))
            )
        case 'server_web_search_result':
            return (
                (value.query === undefined || isString(value.query)) &&
                (value.resultJSON === undefined || isString(value.resultJSON))
            )
        default:
            return false
    }
}

// Message guards (extension -> webview)
export function isExtensionToWorkflow(value: unknown): value is ExtensionToWorkflow {
    const msgType = getMessageType(value)
    if (!msgType) return false
    const msg = value as UnknownRecord
    switch (msgType) {
        case 'workflow_loaded':
            return isWorkflowPayloadDTO(msg.data)
        case 'workflow_saved':
            return (
                msg.data === undefined ||
                (isObject(msg.data) && (msg.data.path === undefined || isString(msg.data.path)))
            )
        case 'workflow_save_failed':
            return (
                msg.data === undefined ||
                (isObject(msg.data) && (msg.data.error === undefined || isString(msg.data.error)))
            )
        case 'execution_started':
            return true
        case 'execution_completed':
            return true
        case 'execution_paused':
            return true
        case 'node_execution_status':
            return isNodeExecutionPayload(msg.data)
        case 'node_output_chunk':
            return (
                isObject(msg.data) &&
                isString(msg.data.nodeId) &&
                isString(msg.data.chunk) &&
                (msg.data.stream === 'stdout' ||
                    msg.data.stream === 'stderr')
            )
        case 'token_count':
            return (
                isObject(msg.data) &&
                typeof msg.data.count === 'number' &&
                isString(msg.data.nodeId)
            )
        case 'node_assistant_content':
            return (
                isObject(msg.data) &&
                isString(msg.data.nodeId) &&
                (msg.data.threadID === undefined || isString(msg.data.threadID)) &&
                (msg.data.mode === undefined ||
                    msg.data.mode === 'workflow' ||
                    msg.data.mode === 'single-node') &&
                Array.isArray(msg.data.content) &&
                msg.data.content.every(isAssistantContentItem)
            )
        case 'subflow_node_execution_status':
            return (
                isObject(msg.data) &&
                isString(msg.data.subflowId) &&
                isNodeExecutionPayload(msg.data.payload)
            )
        case 'subflow_node_assistant_content':
            return (
                isObject(msg.data) &&
                isString(msg.data.subflowId) &&
                isString(msg.data.nodeId) &&
                (msg.data.threadID === undefined || isString(msg.data.threadID)) &&
                (msg.data.mode === undefined ||
                    msg.data.mode === 'workflow' ||
                    msg.data.mode === 'single-node') &&
                Array.isArray(msg.data.content) &&
                msg.data.content.every(isAssistantContentItem)
            )
        case 'node_sub_agent_content':
            return (
                isObject(msg.data) &&
                isString(msg.data.nodeId) &&
                isString(msg.data.subThreadID) &&
                isString(msg.data.agentType) &&
                ['running', 'done', 'error', 'cancelled'].includes(msg.data.status as string) &&
                (msg.data.parentThreadID === undefined ||
                    isString(msg.data.parentThreadID)) &&
                Array.isArray(msg.data.content) &&
                msg.data.content.every(isAssistantContentItem)
            )
        case 'subflow_node_sub_agent_content':
            return (
                isObject(msg.data) &&
                isString(msg.data.subflowId) &&
                isString(msg.data.nodeId) &&
                isString(msg.data.subThreadID) &&
                isString(msg.data.agentType) &&
                ['running', 'done', 'error', 'cancelled'].includes(msg.data.status as string) &&
                (msg.data.parentThreadID === undefined ||
                    isString(msg.data.parentThreadID)) &&
                Array.isArray(msg.data.content) &&
                msg.data.content.every(isAssistantContentItem)
            )
        case 'models_loaded':
            return Array.isArray(msg.data)
        case 'provide_custom_nodes':
            return Array.isArray(msg.data) && msg.data.every(isWorkflowNodeDTO)
        case 'storage_scope': {
            if (msg.data === undefined) return false
            if (!isObject(msg.data)) return false
            const scope = msg.data.scope
            if (scope !== 'workspace' && scope !== 'user') return false
            if (
                'basePath' in msg.data &&
                msg.data.basePath !== undefined &&
                !isString(msg.data.basePath)
            ) {
                return false
            }
            if (typeof msg.data.workspaceAvailable !== 'boolean') return false
            for (const key of ['workspacePath', 'workspaceName'] as const) {
                if (key in msg.data && msg.data[key] !== undefined && !isString(msg.data[key])) {
                    return false
                }
            }
            return true
        }
        case 'subflow_saved':
            return isObject(msg.data) && isString(msg.data.id)
        case 'provide_subflow': {
            const d = msg.data
            if (!isObject(d)) return false
            if (!isString(d.id) || !isString(d.title) || !isString(d.version))
                return false
            const g = d.graph
            if (!isObject(g)) return false
            const nodes = g.nodes
            const edges = g.edges
            if (!Array.isArray(nodes) || !nodes.every(isWorkflowNodeDTO)) return false
            if (!Array.isArray(edges) || !edges.every(isEdgeDTO)) return false
            const inputs = d.inputs
            const outputs = d.outputs
            if (!Array.isArray(inputs) || !Array.isArray(outputs)) return false
            return true
        }
        case 'provide_subflows': {
            const arr = msg.data
            if (!Array.isArray(arr)) return false
            for (const item of arr) {
                if (!isObject(item)) return false
                if (!isString(item.id) || !isString(item.version)) return false
                // title is optional, default to empty string if missing
                if ('title' in item && !isString(item.title)) return false
            }
            return true
        }
        case 'subflow_copied': {
            const d = msg.data
            return (
                isObject(d) &&
                isString(d.nodeId) &&
                isString(d.oldId) &&
                isString(d.newId)
            )
        }
        case 'clipboard_paste':
            return msg.data === undefined || isWorkflowPayloadDTO(msg.data)
        default:
            return false
    }
}
