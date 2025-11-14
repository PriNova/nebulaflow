import type { Edge } from '@graph/CustomOrderedEdge'
import type { WorkflowNodes } from '@nodes/Nodes'
import { type MutableRefObject, useEffect } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import { deepClone } from '../../utils/deepClone'
import type { GenericVSCodeWrapper } from '../../utils/vscode'

const OPEN_SUBFLOW_EVT = 'nebula-open-subflow' as const

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
    }, [nodesRef, edgesRef, activeSubflowIdRef, vscodeAPIRef, setViewStack, setActiveSubflowId])
}
