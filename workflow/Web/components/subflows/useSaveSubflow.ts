import { NodeType, type SubflowNode, type WorkflowNodes } from '@nodes/Nodes'
import { useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type {
    EdgeDTO,
    ExtensionToWorkflow,
    SubflowDefinitionDTO,
    WorkflowToExtension,
} from '../../services/Protocol'
import type { GenericVSCodeWrapper } from '../../utils/vscode'

interface SaveSubflowDetail {
    nodeId?: string
}

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
        const handler = (e: Event) => {
            const detail: SaveSubflowDetail | undefined = (
                e as CustomEvent<SaveSubflowDetail>
            ).detail
            const nodeId = detail?.nodeId
            if (!nodeId) return
            const rawNode = nodes.find(n => n.id === nodeId)
            if (!rawNode || rawNode.type !== NodeType.SUBFLOW) return
            const node = rawNode as SubflowNode
            const pending = node.data.pendingSubflow

            // Case A: pending subflow (unsaved) -> save new definition
            if (pending) {
                const id = uuidv4()
                const def: SubflowDefinitionDTO = {
                    id,
                    title: node.data.title || 'Subflow',
                    version: '1.0.0',
                    inputs: pending.inputs.map((p, i) => ({
                        id: p.id,
                        name: p.name,
                        index: i,
                    })),
                    outputs: pending.outputs.map((p, i) => ({
                        id: `out-${i}`,
                        name: p.name,
                        index: i,
                    })),
                    graph: {
                        nodes: pending.graph.nodes as WorkflowNodes[],
                        edges: pending.graph.edges as EdgeDTO[],
                    },
                }
                vscodeAPI.postMessage({ type: 'create_subflow', data: def })
                // Update wrapper to link saved def
                setNodes(prev =>
                    prev.map(n =>
                        n.id === nodeId
                            ? {
                                  ...n,
                                  data: {
                                      ...n.data,
                                      subflowId: id,
                                      outputPortCount:
                                          pending.outputs.length || node.data.outputPortCount,
                                      pendingSubflow: undefined,
                                  },
                              }
                            : n
                    )
                )
                notify({ type: 'success', text: 'Subflow saved' })
                vscodeAPI.postMessage({ type: 'get_subflows' })
                return
            }

            // Case B: existing subflow -> rename definition title in-place
            const subflowId: string | undefined = node.data.subflowId
            if (subflowId) {
                setPendingSubflowRename({ id: subflowId, newTitle: node.data.title || 'Subflow' })
                vscodeAPI.postMessage({ type: 'get_subflow', data: { id: subflowId } })
                return
            }
        }
        window.addEventListener('nebula-save-subflow', handler)
        return () => window.removeEventListener('nebula-save-subflow', handler)
    }, [nodes, vscodeAPI, notify, setNodes, setPendingSubflowRename])
}
