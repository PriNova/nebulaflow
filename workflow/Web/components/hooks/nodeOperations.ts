import {
    type BaseNodeData,
    DEFAULT_LLM_MODEL_ID,
    DEFAULT_LLM_MODEL_TITLE,
    DEFAULT_LLM_REASONING_EFFORT,
    NodeType,
    type WorkflowNodes,
    createNode,
} from '@nodes/Nodes'
import { type NodeChange, applyNodeChanges, useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { unstable_batchedUpdates } from 'react-dom'
import { v4 as uuidv4 } from 'uuid'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import { toWorkflowNodeDTO } from '../../utils/nodeDto'
import type { GenericVSCodeWrapper } from '../../utils/vscode'
import type { LLMNode } from '../nodes/LLM_Node'
import type { LoopStartNode } from '../nodes/LoopStart_Node'

interface IndexedNodes {
    byId: Map<string, WorkflowNodes>
    allIds: string[]
}

type DraggingPositionChange = Extract<NodeChange, { type: 'position' }> & {
    dragging?: boolean
    event?: React.MouseEvent
    id: string
}

function isDraggingPositionChange(change: NodeChange): change is DraggingPositionChange {
    return change.type === 'position' && 'dragging' in change
}

function cloneNodeData(sourceNode: WorkflowNodes): WorkflowNodes {
    const baseClone = createNode({
        type: sourceNode.type,
        data: {
            ...sourceNode.data,
            title: sourceNode.data.title,
            content: sourceNode.data.content,
            active: sourceNode.data.active,
        },
        position: { x: sourceNode.position.x, y: sourceNode.position.y },
    }) as WorkflowNodes

    switch (sourceNode.type) {
        case NodeType.LLM: {
            const llmSource = sourceNode as LLMNode
            return {
                ...baseClone,
                data: {
                    ...baseClone.data,
                    model: llmSource.data.model,
                    timeoutSec: (llmSource as LLMNode).data.timeoutSec,
                },
            } as LLMNode
        }
        case NodeType.LOOP_START: {
            const loopSource = sourceNode as LoopStartNode
            return {
                ...baseClone,
                data: {
                    ...baseClone.data,
                    iterations: loopSource.data.iterations,
                    loopVariable: loopSource.data.loopVariable,
                    loopMode: loopSource.data.loopMode,
                    collectionVariable: loopSource.data.collectionVariable,
                    maxSafeIterations: loopSource.data.maxSafeIterations,
                },
            } as LoopStartNode
        }
        case NodeType.CLI:
        case NodeType.PREVIEW:
        case NodeType.INPUT:
        case NodeType.LOOP_END:
        case NodeType.ACCUMULATOR:
        case NodeType.VARIABLE:
        case NodeType.IF_ELSE:
            return baseClone
        default:
            return baseClone
    }
}

const AUTO_SELECT_ON_ADD = true

export const useNodeOperations = (
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>,
    nodes: WorkflowNodes[],
    setNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>,
    selectedNodes: WorkflowNodes[],
    setSelectedNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>,
    activeNode: WorkflowNodes | null,
    setActiveNode: React.Dispatch<React.SetStateAction<WorkflowNodes | null>>
) => {
    const [movingNodeId, setMovingNodeId] = useState<string | null>(null)
    const flowInstance = useReactFlow()
    const createIndexedNodes = (nodes: WorkflowNodes[]): IndexedNodes => ({
        byId: new Map(nodes.map(node => [node.id, node])),
        allIds: nodes.map(node => node.id),
    })
    const indexedNodes = useMemo(() => createIndexedNodes(nodes), [nodes, createIndexedNodes])

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            const dragChange = changes.find(isDraggingPositionChange)
            if (dragChange?.event?.shiftKey && dragChange.dragging && !movingNodeId) {
                return
            }
            if (dragChange?.dragging) {
                setMovingNodeId(dragChange.id)
            } else if (movingNodeId) {
                setMovingNodeId(null)
            }
            const updatedNodes = applyNodeChanges(changes, nodes) as typeof nodes
            setNodes(updatedNodes)

            // Build fresh index from updated nodes to avoid stale references
            const updatedIndex = createIndexedNodes(updatedNodes)

            if (selectedNodes.length > 0) {
                const updatedSelectedNodes = selectedNodes
                    .map(node => updatedIndex.byId.get(node.id))
                    .filter(Boolean) as WorkflowNodes[]
                setSelectedNodes(updatedSelectedNodes)
            }
            if (activeNode) {
                const updatedActiveNode = updatedIndex.byId.get(activeNode.id)
                setActiveNode(updatedActiveNode || null)
            }
        },
        [
            selectedNodes,
            activeNode,
            nodes,
            movingNodeId,
            setNodes,
            setSelectedNodes,
            setActiveNode,
            createIndexedNodes,
        ]
    )

    const onNodeDragStart = useCallback(
        (event: React.MouseEvent, node: WorkflowNodes) => {
            if (event.shiftKey) {
                const sourceNode = indexedNodes.byId.get(node.id)
                if (!sourceNode) return

                const newNode = cloneNodeData(sourceNode)
                setNodes(current => [...current, newNode])
                setMovingNodeId(newNode.id)
                event.stopPropagation()
            }
        },
        [indexedNodes, setNodes]
    )

    const onNodeAdd = useCallback(
        (
            nodeOrLabel: WorkflowNodes | string,
            nodeType?: NodeType,
            options?: { position?: { x: number; y: number }; initialData?: Partial<BaseNodeData> }
        ) => {
            const flowElement = document.querySelector('.react-flow')
            const flowBounds = flowElement?.getBoundingClientRect()
            const centerPosition =
                options?.position ??
                flowInstance.screenToFlowPosition({
                    x: flowBounds ? flowBounds.x + flowBounds.width / 2 : 0,
                    y: flowBounds ? flowBounds.y + flowBounds.height / 2 : 0,
                })
            if (typeof nodeOrLabel === 'string') {
                const newNode = createNode({
                    type: nodeType!,
                    data: { title: nodeOrLabel, content: '', active: true },
                    position: centerPosition,
                }) as WorkflowNodes
                switch (nodeType) {
                    case NodeType.LLM:
                        ;(newNode as any).data = {
                            ...newNode.data,
                            model: { id: DEFAULT_LLM_MODEL_ID, title: DEFAULT_LLM_MODEL_TITLE },
                            reasoningEffort: DEFAULT_LLM_REASONING_EFFORT,
                        }
                        break
                    case NodeType.PREVIEW:
                    case NodeType.INPUT:
                        newNode.data.content = ''
                        break
                    case NodeType.LOOP_START:
                        ;(newNode as any).data = { ...newNode.data, iterations: 1, loopVariable: 'loop' }
                        break
                }
                if (options?.initialData) {
                    newNode.data = { ...newNode.data, ...options.initialData }
                }
                setNodes(nodes => [...nodes, newNode])
                if (AUTO_SELECT_ON_ADD) {
                    setSelectedNodes([newNode])
                    setActiveNode(newNode)
                }
            } else {
                const nodeWithId = { ...nodeOrLabel, id: uuidv4(), position: centerPosition }
                setNodes(nodes => [...nodes, nodeWithId as any])
                if (AUTO_SELECT_ON_ADD) {
                    setSelectedNodes([nodeWithId as any])
                    setActiveNode(nodeWithId as any)
                }
            }
        },
        [flowInstance, setNodes, setSelectedNodes, setActiveNode]
    )

    const onNodeUpdate = useCallback(
        (nodeId: string, data: Partial<WorkflowNodes['data']>) => {
            const nodeToUpdate = nodes.find(n => n.id === nodeId)
            if (!nodeToUpdate) return
            let updatedNode: WorkflowNodes
            if (nodeToUpdate.type === NodeType.LLM) {
                const llmNode = nodeToUpdate as LLMNode
                const updatedLLMData: Partial<LLMNode['data']> = { ...llmNode.data, ...data }
                if ('model' in data && (data as any).model) {
                    ;(updatedLLMData as any).model = { ...(data as any).model }
                }
                updatedNode = { ...llmNode, data: updatedLLMData as LLMNode['data'] }
            } else {
                updatedNode = { ...nodeToUpdate, data: { ...nodeToUpdate.data, ...data } }
            }
            if (nodeToUpdate.type === NodeType.PREVIEW && 'content' in data) {
                vscodeAPI.postMessage({
                    type: 'calculate_tokens',
                    data: { text: (data as any).content || '', nodeId },
                } as any)
            }
            unstable_batchedUpdates(() => {
                setNodes(currentNodes => currentNodes.map(n => (n.id === nodeId ? updatedNode : n)))
                if (selectedNodes.some(n => n.id === nodeId)) {
                    setSelectedNodes(prev => prev.map(n => (n.id === nodeId ? updatedNode : n)))
                }
                if (activeNode?.id === nodeId) {
                    setActiveNode(updatedNode)
                }
            })
        },
        [nodes, selectedNodes, activeNode, setNodes, setSelectedNodes, setActiveNode, vscodeAPI]
    )

    return { movingNodeId, onNodesChange, onNodeDragStart, onNodeAdd, onNodeUpdate, indexedNodes }
}

export const useCustomNodes = (
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>
) => {
    const onGetCustomNodes = useCallback(() => {
        vscodeAPI.postMessage({ type: 'get_custom_nodes' } as any)
    }, [vscodeAPI])
    const onSaveCustomNode = useCallback(
        (node: WorkflowNodes) => {
            // Send a sanitized DTO to avoid DataCloneError from functions/symbols
            const dto = toWorkflowNodeDTO(node)
            vscodeAPI.postMessage({ type: 'save_customNode', data: dto } as any)
        },
        [vscodeAPI]
    )
    const onDeleteCustomNode = useCallback(
        (nodeTitle: string) => {
            vscodeAPI.postMessage({ type: 'delete_customNode', data: nodeTitle } as any)
        },
        [vscodeAPI]
    )
    const onRenameCustomNode = useCallback(
        (oldNodeTitle: string, newNodeTitle: string) => {
            vscodeAPI.postMessage({
                type: 'rename_customNode',
                data: { oldNodeTitle, newNodeTitle },
            } as any)
        },
        [vscodeAPI]
    )
    useEffect(() => {
        onGetCustomNodes()
    }, [onGetCustomNodes])
    return { onSaveCustomNode, onDeleteCustomNode, onRenameCustomNode }
}
