import { useEffect } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import type { GenericVSCodeWrapper } from '../../utils/vscode'

interface DuplicateSubflowDetail {
    id?: string
    nodeId?: string
}

/**
 * Hook to forward duplicate subflow requests from node UI to the extension.
 */
export const useDuplicateSubflow = (
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>
) => {
    useEffect(() => {
        const handler = (e: Event) => {
            const detail: DuplicateSubflowDetail | undefined = (
                e as CustomEvent<DuplicateSubflowDetail>
            ).detail
            const id = detail?.id
            const nodeId = detail?.nodeId
            if (id && nodeId) {
                vscodeAPI.postMessage({ type: 'duplicate_subflow', data: { id, nodeId } })
            }
        }
        window.addEventListener('nebula-duplicate-subflow', handler)
        return () => window.removeEventListener('nebula-duplicate-subflow', handler)
    }, [vscodeAPI])
}
