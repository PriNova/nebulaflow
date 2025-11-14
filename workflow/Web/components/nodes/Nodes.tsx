import type { Edge } from '@graph/CustomOrderedEdge'
import type { Node as ReactFlowNode } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import { AccumulatorNode } from './Accumulator_Node'
import { CLINode } from './CLI_Node'
import { IfElseNode } from './IfElse_Node'
import { LLMNode } from './LLM_Node'
import { LoopEndNode } from './LoopEnd_Node'
import { LoopStartNode } from './LoopStart_Node'
import { PreviewNode } from './Preview_Node'
import { SubflowNode as SubflowNodeComp } from './Subflow_Node'
import { TextNode } from './Text_Node'
import { VariableNode } from './Variable_Node'

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
    SUBFLOW = 'subflow',
    SUBFLOW_INPUT = 'subflow-input',
    SUBFLOW_OUTPUT = 'subflow-output',
}

// Human-friendly labels for each node type used in UI-only titles
export const nodeTypeDisplayLabel: Record<NodeType, string> = {
    [NodeType.LLM]: 'Agent Node',
    [NodeType.CLI]: 'Shell Node',
    [NodeType.PREVIEW]: 'Preview Node',
    [NodeType.INPUT]: 'Text Node',
    [NodeType.LOOP_START]: 'Loop Start Node',
    [NodeType.LOOP_END]: 'Loop End Node',
    [NodeType.ACCUMULATOR]: 'Accumulator Node',
    [NodeType.VARIABLE]: 'Variable Node',
    [NodeType.IF_ELSE]: 'If/Else Node',
    [NodeType.SUBFLOW]: 'Subflow Node',
    [NodeType.SUBFLOW_INPUT]: 'Subflow Input',
    [NodeType.SUBFLOW_OUTPUT]: 'Subflow Output',
}

// Compose the display title without mutating or persisting the underlying data.title
export const formatNodeTitle = (type: NodeType, title?: string | null): string => {
    const prefix = nodeTypeDisplayLabel[type] ?? String(type)
    const safeTitle = (title ?? '').trim()
    return safeTitle.length > 0 ? `${prefix} - ${safeTitle}` : prefix
}

export const DEFAULT_LLM_REASONING_EFFORT = 'medium' as const
export const DEFAULT_LLM_MODEL_ID = 'anthropic/claude-sonnet-4-5-20250929' as const
export const DEFAULT_LLM_MODEL_TITLE = 'Sonnet 4.5' as const

export interface BaseNodeProps {
    id: string
    data: {
        title: string
        moving?: boolean
        executing?: boolean
        error?: boolean
        content?: string
        active: boolean
        bypass?: boolean
        needsUserApproval?: boolean
        tokenCount?: number
        iterations?: number
        interrupted?: boolean
        isEditing?: boolean
        // Fan-in rendering flags available on nodes that opt-in
        fanInEnabled?: boolean
        inputPortCount?: number
        // Map of input handle id -> connected edge id (for hover tooltips)
        inputEdgeIdByHandle?: Record<string, string>
    }
    selected: boolean
}

export type BaseNodeData = {
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
    isEditing?: boolean
    onUpdate?: (partial: Partial<BaseNodeData>) => void
    // Fan-in rendering flags
    fanInEnabled?: boolean
    inputPortCount?: number
    // Map of input handle id -> connected edge id (for hover tooltips)
    inputEdgeIdByHandle?: Record<string, string>
}

export type WorkflowNode = Omit<ReactFlowNode, 'data' | 'position' | 'type' | 'id' | 'selected'> & {
    id: string
    type: NodeType
    data: BaseNodeData
    position: { x: number; y: number }
    selected?: boolean
}

export type SubflowNode = Omit<WorkflowNode, 'data'> & {
    type: NodeType.SUBFLOW
    data: BaseNodeData & {
        subflowId?: string
        inputPortCount?: number
        outputPortCount?: number
        pendingSubflow?: {
            inputs: Array<{ id: string; name: string; index: number }>
            outputs: Array<{ id: string; name: string; index: number }>
            graph: { nodes: any[]; edges: any[] }
        }
    }
}

export type WorkflowNodes =
    | WorkflowNode
    | CLINode
    | LLMNode
    | PreviewNode
    | TextNode
    | LoopStartNode
    | LoopEndNode
    | AccumulatorNode
    | VariableNode
    | IfElseNode
    | SubflowNode

export const createNode = (node: Omit<WorkflowNodes, 'id'>): WorkflowNodes => {
    const id = uuidv4()
    switch (node.type) {
        case NodeType.CLI:
            return {
                ...node,
                id,
                data: { ...node.data, needsUserApproval: false, fanInEnabled: true },
            } as CLINode
        case NodeType.LLM: {
            const llmNode = node as Omit<LLMNode, 'id'>
            return {
                ...llmNode,
                id,
                data: {
                    ...llmNode.data,
                    reasoningEffort: llmNode.data.reasoningEffort ?? DEFAULT_LLM_REASONING_EFFORT,
                    fanInEnabled: true,
                },
            } as LLMNode
        }
        case NodeType.PREVIEW:
            return { ...node, id, data: { ...node.data, fanInEnabled: true } } as PreviewNode
        case NodeType.ACCUMULATOR:
            return { ...node, id, data: { ...node.data, fanInEnabled: true } } as AccumulatorNode
        case NodeType.INPUT:
            return {
                ...node,
                id,
                data: { ...node.data, isEditing: false, fanInEnabled: true },
            } as TextNode
        case NodeType.IF_ELSE:
            return {
                ...node,
                id,
                data: { ...node.data, truePathActive: false, falsePathActive: false },
            } as IfElseNode
        case NodeType.LOOP_START:
            return { ...node, id, data: { ...node.data, overrideIterations: false } } as LoopStartNode
        case NodeType.SUBFLOW:
            return { ...node, id, data: { ...node.data, fanInEnabled: true } } as SubflowNode
        default:
            return { ...node, id }
    }
}

export const createEdge = (sourceNode: WorkflowNode, targetNode: WorkflowNode): Edge => ({
    id: `${sourceNode.id}-${targetNode.id}`,
    source: sourceNode.id,
    target: targetNode.id,
    style: { strokeWidth: 1 },
})

export const defaultWorkflow = (() => {
    const nodes = [
        createNode({
            type: NodeType.CLI,
            data: { title: 'Git Diff', content: 'git diff', active: true },
            position: { x: 0, y: 0 },
        }),
        createNode({
            type: NodeType.LLM,
            data: {
                title: 'Generate Commit Message',
                content: 'Generate a commit message for the following git diff: ${1}',
                active: true,
                model: { id: DEFAULT_LLM_MODEL_ID, title: DEFAULT_LLM_MODEL_TITLE },
                reasoningEffort: 'medium',
            },
            position: { x: 0, y: 100 },
        }),
        createNode({
            type: NodeType.CLI,
            data: { title: 'Git Commit', content: 'git commit -m "${1}"', active: true },
            position: { x: 0, y: 200 },
        }),
    ]
    return { nodes, edges: [createEdge(nodes[0], nodes[1]), createEdge(nodes[1], nodes[2])] }
})()

export const getBorderColor = (
    type: NodeType,
    {
        error,
        executing,
        moving,
        selected,
        interrupted,
        active,
    }: {
        error?: boolean
        executing?: boolean
        moving?: boolean
        selected?: boolean
        interrupted?: boolean
        active?: boolean
    }
) => {
    if (active === false) {
        return 'var(--vscode-disabledForeground)'
    }
    if (interrupted) return 'var(--vscode-charts-orange)'
    if (error) return 'var(--vscode-inputValidation-errorBorder)'
    if (executing) return 'var(--vscode-charts-yellow)'
    if (selected || moving) return 'var(--vscode-testing-iconPassed)'
    switch (type) {
        case NodeType.PREVIEW:
            return '#aa0000'
        case NodeType.CLI:
            return 'var(--vscode-textLink-foreground)'
        case NodeType.LLM:
            return 'var(--vscode-symbolIcon-functionForeground)'
        case NodeType.INPUT:
            return 'var(--vscode-input-foreground)'
        default:
            return 'var(--vscode-foreground)'
    }
}

export const getNodeStyle = (
    type: NodeType,
    moving?: boolean,
    selected?: boolean,
    executing?: boolean,
    error?: boolean,
    active?: boolean,
    interrupted?: boolean,
    bypass?: boolean,
    defaultBorderStyle: 'solid' | 'double' = 'solid'
) => {
    const color = getBorderColor(type, { error, executing, moving, interrupted, selected })
    const styleForThisNode =
        active === false ? defaultBorderStyle : bypass ? 'dashed' : defaultBorderStyle
    return {
        padding: '0.5rem',
        borderRadius: '0.25rem',
        backgroundColor: error
            ? 'var(--vscode-inputValidation-errorBackground)'
            : 'var(--vscode-dropdown-background)',
        color: 'var(--vscode-dropdown-foreground)',
        // Use a single shorthand so style never gets out-of-sync
        border: `2px ${styleForThisNode} ${color}`,
        // Inactive nodes stay at 0.4 opacity. Bypass nodes get a light dim.
        opacity: active === false ? '0.4' : bypass ? '0.7' : '1',
        minWidth: '5rem',
        boxShadow: '6px 6px 8px rgba(0, 0, 0, 0.6)',
    } as const
}

export const nodeTypes = {
    [NodeType.CLI]: CLINode,
    [NodeType.LLM]: LLMNode,
    [NodeType.PREVIEW]: PreviewNode,
    [NodeType.INPUT]: TextNode,
    [NodeType.LOOP_START]: LoopStartNode,
    [NodeType.LOOP_END]: LoopEndNode,
    [NodeType.ACCUMULATOR]: AccumulatorNode,
    [NodeType.IF_ELSE]: IfElseNode,
    [NodeType.VARIABLE]: VariableNode,
    [NodeType.SUBFLOW]: SubflowNodeComp,
    [NodeType.SUBFLOW_INPUT]: TextNode,
    [NodeType.SUBFLOW_OUTPUT]: PreviewNode,
}
