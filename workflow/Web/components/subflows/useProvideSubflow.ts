import type { Edge } from '@graph/CustomOrderedEdge'
import { NodeType, type WorkflowNodes } from '@nodes/Nodes'
import { useEffect } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import { toWorkflowNodeDTO } from '../../utils/nodeDto'
import type { GenericVSCodeWrapper } from '../../utils/vscode'

const PROVIDE_SUBFLOW_EVT = 'nebula-subflow-provide' as const

export interface SubflowMeta {
    id: string
    title: string
    version: string
    inputs: Array<{ id: string; name: string; index: number }>
    outputs: Array<{ id: string; name: string; index: number }>
}

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
        dtoNodes: Array<{ id: string; type: string; data?: any }>,
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
