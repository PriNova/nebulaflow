// Runtime type-guards for shared protocol contracts
// Keep checks narrow and low-cost; avoid external deps.

import type {
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

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
    return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
}

export function isBaseWorkflowMessage(value: unknown): value is BaseWorkflowMessage {
    return isObject(value) && isString((value as any).type)
}

export function isEdgeDTO(value: unknown): value is EdgeDTO {
    if (!isObject(value)) return false
    if (
        !isString((value as any).id) ||
        !isString((value as any).source) ||
        !isString((value as any).target)
    )
        return false
    if (
        'sourceHandle' in value &&
        (value as any).sourceHandle !== undefined &&
        !isString((value as any).sourceHandle)
    )
        return false
    if (
        'targetHandle' in value &&
        (value as any).targetHandle !== undefined &&
        !isString((value as any).targetHandle)
    )
        return false
    return true
}

export function isWorkflowNodeDTO(value: unknown): value is WorkflowNodeDTO {
    if (!isObject(value)) return false
    if (!isString((value as any).id) || !isString((value as any).type)) return false
    if (!isObject((value as any).data)) return false
    const pos = (value as any).position
    if (!isObject(pos) || !isNumber((pos as any).x) || !isNumber((pos as any).y)) return false
    if (
        'selected' in value &&
        (value as any).selected !== undefined &&
        typeof (value as any).selected !== 'boolean'
    )
        return false
    return true
}

function isNodeSavedState(value: unknown): value is NodeSavedState {
    if (!isObject(value)) return false
    const status = (value as any).status
    if (!['completed', 'error', 'interrupted'].includes(status)) return false
    if (!isString((value as any).output)) return false
    if (
        'error' in (value as any) &&
        (value as any).error !== undefined &&
        !isString((value as any).error)
    )
        return false
    if (
        'tokenCount' in (value as any) &&
        (value as any).tokenCount !== undefined &&
        !isNumber((value as any).tokenCount)
    )
        return false
    return true
}

function isWorkflowStateDTO(value: unknown): value is WorkflowStateDTO {
    if (!isObject(value)) return false
    const nodeResults = (value as any).nodeResults
    if (!isObject(nodeResults)) return false
    for (const [, result] of Object.entries(nodeResults)) {
        if (!isNodeSavedState(result)) return false
    }
    if ('ifElseDecisions' in (value as any) && (value as any).ifElseDecisions !== undefined) {
        const decisions = (value as any).ifElseDecisions
        if (!isObject(decisions)) return false
        for (const [, decision] of Object.entries(decisions)) {
            if (!['true', 'false'].includes(decision as string)) return false
        }
    }
    return true
}

export function isWorkflowPayloadDTO(value: unknown): value is WorkflowPayloadDTO {
    if (!isObject(value)) return false
    if ('nodes' in (value as any) && (value as any).nodes !== undefined) {
        if (!Array.isArray((value as any).nodes) || !(value as any).nodes.every(isWorkflowNodeDTO))
            return false
    }
    if ('edges' in (value as any) && (value as any).edges !== undefined) {
        if (!Array.isArray((value as any).edges) || !(value as any).edges.every(isEdgeDTO)) return false
    }
    if ('state' in (value as any) && (value as any).state !== undefined) {
        if (!isWorkflowStateDTO((value as any).state)) return false
    }
    return true
}

export function isNodeExecutionPayload(value: unknown): value is NodeExecutionPayload {
    if (!isObject(value)) return false
    if (!isString((value as any).nodeId)) return false
    const status = (value as any).status
    if (!['running', 'completed', 'error', 'interrupted', 'pending_approval'].includes(status))
        return false
    if (
        'result' in (value as any) &&
        (value as any).result !== undefined &&
        !isString((value as any).result)
    )
        return false
    if (
        'command' in (value as any) &&
        (value as any).command !== undefined &&
        !isString((value as any).command)
    )
        return false
    return true
}

// Message guards (webview -> extension)
export function isWorkflowToExtension(value: unknown): value is WorkflowToExtension {
    if (!isBaseWorkflowMessage(value)) return false
    const msg = value as any
    switch (msg.type) {
        case 'open_external_link':
            return isString(msg.url)
        case 'save_workflow':
            return isWorkflowPayloadDTO(msg.data)
        case 'load_workflow':
            return true
        case 'execute_workflow':
            return isWorkflowPayloadDTO(msg.data)
        case 'abort_workflow':
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
        case 'calculate_tokens':
            return isObject(msg.data) && isString(msg.data.text) && isString(msg.data.nodeId)
        case 'execute_node': {
            const data = msg.data
            if (!isObject(data)) return false
            if (!('node' in data) || !isWorkflowNodeDTO((data as any).node)) return false
            if (
                'inputs' in data &&
                (data as any).inputs !== undefined &&
                !(
                    Array.isArray((data as any).inputs) &&
                    (data as any).inputs.every((v: unknown) => isString(v))
                )
            )
                return false
            if ('runId' in data && (data as any).runId !== undefined && !isNumber((data as any).runId))
                return false
            if (
                'variables' in data &&
                (data as any).variables !== undefined &&
                !(
                    isObject((data as any).variables) &&
                    Object.values((data as any).variables).every(v => isString(v))
                )
            )
                return false
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
        default:
            return false
    }
}

// Runtime validator for assistant content items
function isAssistantContentItem(value: unknown): boolean {
    if (!isObject(value)) return false
    const t = (value as any).type
    if (!isString(t)) return false
    switch (t) {
        case 'text':
            return isString((value as any).text)
        case 'thinking':
            return isString((value as any).thinking)
        case 'tool_use':
            return (
                isString((value as any).id) &&
                isString((value as any).name) &&
                ((value as any).inputJSON === undefined || isString((value as any).inputJSON))
            )
        case 'tool_result':
            return (
                isString((value as any).toolUseID) &&
                ((value as any).resultJSON === undefined || isString((value as any).resultJSON))
            )
        case 'server_tool_use':
            return (
                isString((value as any).name) &&
                ((value as any).inputJSON === undefined || isString((value as any).inputJSON))
            )
        case 'server_web_search_result':
            return (
                ((value as any).query === undefined || isString((value as any).query)) &&
                ((value as any).resultJSON === undefined || isString((value as any).resultJSON))
            )
        default:
            return false
    }
}

// Message guards (extension -> webview)
export function isExtensionToWorkflow(value: unknown): value is ExtensionToWorkflow {
    if (!isBaseWorkflowMessage(value)) return false
    const msg = value as any
    switch (msg.type) {
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
        case 'node_execution_status':
            return isNodeExecutionPayload(msg.data)
        case 'token_count':
            return (
                isObject(msg.data) &&
                typeof (msg.data as any).count === 'number' &&
                isString((msg.data as any).nodeId)
            )
        case 'node_assistant_content':
            return (
                isObject(msg.data) &&
                isString((msg.data as any).nodeId) &&
                ((msg.data as any).threadID === undefined || isString((msg.data as any).threadID)) &&
                Array.isArray((msg.data as any).content) &&
                (msg.data as any).content.every(isAssistantContentItem)
            )
        case 'models_loaded':
            return Array.isArray(msg.data)
        case 'provide_custom_nodes':
            return Array.isArray(msg.data) && (msg.data as any[]).every(isWorkflowNodeDTO)
        default:
            return false
    }
}
