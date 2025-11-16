import type { Edge } from '@graph/CustomOrderedEdge'
import { NodeType, type WorkflowNodes } from '@nodes/Nodes'
import { useCallback, useEffect, useRef } from 'react'
import type {
    ExtensionToWorkflow,
    WorkflowPayloadDTO,
    WorkflowToExtension,
} from '../../services/Protocol'
import type { GenericVSCodeWrapper } from '../../utils/vscode'

const getDownstreamPreviewNodes = (
    completedNodeId: string,
    edges: Edge[],
    nodes: WorkflowNodes[]
): Array<{ id: string; parentEdges: Edge[] }> => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const result: Array<{ id: string; parentEdges: Edge[] }> = []

    // Find all edges where the completed node is the source
    const parentEdges = edges.filter(e => e.source === completedNodeId)

    // For each edge target, check if it's a Preview node
    for (const edge of parentEdges) {
        const targetNode = nodeMap.get(edge.target)
        if (targetNode?.type === NodeType.PREVIEW) {
            let preview = result.find(p => p.id === edge.target)
            if (!preview) {
                // Aggregate ALL incoming edges to the preview, not just from completed node
                const allIncomingEdges = edges.filter(e => e.target === edge.target)
                preview = { id: edge.target, parentEdges: allIncomingEdges }
                result.push(preview)
            }
        }
    }

    return result
}

const computePreviewContent = (
    previewNode: WorkflowNodes,
    parentEdges: Edge[],
    nodeResults: Map<string, string>,
    edgeOrderMap: Map<string, number>,
    nodeMultiResults: Map<string, string[]>
): string => {
    // Sort edges to this preview by their order (source order at the preview target)
    const sortedEdges = [...parentEdges].sort((a, b) => {
        const aOrder = edgeOrderMap.get(a.id) ?? 0
        const bOrder = edgeOrderMap.get(b.id) ?? 0
        return aOrder - bOrder
    })

    // Concatenate parent outputs in order
    const contents: string[] = []
    for (const edge of sortedEdges) {
        const parentId = edge.source
        const handle = edge.sourceHandle
        const multi = nodeMultiResults.get(parentId)
        if (Array.isArray(multi) && typeof handle === 'string' && handle.startsWith('out-')) {
            const idx = Number.parseInt(handle.slice(4), 10)
            if (Number.isFinite(idx) && idx >= 0 && idx < multi.length) {
                contents.push(multi[idx])
                continue
            }
        }
        const parentOutput = nodeResults.get(parentId)
        if (parentOutput) {
            contents.push(parentOutput)
        }
    }

    return contents.join('\n')
}

// Migration: normalize old workflows to dynamic fan-in inputs.
function migrateToFanIn(
    nodes: WorkflowNodes[],
    edges: Edge[]
): { nodes: WorkflowNodes[]; edges: Edge[] } {
    const fanInTypes = new Set<NodeType>([
        NodeType.CLI,
        NodeType.LLM,
        NodeType.PREVIEW,
        NodeType.ACCUMULATOR,
        NodeType.INPUT,
    ])

    // Enable fan-in on supported node types (idempotent)
    const nodeById = new Map(nodes.map(n => [n.id, n]))
    const migratedNodes = nodes.map(n => {
        if (fanInTypes.has(n.type)) {
            const data: any = { ...n.data, fanInEnabled: true }
            return { ...n, data }
        }
        return n
    })

    // Group edges by target
    const byTarget = new Map<string, number[]>() // store indices into edges
    edges.forEach((e, idx) => {
        const arr = byTarget.get(e.target) || []
        arr.push(idx)
        byTarget.set(e.target, arr)
    })

    const migratedEdges = edges.map(e => ({ ...e }))

    for (const [targetId, idxs] of byTarget) {
        const targetNode = nodeById.get(targetId)
        if (!targetNode || !fanInTypes.has(targetNode.type)) continue

        // Assign sequential handles (in-0, in-1, ...) in the order they appear
        // This fixes: missing handles, duplicates, or legacy single-port graphs.
        idxs.forEach((edgeIdx, i) => {
            const edge = migratedEdges[edgeIdx] as any
            edge.targetHandle = `in-${i}`
        })
    }

    return { nodes: migratedNodes, edges: migratedEdges }
}

export const useMessageHandler = (
    nodes: WorkflowNodes[],
    setNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>,
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
    setNodeErrors: React.Dispatch<React.SetStateAction<Map<string, string>>>,
    setNodeResults: React.Dispatch<React.SetStateAction<Map<string, string>>>,
    setInterruptedNodeId: React.Dispatch<React.SetStateAction<string | null>>,
    setStoppedAtNodeId: React.Dispatch<React.SetStateAction<string | null>>,
    setExecutingNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>,
    setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>,
    onNodeUpdate: (nodeId: string, data: Partial<WorkflowNodes['data']>) => void,
    calculatePreviewNodeTokens: (nodes: WorkflowNodes[]) => void,
    setPendingApprovalNodeId: React.Dispatch<React.SetStateAction<string | null>>,
    setModels: React.Dispatch<React.SetStateAction<{ id: string; title?: string }[]>>,
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>,
    setCustomNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>,
    setNodeAssistantContent: React.Dispatch<React.SetStateAction<Map<string, any[]>>>,
    setIfElseDecisions: React.Dispatch<React.SetStateAction<Map<string, 'true' | 'false'>>>,
    notify: (p: { type: 'success' | 'error'; text: string }) => void,
    edges: Edge[],
    orderedEdges: Edge[],
    nodeResults: Map<string, string>,
    setIsPaused?: React.Dispatch<React.SetStateAction<boolean>>,
    requestFitOnNextRender: () => void = () => {},
    setCompletedThisRun?: React.Dispatch<React.SetStateAction<Set<string>>>,
    setStorageScope?: React.Dispatch<
        React.SetStateAction<{ scope: 'workspace' | 'user'; basePath?: string } | null>
    >,
    activeSubflowIdRef?: React.MutableRefObject<string | null>,
    onClipboardPaste?: (payload: WorkflowPayloadDTO) => void
) => {
    const lastExecutedNodeIdRef = useRef<string | null>(null)
    const hasRequestedLastWorkflowRef = useRef(false)
    const batchUpdateNodeResults = useCallback(
        (updates: Map<string, string>) => {
            setNodeResults(prev => new Map([...prev, ...updates]))
        },
        [setNodeResults]
    )

    // Track multi-output results (e.g., subflow outputs by index) without causing extra renders
    const nodeMultiResultsRef = useRef<Map<string, string[]>>(new Map())

    const applyNodeExecutionStatus = (
        nodeId: string,
        status: 'running' | 'completed' | 'error' | 'interrupted' | 'pending_approval',
        result?: string,
        multi?: string[]
    ) => {
        if (nodeId && status) {
            if (status === 'interrupted') {
                setInterruptedNodeId(nodeId)
                setExecutingNodeIds(prev => {
                    const next = new Set(prev)
                    next.delete(nodeId)
                    return next
                })
            }
            if (status === 'pending_approval') {
                setPendingApprovalNodeId(nodeId)
            } else if (status === 'running') {
                setExecutingNodeIds(prev => {
                    const next = new Set(prev)
                    next.add(nodeId)
                    return next
                })
                setNodeErrors(prev => {
                    const updated = new Map(prev)
                    updated.delete(nodeId)
                    return updated
                })
            } else if (status === 'error') {
                setExecutingNodeIds(prev => {
                    const next = new Set(prev)
                    next.delete(nodeId)
                    return next
                })
                setNodeErrors(prev => new Map(prev).set(nodeId, result ?? ''))
            } else if (status === 'completed') {
                lastExecutedNodeIdRef.current = nodeId
                setExecutingNodeIds(prev => {
                    const next = new Set(prev)
                    next.delete(nodeId)
                    return next
                })
                // Mark node as completed in this run for precise resume seeding
                setCompletedThisRun?.(prev => {
                    const next = new Set(prev)
                    next.add(nodeId)
                    return next
                })
                const node = nodes.find(n => n.id === nodeId)
                // Capture If/Else decisions for resume
                if (node?.type === NodeType.IF_ELSE) {
                    const decision = result?.trim().toLowerCase() === 'true' ? 'true' : 'false'
                    setIfElseDecisions(prev => new Map(prev).set(nodeId, decision))
                }
                // Track multi-output results for this node (if provided)
                if (Array.isArray(multi)) {
                    nodeMultiResultsRef.current.set(nodeId, multi)
                }
                if (node?.type === NodeType.PREVIEW) {
                    onNodeUpdate(node.id, { content: result as any })
                } else {
                    // Propagate completion to downstream Preview nodes
                    const downstreamPreviews = getDownstreamPreviewNodes(nodeId, edges, nodes)
                    // Build edge order map once to avoid O(E²) lookups
                    const edgeOrderMap = new Map(orderedEdges.map(e => [e.id, e.data?.orderNumber ?? 0]))
                    for (const preview of downstreamPreviews) {
                        // Create a map with the just-completed node's result
                        const updatedResults = new Map(nodeResults).set(nodeId, result ?? '')
                        const previewNode = nodes.find(n => n.id === preview.id)
                        if (previewNode) {
                            const content = computePreviewContent(
                                previewNode,
                                preview.parentEdges,
                                updatedResults,
                                edgeOrderMap,
                                nodeMultiResultsRef.current
                            )
                            // Only update if content has changed to avoid unnecessary updates
                            if (content !== previewNode.data.content) {
                                onNodeUpdate(preview.id, { content })
                            }
                        }
                    }
                }
            } else {
                setExecutingNodeIds(prev => new Set())
            }
            setNodeResults(prev => new Map(prev).set(nodeId, result ?? ''))
        }
    }

    useEffect(() => {
        vscodeAPI.postMessage({ type: 'get_models' } as any)
    }, [vscodeAPI])

    // biome-ignore lint/correctness/useExhaustiveDependencies: message handler relies on stable refs and setter identity; exhaustive deps not desired here
    useEffect(() => {
        const messageHandler = (event: MessageEvent<ExtensionToWorkflow>) => {
            switch (event.data.type) {
                case 'workflow_loaded': {
                    const { nodes, edges, state } = event.data.data as any
                    if (nodes && edges) {
                        const migrated = migrateToFanIn(nodes as any, edges as any)
                        calculatePreviewNodeTokens(migrated.nodes as any)
                        setNodes(migrated.nodes as any)
                        setEdges(migrated.edges as any)
                        setNodeErrors(new Map())

                        // Hydrate saved state if present
                        if (state?.nodeResults) {
                            const results = new Map<string, string>()
                            for (const [nodeId, savedState] of Object.entries(
                                state.nodeResults as any
                            )) {
                                results.set(nodeId, (savedState as any).output || '')
                            }
                            setNodeResults(results)
                        }
                        if (state?.ifElseDecisions) {
                            const decisions = new Map<string, 'true' | 'false'>()
                            for (const [nodeId, decision] of Object.entries(state.ifElseDecisions)) {
                                if (decision === 'true' || decision === 'false') {
                                    decisions.set(nodeId, decision)
                                }
                            }
                            setIfElseDecisions(decisions)
                        }

                        requestFitOnNextRender()
                    }
                    break
                }
                case 'workflow_saved': {
                    notify({ type: 'success', text: `Saved: ${event.data.data?.path ?? ''}` })
                    break
                }
                case 'workflow_save_failed': {
                    notify({ type: 'error', text: event.data.data?.error ?? 'Save failed' })
                    break
                }
                case 'node_execution_status': {
                    const payload = event.data.data as any
                    applyNodeExecutionStatus(
                        payload.nodeId,
                        payload.status,
                        payload.result,
                        (payload as any)?.multi
                    )
                    break
                }
                case 'subflow_node_execution_status': {
                    const { subflowId, payload } = (event.data as any).data || {}
                    // Only apply when viewing this subflow
                    if (payload && subflowId && activeSubflowIdRef?.current === subflowId) {
                        applyNodeExecutionStatus(
                            payload.nodeId,
                            payload.status,
                            payload.result,
                            (payload as any)?.multi
                        )
                    }
                    break
                }
                case 'execution_started':
                    setIsExecuting(true)
                    setIsPaused?.(false)
                    setCompletedThisRun?.(new Set())
                    lastExecutedNodeIdRef.current = null
                    break
                case 'execution_completed': {
                    const eventData = event.data as any
                    setIsExecuting(false)
                    setIsPaused?.(false)
                    setExecutingNodeIds(new Set())
                    const stoppedAtFromEvent = eventData.stoppedAtNodeId
                    const stoppedAt = stoppedAtFromEvent || lastExecutedNodeIdRef.current
                    setStoppedAtNodeId(stoppedAt)
                    break
                }
                case 'execution_paused': {
                    const eventData = event.data as any
                    setIsExecuting(true)
                    setIsPaused?.(true)
                    setExecutingNodeIds(new Set())
                    const stoppedAtFromEvent = eventData.stoppedAtNodeId
                    const stoppedAt = stoppedAtFromEvent || lastExecutedNodeIdRef.current
                    setStoppedAtNodeId(stoppedAt)
                    break
                }
                case 'token_count': {
                    const { count, nodeId } = event.data.data as any
                    const updates = new Map([[`${nodeId}_tokens`, String(count)]])
                    batchUpdateNodeResults(updates)
                    break
                }
                case 'node_assistant_content': {
                    const { nodeId, content } = event.data.data as any
                    // If assistant content arrives, mark node as executing (handles mid-run opens)
                    if (nodeId) {
                        setExecutingNodeIds(prev => {
                            const next = new Set(prev)
                            next.add(nodeId)
                            return next
                        })
                    }
                    setNodeAssistantContent(prev => new Map(prev).set(nodeId, content))
                    break
                }
                case 'subflow_node_assistant_content': {
                    const { subflowId, nodeId, content } = (event.data as any).data || {}
                    if (subflowId && activeSubflowIdRef?.current === subflowId && nodeId) {
                        // If assistant content arrives, mark node as executing (handles mid-run opens)
                        setExecutingNodeIds(prev => {
                            const next = new Set(prev)
                            next.add(nodeId)
                            return next
                        })
                        setNodeAssistantContent(prev => new Map(prev).set(nodeId, content))
                    }
                    break
                }
                case 'models_loaded': {
                    const models = event.data.data as any
                    if (models) {
                        setModels(models)
                    }
                    break
                }
                case 'provide_custom_nodes': {
                    const customNodes = event.data.data as any
                    if (customNodes) {
                        setCustomNodes(customNodes as any)
                    }
                    break
                }
                case 'storage_scope': {
                    const info = (event.data as any)?.data as {
                        scope: 'workspace' | 'user'
                        basePath?: string
                    }
                    setStorageScope?.(info || null)
                    break
                }
                case 'subflow_saved': {
                    // no-op here; caller likely rewires graph immediately
                    break
                }
                case 'provide_subflow': {
                    try {
                        const def = (event.data as any)?.data
                        window.dispatchEvent(
                            new CustomEvent('nebula-subflow-provide' as any, { detail: def })
                        )
                    } catch (err) {
                        console.error('[messageHandling] Failed to dispatch provide_subflow event', err)
                    }
                    break
                }
                case 'provide_subflows': {
                    try {
                        const list = (event.data as any)?.data
                        window.dispatchEvent(
                            new CustomEvent('nebula-subflows-provide' as any, { detail: list })
                        )
                    } catch (err) {
                        console.error('[messageHandling] Failed to dispatch provide_subflows event', err)
                    }
                    break
                }
                case 'subflow_copied': {
                    try {
                        const info = (event.data as any)?.data
                        if (info?.nodeId && info?.newId) {
                            onNodeUpdate(info.nodeId, { subflowId: info.newId })
                        }
                    } catch (err) {
                        console.error('[messageHandling] Failed to handle subflow_copied event', err)
                    }
                    break
                }
                case 'clipboard_paste': {
                    const payload = (event.data as any)?.data as WorkflowPayloadDTO | undefined
                    console.log('[messageHandling] clipboard_paste received', {
                        hasPayload: !!payload,
                        nodeCount: payload?.nodes?.length ?? 0,
                        edgeCount: payload?.edges?.length ?? 0,
                    })
                    if (payload && Array.isArray(payload.nodes) && payload.nodes.length > 0) {
                        try {
                            onClipboardPaste?.(payload)
                        } catch (err) {
                            console.error(
                                '[messageHandling] Failed to apply clipboard_paste payload',
                                err
                            )
                        }
                    }
                    break
                }
            }
        }
        const off = vscodeAPI.onMessage(messageHandler as any)
        // Request storage scope after listener is active to avoid race conditions
        vscodeAPI.postMessage({ type: 'get_storage_scope' } as any)

        if (!hasRequestedLastWorkflowRef.current) {
            hasRequestedLastWorkflowRef.current = true
            vscodeAPI.postMessage({ type: 'load_last_workflow' } as any)
        }

        return () => off()
    }, [
        nodes,
        onNodeUpdate,
        setEdges,
        setExecutingNodeIds,
        setInterruptedNodeId,
        setStoppedAtNodeId,
        setIsExecuting,
        setIsPaused,
        setNodeErrors,
        setNodeResults,
        setNodes,
        calculatePreviewNodeTokens,
        setPendingApprovalNodeId,
        batchUpdateNodeResults,
        setModels,
        setCustomNodes,
        setNodeAssistantContent,
        setIfElseDecisions,
        setCompletedThisRun,
        vscodeAPI,
        notify,
        edges,
        orderedEdges,
        nodeResults,
        requestFitOnNextRender,
        setStorageScope,
        onClipboardPaste,
    ])
}
