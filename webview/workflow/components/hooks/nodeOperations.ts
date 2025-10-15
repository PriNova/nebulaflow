import { type NodeChange, applyNodeChanges, useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { unstable_batchedUpdates } from 'react-dom'
import { v4 as uuidv4 } from 'uuid'
import type { GenericVSCodeWrapper } from '../../../utils/vscode'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/WorkflowProtocol'
import type { LLMNode } from '../nodes/LLM_Node'
import type { LoopStartNode } from '../nodes/LoopStart_Node'
import { NodeType, type WorkflowNodes, createNode } from '../nodes/Nodes'

interface IndexedNodes {
    byId: Map<string, WorkflowNodes>
    allIds: string[]
}

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
            const dragChange = changes.find(
                change => change.type === 'position' && 'dragging' in change && (change as any).dragging
            ) as any
            if (dragChange?.event?.shiftKey && dragChange.dragging && !movingNodeId) {
                return
            }
            if (dragChange) {
                setMovingNodeId(dragChange.id)
            } else if (movingNodeId) {
                setMovingNodeId(null)
            }
            const updatedNodes = applyNodeChanges(changes, nodes) as typeof nodes
            setNodes(updatedNodes)
            if (selectedNodes.length > 0) {
                const updatedSelectedNodes = selectedNodes
                    .map(node => indexedNodes.byId.get(node.id))
                    .filter(Boolean) as WorkflowNodes[]
                setSelectedNodes(updatedSelectedNodes)
            }
            if (activeNode) {
                const updatedActiveNode = indexedNodes.byId.get(activeNode.id)
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
            indexedNodes,
        ]
    )

    const onNodeDragStart = useCallback(
        (event: React.MouseEvent, node: WorkflowNodes) => {
            if (event.shiftKey) {
                const sourceNode = indexedNodes.byId.get(node.id)
                if (!sourceNode) return
                const newNode = createNode({
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
                        ;(newNode as any).data = {
                            ...newNode.data,
                            temperature: llmSource.data.temperature,
                            maxTokens: llmSource.data.maxTokens,
                            model: llmSource.data.model,
                        }
                        break
                    }
                    case NodeType.CLI:
                    case NodeType.PREVIEW:
                    case NodeType.INPUT:
                    case NodeType.CODY_OUTPUT:
                    case NodeType.LOOP_START: {
                        const loopStartData = sourceNode as LoopStartNode
                        ;(newNode as any).data = {
                            ...newNode.data,
                            iterations: (loopStartData as any).data.iterations,
                            loopVariable: (loopStartData as any).data.loopVariable,
                        }
                        break
                    }
                    case NodeType.LOOP_END:
                    case NodeType.SEARCH_CONTEXT:
                        ;(newNode as any).data.content = sourceNode.data.content
                        break
                }
                setNodes(current => [...current, newNode])
                setMovingNodeId((newNode as any).id)
                event.stopPropagation()
            }
        },
        [indexedNodes, setNodes]
    )

    const onNodeAdd = useCallback(
        (nodeOrLabel: WorkflowNodes | string, nodeType?: NodeType) => {
            const flowElement = document.querySelector('.react-flow')
            const flowBounds = flowElement?.getBoundingClientRect()
            const centerPosition = flowInstance.screenToFlowPosition({
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
                            temperature: 0.0,
                            maxTokens: 1000,
                            model: undefined,
                        }
                        break
                    case NodeType.PREVIEW:
                    case NodeType.INPUT:
                        newNode.data.content = ''
                        break
                    case NodeType.LOOP_START:
                        ;(newNode as any).data = { ...newNode.data, iterations: 1, loopVariable: 'loop' }
                        break
                    case NodeType.SEARCH_CONTEXT:
                        ;(newNode as any).data = { ...newNode.data, local_remote: false }
                        break
                }
                setNodes(nodes => [...nodes, newNode])
            } else {
                const nodeWithId = { ...nodeOrLabel, id: uuidv4(), position: centerPosition }
                setNodes(nodes => [...nodes, nodeWithId as any])
            }
        },
        [flowInstance, setNodes]
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
            vscodeAPI.postMessage({ type: 'save_customNode', data: node } as any)
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
