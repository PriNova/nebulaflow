// Local protocol and workflow type definitions for the extension side

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
    LOOP_START = 'loop-start',
    LOOP_END = 'loop-end',
    ACCUMULATOR = 'accumulator',
    VARIABLE = 'variable',
    IF_ELSE = 'if-else',
}

export class AbortedError extends Error {
    constructor(message = 'aborted') {
        super(message)
        this.name = 'AbortedError'
    }
}

export class PausedError extends Error {
    constructor(message = 'paused') {
        super(message)
        this.name = 'PausedError'
    }
}

export type ApprovalResult = { type: 'approved'; command?: string } | { type: 'aborted' }

export interface BaseNodeData {
    title: string
    input?: string
    output?: string
    content: string
    active: boolean
    bypass?: boolean
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

import type { AssistantContentItem, Model } from './Contracts/Protocol'

export type { AssistantContentItem }

export interface LLMNode extends WorkflowNode {
    type: NodeType.LLM
    data: BaseNodeData & {
        model?: Model
        disabledTools?: string[]
        timeoutSec?: number
        dangerouslyAllowAll?: boolean
        reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
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

// Re-export shared protocol message contracts (types-only)
export type {
    BaseWorkflowMessage,
    WorkflowPayloadDTO,
    NodeExecutionPayload,
    WorkflowToExtension,
    ExtensionToWorkflow,
    Model,
} from './Contracts/Protocol'
