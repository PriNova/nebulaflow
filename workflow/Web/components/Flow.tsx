import {
    Background,
    ConnectionLineType,
    Controls,
    ReactFlow,
    SelectionMode,
    useReactFlow,
} from '@xyflow/react'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../services/Protocol'
import { toWorkflowNodeDTO } from '../utils/nodeDto'
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
import { useParallelAnalysis } from './hooks/parallelAnalysis'
import { buildSelectionSummary, useInteractionHandling } from './hooks/selectionHandling'
import { useRightSidebarResize, useSidebarResize } from './hooks/sidebarResizing'
import { useWorkflowActions } from './hooks/workflowActions'
import { useWorkflowExecution } from './hooks/workflowExecution'
import { NodeType } from './nodes/Nodes'
import { type WorkflowNodes, defaultWorkflow, nodeTypes } from './nodes/Nodes'
import { isValidEdgeConnection } from './utils/edgeValidation'

const FitViewHandler: React.FC<{
    fitRequested: boolean
    nodes: WorkflowNodes[]
    onFitComplete: () => void
}> = ({ fitRequested, nodes, onFitComplete }) => {
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
    const [fitRequested, setFitRequested] = useState(false)
    const [storageScope, setStorageScope] = useState<{
        scope: 'workspace' | 'user'
        basePath?: string
    } | null>(null)
    const [isTogglingScope, setIsTogglingScope] = useState(false)

    const requestFitOnNextRender = useCallback(() => {
        setFitRequested(true)
    }, [])

    const selectionSummary = useMemo(() => buildSelectionSummary(selectedNodes), [selectedNodes])

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
        isPaused,
        executingNodeIds,
        nodeErrors,
        interruptedNodeId,
        stoppedAtNodeId,
        nodeAssistantContent,
        ifElseDecisions,
        executionRunId,
        onExecute,
        onResume,
        onAbort,
        onPauseToggle,
        resetExecutionState,
        setExecutingNodeIds,
        setIsExecuting,
        setIsPaused,
        setInterruptedNodeId,
        setStoppedAtNodeId,
        setNodeErrors,
        setNodeAssistantContent,
        setIfElseDecisions,
        setCompletedThisRun,
    } = useWorkflowExecution(vscodeAPI, nodes, edges, setNodes, setEdges, nodeResults)

    const { onSave, onLoad, calculatePreviewNodeTokens, handleNodeApproval } = useWorkflowActions(
        vscodeAPI,
        nodes,
        edges,
        setPendingApprovalNodeId,
        setNodeErrors,
        setIsExecuting,
        nodeResults,
        ifElseDecisions
    )

    useMessageHandler(
        nodes,
        setNodes,
        setEdges,
        setNodeErrors,
        setNodeResults,
        setInterruptedNodeId,
        setStoppedAtNodeId,
        setExecutingNodeIds,
        setIsExecuting,
        onNodeUpdate,
        calculatePreviewNodeTokens,
        setPendingApprovalNodeId,
        setModels,
        vscodeAPI,
        setCustomNodes,
        setNodeAssistantContent,
        setIfElseDecisions,
        notify,
        edges,
        orderedEdges,
        nodeResults,
        setIsPaused,
        requestFitOnNextRender,
        setCompletedThisRun,
        setStorageScope
    )

    useEffect(() => {
        // Re-enable scope toggle once a storage_scope update arrives
        setIsTogglingScope(false)
    })

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

    const reactFlowInstance = useReactFlow()

    const isValidConnection = useCallback(
        (conn: any) => isValidEdgeConnection(conn, edges, nodes),
        [edges, nodes]
    )

    const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
        const nodeType = e.dataTransfer.types.includes('application/x-amp-node-type')
            ? e.dataTransfer.getData('application/x-amp-node-type')
            : null
        if (nodeType) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
        }
    }, [])

    const handleCanvasDrop = useCallback(
        (e: React.DragEvent) => {
            const nodeType = e.dataTransfer.getData('application/x-amp-node-type')
            if (nodeType === NodeType.INPUT) {
                e.preventDefault()
                const flowElement = document.querySelector('.react-flow')
                if (flowElement) {
                    const position = reactFlowInstance.screenToFlowPosition({
                        x: e.clientX,
                        y: e.clientY,
                    })
                    onNodeAdd('Text', NodeType.INPUT, {
                        position,
                        initialData: { isEditing: true },
                    })
                }
            }
        },
        [onNodeAdd, reactFlowInstance]
    )

    useEffect(() => {
        setEdges(prev => pruneEdgesForMissingNodes(prev, nodes))
    }, [nodes])

    const nodesWithState = useNodeStateTransformation(
        nodes,
        selectedNodes,
        movingNodeId,
        executingNodeIds,
        nodeErrors,
        nodeResults,
        interruptedNodeId,
        stoppedAtNodeId,
        orderedEdges
    )

    const { onSaveCustomNode, onDeleteCustomNode, onRenameCustomNode } = useCustomNodes(vscodeAPI)

    const nodeUpdateCallbacks = useMemo(() => {
        const callbacks: Record<string, (partial: any) => void> = {}
        for (const node of nodesWithState) {
            callbacks[node.id] = (partial: Partial<typeof node.data>) => onNodeUpdate(node.id, partial)
        }
        return callbacks
    }, [nodesWithState, onNodeUpdate])

    const parallelAnalysis = useParallelAnalysis(nodesWithState, edges)

    const sortedNodes = useMemo(() => {
        const sorted = memoizedTopologicalSort(nodesWithState, edges)
        return sorted.map(node => ({
            ...node,
            data: {
                ...node.data,
                onUpdate: nodeUpdateCallbacks[node.id],
                parallelStep: parallelAnalysis.stepByNodeId.get(node.id),
            },
        }))
    }, [nodesWithState, edges, nodeUpdateCallbacks, parallelAnalysis])

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
        const handleEditNode = (e: any) => {
            const detail = e?.detail
            if (!detail) return
            const { id, action, content, title } = detail
            if (!id) return

            switch (action) {
                case 'start':
                    onNodeUpdate(id, { isEditing: true })
                    break
                case 'commit': {
                    const updates: Record<string, any> = { isEditing: false }
                    if (content !== undefined) {
                        updates.content = content
                    }
                    if (title !== undefined) {
                        updates.title = title
                    }
                    onNodeUpdate(id, updates)
                    break
                }
                case 'cancel':
                    onNodeUpdate(id, { isEditing: false })
                    break
            }
        }
        window.addEventListener('nebula-edit-node' as any, handleEditNode as any)
        return () => window.removeEventListener('nebula-edit-node' as any, handleEditNode as any)
    }, [onNodeUpdate])

    // biome-ignore lint/correctness/useExhaustiveDependencies: setters are always stable
    const onResetResults = useCallback(() => {
        setNodeResults(new Map())
        setNodeAssistantContent(new Map())
        setNodeErrors(new Map())
        setNodes(prev =>
            prev.map(n =>
                n.type === NodeType.PREVIEW
                    ? { ...n, data: { ...n.data, content: '', tokenCount: 0 } }
                    : n
            )
        )
    }, [])

    useEffect(() => {
        const handler = (e: any) => {
            const nodeId = e?.detail?.nodeId
            if (!nodeId) return
            if (isPaused) return
            const outputs: Record<string, string> = {}
            const nodeIdSet = new Set(nodes.map(n => n.id))
            for (const [k, v] of nodeResults) {
                if (nodeIdSet.has(k) && k !== nodeId) outputs[k] = v
            }
            onResume(nodeId, outputs)
        }
        window.addEventListener('nebula-run-from-here' as any, handler as any)
        return () => window.removeEventListener('nebula-run-from-here' as any, handler as any)
    }, [nodeResults, nodes, onResume, isPaused])

    useEffect(() => {
        const handler = (e: any) => {
            const nodeId: string | undefined = e?.detail?.nodeId
            if (!nodeId) return
            if (isPaused) return
            // Build ordered inputs from immediate parents using edge order
            const incoming = edges.filter(e => e.target === nodeId)
            const sorted = [...incoming].sort(
                (a, b) => (a.data?.orderNumber ?? 0) - (b.data?.orderNumber ?? 0)
            )
            const inputs: string[] = []
            for (const edge of sorted) {
                const val = nodeResults.get(edge.source)
                if (typeof val === 'string') inputs.push(val)
            }
            // Derive variables from VARIABLE nodes and current nodeResults
            const variables: Record<string, string> = {}
            for (const n of nodes) {
                if (n.type === NodeType.VARIABLE) {
                    const varName = (n as any).data?.variableName as string | undefined
                    if (varName) {
                        const v = nodeResults.get(n.id)
                        if (typeof v === 'string') variables[varName] = v
                    }
                }
            }
            const node = nodes.find(n => n.id === nodeId)
            if (!node) return
            // Post single-node execution request
            vscodeAPI.postMessage({
                type: 'execute_node',
                data: { node: toWorkflowNodeDTO(node as any), inputs, variables },
            } as any)
        }
        window.addEventListener('nebula-run-only-this' as any, handler as any)
        return () => window.removeEventListener('nebula-run-only-this' as any, handler as any)
    }, [edges, nodeResults, nodes, vscodeAPI, isPaused])

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
                    onReset={onResetResults}
                    isExecuting={isExecuting}
                    isPaused={isPaused}
                    onAbort={onAbort}
                    onPauseToggle={onPauseToggle}
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
                        storageScope={storageScope?.scope || 'user'}
                        isTogglingScope={isTogglingScope}
                        onToggleStorageScope={() => {
                            setIsTogglingScope(true)
                            vscodeAPI.postMessage({ type: 'toggle_storage_scope' } as any)
                        }}
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
                        onDragOver={handleCanvasDragOver}
                        onDrop={handleCanvasDrop}
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
                                nodes={sortedNodes}
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
                            executingNodeIds={executingNodeIds}
                            pendingApprovalNodeId={pendingApprovalNodeId}
                            onApprove={handleNodeApproval}
                            interruptedNodeId={interruptedNodeId}
                            stoppedAtNodeId={stoppedAtNodeId}
                            nodeAssistantContent={nodeAssistantContent}
                            executionRunId={executionRunId}
                            isPaused={isPaused}
                            onRunFromHere={(nodeId: string) => {
                                const outputs: Record<string, string> = {}
                                const nodeIdSet = new Set(nodes.map(n => n.id))
                                for (const [k, v] of nodeResults) {
                                    if (nodeIdSet.has(k) && k !== nodeId) {
                                        outputs[k] = v
                                    }
                                }
                                onResume(nodeId, outputs)
                            }}
                            selection={selectionSummary}
                            parallelSteps={parallelAnalysis.steps}
                            parallelStepByNodeId={parallelAnalysis.stepByNodeId}
                            branchByIfElseId={parallelAnalysis.branchByIfElseId}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
