import { ReactFlowProvider } from '@xyflow/react'
import type React from 'react'
import './index.css'
import { Flow } from './components/Flow'
import type { ExtensionToWorkflow, WorkflowToExtension } from './services/Protocol'
import { TooltipProvider } from './ui/shadcn/ui/tooltip'
import type { GenericVSCodeWrapper } from './utils/vscode'

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
