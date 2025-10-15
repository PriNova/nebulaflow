// Local protocol and workflow type definitions for the extension side

export type Model = { id: string; title?: string }

export type Edge = {
    id: string
    source: string
    target: string
    sourceHandle?: string
    targetHandle?: string
}

export enum NodeType {
    CLI = 'cli',
    LLM = 'llm',
    PREVIEW = 'preview',
    INPUT = 'text-format',
    SEARCH_CONTEXT = 'search-context',
    CODY_OUTPUT = 'cody-output',
    LOOP_START = 'loop-start',
    LOOP_END = 'loop-end',
    ACCUMULATOR = 'accumulator',
    VARIABLE = 'variable',
    IF_ELSE = 'if-else',
}

export interface BaseNodeData {
    title: string
    input?: string
    output?: string
    content: string
    active: boolean
    needsUserApproval?: boolean
    tokenCount?: number
    local_remote?: boolean
    moving?: boolean
    executing?: boolean
    error?: boolean
    interrupted?: boolean
    result?: string
    shouldAbort?: boolean
}

export interface WorkflowNode {
    id: string
    type: NodeType
    data: BaseNodeData
    position: { x: number; y: number }
    selected?: boolean
}

export interface LLMNode extends WorkflowNode {
    type: NodeType.LLM
    data: BaseNodeData & {
        temperature: number
        maxTokens?: number
        model?: Model
        hasGoogleSearch: boolean
    }
}

export interface LoopStartNode extends WorkflowNode {
    type: NodeType.LOOP_START
    data: BaseNodeData & {
        iterations: number
        loopVariable: string
        overrideIterations?: boolean
    }
}

export interface LoopEndNode extends WorkflowNode {
    type: NodeType.LOOP_END
}

export interface AccumulatorNode extends WorkflowNode {
    type: NodeType.ACCUMULATOR
    data: BaseNodeData & {
        variableName: string
        initialValue?: string
    }
}

export interface VariableNode extends WorkflowNode {
    type: NodeType.VARIABLE
    data: BaseNodeData & {
        variableName: string
        initialValue?: string
    }
}

export interface IfElseNode extends WorkflowNode {
    type: NodeType.IF_ELSE
    data: BaseNodeData & {
        truePathActive?: boolean
        falsePathActive?: boolean
    }
}

export type WorkflowNodes =
    | WorkflowNode
    | LLMNode
    | LoopStartNode
    | LoopEndNode
    | AccumulatorNode
    | VariableNode
    | IfElseNode

// Messaging protocol (webview <-> extension)
interface BaseWorkflowMessage {
    type: string
}

interface WorkflowPayload {
    nodes?: WorkflowNodes[]
    edges?: Edge[]
}

interface NodeExecutionPayload {
    nodeId: string
    status: 'running' | 'completed' | 'error' | 'interrupted' | 'pending_approval'
    result?: string
    command?: string
}

// To Extension (from webview)
export interface OpenExternalLink extends BaseWorkflowMessage {
    type: 'open_external_link'
    url: string
}

export interface SaveWorkflowCommand extends BaseWorkflowMessage {
    type: 'save_workflow'
    data: WorkflowPayload
}

export interface LoadWorkflowCommand extends BaseWorkflowMessage {
    type: 'load_workflow'
}

export interface ExecuteWorkflowCommand extends BaseWorkflowMessage {
    type: 'execute_workflow'
    data: WorkflowPayload
}

export interface AbortWorkflowCommand extends BaseWorkflowMessage {
    type: 'abort_workflow'
}

export interface GetModelsCommand extends BaseWorkflowMessage {
    type: 'get_models'
}

export interface SaveCustomNodeCommand extends BaseWorkflowMessage {
    type: 'save_customNode'
    data: WorkflowNodes
}

export interface DeleteCustomNodeCommand extends BaseWorkflowMessage {
    type: 'delete_customNode'
    data: string
}

export interface RenameCustomNodeCommand extends BaseWorkflowMessage {
    type: 'rename_customNode'
    data: { oldNodeTitle: string; newNodeTitle: string }
}

export interface GetCustomNodesCommand extends BaseWorkflowMessage {
    type: 'get_custom_nodes'
}

// From Extension (to webview)
export interface WorkflowLoadedEvent extends BaseWorkflowMessage {
    type: 'workflow_loaded'
    data: WorkflowPayload
}

export interface ExecutionStartedEvent extends BaseWorkflowMessage {
    type: 'execution_started'
}

export interface ExecutionCompletedEvent extends BaseWorkflowMessage {
    type: 'execution_completed'
}

export interface NodeExecutionStatusEvent extends BaseWorkflowMessage {
    type: 'node_execution_status'
    data: NodeExecutionPayload
}

export interface CalculateTokensCommand extends BaseWorkflowMessage {
    type: 'calculate_tokens'
    data: { text: string; nodeId: string }
}

export interface TokenCountEvent extends BaseWorkflowMessage {
    type: 'token_count'
    data: { count: number; nodeId: string }
}

export interface NodeApprovalCommand extends BaseWorkflowMessage {
    type: 'node_approved'
    data: { nodeId: string; modifiedCommand?: string }
}

export interface ModelsLoadedEvent extends BaseWorkflowMessage {
    type: 'models_loaded'
    data: Model[]
}

export interface ProvideCustomModelsEvent extends BaseWorkflowMessage {
    type: 'provide_custom_nodes'
    data: WorkflowNodes[]
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
    | SaveCustomNodeCommand
    | DeleteCustomNodeCommand
    | RenameCustomNodeCommand
    | GetCustomNodesCommand

export type ExtensionToWorkflow =
    | ModelsLoadedEvent
    | WorkflowLoadedEvent
    | ExecutionStartedEvent
    | ExecutionCompletedEvent
    | NodeExecutionStatusEvent
    | TokenCountEvent
    | ProvideCustomModelsEvent
