import { ReactFlowProvider } from '@xyflow/react'
import type React from 'react'
import '../index.css'
import { TooltipProvider } from '../components/shadcn/ui/tooltip'
import type { GenericVSCodeWrapper } from '../utils/vscode'
import { Flow } from './components/Flow'
import type { ExtensionToWorkflow, WorkflowToExtension } from './services/WorkflowProtocol'

export const WorkflowApp: React.FC<{
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>
}> = vscodeAPI => {
    return (
        <ReactFlowProvider>
            <TooltipProvider>
                <Flow {...vscodeAPI} />
            </TooltipProvider>
        </ReactFlowProvider>
    )
}
