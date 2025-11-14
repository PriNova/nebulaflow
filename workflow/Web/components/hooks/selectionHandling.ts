import type { WorkflowNodes } from '@nodes/Nodes'
import { useOnSelectionChange } from '@xyflow/react'
import { useCallback } from 'react'

export interface SelectionSummary {
    selectedNodeId: string | null
    selectedNodeLabel: string | null
    selectedNodeType: string | null
    selectedCount: number
}

export const buildSelectionSummary = (selectedNodes: WorkflowNodes[]): SelectionSummary => {
    if (selectedNodes.length === 0) {
        return {
            selectedNodeId: null,
            selectedNodeLabel: null,
            selectedNodeType: null,
            selectedCount: 0,
        }
    }

    const firstNode = selectedNodes[0]
    return {
        selectedNodeId: firstNode.id,
        selectedNodeLabel: firstNode.data.title ?? firstNode.id,
        selectedNodeType: firstNode.type,
        selectedCount: selectedNodes.length,
    }
}

export const useInteractionHandling = (
    setSelectedNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>,
    setActiveNode: React.Dispatch<React.SetStateAction<WorkflowNodes | null>>
) => {
    useOnSelectionChange({
        onChange: ({ nodes }) => {
            const selectedWorkflowNodes = nodes as WorkflowNodes[]
            setSelectedNodes(selectedWorkflowNodes)
            if (selectedWorkflowNodes.length > 0) {
                setActiveNode(current => {
                    if (!current) return selectedWorkflowNodes[0]
                    if (selectedWorkflowNodes.some(n => n.id === current.id)) {
                        return current
                    }
                    return selectedWorkflowNodes[0]
                })
            } else if (selectedWorkflowNodes.length === 0) {
                setActiveNode(null)
            }
        },
    })

    const onNodeClick = useCallback(
        (event: React.MouseEvent, node: WorkflowNodes) => {
            event.stopPropagation()
            if (event.shiftKey) return

            const isModifier = event.ctrlKey || event.metaKey
            if (isModifier) {
                setSelectedNodes(prev => {
                    const isSelected = prev.some(n => n.id === node.id)
                    if (isSelected) {
                        const next = prev.filter(n => n.id !== node.id)
                        setActiveNode(current => (current?.id === node.id ? next[0] ?? null : current))
                        return next
                    }
                    setActiveNode(node)
                    return [...prev, node]
                })
            } else {
                setSelectedNodes([node])
                setActiveNode(node)
            }
        },
        [setSelectedNodes, setActiveNode]
    )

    const handleBackgroundClick = useCallback(
        (event: React.MouseEvent | React.KeyboardEvent) => {
            if (
                (event.type === 'click' && !(event as React.MouseEvent).shiftKey) ||
                (event as React.KeyboardEvent).key === 'Enter'
            ) {
                setSelectedNodes([])
                setActiveNode(null)
            }
        },
        [setSelectedNodes, setActiveNode]
    )

    const handleBackgroundKeyDown = useCallback(
        (event: React.KeyboardEvent) => {
            if (event.key === 'Enter') {
                setSelectedNodes([])
                setActiveNode(null)
            }
        },
        [setSelectedNodes, setActiveNode]
    )

    return { onNodeClick, handleBackgroundClick, handleBackgroundKeyDown }
}
