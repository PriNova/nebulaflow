import type { Edge } from '@graph/CustomOrderedEdge'
import { NodeType } from '@nodes/Nodes'
import type { WorkflowNodes } from '@nodes/Nodes'
import type React from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import { Button } from '../../ui/shadcn/ui/button'
import { toWorkflowNodeDTO } from '../../utils/nodeDto'
import type { GenericVSCodeWrapper } from '../../utils/vscode'
import type { SubflowMeta } from '../subflows/useProvideSubflow'

interface SubflowOutputsEditorProps {
    activeSubflowId: string
    subflowMeta: SubflowMeta
    nodes: WorkflowNodes[]
    edges: Edge[]
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>
    notify: (p: { type: 'success' | 'error'; text: string }) => void
    computeDisabledOutputHandles: (
        dtoNodes: Array<{ id: string; type: string; data?: any }>,
        dtoEdges: Array<{ source: string; target: string }>
    ) => Set<string>
    setSubflowMeta: React.Dispatch<React.SetStateAction<SubflowMeta | null>>
    setNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>
    setDisabledOutputsBySubflowId: React.Dispatch<React.SetStateAction<Map<string, Set<string>>>>
    subflowBaselineRef: React.MutableRefObject<{
        nodes: string
        edges: string
        outputs: string
    } | null>
}

/**
 * Overlay UI for renaming and reordering subflow outputs when editing a subflow.
 */
export const SubflowOutputsEditor: React.FC<SubflowOutputsEditorProps> = ({
    activeSubflowId,
    subflowMeta,
    nodes,
    edges,
    vscodeAPI,
    notify,
    computeDisabledOutputHandles,
    setSubflowMeta,
    setNodes,
    setDisabledOutputsBySubflowId,
    subflowBaselineRef,
}) => {
    return (
        <div className="tw-absolute tw-top-4 tw-left-4 tw-z-50 tw-bg-[var(--vscode-editor-background)] tw-border tw-border-[var(--vscode-panel-border)] tw-rounded tw-p-2 tw-shadow-md tw-min-w-[260px]">
            <div className="tw-text-xs tw-font-semibold tw-mb-1">Subflow Outputs</div>
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
                                    if (!meta || idx >= meta.outputs.length - 1) return meta
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
                        const nameByPid = new Map(newOutputs.map(o => [o.id, o.name]))
                        const updatedNodes = nodes.map(n => {
                            if (n.type === NodeType.SUBFLOW_OUTPUT) {
                                const oldPid = (n as any).data?.portId as string | undefined
                                const newPid = oldPid ? mapOldToNew.get(oldPid) ?? oldPid : oldPid
                                const newTitle =
                                    (newPid && nameByPid.get(newPid)) || (n as any).data?.title
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
                        const innerNodeDTOs = (updatedNodes as any[]).map(n => toWorkflowNodeDTO(n))
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
                            const sortedNodes = [...innerNodeDTOs].sort((a: any, b: any) =>
                                String(a.id).localeCompare(String(b.id))
                            )
                            const sortedEdges = [...innerEdgeDTOs].sort((a: any, b: any) =>
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
    )
}
