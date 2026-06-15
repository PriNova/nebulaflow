import type { Edge } from '@graph/CustomOrderedEdge'
import { NodeType, type WorkflowNodes } from '@nodes/Nodes'
import { useEffect } from 'react'
import type {
    ExtensionToWorkflow,
    SubflowDefinitionDTO,
    SubflowPortDTO,
    WorkflowNodeDTO,
    WorkflowToExtension,
} from '../../services/Protocol'
import { toWorkflowNodeDTO } from '../../utils/nodeDto'
import type { GenericVSCodeWrapper } from '../../utils/vscode'

const PROVIDE_SUBFLOW_EVT = 'nebula-subflow-provide'

export interface SubflowMeta {
    id: string
    title: string
    version: string
    inputs: SubflowPortDTO[]
    outputs: SubflowPortDTO[]
}

// Detail type alias for the provide_subflow event payload.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ProvideSubflowDetail extends SubflowDefinitionDTO {}

/**
 * Hook to handle subflow data provided by the extension.
 * Populates the editor with the subflow's inner graph.
 */
export const useProvideSubflow = (
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>,
    requestFitOnNextRender: () => void,
    pendingSubflowRename: { id: string; newTitle: string } | null,
    notify: (p: { type: 'success' | 'error'; text: string }) => void,
    computeDisabledOutputHandles: (
        dtoNodes: WorkflowNodeDTO[],
        dtoEdges: Array<{ source: string; target: string }>
    ) => Set<string>,
    setDisabledOutputsBySubflowId: React.Dispatch<React.SetStateAction<Map<string, Set<string>>>>,
    setNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>,
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
    setSubflowMeta: React.Dispatch<React.SetStateAction<SubflowMeta | null>>,
    subflowBaselineRef: React.MutableRefObject<{
        nodes: string
        edges: string
        outputs: string
    } | null>,
    setNodeResults: React.Dispatch<React.SetStateAction<Map<string, string>>>,
    setPendingSubflowRename: React.Dispatch<
        React.SetStateAction<{ id: string; newTitle: string } | null>
    >
) => {
    useEffect(() => {
        const provideHandler = (e: Event) => {
            const def: ProvideSubflowDetail | undefined = (
                e as CustomEvent<ProvideSubflowDetail>
            ).detail
            if (!def) return
            // If rename requested, update title and persist without opening
            if (pendingSubflowRename && def.id === pendingSubflowRename.id) {
                const renamed = { ...def, title: pendingSubflowRename.newTitle }
                vscodeAPI.postMessage({ type: 'create_subflow', data: renamed })
                setPendingSubflowRename(null)
                notify({ type: 'success', text: 'Subflow renamed' })
                vscodeAPI.postMessage({ type: 'get_subflows' })
                return
            }

            const dtoNodes: WorkflowNodeDTO[] = def.graph?.nodes ?? []
            const dtoEdges = (def.graph?.edges ?? []) as Array<{
                id: string
                source: string
                target: string
                sourceHandle?: string
                targetHandle?: string
            }>

            // Cache disabled outputs for this subflow id (for top-level visual dimming)
            try {
                const disabled = computeDisabledOutputHandles(dtoNodes, dtoEdges)
                setDisabledOutputsBySubflowId(prev => {
                    const next = new Map(prev)
                    next.set(def.id, disabled)
                    return next
                })
            } catch {
                // computeDisabledOutputHandles may throw on malformed data; safe to ignore
            }

            const fanInTypes = new Set([
                NodeType.CLI,
                NodeType.LLM,
                NodeType.PREVIEW,
                NodeType.ACCUMULATOR,
                NodeType.INPUT,
            ])

            const uiNodes: WorkflowNodes[] = dtoNodes.map(n => {
                const nodeType = n.type as NodeType
                const nodeData = (n.data ?? {}) as Partial<WorkflowNodes['data']>
                const baseData: WorkflowNodes['data'] = {
                    title: nodeData.title ?? '',
                    content: nodeData.content ?? '',
                    active: nodeData.active ?? true,
                    // Include all other data properties (bypass, iterations, model, etc.)
                    ...nodeData,
                }
                // Enable fan-in for common types to ensure handles render
                if (fanInTypes.has(nodeType)) {
                    baseData.fanInEnabled = true
                }
                return {
                    id: n.id,
                    type: nodeType,
                    data: baseData,
                    position: n.position,
                }
            })

            const uiEdges: Edge[] = dtoEdges.map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle ?? undefined,
                targetHandle: e.targetHandle ?? undefined,
            }))

            // Capture subflow meta for simple ports editor (rename/reorder outputs)
            try {
                const outs = def.outputs
                    ? [...(def.outputs)].sort(
                          (a, b) => (a.index ?? 0) - (b.index ?? 0)
                      )
                    : []
                const ins = def.inputs
                    ? [...(def.inputs)].sort(
                          (a, b) => (a.index ?? 0) - (b.index ?? 0)
                      )
                    : []
                setSubflowMeta({
                    id: def.id,
                    title: def.title,
                    version: def.version,
                    inputs: ins,
                    outputs: outs,
                })
            } catch {
                // Port metadata may be malformed; safe to skip
            }

            setNodes(uiNodes)
            setEdges(uiEdges)
            // Establish baseline for dirty-check
            try {
                const nodeDTOs = uiNodes.map(n => toWorkflowNodeDTO(n))
                nodeDTOs.sort((a, b) => String(a.id).localeCompare(String(b.id)))
                const edgeDTOs = uiEdges.map(e => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    sourceHandle: e.sourceHandle ?? undefined,
                    targetHandle: e.targetHandle ?? undefined,
                }))
                edgeDTOs.sort((a, b) => String(a.id).localeCompare(String(b.id)))
                const outs = Array.isArray(def.outputs)
                    ? [...(def.outputs)].sort(
                          (a, b) => (a.index ?? 0) - (b.index ?? 0)
                      )
                    : []
                const outputsSig = JSON.stringify(
                    outs.map(o => ({ id: o.id, name: o.name, index: o.index }))
                )
                subflowBaselineRef.current = {
                    nodes: JSON.stringify(nodeDTOs),
                    edges: JSON.stringify(edgeDTOs),
                    outputs: outputsSig,
                }
            } catch {
                // Baseline computation may fail; safe to skip
            }
            requestFitOnNextRender()

            // Hydrate RightSidebar results from subflow node data (result/output) for immediate visibility
            try {
                const initialResults = new Map<string, string>()
                for (const n of uiNodes) {
                    const r = (n.data as Record<string, unknown>).result as string | undefined
                    const o = (n.data as Record<string, unknown>).output as string | undefined
                    const val = r ?? o
                    if (typeof val === 'string' && val.length > 0) {
                        initialResults.set(n.id, val)
                    }
                }
                setNodeResults(prev => new Map([...prev, ...initialResults]))
            } catch {
                // Hydration is best-effort; failures safe to ignore
            }
        }
        window.addEventListener(PROVIDE_SUBFLOW_EVT, provideHandler)
        return () => {
            window.removeEventListener(PROVIDE_SUBFLOW_EVT, provideHandler)
        }
    }, [
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
        setPendingSubflowRename,
    ])
}
