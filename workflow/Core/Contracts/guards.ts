// Runtime type-guards for shared protocol contracts
// Keep checks narrow and low-cost; avoid external deps.

import type {
    BaseWorkflowMessage,
    EdgeDTO,
    ExtensionToWorkflow,
    NodeExecutionPayload,
    WorkflowNodeDTO,
    WorkflowPayloadDTO,
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
    return isObject(value) && isString(value.type)
}

export function isEdgeDTO(value: unknown): value is EdgeDTO {
    if (!isObject(value)) return false
    if (!isString(value.id) || !isString(value.source) || !isString(value.target)) return false
    if ('sourceHandle' in value && value.sourceHandle !== undefined && !isString(value.sourceHandle))
        return false
    if ('targetHandle' in value && value.targetHandle !== undefined && !isString(value.targetHandle))
        return false
    return true
}

export function isWorkflowNodeDTO(value: unknown): value is WorkflowNodeDTO {
    if (!isObject(value)) return false
    if (!isString(value.id) || !isString(value.type)) return false
    if (!isObject(value.data)) return false
    const pos = (value as any).position
    if (!isObject(pos) || !isNumber(pos.x) || !isNumber(pos.y)) return false
    if ('selected' in value && value.selected !== undefined && typeof value.selected !== 'boolean')
        return false
    return true
}

export function isWorkflowPayloadDTO(value: unknown): value is WorkflowPayloadDTO {
    if (!isObject(value)) return false
    if ('nodes' in value && value.nodes !== undefined) {
        if (!Array.isArray(value.nodes) || !value.nodes.every(isWorkflowNodeDTO)) return false
    }
    if ('edges' in value && value.edges !== undefined) {
        if (!Array.isArray(value.edges) || !value.edges.every(isEdgeDTO)) return false
    }
    return true
}

export function isNodeExecutionPayload(value: unknown): value is NodeExecutionPayload {
    if (!isObject(value)) return false
    if (!isString((value as any).nodeId)) return false
    const status = (value as any).status
    if (!['running', 'completed', 'error', 'interrupted', 'pending_approval'].includes(status))
        return false
    if ('result' in value && value.result !== undefined && !isString(value.result)) return false
    if ('command' in value && value.command !== undefined && !isString(value.command)) return false
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
            return isObject(msg.data) && typeof msg.data.count === 'number' && isString(msg.data.nodeId)
        case 'models_loaded':
            return Array.isArray(msg.data)
        case 'provide_custom_nodes':
            return Array.isArray(msg.data) && msg.data.every(isWorkflowNodeDTO)
        default:
            return false
    }
}
