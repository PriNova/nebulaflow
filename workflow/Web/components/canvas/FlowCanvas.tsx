import { CustomOrderedEdgeComponent } from '@graph/CustomOrderedEdge'
import type { Edge } from '@graph/CustomOrderedEdge'
import { HelpModal } from '@modals/HelpModal'
import { type WorkflowNodes, nodeTypes } from '@nodes/Nodes'
import {
    Background,
    ConnectionLineType,
    Controls,
    ReactFlow,
    SelectionMode,
    useReactFlow,
} from '@xyflow/react'
import type React from 'react'
import { type RefObject, useEffect, useRef } from 'react'
import { toWorkflowNodeDTO } from '../../utils/nodeDto'
import type { SubflowMeta } from '../subflows/useProvideSubflow'

interface FitViewHandlerProps {
    fitRequested: boolean
    nodes: WorkflowNodes[]
    onFitComplete: () => void
}

const FitViewHandler: React.FC<FitViewHandlerProps> = ({ fitRequested, nodes, onFitComplete }) => {
    const reactFlow = useReactFlow()
    const rafIdRef = useRef<number | null>(null)

    useEffect(() => {
        if (!fitRequested) return

        const performFit = () => {
            if (nodes.length === 0) {
                reactFlow.setViewport({ x: 0, y: 0, zoom: 1 })
            } else {
                reactFlow.fitView({ padding: 0.2, minZoom: 0.5, maxZoom: 1.5 })
            }
            onFitComplete()
        }

        rafIdRef.current = requestAnimationFrame(performFit)

        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current)
            }
        }
    }, [fitRequested, nodes, reactFlow, onFitComplete])

    return null
}

interface FlowCanvasProps {
    sortedNodes: WorkflowNodes[]
    visualEdges: Edge[]
    nodes: WorkflowNodes[]
    edges: Edge[]
    fitRequested: boolean
    isHelpOpen: boolean
    viewStack: Array<{ nodes: WorkflowNodes[]; edges: Edge[] }>
    activeSubflowId: string | null
    subflowMeta: SubflowMeta | null
    subflowBaselineRef: RefObject<{ nodes: string; edges: string; outputs: string } | null>
    setFitRequested: React.Dispatch<React.SetStateAction<boolean>>
    setIsHelpOpen: React.Dispatch<React.SetStateAction<boolean>>
    setViewStack: React.Dispatch<React.SetStateAction<Array<{ nodes: WorkflowNodes[]; edges: Edge[] }>>>
    setActiveSubflowId: React.Dispatch<React.SetStateAction<string | null>>
    setNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
    onNodesChange: (changes: any) => void
    onEdgesChange: (changes: any) => void
    onEdgesDelete: (edges: any) => void
    onConnect: (connection: any) => void
    onNodeClick: (event: any, node: any) => void
    onNodeDragStart: (event: any, node: any) => void
    isValidConnection: (conn: any) => boolean
    requestFitOnNextRender: () => void
    onNodeContextMenu: (event: any, node: any) => void
    onPaneContextMenu: (event: any) => void
}

/**
 * ReactFlow canvas with controls and background.
 */
export const FlowCanvas: React.FC<FlowCanvasProps> = ({
    sortedNodes,
    visualEdges,
    nodes,
    edges,
    fitRequested,
    isHelpOpen,
    viewStack,
    activeSubflowId,
    subflowMeta,
    subflowBaselineRef,
    setFitRequested,
    setIsHelpOpen,
    setViewStack,
    setActiveSubflowId,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onEdgesDelete,
    onConnect,
    onNodeClick,
    onNodeDragStart,
    isValidConnection,
    requestFitOnNextRender,
    onNodeContextMenu,
    onPaneContextMenu,
}) => {
    return (
        <div className="tw-absolute tw-inset-0 tw-z-[1]">
            <ReactFlow
                nodes={sortedNodes}
                edges={visualEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onEdgesDelete={onEdgesDelete}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onNodeDragStart={onNodeDragStart}
                onNodeContextMenu={onNodeContextMenu}
                onPaneContextMenu={onPaneContextMenu}
                deleteKeyCode={['Backspace', 'Delete']}
                nodeTypes={nodeTypes}
                selectionMode={SelectionMode.Partial}
                selectionOnDrag={true}
                selectionKeyCode="Shift"
                isValidConnection={isValidConnection}
                connectionLineType={ConnectionLineType.Bezier}
                edgeTypes={{
                    'ordered-edge': props => <CustomOrderedEdgeComponent {...props} />,
                }}
                fitView
            >
                <FitViewHandler
                    fitRequested={fitRequested}
                    nodes={nodes}
                    onFitComplete={() => setFitRequested(false)}
                />
                <Background color="transparent" />
                <Controls className="rf-controls">
                    <button
                        type="button"
                        className="react-flow__controls-button"
                        onClick={() => setIsHelpOpen(true)}
                        title="Help"
                    >
                        ?
                    </button>
                    {viewStack.length > 0 && (
                        <button
                            type="button"
                            className="react-flow__controls-button"
                            onClick={() => {
                                // Confirm before discarding unsaved subflow edits
                                try {
                                    if (activeSubflowId) {
                                        const nodeDTOs = (nodes as any[]).map(n => toWorkflowNodeDTO(n))
                                        nodeDTOs.sort((a: any, b: any) =>
                                            String(a.id).localeCompare(String(b.id))
                                        )
                                        const edgeDTOs = (edges as any[]).map(e => ({
                                            id: e.id,
                                            source: e.source,
                                            target: e.target,
                                            sourceHandle: (e as any).sourceHandle,
                                            targetHandle: (e as any).targetHandle,
                                        }))
                                        edgeDTOs.sort((a: any, b: any) =>
                                            String(a.id).localeCompare(String(b.id))
                                        )
                                        const outputs = Array.isArray(subflowMeta?.outputs)
                                            ? subflowMeta!.outputs.map(o => ({
                                                  id: o.id,
                                                  name: o.name,
                                                  index: o.index,
                                              }))
                                            : []
                                        const cur = {
                                            nodes: JSON.stringify(nodeDTOs),
                                            edges: JSON.stringify(edgeDTOs),
                                            outputs: JSON.stringify(outputs),
                                        }
                                        const base = subflowBaselineRef.current
                                        const changed =
                                            !base ||
                                            base.nodes !== cur.nodes ||
                                            base.edges !== cur.edges ||
                                            base.outputs !== cur.outputs
                                        if (changed) {
                                            const ok = window.confirm(
                                                'You have unsaved subflow changes. Discard and go back?'
                                            )
                                            if (!ok) {
                                                return
                                            }
                                        }
                                    }
                                } catch {}
                                const prev = viewStack[viewStack.length - 1]
                                setViewStack(stack => stack.slice(0, -1))
                                setActiveSubflowId(null)
                                setNodes(prev.nodes)
                                setEdges(prev.edges)
                                requestFitOnNextRender()
                            }}
                            title="Back to Parent"
                        >
                            ⬅
                        </button>
                    )}
                </Controls>
                <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
            </ReactFlow>
        </div>
    )
}
