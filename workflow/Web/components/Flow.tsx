import { Background, Controls, ReactFlow, SelectionMode } from '@xyflow/react'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../services/Protocol'
import type { GenericVSCodeWrapper } from '../utils/vscode'
import { CustomOrderedEdgeComponent } from './CustomOrderedEdge'
import type { Edge } from './CustomOrderedEdge'
// styles moved to global index.css
import { HelpModal } from './HelpModal'
import { NebulaSpinningLogo } from './NebulaSpinningLogo'
import { RightSidebar } from './RightSidebar'
import { SidebarActionsBar } from './SidebarActionsBar'
import { WorkflowSidebar } from './WorkflowSidebar'
import { useEdgeOperations } from './hooks/edgeOperations'
import { useMessageHandler } from './hooks/messageHandling'
import { useCustomNodes, useNodeOperations } from './hooks/nodeOperations'
import { memoizedTopologicalSort, useNodeStateTransformation } from './hooks/nodeStateTransforming'
import { useInteractionHandling } from './hooks/selectionHandling'
import { useRightSidebarResize, useSidebarResize } from './hooks/sidebarResizing'
import { useWorkflowActions } from './hooks/workflowActions'
import { useWorkflowExecution } from './hooks/workflowExecution'
import { type WorkflowNodes, defaultWorkflow, nodeTypes } from './nodes/Nodes'
import { isValidEdgeConnection } from './utils/edgeValidation'

const HANDLE_THICKNESS = '6px'
const MIN_HANDLE_GAP = 8 // px gap to prevent handle overlap

const pruneEdgesForMissingNodes = (eds: Edge[], nodeList: WorkflowNodes[]): Edge[] => {
    const nodeIds = new Set(nodeList.map(n => n.id))
    return eds.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
}

export const Flow: React.FC<{
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>
}> = ({ vscodeAPI }) => {
    const [nodes, setNodes] = useState<WorkflowNodes[]>(defaultWorkflow.nodes)
    const [selectedNodes, setSelectedNodes] = useState<WorkflowNodes[]>([])
    const [activeNode, setActiveNode] = useState<WorkflowNodes | null>(null)
    const [nodeResults, setNodeResults] = useState<Map<string, string>>(new Map())
    const [pendingApprovalNodeId, setPendingApprovalNodeId] = useState<string | null>(null)
    const [models, setModels] = useState<{ id: string; title?: string }[]>([])
    const [customNodes, setCustomNodes] = useState<WorkflowNodes[]>([])
    const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const [edges, setEdges] = useState(defaultWorkflow.edges)
    const [isHelpOpen, setIsHelpOpen] = useState(false)

    const notify = useCallback((p: { type: 'success' | 'error'; text: string }) => {
        if (bannerTimerRef.current) {
            clearTimeout(bannerTimerRef.current)
        }
        setBanner(p)
        bannerTimerRef.current = setTimeout(() => setBanner(null), 3000)
    }, [])

    useEffect(() => {
        return () => {
            if (bannerTimerRef.current) {
                clearTimeout(bannerTimerRef.current)
            }
        }
    }, [])

    const { onEdgesChange, onConnect, onEdgesDelete, orderedEdges } = useEdgeOperations(
        edges,
        setEdges,
        nodes
    )

    const { movingNodeId, onNodesChange, onNodeDragStart, onNodeAdd, onNodeUpdate } = useNodeOperations(
        vscodeAPI,
        nodes,
        setNodes,
        selectedNodes,
        setSelectedNodes,
        activeNode,
        setActiveNode
    )

    const {
        isExecuting,
        executingNodeId,
        nodeErrors,
        interruptedNodeId,
        nodeAssistantContent,
        executionRunId,
        onExecute,
        onResume,
        onAbort,
        resetExecutionState,
        setExecutingNodeId,
        setIsExecuting,
        setInterruptedNodeId,
        setNodeErrors,
        setNodeAssistantContent,
    } = useWorkflowExecution(vscodeAPI, nodes, edges, setNodes, setEdges)

    const { onSave, onLoad, calculatePreviewNodeTokens, handleNodeApproval } = useWorkflowActions(
        vscodeAPI,
        nodes,
        edges,
        setPendingApprovalNodeId,
        setNodeErrors,
        setIsExecuting
    )

    useMessageHandler(
        nodes,
        setNodes,
        setEdges,
        setNodeErrors,
        setNodeResults,
        setInterruptedNodeId,
        setExecutingNodeId,
        setIsExecuting,
        onNodeUpdate,
        calculatePreviewNodeTokens,
        setPendingApprovalNodeId,
        setModels,
        vscodeAPI,
        setCustomNodes,
        setNodeAssistantContent,
        notify,
        edges,
        nodeResults
    )

    const { sidebarWidth, handleMouseDown } = useSidebarResize(256, 200, 600, {
        minCenterGap: MIN_HANDLE_GAP,
        getCenterWidth: () => centerRef.current?.clientWidth ?? 0,
    })
    const { rightSidebarWidth, handleMouseDown: handleRightSidebarMouseDown } = useRightSidebarResize(
        256,
        200,
        undefined,
        { minCenterGap: MIN_HANDLE_GAP, getCenterWidth: () => centerRef.current?.clientWidth ?? 0 }
    )
    const { onNodeClick, handleBackgroundClick, handleBackgroundKeyDown } = useInteractionHandling(
        setSelectedNodes,
        setActiveNode
    )

    const isValidConnection = useCallback((conn: any) => isValidEdgeConnection(conn, edges), [edges])

    useEffect(() => {
        setEdges(prev => pruneEdgesForMissingNodes(prev, nodes))
    }, [nodes])

    const nodesWithState = useNodeStateTransformation(
        nodes,
        selectedNodes,
        movingNodeId,
        executingNodeId,
        nodeErrors,
        nodeResults,
        interruptedNodeId,
        edges
    )

    const { onSaveCustomNode, onDeleteCustomNode, onRenameCustomNode } = useCustomNodes(vscodeAPI)

    const sortedNodes = useMemo(() => {
        const sorted = memoizedTopologicalSort(nodesWithState, edges)
        return sorted.map(node => ({ ...node, data: { ...node.data } }))
    }, [nodesWithState, edges])

    // Measure center pane for background canvas sizing
    const centerRef = useRef<HTMLDivElement | null>(null)
    const [centerSize, setCenterSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
    useEffect(() => {
        const el = centerRef.current
        if (!el) return
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                const cr = entry.contentRect
                setCenterSize({
                    w: Math.max(0, Math.floor(cr.width)),
                    h: Math.max(0, Math.floor(cr.height)),
                })
            }
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    useEffect(() => {
        const handler = (e: any) => {
            const nodeId = e?.detail?.nodeId
            if (!nodeId) return
            const outputs: Record<string, string> = {}
            const nodeIdSet = new Set(nodes.map(n => n.id))
            for (const [k, v] of nodeResults) {
                if (nodeIdSet.has(k)) outputs[k] = v
            }
            onResume(nodeId, outputs)
        }
        window.addEventListener('nebula-run-from-here' as any, handler as any)
        return () => window.removeEventListener('nebula-run-from-here' as any, handler as any)
    }, [nodeResults, nodes, onResume])

    return (
        <div className="tw-flex tw-h-screen tw-w-full tw-border-2 tw-border-solid tw-border-[var(--vscode-panel-border)] tw-text-[14px] tw-overflow-hidden">
            <div
                style={{ width: sidebarWidth + 'px' }}
                className="tw-flex-shrink-0 tw-bg-[var(--vscode-sideBar-background)] tw-h-full tw-flex tw-flex-col"
            >
                <SidebarActionsBar
                    onSave={onSave}
                    onLoad={onLoad}
                    onExecute={onExecute}
                    onClear={resetExecutionState}
                    isExecuting={isExecuting}
                    onAbort={onAbort}
                />
                <div className="tw-flex-1 tw-overflow-y-auto tw-min-h-0">
                    <WorkflowSidebar
                        onNodeAdd={onNodeAdd}
                        selectedNode={activeNode}
                        onNodeUpdate={onNodeUpdate}
                        models={models}
                        onSaveCustomNode={onSaveCustomNode}
                        onDeleteCustomNode={onDeleteCustomNode}
                        onRenameCustomNode={onRenameCustomNode}
                        customNodes={customNodes}
                        nodeErrors={nodeErrors}
                    />
                </div>
            </div>
            <div
                style={{ width: HANDLE_THICKNESS }}
                className="hover:tw-bg-[var(--vscode-textLink-activeForeground)] tw-bg-[var(--vscode-panel-border)] tw-cursor-ew-resize tw-select-none"
                onMouseDown={handleMouseDown}
            />
            <div
                className="tw-flex-1 tw-bg-[var(--vscode-editor-background)] tw-shadow-inner tw-h-full tw-overflow-hidden"
                onClick={handleBackgroundClick}
                onKeyDown={handleBackgroundKeyDown}
                role="button"
                tabIndex={0}
            >
                <div className="tw-flex tw-flex-1 tw-h-full">
                    <div
                        ref={centerRef}
                        className="tw-relative tw-flex-1 tw-bg-[var(--vscode-editor-background)] tw-h-full tw-min-w-0"
                    >
                        {banner && (
                            <div
                                className="tw-absolute tw-top-4 tw-left-1/2 tw-transform tw--translate-x-1/2 tw-z-50 tw-px-4 tw-py-2 tw-rounded tw-shadow-lg"
                                style={{
                                    backgroundColor: banner.type === 'success' ? '#28a745' : '#dc3545',
                                    color: '#fff',
                                }}
                            >
                                {banner.text}
                            </div>
                        )}
                        {/* Background: NebulaFlow spinner */}
                        {centerSize.w > 0 && centerSize.h > 0 ? (
                            <NebulaSpinningLogo
                                width={centerSize.w}
                                height={centerSize.h}
                                scale={2.5}
                                axis="y"
                                opacity={0.12}
                                className="tw-z-0"
                            />
                        ) : null}
                        {/* ReactFlow overlay */}
                        <div className="tw-absolute tw-inset-0 tw-z-[1]">
                            <ReactFlow
                                nodes={nodesWithState}
                                edges={orderedEdges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onEdgesDelete={onEdgesDelete}
                                onConnect={onConnect}
                                onNodeClick={onNodeClick}
                                onNodeDragStart={onNodeDragStart}
                                deleteKeyCode={['Backspace', 'Delete']}
                                nodeTypes={nodeTypes}
                                selectionMode={SelectionMode.Partial}
                                selectionOnDrag={true}
                                selectionKeyCode="Shift"
                                isValidConnection={isValidConnection}
                                edgeTypes={{
                                    'ordered-edge': props => <CustomOrderedEdgeComponent {...props} />,
                                }}
                                fitView
                            >
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
                                </Controls>
                                <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
                            </ReactFlow>
                        </div>
                    </div>
                    <div
                        style={{ width: HANDLE_THICKNESS }}
                        className="hover:tw-bg-[var(--vscode-textLink-activeForeground)] tw-bg-[var(--vscode-panel-border)] tw-cursor-ew-resize tw-select-none"
                        onMouseDown={handleRightSidebarMouseDown}
                    />
                    <div
                        style={{ width: rightSidebarWidth + 'px' }}
                        className="tw-flex-shrink-0 tw-border-r tw-border-solid tw-border-[var(--vscode-panel-border)] tw-bg-[var(--vscode-sideBar-background)] tw-h-full tw-overflow-y-auto"
                    >
                        <RightSidebar
                            sortedNodes={sortedNodes}
                            nodeResults={nodeResults}
                            executingNodeId={executingNodeId}
                            pendingApprovalNodeId={pendingApprovalNodeId}
                            onApprove={handleNodeApproval}
                            interruptedNodeId={interruptedNodeId}
                            nodeAssistantContent={nodeAssistantContent}
                            executionRunId={executionRunId}
                            onRunFromHere={(nodeId: string) => {
                                const outputs: Record<string, string> = {}
                                const nodeIdSet = new Set(nodes.map(n => n.id))
                                for (const [k, v] of nodeResults) {
                                    if (nodeIdSet.has(k)) {
                                        outputs[k] = v
                                    }
                                }
                                onResume(nodeId, outputs)
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
