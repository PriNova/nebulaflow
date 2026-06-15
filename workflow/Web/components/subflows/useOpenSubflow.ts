import type { Edge } from '@graph/CustomOrderedEdge'
import type { WorkflowNodes } from '@nodes/Nodes'
import { type MutableRefObject, useEffect } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import { deepClone } from '../../utils/deepClone'
import type { GenericVSCodeWrapper } from '../../utils/vscode'

const OPEN_SUBFLOW_EVT = 'nebula-open-subflow'

interface OpenSubflowDetail {
    subflowId?: string
}

/**
 * Hook to handle opening a subflow for editing.
 * Stable, single registration using refs to avoid stale closures.
 */
export const useOpenSubflow = (
    nodesRef: MutableRefObject<WorkflowNodes[]>,
    edgesRef: MutableRefObject<Edge[]>,
    activeSubflowIdRef: MutableRefObject<string | null>,
    vscodeAPIRef: MutableRefObject<GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>>,
    setViewStack: React.Dispatch<React.SetStateAction<Array<{ nodes: WorkflowNodes[]; edges: Edge[] }>>>,
    setActiveSubflowId: React.Dispatch<React.SetStateAction<string | null>>
) => {
    useEffect(() => {
        const openHandler = (e: Event) => {
            const detail: OpenSubflowDetail | undefined = (
                e as CustomEvent<OpenSubflowDetail>
            ).detail
            const subflowId = detail?.subflowId
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
                })
            } catch {
                // Subflow fetch delivery failure; visible during development
            }
        }
        window.addEventListener(OPEN_SUBFLOW_EVT, openHandler)
        return () => {
            window.removeEventListener(OPEN_SUBFLOW_EVT, openHandler)
        }
    }, [nodesRef, edgesRef, activeSubflowIdRef, vscodeAPIRef, setViewStack, setActiveSubflowId])
}
