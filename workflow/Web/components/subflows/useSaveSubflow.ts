import { NodeType, type WorkflowNodes } from '@nodes/Nodes'
import { useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import type { GenericVSCodeWrapper } from '../../utils/vscode'

/**
 * Hook to handle save-unsaved subflow requests from PropertyEditor.
 */
export const useSaveSubflow = (
    nodes: WorkflowNodes[],
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>,
    notify: (p: { type: 'success' | 'error'; text: string }) => void,
    setNodes: React.Dispatch<React.SetStateAction<WorkflowNodes[]>>,
    setPendingSubflowRename: React.Dispatch<
        React.SetStateAction<{ id: string; newTitle: string } | null>
    >
) => {
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
    }, [nodes, vscodeAPI, notify, setNodes, setPendingSubflowRename])
}
