import {
    Background,
    ConnectionLineType,
    Controls,
    ReactFlow,
    SelectionMode,
    useReactFlow,
} from '@xyflow/react'
import { Menu } from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../services/Protocol'
import { Button } from '../ui/shadcn/ui/button'
import { toWorkflowNodeDTO } from '../utils/nodeDto'
import type { GenericVSCodeWrapper } from '../utils/vscode'
import { CustomOrderedEdgeComponent } from './CustomOrderedEdge'
import type { Edge } from './CustomOrderedEdge'
// styles moved to global index.css
import { HelpModal } from './HelpModal'
import { LeftSidebar } from './LeftSidebar'
import { NebulaSpinningLogo } from './NebulaSpinningLogo'
import { RightSidebar } from './RightSidebar'
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

// Event keys
const OPEN_SUBFLOW_EVT = 'nebula-open-subflow' as const
const PROVIDE_SUBFLOW_EVT = 'nebula-subflow-provide' as const

// Deep clone utility for graph snapshots (prefers structuredClone; falls back to JSON copy)
const deepClone = <T,>(value: T): T => {
    try {
        if (typeof structuredClone === 'function') {
            return structuredClone(value as any)
        }
    } catch {
        // ignore and fall back
    }
    return JSON.parse(JSON.stringify(value)) as T
}

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

const COLLAPSED_WIDTH = 36 // px

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
        // Clear backend subflow cache
        try {
            vscodeAPI.postMessage({ type: 'reset_results' } as any)
        } catch {}
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

    // Open subflow handler (stable, single registration)
    useEffect(() => {
        const openHandler = (e: any) => {
            const subflowId: string | undefined = e?.detail?.subflowId
            if (!subflowId) return
            // Idempotence: avoid stacking if already active
            if (activeSubflowIdRef.current === subflowId) return
            // Snapshot current view (deep clone to avoid shared nested object mutations)
            const nodesSnap = deepClone(nodesRef.current)
            const edgesSnap = deepClone(edgesRef.current)
            setViewStack(prev => [...prev, { nodes: nodesSnap, edges: edgesSnap }])
            setActiveSubflowId(subflowId)
            try {
                vscodeAPIRef.current.postMessage({
                    type: 'get_subflow',
                    data: { id: subflowId },
                } as any)
            } catch (err) {
                // Log so subflow fetch delivery failures are visible during development
                console.error('[Flow] Failed to request subflow from extension', err)
            }
        }
        window.addEventListener(OPEN_SUBFLOW_EVT as any, openHandler as any)
        return () => {
            window.removeEventListener(OPEN_SUBFLOW_EVT as any, openHandler as any)
        }
    }, [])

    // Provide subflow handler (kept as-is; registration may rebind)
    useEffect(() => {
        const provideHandler = (e: any) => {
            const def = e?.detail
            if (!def) return
            // If rename requested, update title and persist without opening
            if (pendingSubflowRename && def.id === pendingSubflowRename.id) {
                const renamed = { ...def, title: pendingSubflowRename.newTitle }
                vscodeAPI.postMessage({ type: 'create_subflow', data: renamed } as any)
                setPendingSubflowRename(null)
                notify({ type: 'success', text: 'Subflow renamed' })
                vscodeAPI.postMessage({ type: 'get_subflows' } as any)
                return
            }

            const dtoNodes = (def.graph?.nodes || []) as any[]
            const dtoEdges = (def.graph?.edges || []) as any[]

            // Cache disabled outputs for this subflow id (for top-level visual dimming)
            try {
                const disabled = computeDisabledOutputHandles(dtoNodes as any, dtoEdges as any)
                setDisabledOutputsBySubflowId(prev => {
                    const next = new Map(prev)
                    next.set(def.id, disabled)
                    return next
                })
            } catch {}

            const uiNodes = dtoNodes.map(n => {
                const baseData = {
                    title: '',
                    content: '',
                    active: true,
                    ...n.data,
                }
                // Enable fan-in for common types to ensure handles render
                const fanInTypes = new Set([
                    NodeType.CLI,
                    NodeType.LLM,
                    NodeType.PREVIEW,
                    NodeType.ACCUMULATOR,
                    NodeType.INPUT,
                ])
                if (fanInTypes.has(n.type as NodeType)) {
                    ;(baseData as any).fanInEnabled = true
                }
                return {
                    id: n.id,
                    type: n.type as NodeType,
                    data: baseData,
                    position: n.position,
                    selected: n.selected,
                } as any
            })
            const uiEdges = dtoEdges.map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle,
                targetHandle: e.targetHandle,
            })) as any

            // Capture subflow meta for simple ports editor (rename/reorder outputs)
            try {
                const outs = Array.isArray(def.outputs)
                    ? [...def.outputs].sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0))
                    : []
                const ins = Array.isArray(def.inputs)
                    ? [...def.inputs].sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0))
                    : []
                setSubflowMeta({
                    id: def.id,
                    title: def.title,
                    version: def.version,
                    inputs: ins,
                    outputs: outs,
                })
            } catch {}

            setNodes(uiNodes as any)
            setEdges(uiEdges as any)
            // Establish baseline for dirty-check
            try {
                const nodeDTOs = (uiNodes as any[]).map(n => toWorkflowNodeDTO(n))
                nodeDTOs.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)))
                const edgeDTOs = (uiEdges as any[]).map(e => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    sourceHandle: (e as any).sourceHandle,
                    targetHandle: (e as any).targetHandle,
                }))
                edgeDTOs.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)))
                const outs = Array.isArray(def.outputs)
                    ? [...def.outputs].sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0))
                    : []
                const outputsSig = JSON.stringify(
                    outs.map((o: any) => ({ id: o.id, name: o.name, index: o.index }))
                )
                subflowBaselineRef.current = {
                    nodes: JSON.stringify(nodeDTOs),
                    edges: JSON.stringify(edgeDTOs),
                    outputs: outputsSig,
                }
            } catch {}
            requestFitOnNextRender()

            // Hydrate RightSidebar results from subflow node data (result/output) for immediate visibility
            try {
                const initialResults = new Map<string, string>()
                for (const n of uiNodes as any[]) {
                    const r =
                        (n?.data?.result as string | undefined) ??
                        (n?.data?.output as string | undefined)
                    if (typeof r === 'string' && r.length > 0) {
                        initialResults.set(n.id, r)
                    }
                }
                setNodeResults(prev => new Map([...prev, ...initialResults]))
            } catch {}
        }
        window.addEventListener(PROVIDE_SUBFLOW_EVT as any, provideHandler as any)
        return () => {
            window.removeEventListener(PROVIDE_SUBFLOW_EVT as any, provideHandler as any)
        }
    }, [vscodeAPI, requestFitOnNextRender, pendingSubflowRename, notify, computeDisabledOutputHandles])
    // Listen for subflow library updates
    useEffect(() => {
        const handler = (e: any) => {
            const list = e?.detail as Array<{ id: string; title: string; version: string }>
            if (Array.isArray(list)) setSubflows(list)
        }
        window.addEventListener('nebula-subflows-provide' as any, handler as any)
        return () => window.removeEventListener('nebula-subflows-provide' as any, handler as any)
    }, [])

    // Merge in-memory subflow outputs into active subflow view
    useEffect(() => {
        const handler = (e: any) => {
            const info = (e?.detail || {}) as { id?: string; outputs?: Record<string, string> }
            if (!info?.id || !info.outputs) return
            if (activeSubflowId && info.id === activeSubflowId) {
                const outputs = info.outputs
                setNodes(prev =>
                    prev.map(n =>
                        outputs[n.id]
                            ? ({
                                  ...n,
                                  data: { ...n.data, output: outputs[n.id] },
                              } as any)
                            : n
                    )
                )
                setNodeResults(prev => {
                    const next = new Map(prev)
                    for (const [k, v] of Object.entries(outputs)) next.set(k, v)
                    return next
                })
            }
        }
        window.addEventListener('nebula-subflow-state' as any, handler as any)
        return () => window.removeEventListener('nebula-subflow-state' as any, handler as any)
    }, [activeSubflowId])

    // Forward duplicate requests from node UI to extension
    useEffect(() => {
        const handler = (e: any) => {
            const id: string | undefined = e?.detail?.id
            const nodeId: string | undefined = e?.detail?.nodeId
            if (id && nodeId) {
                vscodeAPI.postMessage({ type: 'duplicate_subflow', data: { id, nodeId } } as any)
            }
        }
        window.addEventListener('nebula-duplicate-subflow' as any, handler as any)
        return () => window.removeEventListener('nebula-duplicate-subflow' as any, handler as any)
    }, [vscodeAPI])

    // Save-unsaved subflow request from PropertyEditor
    useEffect(() => {
        const handler = (e: any) => {
            const nodeId: string | undefined = e?.detail?.nodeId
            if (!nodeId) return
            const node = nodes.find(n => n.id === nodeId)
            if (!node || node.type !== NodeType.SUBFLOW) return
            const data: any = node.data
            const pending = data?.pendingSubflow

            // Case A: pending subflow (unsaved) -> save new definition
            if (pending) {
                const id = uuidv4()
                const def = {
                    id,
                    title: (data?.title as string) || 'Subflow',
                    version: '1.0.0',
                    inputs: pending.inputs.map((p: any, i: number) => ({
                        id: p.id,
                        name: p.name,
                        index: i,
                    })),
                    outputs: pending.outputs.map((p: any, i: number) => ({
                        id: `out-${i}`,
                        name: p.name,
                        index: i,
                    })),
                    graph: { nodes: pending.graph.nodes, edges: pending.graph.edges },
                }
                vscodeAPI.postMessage({ type: 'create_subflow', data: def } as any)
                // Update wrapper to link saved def
                setNodes(prev =>
                    prev.map(n =>
                        n.id === nodeId
                            ? ({
                                  ...n,
                                  data: {
                                      ...(n as any).data,
                                      subflowId: id,
                                      outputPortCount:
                                          pending.outputs.length || (n as any).data.outputPortCount,
                                      pendingSubflow: undefined,
                                  },
                              } as any)
                            : n
                    )
                )
                notify({ type: 'success', text: 'Subflow saved' })
                vscodeAPI.postMessage({ type: 'get_subflows' } as any)
                return
            }

            // Case B: existing subflow -> rename definition title in-place
            const subflowId: string | undefined = data?.subflowId
            if (subflowId) {
                setPendingSubflowRename({ id: subflowId, newTitle: data?.title || 'Subflow' })
                vscodeAPI.postMessage({ type: 'get_subflow', data: { id: subflowId } } as any)
                return
            }
        }
        window.addEventListener('nebula-save-subflow' as any, handler as any)
        return () => window.removeEventListener('nebula-save-subflow' as any, handler as any)
    }, [nodes, vscodeAPI, notify])

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
            <div
                id="left-sidebar-panel"
                style={{ width: (leftCollapsed ? COLLAPSED_WIDTH : sidebarWidth) + 'px' }}
                className="tw-flex-shrink-0 tw-bg-[var(--vscode-sideBar-background)] tw-h-full tw-flex tw-flex-col"
            >
                {leftCollapsed ? (
                    <div className="tw-border-b tw-border-border tw-bg-sidebar-background tw-px-2 tw-py-2 tw-flex tw-justify-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLeftCollapsed(false)}
                            aria-label="Expand Left Sidebar"
                            title="Expand Left Sidebar"
                            aria-expanded={false}
                            aria-controls="left-sidebar-panel"
                            className="tw-h-8 tw-w-8 tw-p-0"
                        >
                            <Menu size={18} />
                        </Button>
                    </div>
                ) : (
                    <LeftSidebar
                        onToggleCollapse={() => setLeftCollapsed(true)}
                        onSave={onSave}
                        onLoad={onLoad}
                        onExecute={onExecute}
                        onClear={resetExecutionState}
                        onReset={onResetResults}
                        isExecuting={isExecuting}
                        isPaused={isPaused}
                        onAbort={onAbort}
                        onPauseToggle={onPauseToggle}
                        onNodeAdd={onNodeAdd}
                        selectedNode={activeNode}
                        onNodeUpdate={onNodeUpdate}
                        models={models}
                        onSaveCustomNode={onSaveCustomNode}
                        onDeleteCustomNode={onDeleteCustomNode}
                        onRenameCustomNode={onRenameCustomNode}
                        customNodes={customNodes}
                        subflows={subflows}
                        nodeErrors={nodeErrors}
                        storageScope={storageScope?.scope || 'user'}
                        isTogglingScope={isTogglingScope}
                        onToggleStorageScope={() => {
                            setIsTogglingScope(true)
                            vscodeAPI.postMessage({ type: 'toggle_storage_scope' } as any)
                        }}
                    />
                )}
            </div>
            <div
                style={{ width: HANDLE_THICKNESS }}
                className="hover:tw-bg-[var(--vscode-textLink-activeForeground)] tw-bg-[var(--vscode-panel-border)] tw-cursor-ew-resize tw-select-none"
                onMouseDown={handleMouseDown}
            />
            <div className="tw-flex-1 tw-bg-[var(--vscode-editor-background)] tw-shadow-inner tw-h-full tw-overflow-hidden">
                <div className="tw-flex tw-flex-1 tw-h-full">
                    <div
                        ref={centerRef}
                        className="tw-relative tw-flex-1 tw-bg-[var(--vscode-editor-background)] tw-h-full tw-min-w-0"
                        onClick={handleBackgroundClick}
                        onKeyDown={handleBackgroundKeyDown}
                        role="button"
                        tabIndex={0}
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
                            <div className="tw-absolute tw-top-4 tw-left-4 tw-z-50 tw-bg-[var(--vscode-editor-background)] tw-border tw-border-[var(--vscode-panel-border)] tw-rounded tw-p-2 tw-shadow-md tw-min-w-[260px]">
                                <div className="tw-text-xs tw-font-semibold tw-mb-1">
                                    Subflow Outputs
                                </div>
                                <div className="tw-flex tw-flex-col tw-gap-1">
                                    {subflowMeta.outputs.map((o, idx) => (
                                        <div key={o.id} className="tw-flex tw-items-center tw-gap-1">
                                            <input
                                                className="tw-flex-1 tw-text-xs tw-bg-[var(--vscode-input-background)] tw-text-[var(--vscode-input-foreground)] tw-border tw-border-[var(--vscode-panel-border)] tw-rounded tw-px-1 tw-py-[2px]"
                                                value={o.name}
                                                onChange={e => {
                                                    const name = e.target.value
                                                    setSubflowMeta(meta =>
                                                        meta
                                                            ? {
                                                                  ...meta,
                                                                  outputs: meta.outputs.map((x, i) =>
                                                                      i === idx ? { ...x, name } : x
                                                                  ),
                                                              }
                                                            : meta
                                                    )
                                                }}
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSubflowMeta(meta => {
                                                        if (!meta || idx <= 0) return meta
                                                        const arr = [...meta.outputs]
                                                        const tmp = arr[idx - 1]
                                                        arr[idx - 1] = arr[idx]
                                                        arr[idx] = tmp
                                                        return { ...meta, outputs: arr }
                                                    })
                                                }}
                                                title="Move up"
                                            >
                                                ↑
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSubflowMeta(meta => {
                                                        if (!meta || idx >= meta.outputs.length - 1)
                                                            return meta
                                                        const arr = [...meta.outputs]
                                                        const tmp = arr[idx + 1]
                                                        arr[idx + 1] = arr[idx]
                                                        arr[idx] = tmp
                                                        return { ...meta, outputs: arr }
                                                    })
                                                }}
                                                title="Move down"
                                            >
                                                ↓
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <div className="tw-flex tw-justify-end tw-gap-2 tw-mt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            // Cancel edits: refetch current def
                                            if (activeSubflowId) {
                                                vscodeAPI.postMessage({
                                                    type: 'get_subflow',
                                                    data: { id: activeSubflowId },
                                                } as any)
                                            }
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            if (!activeSubflowId || !subflowMeta) return
                                            // Build mapping oldId -> newId by new order
                                            const newOutputs = subflowMeta.outputs.map((o, i) => ({
                                                id: `out-${i}`,
                                                name: o.name,
                                                index: i,
                                            }))
                                            const mapOldToNew = new Map(
                                                subflowMeta.outputs.map((o, i) => [o.id, `out-${i}`])
                                            )
                                            // Update SUBFLOW_OUTPUT nodes' portId and title
                                            const nameByPid = new Map(
                                                newOutputs.map(o => [o.id, o.name])
                                            )
                                            const updatedNodes = nodes.map(n => {
                                                if (n.type === NodeType.SUBFLOW_OUTPUT) {
                                                    const oldPid = (n as any).data?.portId as
                                                        | string
                                                        | undefined
                                                    const newPid = oldPid
                                                        ? mapOldToNew.get(oldPid) ?? oldPid
                                                        : oldPid
                                                    const newTitle =
                                                        (newPid && nameByPid.get(newPid)) ||
                                                        (n as any).data?.title
                                                    return {
                                                        ...n,
                                                        data: {
                                                            ...n.data,
                                                            portId: newPid,
                                                            title: newTitle,
                                                        },
                                                    } as any
                                                }
                                                return n
                                            })
                                            setNodes(updatedNodes)
                                            // Prepare def
                                            const innerNodeDTOs = (updatedNodes as any[]).map(n =>
                                                toWorkflowNodeDTO(n)
                                            )
                                            const innerEdgeDTOs = (edges as any[]).map(e => ({
                                                id: e.id,
                                                source: e.source,
                                                target: e.target,
                                                sourceHandle: (e as any).sourceHandle,
                                                targetHandle: (e as any).targetHandle,
                                            }))
                                            const def = {
                                                id: subflowMeta.id,
                                                title: subflowMeta.title,
                                                version: subflowMeta.version,
                                                inputs: subflowMeta.inputs.map((p, i) => ({
                                                    id: p.id,
                                                    name: p.name,
                                                    index: i,
                                                })),
                                                outputs: newOutputs,
                                                graph: { nodes: innerNodeDTOs, edges: innerEdgeDTOs },
                                            }
                                            // Cache disabled outputs for this subflow id
                                            try {
                                                const disabled = computeDisabledOutputHandles(
                                                    innerNodeDTOs as any,
                                                    innerEdgeDTOs as any
                                                )
                                                setDisabledOutputsBySubflowId(prev => {
                                                    const next = new Map(prev)
                                                    next.set(def.id, disabled)
                                                    return next
                                                })
                                            } catch {}
                                            vscodeAPI.postMessage({
                                                type: 'create_subflow',
                                                data: def,
                                            } as any)
                                            notify({ type: 'success', text: 'Subflow saved' })
                                            // Update baseline after save to avoid false dirty prompt
                                            try {
                                                const sortedNodes = [...innerNodeDTOs].sort(
                                                    (a: any, b: any) =>
                                                        String(a.id).localeCompare(String(b.id))
                                                )
                                                const sortedEdges = [...innerEdgeDTOs].sort(
                                                    (a: any, b: any) =>
                                                        String(a.id).localeCompare(String(b.id))
                                                )
                                                subflowBaselineRef.current = {
                                                    nodes: JSON.stringify(sortedNodes),
                                                    edges: JSON.stringify(sortedEdges),
                                                    outputs: JSON.stringify(
                                                        newOutputs.map(o => ({
                                                            id: o.id,
                                                            name: o.name,
                                                            index: o.index,
                                                        }))
                                                    ),
                                                }
                                            } catch {}
                                        }}
                                    >
                                        Save
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Quick actions overlay */}
                        {selectedNodes.length > 1 && (
                            <div className="tw-absolute tw-top-4 tw-left-4 tw-z-50">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        // Create subflow from current selection
                                        const selectedIds = new Set(selectedNodes.map(n => n.id))
                                        const incoming = edges.filter(
                                            e => !selectedIds.has(e.source) && selectedIds.has(e.target)
                                        )
                                        const outgoing = edges.filter(
                                            e => selectedIds.has(e.source) && !selectedIds.has(e.target)
                                        )

                                        // Inputs mapping (multi-input): one input per unique external source feeding the selection
                                        const groupedBySource = new Map<string, typeof incoming>()
                                        for (const e of incoming) {
                                            const arr = groupedBySource.get(e.source) || []
                                            arr.push(e)
                                            groupedBySource.set(e.source, arr)
                                        }
                                        const inputSourcesWithPos = Array.from(groupedBySource.keys())
                                            .map(sourceId => ({
                                                sourceId,
                                                node: nodes.find(n => n.id === sourceId),
                                                targets: Array.from(
                                                    new Set(
                                                        (groupedBySource.get(sourceId) || []).map(
                                                            ed => ed.target
                                                        )
                                                    )
                                                ),
                                            }))
                                            .sort(
                                                (a, b) =>
                                                    (a.node?.position.x ?? 0) -
                                                        (b.node?.position.x ?? 0) ||
                                                    (a.node?.position.y ?? 0) -
                                                        (b.node?.position.y ?? 0) ||
                                                    a.sourceId.localeCompare(b.sourceId)
                                            )
                                        const inputs = inputSourcesWithPos.map((s, idx) => ({
                                            id: `in-${idx}`,
                                            name: s.node?.data?.title
                                                ? String(s.node.data.title)
                                                : `Input ${idx + 1}`,
                                            index: idx,
                                            sourceId: s.sourceId,
                                            targets: s.targets,
                                        }))

                                        // Build inner graph nodes (clone)
                                        const innerNodes = selectedNodes.map(n => ({ ...n })) as any
                                        const innerEdges = edges
                                            .filter(
                                                e =>
                                                    selectedIds.has(e.source) &&
                                                    selectedIds.has(e.target)
                                            )
                                            .map(e => ({ ...e })) as any

                                        // Replace incoming edges by SubflowInput nodes (fan-out to all targets for that source)
                                        for (const inp of inputs) {
                                            const inputNodeId = `sfi-${uuidv4()}`
                                            innerNodes.push({
                                                id: inputNodeId,
                                                type: NodeType.SUBFLOW_INPUT,
                                                data: {
                                                    title: inp.name,
                                                    content: '',
                                                    active: true,
                                                    portId: inp.id,
                                                },
                                                position: { x: 0, y: 0 },
                                            } as any)
                                            for (const targetNodeId of inp.targets) {
                                                innerEdges.push({
                                                    id: uuidv4(),
                                                    source: inputNodeId,
                                                    target: targetNodeId,
                                                } as any)
                                            }
                                        }

                                        // Outputs mapping (MVP Phase 1): computed below for a single output from a representative source

                                        // Outputs mapping (multi-output): one output per unique inner source with exit edges
                                        const uniqueSourceIds = Array.from(
                                            new Set(outgoing.map(e => e.source))
                                        )
                                        const sourcesWithPos = uniqueSourceIds
                                            .map(id => ({
                                                id,
                                                node: selectedNodes.find(n => n.id === id),
                                            }))
                                            .sort(
                                                (a, b) =>
                                                    (a.node?.position.x ?? 0) -
                                                        (b.node?.position.x ?? 0) ||
                                                    (a.node?.position.y ?? 0) -
                                                        (b.node?.position.y ?? 0) ||
                                                    a.id.localeCompare(b.id)
                                            )
                                        const outputDefs: Array<{
                                            id: string
                                            name: string
                                            index: number
                                        }> = []
                                        const sourceIndexById = new Map<string, number>()
                                        if (sourcesWithPos.length === 0) {
                                            // Fallback: single output from a representative inner source
                                            let repSource: string | null = null
                                            if (outgoing.length > 0) repSource = outgoing[0].source
                                            if (!repSource) {
                                                const selIds = new Set(selectedNodes.map(n => n.id))
                                                const hasOut = new Set(
                                                    edges
                                                        .filter(
                                                            e =>
                                                                selIds.has(e.source) &&
                                                                selIds.has(e.target)
                                                        )
                                                        .map(e => e.source)
                                                )
                                                const candidate = selectedNodes.find(
                                                    n => !hasOut.has(n.id)
                                                )
                                                repSource = candidate?.id || selectedNodes[0].id
                                            }
                                            const sfoId = `sfo-${uuidv4()}`
                                            innerNodes.push({
                                                id: sfoId,
                                                type: NodeType.SUBFLOW_OUTPUT,
                                                data: {
                                                    title: 'Output 1',
                                                    content: '',
                                                    active: true,
                                                    portId: 'out-0',
                                                },
                                                position: { x: 0, y: 100 },
                                            } as any)
                                            if (repSource) {
                                                innerEdges.push({
                                                    id: `${repSource}-${sfoId}`,
                                                    source: repSource,
                                                    target: sfoId,
                                                } as any)
                                                sourceIndexById.set(repSource, 0)
                                            }
                                            outputDefs.push({ id: 'out-0', name: 'Output 1', index: 0 })
                                        } else {
                                            sourcesWithPos.forEach((s, idx) => {
                                                const outId = `out-${idx}`
                                                // Base title from inner source node
                                                let title = s.node?.data?.title
                                                    ? String(s.node.data.title)
                                                    : `Output ${idx + 1}`
                                                // If exactly one downstream target outside selection, prefer its title
                                                const outsFromSource = outgoing
                                                    .filter(e => e.source === s.id)
                                                    .map(e => e.target)
                                                const uniqueTargets = Array.from(new Set(outsFromSource))
                                                if (uniqueTargets.length === 1) {
                                                    const dn = nodes.find(n => n.id === uniqueTargets[0])
                                                    const dnTitle = dn?.data?.title
                                                        ? String(dn.data.title)
                                                        : ''
                                                    if (dnTitle.trim().length > 0) title = dnTitle
                                                }
                                                const sfoId = `sfo-${uuidv4()}`
                                                innerNodes.push({
                                                    id: sfoId,
                                                    type: NodeType.SUBFLOW_OUTPUT,
                                                    data: {
                                                        title,
                                                        content: '',
                                                        active: true,
                                                        portId: outId,
                                                    },
                                                    position: {
                                                        x: s.node?.position.x ?? idx * 200,
                                                        y: (s.node?.position.y ?? 100) + 120,
                                                    },
                                                } as any)
                                                innerEdges.push({
                                                    id: `${s.id}-${sfoId}`,
                                                    source: s.id,
                                                    target: sfoId,
                                                } as any)
                                                outputDefs.push({ id: outId, name: title, index: idx })
                                                sourceIndexById.set(s.id, idx)
                                            })
                                        }

                                        const innerNodeDTOs = (innerNodes as any[]).map(n =>
                                            toWorkflowNodeDTO(n)
                                        )
                                        const innerEdgeDTOs = (innerEdges as any[]).map(e => ({
                                            id: e.id,
                                            source: e.source,
                                            target: e.target,
                                            sourceHandle: (e as any).sourceHandle,
                                            targetHandle: (e as any).targetHandle,
                                        }))

                                        // Determine disabled outputs from current inner graph
                                        const disabledOutHandles = Array.from(
                                            computeDisabledOutputHandles(
                                                innerNodeDTOs as any,
                                                innerEdgeDTOs as any
                                            )
                                        )

                                        // Build pending (unsaved) subflow payload
                                        const pending = {
                                            inputs: inputs.map(({ id, name }, idx) => ({
                                                id,
                                                name,
                                                index: idx,
                                            })),
                                            outputs:
                                                outputDefs.length > 0
                                                    ? outputDefs
                                                    : [{ id: 'out-0', name: 'Output', index: 0 }],
                                            graph: { nodes: innerNodeDTOs, edges: innerEdgeDTOs },
                                        }

                                        // Replace selection with wrapper node and rewire edges
                                        const center = {
                                            x:
                                                selectedNodes.reduce((a, n) => a + n.position.x, 0) /
                                                selectedNodes.length,
                                            y:
                                                selectedNodes.reduce((a, n) => a + n.position.y, 0) /
                                                selectedNodes.length,
                                        }
                                        const wrapperId = uuidv4()
                                        const wrapper = {
                                            id: wrapperId,
                                            type: NodeType.SUBFLOW,
                                            data: {
                                                title: 'Subflow',
                                                content: '',
                                                active: true,
                                                // subflowId is undefined until saved
                                                inputPortCount: inputs.length,
                                                outputPortCount: pending.outputs.length || 1,
                                                pendingSubflow: pending,
                                                disabledOutputHandles: disabledOutHandles,
                                            },
                                            position: center,
                                        } as any

                                        const removedIds = new Set(selectedNodes.map(n => n.id))
                                        const nextNodes = nodes.filter(n => !removedIds.has(n.id))
                                        nextNodes.push(wrapper)

                                        // Remove internal edges and cross-boundary edges
                                        const internalEdgeIds = new Set(
                                            edges
                                                .filter(
                                                    e =>
                                                        removedIds.has(e.source) &&
                                                        removedIds.has(e.target)
                                                )
                                                .map(e => e.id)
                                        )
                                        const incomingEdges = edges.filter(
                                            e => !removedIds.has(e.source) && removedIds.has(e.target)
                                        )
                                        const outgoingEdges = edges.filter(
                                            e => removedIds.has(e.source) && !removedIds.has(e.target)
                                        )
                                        const nextEdges = edges.filter(
                                            e =>
                                                !internalEdgeIds.has(e.id) &&
                                                !incomingEdges.includes(e) &&
                                                !outgoingEdges.includes(e)
                                        )

                                        // Rewire incoming -> wrapper
                                        for (let idx = 0; idx < inputs.length; idx++) {
                                            const inp = inputs[idx]
                                            nextEdges.push({
                                                id: uuidv4(),
                                                source: inp.sourceId,
                                                target: wrapperId,
                                                targetHandle: `in-${idx}`,
                                            } as any)
                                        }
                                        // Rewire outgoing from wrapper with per-source handle
                                        outgoingEdges.forEach((e, idx) => {
                                            const outIdx = sourceIndexById.get(e.source) ?? 0
                                            nextEdges.push({
                                                id: uuidv4(),
                                                source: wrapperId,
                                                target: e.target,
                                                sourceHandle: `out-${outIdx}`,
                                            } as any)
                                        })
                                        setNodes(nextNodes)
                                        setEdges(nextEdges)
                                        setSelectedNodes([wrapper as any])
                                    }}
                                >
                                    Create Subflow from Selection
                                </Button>
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
                                edges={visualEdges}
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
                                    {viewStack.length > 0 && (
                                        <button
                                            type="button"
                                            className="react-flow__controls-button"
                                            onClick={() => {
                                                // Confirm before discarding unsaved subflow edits
                                                try {
                                                    if (activeSubflowId) {
                                                        const nodeDTOs = (nodes as any[]).map(n =>
                                                            toWorkflowNodeDTO(n)
                                                        )
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
                                                        const outputs = Array.isArray(
                                                            subflowMeta?.outputs
                                                        )
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
                    </div>
                    <div
                        style={{ width: HANDLE_THICKNESS }}
                        className="hover:tw-bg-[var(--vscode-textLink-activeForeground)] tw-bg-[var(--vscode-panel-border)] tw-cursor-ew-resize tw-select-none"
                        onMouseDown={handleRightSidebarMouseDown}
                    />
                    <div
                        id="right-sidebar-panel"
                        style={{ width: (rightCollapsed ? COLLAPSED_WIDTH : rightSidebarWidth) + 'px' }}
                        className="tw-flex-shrink-0 tw-border-r tw-border-solid tw-border-[var(--vscode-panel-border)] tw-bg-[var(--vscode-sideBar-background)] tw-h-full tw-overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => e.stopPropagation()}
                    >
                        {rightCollapsed ? (
                            <div className="tw-border-b tw-border-border tw-bg-sidebar-background tw-px-2 tw-py-2 tw-flex tw-justify-center">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setRightCollapsed(false)}
                                    aria-label="Expand Right Sidebar"
                                    title="Expand Right Sidebar"
                                    aria-expanded={false}
                                    aria-controls="right-sidebar-panel"
                                    className="tw-h-8 tw-w-8 tw-p-0"
                                >
                                    <Menu size={18} />
                                </Button>
                            </div>
                        ) : (
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
                                onToggleCollapse={() => setRightCollapsed(true)}
                                onResultUpdate={handleResultUpdate}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
