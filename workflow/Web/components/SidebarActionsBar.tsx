import { CircleHelp, CircleStop, File, Play, Save, Trash2 } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Button } from '../ui/shadcn/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/shadcn/ui/tooltip'
import { HelpModal } from './HelpModal'

interface SidebarActionsBarProps {
    onSave: () => void
    onLoad: () => void
    onExecute: () => void
    onAbort: () => void
    onClear: () => void
    isExecuting: boolean
}

export const SidebarActionsBar: React.FC<SidebarActionsBarProps> = ({
    onSave,
    onLoad,
    onExecute,
    onAbort,
    onClear,
    isExecuting,
}) => {
    const [isHelpOpen, setIsHelpOpen] = useState(false)

    return (
        <>
            <div className="tw-border-b tw-border-border tw-bg-sidebar-background tw-p-4">
                <div className="tw-flex tw-flex-col tw-gap-1">
                    <div className="tw-flex tw-flex-row tw-gap-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="tw-flex-1"
                                    onClick={onLoad}
                                    aria-label="Open Workflow"
                                >
                                    <File size={18} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open Workflow</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="tw-flex-1"
                                    onClick={onSave}
                                    aria-label="Save Workflow"
                                >
                                    <Save size={18} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Save Workflow</TooltipContent>
                        </Tooltip>
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="tw-flex-1"
                                onClick={isExecuting ? onAbort : onExecute}
                                aria-label={isExecuting ? 'Stop Execution' : 'Start Execution'}
                            >
                                {isExecuting ? <CircleStop size={18} /> : <Play size={18} />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {isExecuting ? 'Stop Execution' : 'Start Execution'}
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="tw-w-full"
                                onClick={onClear}
                                aria-label="Clear"
                            >
                                <Trash2 size={18} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Clear</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="tw-w-full"
                                onClick={() => setIsHelpOpen(true)}
                                aria-label="Help"
                            >
                                <CircleHelp size={18} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Help</TooltipContent>
                    </Tooltip>
                </div>
            </div>
            <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        </>
    )
}
