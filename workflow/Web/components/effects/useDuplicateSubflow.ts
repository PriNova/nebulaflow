import { useEffect } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import type { GenericVSCodeWrapper } from '../../utils/vscode'

/**
 * Hook to forward duplicate subflow requests from node UI to the extension.
 */
export const useDuplicateSubflow = (
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>
) => {
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
}
