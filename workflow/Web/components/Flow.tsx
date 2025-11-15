import type { Edge } from '@graph/CustomOrderedEdge'
import { isValidEdgeConnection } from '@graph/utils/edgeValidation'
import { NodeType } from '@nodes/Nodes'
import { type WorkflowNodes, defaultWorkflow } from '@nodes/Nodes'
import { NebulaSpinningLogo } from '@shared/NebulaSpinningLogo'
import { useReactFlow } from '@xyflow/react'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../services/Protocol'
import { pruneEdgesForMissingNodes } from '../utils/pruneEdges'
import type { GenericVSCodeWrapper } from '../utils/vscode'
import { FlowCanvas } from './canvas/FlowCanvas'
import { useDuplicateSubflow } from './effects/useDuplicateSubflow'
import { useEditNode } from './effects/useEditNode'
import { useRunFromHere } from './effects/useRunFromHere'
import { useRunOnlyThis } from './effects/useRunOnlyThis'
import { useEdgeOperations } from './hooks/edgeOperations'
import { useMessageHandler } from './hooks/messageHandling'
import { useCustomNodes, useNodeOperations } from './hooks/nodeOperations'
import { memoizedTopologicalSort, useNodeStateTransformation } from './hooks/nodeStateTransforming'
import { useParallelAnalysis } from './hooks/parallelAnalysis'
import { buildSelectionSummary, useInteractionHandling } from './hooks/selectionHandling'
import { useRightSidebarResize, useSidebarResize } from './hooks/sidebarResizing'
import { useWorkflowActions } from './hooks/workflowActions'
import { useWorkflowExecution } from './hooks/workflowExecution'
import { LeftSidebarContainer } from './layout/LeftSidebarContainer'
import { RightSidebarContainer } from './layout/RightSidebarContainer'
import { QuickActions } from './overlays/QuickActions'
import { SubflowOutputsEditor } from './overlays/SubflowOutputsEditor'
import { useOpenSubflow } from './subflows/useOpenSubflow'
import { useProvideSubflow } from './subflows/useProvideSubflow'
import { useSaveSubflow } from './subflows/useSaveSubflow'
import { useSubflowState } from './subflows/useSubflowState'

const MIN_HANDLE_GAP = 8 // px gap to prevent handle overlap

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
    const [subflows, setSubflows] = useState<Array<{ id: string; title: string; version: string }>>([])
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

    // Subflow view stack
    const [viewStack, setViewStack] = useState<Array<{ nodes: WorkflowNodes[]; edges: Edge[] }>>([])
    const [activeSubflowId, setActiveSubflowId] = useState<string | null>(null)
    const subflowBaselineRef = useRef<{ nodes: string; edges: string; outputs: string } | null>(null)
    const [subflowMeta, setSubflowMeta] = useState<{
        id: string
        title: string
        version: string
        inputs: Array<{ id: string; name: string; index: number }>
        outputs: Array<{ id: string; name: string; index: number }>
    } | null>(null)

    const [leftCollapsed, setLeftCollapsed] = useState(false)
    const [rightCollapsed, setRightCollapsed] = useState(false)
    // One-shot rename flow for existing subflows triggered via PropertyEditor
    const [pendingSubflowRename, setPendingSubflowRename] = useState<{
        id: string
        newTitle: string
    } | null>(null)

    // Cache of disabled output handles per subflow definition id
    const [disabledOutputsBySubflowId, setDisabledOutputsBySubflowId] = useState<
        Map<string, Set<string>>
    >(new Map())

    // Refs to keep latest values for one-time listeners
    const nodesRef = useRef(nodes)
    const edgesRef = useRef(edges)
    const activeSubflowIdRef = useRef(activeSubflowId)
    const vscodeAPIRef = useRef(vscodeAPI)

    useEffect(() => {
        nodesRef.current = nodes
    }, [nodes])
    useEffect(() => {
        edgesRef.current = edges
    }, [edges])
    useEffect(() => {
        activeSubflowIdRef.current = activeSubflowId
    }, [activeSubflowId])
    useEffect(() => {
        vscodeAPIRef.current = vscodeAPI
    }, [vscodeAPI])

    // Determine which subflow outputs are disabled based on inner graph active flags
    const computeDisabledOutputHandles = useCallback(
        (
            dtoNodes: Array<{ id: string; type: string; data?: any }>,
            dtoEdges: Array<{ source: string; target: string }>
        ): Set<string> => {
            const byId = new Map(dtoNodes.map(n => [n.id, n]))
            const incoming = new Map<string, string[]>()
            for (const e of dtoEdges) {
                const arr = incoming.get(e.target) || []
                arr.push(e.source)
                incoming.set(e.target, arr)
            }
            const isActive = (id: string): boolean => {
                const n = byId.get(id) as any
                if (!n) return false
                if (n.type === NodeType.SUBFLOW_INPUT || n.type === NodeType.SUBFLOW_OUTPUT) return true
                return n?.data?.active !== false
            }
            const outNodes = dtoNodes.filter(n => n.type === (NodeType.SUBFLOW_OUTPUT as any))
            const disabled = new Set<string>()
            for (const outNode of outNodes) {
                const portId = (outNode as any)?.data?.portId as string | undefined
                if (!portId) continue
                // BFS backward allowing only active nodes (boundary nodes always allowed)
                const queue: string[] = [outNode.id]
                const seen = new Set<string>([outNode.id])
                let reachable = false
                while (queue.length > 0 && !reachable) {
                    const cur = queue.shift()!
                    const parents = incoming.get(cur) || []
                    for (const p of parents) {
                        if (seen.has(p)) continue
                        seen.add(p)
                        const pn = byId.get(p) as any
                        if (!pn) continue
                        if (pn.type === (NodeType.SUBFLOW_INPUT as any)) {
                            reachable = true
                            break
                        }
                        if (isActive(p)) {
                            queue.push(p)
                        }
                    }
                }
                if (!reachable) disabled.add(portId)
            }
            return disabled
        },
        []
    )

    const requestFitOnNextRender = useCallback(() => {
        setFitRequested(true)
    }, [])

    const handleResultUpdate = useCallback((nodeId: string, value: string) => {
        setNodeResults(prev => {
            const next = new Map(prev)
            next.set(nodeId, value)
            return next
        })
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

    // Visual edges overlay: dim wrapper edges for disabled outputs
    const visualEdges: Edge[] = useMemo(() => {
        if (!orderedEdges || orderedEdges.length === 0) return orderedEdges
        const disabledByWrapper = new Map<string, Set<string>>()
        for (const n of nodes) {
            if (n.type === NodeType.SUBFLOW) {
                const data: any = (n as any).data
                let set: Set<string> | undefined
                if (
                    Array.isArray(data?.disabledOutputHandles) &&
                    data.disabledOutputHandles.length > 0
                ) {
                    set = new Set(data.disabledOutputHandles as string[])
                } else if (data?.subflowId && disabledOutputsBySubflowId.has(data.subflowId)) {
                    set = disabledOutputsBySubflowId.get(data.subflowId)
                }
                if (set && set.size > 0) disabledByWrapper.set(n.id, set)
            }
        }
        if (disabledByWrapper.size === 0) return orderedEdges
        return orderedEdges.map(e => {
            const set = disabledByWrapper.get(e.source)
            if (set && typeof e.sourceHandle === 'string' && set.has(e.sourceHandle)) {
                return {
                    ...e,
                    style: {
                        ...(e.style || {}),
                        opacity: 0.4,
                        stroke: 'var(--vscode-disabledForeground)',
                    },
                }
            }
            return e
        })
    }, [orderedEdges, nodes, disabledOutputsBySubflowId])

    const { movingNodeId, onNodesChange, onNodeDragStart, onNodeAdd, onNodeUpdate } = useNodeOperations(
        vscodeAPI,
        nodes,
        setNodes,
        selectedNodes,
        setSelectedNodes,
        activeNode,
        setActiveNode
    )

    // Downstream nodes to dim (direct children of wrappers on disabled output handles)
    const dimmedChildNodeIds = useMemo(() => {
        const dim = new Set<string>()
        if (!orderedEdges || orderedEdges.length === 0) return dim
        // Build disabled handle map per wrapper id
        const disabledByWrapper = new Map<string, Set<string>>()
        for (const n of nodes) {
            if (n.type === NodeType.SUBFLOW) {
                const data: any = (n as any).data
                let set: Set<string> | undefined
                if (
                    Array.isArray(data?.disabledOutputHandles) &&
                    data.disabledOutputHandles.length > 0
                ) {
                    set = new Set(data.disabledOutputHandles as string[])
                } else if (data?.subflowId && disabledOutputsBySubflowId.has(data.subflowId)) {
                    set = disabledOutputsBySubflowId.get(data.subflowId)
                }
                if (set && set.size > 0) disabledByWrapper.set(n.id, set)
            }
        }
        if (disabledByWrapper.size === 0) return dim
        // Children index for BFS
        const bySource = new Map<string, typeof orderedEdges>()
        for (const e of orderedEdges) {
            const arr = bySource.get(e.source) || ([] as typeof orderedEdges)
            ;(arr as any).push(e)
            bySource.set(e.source, arr)
        }
        // Seed queue with direct children from disabled handles
        const queue: string[] = []
        for (const e of orderedEdges) {
            const set = disabledByWrapper.get(e.source)
            if (set && typeof e.sourceHandle === 'string' && set.has(e.sourceHandle)) {
                if (!dim.has(e.target)) {
                    dim.add(e.target)
                    queue.push(e.target)
                }
            }
        }
        // BFS to include entire downstream subgraph
        while (queue.length > 0) {
            const cur = queue.shift() as string
            const out = bySource.get(cur) || []
            for (const edge of out as any) {
                if (!dim.has(edge.target)) {
                    dim.add(edge.target)
                    queue.push(edge.target)
                }
            }
        }
        return dim
    }, [orderedEdges, nodes, disabledOutputsBySubflowId])

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
        setStorageScope,
        activeSubflowIdRef
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
        380,
        380,
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
        return sorted.map(node => {
            const shouldDim = dimmedChildNodeIds.has(node.id)
            return {
                ...node,
                data: {
                    ...node.data,
                    // UI-only dimming: don't mutate underlying state; just render with inactive styling
                    active: shouldDim ? false : node.data.active,
                    onUpdate: nodeUpdateCallbacks[node.id],
                    parallelStep: parallelAnalysis.stepByNodeId.get(node.id),
                },
            }
        })
    }, [nodesWithState, edges, nodeUpdateCallbacks, parallelAnalysis, dimmedChildNodeIds])

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

    // Install effect hooks
    useEditNode(onNodeUpdate)
    useRunFromHere(nodeResults, nodes, onResume, isPaused)
    useRunOnlyThis(edges, nodeResults, nodes, vscodeAPI, isPaused)
    useDuplicateSubflow(vscodeAPI)
    useOpenSubflow(
        nodesRef,
        edgesRef,
        activeSubflowIdRef,
        vscodeAPIRef,
        setViewStack,
        setActiveSubflowId
    )
    useProvideSubflow(
        vscodeAPI,
        requestFitOnNextRender,
        pendingSubflowRename,
        notify,
        computeDisabledOutputHandles,
        setDisabledOutputsBySubflowId,
        setNodes,
        setEdges,
        setSubflowMeta,
        subflowBaselineRef,
        setNodeResults,
        setPendingSubflowRename
    )
    useSubflowState(activeSubflowId, setNodes, setNodeResults)
    useSaveSubflow(nodes, vscodeAPI, notify, setNodes, setPendingSubflowRename)

    useEffect(() => {
        if (!pendingApprovalNodeId || !rightCollapsed) return
        const node = nodes.find(n => n.id === pendingApprovalNodeId)
        if (node && node.type === NodeType.CLI) {
            setRightCollapsed(false)
        }
    }, [pendingApprovalNodeId, rightCollapsed, nodes])

    // Listen for subflow library updates
    useEffect(() => {
        const handler = (e: any) => {
            const list = e?.detail as Array<{ id: string; title: string; version: string }>
            if (Array.isArray(list)) setSubflows(list)
        }
        window.addEventListener('nebula-subflows-provide' as any, handler as any)
        return () => window.removeEventListener('nebula-subflows-provide' as any, handler as any)
    }, [])

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
        // Clear backend subflow cache
        try {
            vscodeAPI.postMessage({ type: 'reset_results' } as any)
        } catch {}
    }, [])

    // Request subflow list on mount and when storage scope changes
    useEffect(() => {
        vscodeAPI.postMessage({ type: 'get_subflows' } as any)
    }, [vscodeAPI])
    useEffect(() => {
        if (storageScope) {
            vscodeAPI.postMessage({ type: 'get_subflows' } as any)
        }
    }, [storageScope, vscodeAPI])

    return (
        <div className="tw-flex tw-h-screen tw-w-full tw-border-2 tw-border-solid tw-border-[var(--vscode-panel-border)] tw-text-[14px] tw-overflow-hidden">
            <LeftSidebarContainer
                leftCollapsed={leftCollapsed}
                sidebarWidth={sidebarWidth}
                isExecuting={isExecuting}
                isPaused={isPaused}
                activeNode={activeNode}
                models={models}
                customNodes={customNodes}
                subflows={subflows}
                nodeErrors={nodeErrors}
                storageScope={storageScope?.scope || 'user'}
                isTogglingScope={isTogglingScope}
                vscodeAPI={vscodeAPI}
                setLeftCollapsed={setLeftCollapsed}
                onSave={onSave}
                onLoad={onLoad}
                onExecute={onExecute}
                resetExecutionState={resetExecutionState}
                onResetResults={onResetResults}
                onAbort={onAbort}
                onPauseToggle={onPauseToggle}
                onNodeAdd={onNodeAdd}
                onNodeUpdate={onNodeUpdate}
                onSaveCustomNode={onSaveCustomNode}
                onDeleteCustomNode={onDeleteCustomNode}
                onRenameCustomNode={onRenameCustomNode}
                handleMouseDown={handleMouseDown}
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
                        {/* Subflow Outputs editor (rename/reorder) */}
                        {activeSubflowId && subflowMeta && (
                            <SubflowOutputsEditor
                                activeSubflowId={activeSubflowId}
                                subflowMeta={subflowMeta}
                                nodes={nodes}
                                edges={edges}
                                vscodeAPI={vscodeAPI}
                                notify={notify}
                                computeDisabledOutputHandles={computeDisabledOutputHandles}
                                setSubflowMeta={setSubflowMeta}
                                setNodes={setNodes}
                                setDisabledOutputsBySubflowId={setDisabledOutputsBySubflowId}
                                subflowBaselineRef={subflowBaselineRef}
                            />
                        )}

                        {/* Quick actions overlay */}
                        <QuickActions
                            selectedNodes={selectedNodes}
                            nodes={nodes}
                            edges={edges}
                            computeDisabledOutputHandles={computeDisabledOutputHandles}
                            setNodes={setNodes}
                            setEdges={setEdges}
                            setSelectedNodes={setSelectedNodes}
                        />

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
                        <FlowCanvas
                            sortedNodes={sortedNodes}
                            visualEdges={visualEdges}
                            nodes={nodes}
                            edges={edges}
                            fitRequested={fitRequested}
                            isHelpOpen={isHelpOpen}
                            viewStack={viewStack}
                            activeSubflowId={activeSubflowId}
                            subflowMeta={subflowMeta}
                            subflowBaselineRef={subflowBaselineRef}
                            setFitRequested={setFitRequested}
                            setIsHelpOpen={setIsHelpOpen}
                            setViewStack={setViewStack}
                            setActiveSubflowId={setActiveSubflowId}
                            setNodes={setNodes}
                            setEdges={setEdges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onEdgesDelete={onEdgesDelete}
                            onConnect={onConnect}
                            onNodeClick={onNodeClick}
                            onNodeDragStart={onNodeDragStart}
                            isValidConnection={isValidConnection}
                            requestFitOnNextRender={requestFitOnNextRender}
                        />
                    </div>
                    <RightSidebarContainer
                        rightCollapsed={rightCollapsed}
                        rightSidebarWidth={rightSidebarWidth}
                        sortedNodes={sortedNodes}
                        nodeResults={nodeResults}
                        executingNodeIds={executingNodeIds}
                        pendingApprovalNodeId={pendingApprovalNodeId}
                        interruptedNodeId={interruptedNodeId}
                        stoppedAtNodeId={stoppedAtNodeId}
                        nodeAssistantContent={nodeAssistantContent}
                        executionRunId={executionRunId}
                        isPaused={isPaused}
                        selectionSummary={selectionSummary}
                        parallelSteps={parallelAnalysis.steps}
                        parallelStepByNodeId={parallelAnalysis.stepByNodeId}
                        branchByIfElseId={parallelAnalysis.branchByIfElseId}
                        nodes={nodes}
                        setRightCollapsed={setRightCollapsed}
                        handleNodeApproval={handleNodeApproval}
                        onRunFromHere={() => {}}
                        onResume={onResume}
                        handleResultUpdate={handleResultUpdate}
                        handleRightSidebarMouseDown={handleRightSidebarMouseDown}
                    />
                </div>
            </div>
        </div>
    )
}
