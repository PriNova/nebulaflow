import { CircleHelp, CircleStop, File, Pause, Play, RotateCcw, Save, Trash2 } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Button } from '../ui/shadcn/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/shadcn/ui/tooltip'
import { ConfirmDeleteWorkflowModal } from './ConfirmDeleteWorkflowModal'
import { HelpModal } from './HelpModal'

interface SidebarActionsBarProps {
    onSave: () => void
    onLoad: () => void
    onExecute: () => void
    onAbort: () => void
    onClear: () => void
    onReset: () => void
    isExecuting: boolean
    isPaused: boolean
    onPauseToggle: () => void
    // storage scope toggle
    storageScope?: 'workspace' | 'user'
    onToggleStorageScope?: () => void
    isTogglingScope?: boolean
}

export const SidebarActionsBar: React.FC<SidebarActionsBarProps> = ({
    onSave,
    onLoad,
    onExecute,
    onAbort,
    onClear,
    onReset,
    isExecuting,
    isPaused,
    onPauseToggle,
    storageScope = 'user',
    onToggleStorageScope,
    isTogglingScope = false,
}) => {
    const [isHelpOpen, setIsHelpOpen] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

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
                    {isExecuting && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="tw-flex-1"
                                    onClick={onPauseToggle}
                                    aria-label={isPaused ? 'Resume Execution' : 'Pause Execution'}
                                >
                                    {isPaused ? <Play size={18} /> : <Pause size={18} />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {isPaused ? 'Resume Execution' : 'Pause Execution'}
                            </TooltipContent>
                        </Tooltip>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="tw-w-full"
                                onClick={onReset}
                                disabled={isExecuting}
                                aria-label="Reset Results"
                            >
                                <RotateCcw size={18} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reset Results</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="tw-w-full"
                                onClick={() => setIsDeleteConfirmOpen(true)}
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
                    {/* Storage scope toggle below all buttons */}
                    <div className="tw-pt-1 tw-flex tw-justify-center">
                        <button
                            type="button"
                            className="tw-text-[11px] tw-px-2 tw-py-[2px] tw-rounded-full tw-border tw-border-[var(--vscode-panel-border)] hover:tw-bg-[var(--vscode-button-secondaryHoverBackground)]"
                            title="Click to switch between User and Workspace"
                            onClick={onToggleStorageScope}
                            disabled={isTogglingScope}
                        >
                            {storageScope === 'user' ? 'User' : 'Workspace'}
                        </button>
                    </div>
                </div>
            </div>
            <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
            <ConfirmDeleteWorkflowModal
                isOpen={isDeleteConfirmOpen}
                onConfirm={() => {
                    onClear()
                    setIsDeleteConfirmOpen(false)
                }}
                onCancel={() => setIsDeleteConfirmOpen(false)}
            />
        </>
    )
}
