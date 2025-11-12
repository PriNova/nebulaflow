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
    // Optional multi-output results for nodes that produce multiple outputs (e.g., Subflow)
    multi?: string[]
    command?: string
}

// Saved state for a single node after execution
export interface NodeSavedState {
    status: 'completed' | 'error' | 'interrupted'
    output: string
    error?: string
    tokenCount?: number
}

// Workflow state envelope persisted across save/load
export interface WorkflowStateDTO {
    nodeResults: Record<string, NodeSavedState>
    ifElseDecisions?: Record<string, 'true' | 'false'>
}

// Subflows
export interface SubflowPortDTO {
    id: string
    name: string
    index: number
}
export interface SubflowGraphDTO {
    nodes: WorkflowNodeDTO[]
    edges: EdgeDTO[]
}
export interface SubflowDefinitionDTO {
    id: string
    title: string
    version: string
    inputs: SubflowPortDTO[]
    outputs: SubflowPortDTO[]
    graph: SubflowGraphDTO
}

// Resume metadata for paused/interrupted workflows
export interface ResumeDTO {
    fromNodeId?: string
    seeds?: {
        outputs?: Record<string, string>
        decisions?: Record<string, 'true' | 'false'>
        variables?: Record<string, string>
    }
}

// Common workflow payload for commands/events
export interface WorkflowPayloadDTO {
    nodes?: WorkflowNodeDTO[]
    edges?: EdgeDTO[]
    state?: WorkflowStateDTO
    resume?: ResumeDTO
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

interface PauseWorkflowCommand extends BaseWorkflowMessage {
    type: 'pause_workflow'
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

interface GetStorageScopeCommand extends BaseWorkflowMessage {
    type: 'get_storage_scope'
}

interface ToggleStorageScopeCommand extends BaseWorkflowMessage {
    type: 'toggle_storage_scope'
}

interface ResetResultsCommand extends BaseWorkflowMessage {
    type: 'reset_results'
}

// Subflow commands
interface CreateSubflowCommand extends BaseWorkflowMessage {
    type: 'create_subflow'
    data: SubflowDefinitionDTO
}

interface GetSubflowCommand extends BaseWorkflowMessage {
    type: 'get_subflow'
    data: { id: string }
}

interface GetSubflowsCommand extends BaseWorkflowMessage {
    type: 'get_subflows'
}

interface DuplicateSubflowCommand extends BaseWorkflowMessage {
    type: 'duplicate_subflow'
    data: { id: string; nodeId: string }
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
    stoppedAtNodeId?: string
}

interface ExecutionPausedEvent extends BaseWorkflowMessage {
    type: 'execution_paused'
    stoppedAtNodeId?: string
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

// Subflow-scoped node events (forwarded when viewing a subflow)
interface SubflowNodeExecutionStatusEvent extends BaseWorkflowMessage {
    type: 'subflow_node_execution_status'
    data: { subflowId: string; payload: NodeExecutionPayload }
}

interface SubflowNodeAssistantContentEvent extends BaseWorkflowMessage {
    type: 'subflow_node_assistant_content'
    data: { subflowId: string; nodeId: string; threadID?: string; content: AssistantContentItem[] }
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

interface StorageScopeEvent extends BaseWorkflowMessage {
    type: 'storage_scope'
    data: { scope: 'workspace' | 'user'; basePath?: string }
}

// Subflow events
interface SubflowSavedEvent extends BaseWorkflowMessage {
    type: 'subflow_saved'
    data: { id: string }
}

interface ProvideSubflowEvent extends BaseWorkflowMessage {
    type: 'provide_subflow'
    data: SubflowDefinitionDTO
}

interface ProvideSubflowsEvent extends BaseWorkflowMessage {
    type: 'provide_subflows'
    data: Array<{ id: string; title: string; version: string }>
}

interface SubflowCopiedEvent extends BaseWorkflowMessage {
    type: 'subflow_copied'
    data: { nodeId: string; oldId: string; newId: string }
}

interface ExecuteNodeCommand extends BaseWorkflowMessage {
    type: 'execute_node'
    data: {
        node: WorkflowNodeDTO
        inputs?: string[]
        runId?: number
        variables?: Record<string, string>
    }
}

export type WorkflowToExtension =
    | OpenExternalLink
    | GetModelsCommand
    | SaveWorkflowCommand
    | LoadWorkflowCommand
    | ExecuteWorkflowCommand
    | ExecuteNodeCommand
    | AbortWorkflowCommand
    | PauseWorkflowCommand
    | CalculateTokensCommand
    | NodeApprovalCommand
    | NodeRejectionCommand
    | SaveCustomNodeCommand
    | DeleteCustomNodeCommand
    | RenameCustomNodeCommand
    | GetCustomNodesCommand
    | GetStorageScopeCommand
    | ToggleStorageScopeCommand
    | ResetResultsCommand
    | CreateSubflowCommand
    | GetSubflowCommand
    | GetSubflowsCommand
    | DuplicateSubflowCommand

export type ExtensionToWorkflow =
    | ModelsLoadedEvent
    | WorkflowLoadedEvent
    | WorkflowSavedEvent
    | WorkflowSaveFailedEvent
    | ExecutionStartedEvent
    | ExecutionCompletedEvent
    | ExecutionPausedEvent
    | NodeExecutionStatusEvent
    | TokenCountEvent
    | NodeAssistantContentEvent
    | SubflowNodeExecutionStatusEvent
    | SubflowNodeAssistantContentEvent
    | ProvideCustomModelsEvent
    | StorageScopeEvent
    | SubflowSavedEvent
    | ProvideSubflowEvent
    | ProvideSubflowsEvent
    | SubflowCopiedEvent
