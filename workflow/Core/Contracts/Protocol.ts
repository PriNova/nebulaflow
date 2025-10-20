// Shared, types-only protocol contracts for webview <-> extension messaging
// Import with `import type { ... } from '.../Protocol'` on both sides

// Basic model descriptor
export type Model = { id: string; title?: string }

// Assistant content blocks streamed during LLM node execution
export type AssistantContentItem =
    | { type: 'text'; text: string }
    | { type: 'thinking'; thinking: string }
    | { type: 'tool_use'; id: string; name: string; inputJSON?: string }
    | { type: 'tool_result'; toolUseID: string; resultJSON?: string }
    | { type: 'server_tool_use'; name: string; inputJSON?: string }
    | { type: 'server_web_search_result'; query?: string; resultJSON?: string }

// Transport-friendly edge DTO
export type EdgeDTO = {
    id: string
    source: string
    target: string
    sourceHandle?: string
    targetHandle?: string
}

// Transport-friendly workflow node DTO (neutral shape)
export interface WorkflowNodeDTO {
    id: string
    type: string
    data: Record<string, unknown>
    position: { x: number; y: number }
    selected?: boolean
}

// Base message envelope
export interface BaseWorkflowMessage {
    type: string
}

// Execution status payload
export interface NodeExecutionPayload {
    nodeId: string
    status: 'running' | 'completed' | 'error' | 'interrupted' | 'pending_approval'
    result?: string
    command?: string
}

// Common workflow payload for commands/events
export interface WorkflowPayloadDTO {
    nodes?: WorkflowNodeDTO[]
    edges?: EdgeDTO[]
}

// To Extension (from webview)
interface OpenExternalLink extends BaseWorkflowMessage {
    type: 'open_external_link'
    url: string
}

interface SaveWorkflowCommand extends BaseWorkflowMessage {
    type: 'save_workflow'
    data: WorkflowPayloadDTO
}

interface LoadWorkflowCommand extends BaseWorkflowMessage {
    type: 'load_workflow'
}

interface ExecuteWorkflowCommand extends BaseWorkflowMessage {
    type: 'execute_workflow'
    data: WorkflowPayloadDTO
}

interface AbortWorkflowCommand extends BaseWorkflowMessage {
    type: 'abort_workflow'
}

interface GetModelsCommand extends BaseWorkflowMessage {
    type: 'get_models'
}

interface SaveCustomNodeCommand extends BaseWorkflowMessage {
    type: 'save_customNode'
    data: WorkflowNodeDTO
}

interface DeleteCustomNodeCommand extends BaseWorkflowMessage {
    type: 'delete_customNode'
    data: string
}

interface RenameCustomNodeCommand extends BaseWorkflowMessage {
    type: 'rename_customNode'
    data: { oldNodeTitle: string; newNodeTitle: string }
}

interface GetCustomNodesCommand extends BaseWorkflowMessage {
    type: 'get_custom_nodes'
}

// From Extension (to webview)
interface WorkflowLoadedEvent extends BaseWorkflowMessage {
    type: 'workflow_loaded'
    data: WorkflowPayloadDTO
}

interface WorkflowSavedEvent extends BaseWorkflowMessage {
    type: 'workflow_saved'
    data?: { path?: string }
}

interface WorkflowSaveFailedEvent extends BaseWorkflowMessage {
    type: 'workflow_save_failed'
    data?: { error?: string }
}

interface ExecutionStartedEvent extends BaseWorkflowMessage {
    type: 'execution_started'
}

interface ExecutionCompletedEvent extends BaseWorkflowMessage {
    type: 'execution_completed'
}

interface NodeExecutionStatusEvent extends BaseWorkflowMessage {
    type: 'node_execution_status'
    data: NodeExecutionPayload
}

interface CalculateTokensCommand extends BaseWorkflowMessage {
    type: 'calculate_tokens'
    data: { text: string; nodeId: string }
}

interface TokenCountEvent extends BaseWorkflowMessage {
    type: 'token_count'
    data: { count: number; nodeId: string }
}

interface NodeAssistantContentEvent extends BaseWorkflowMessage {
    type: 'node_assistant_content'
    data: { nodeId: string; threadID?: string; content: AssistantContentItem[] }
}

interface NodeApprovalCommand extends BaseWorkflowMessage {
    type: 'node_approved'
    data: { nodeId: string; modifiedCommand?: string }
}

interface NodeRejectionCommand extends BaseWorkflowMessage {
    type: 'node_rejected'
    data: { nodeId: string; reason?: string }
}

interface ModelsLoadedEvent extends BaseWorkflowMessage {
    type: 'models_loaded'
    data: Model[]
}

interface ProvideCustomModelsEvent extends BaseWorkflowMessage {
    type: 'provide_custom_nodes'
    data: WorkflowNodeDTO[]
}

export type WorkflowToExtension =
    | OpenExternalLink
    | GetModelsCommand
    | SaveWorkflowCommand
    | LoadWorkflowCommand
    | ExecuteWorkflowCommand
    | AbortWorkflowCommand
    | CalculateTokensCommand
    | NodeApprovalCommand
    | NodeRejectionCommand
    | SaveCustomNodeCommand
    | DeleteCustomNodeCommand
    | RenameCustomNodeCommand
    | GetCustomNodesCommand

export type ExtensionToWorkflow =
    | ModelsLoadedEvent
    | WorkflowLoadedEvent
    | WorkflowSavedEvent
    | WorkflowSaveFailedEvent
    | ExecutionStartedEvent
    | ExecutionCompletedEvent
    | NodeExecutionStatusEvent
    | TokenCountEvent
    | NodeAssistantContentEvent
    | ProvideCustomModelsEvent
