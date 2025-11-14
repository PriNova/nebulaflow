import type { WorkflowNodes } from '@nodes/Nodes'
import { LeftSidebar } from '@sidebar/LeftSidebar'
import { Menu } from 'lucide-react'
import type React from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import { Button } from '../../ui/shadcn/ui/button'
import type { GenericVSCodeWrapper } from '../../utils/vscode'

const COLLAPSED_WIDTH = 36 // px
const HANDLE_THICKNESS = '6px'

interface LeftSidebarContainerProps {
    leftCollapsed: boolean
    sidebarWidth: number
    isExecuting: boolean
    isPaused: boolean
    activeNode: WorkflowNodes | null
    models: { id: string; title?: string }[]
    customNodes: WorkflowNodes[]
    subflows: Array<{ id: string; title: string; version: string }>
    nodeErrors: Map<string, string>
    storageScope: 'workspace' | 'user'
    isTogglingScope: boolean
    vscodeAPI: GenericVSCodeWrapper<WorkflowToExtension, ExtensionToWorkflow>
    setLeftCollapsed: React.Dispatch<React.SetStateAction<boolean>>
    onSave: () => void
    onLoad: () => void
    onExecute: (seedOutputs: Record<string, string>, seedDecisions: Record<string, boolean>) => void
    resetExecutionState: () => void
    onResetResults: () => void
    onAbort: () => void
    onPauseToggle: () => void
    onNodeAdd: (
        nodeOrLabel: WorkflowNodes | string,
        nodeType?: any,
        options?: { position?: { x: number; y: number }; initialData?: any }
    ) => void
    onNodeUpdate: (id: string, partial: any) => void
    onSaveCustomNode: (node: WorkflowNodes) => void
    onDeleteCustomNode: (nodeId: string) => void
    onRenameCustomNode: (oldNodeTitle: string, newNodeTitle: string) => void
    handleMouseDown: (e: React.MouseEvent) => void
}

/**
 * Left sidebar container with collapse handling.
 */
export const LeftSidebarContainer: React.FC<LeftSidebarContainerProps> = ({
    leftCollapsed,
    sidebarWidth,
    isExecuting,
    isPaused,
    activeNode,
    models,
    customNodes,
    subflows,
    nodeErrors,
    storageScope,
    isTogglingScope,
    vscodeAPI,
    setLeftCollapsed,
    onSave,
    onLoad,
    onExecute,
    resetExecutionState,
    onResetResults,
    onAbort,
    onPauseToggle,
    onNodeAdd,
    onNodeUpdate,
    onSaveCustomNode,
    onDeleteCustomNode,
    onRenameCustomNode,
    handleMouseDown,
}) => {
    return (
        <>
            <div
                id="left-sidebar-panel"
                style={{ width: (leftCollapsed ? COLLAPSED_WIDTH : sidebarWidth) + 'px' }}
                className="tw-flex-shrink-0 tw-bg-[var(--vscode-sideBar-background)] tw-h-full tw-flex tw-flex-col"
            >
                {leftCollapsed ? (
                    <div className="tw-border-b tw-border-border tw-bg-sidebar-background tw-px-2 tw-py-2 tw-flex tw-justify-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLeftCollapsed(false)}
                            aria-label="Expand Left Sidebar"
                            title="Expand Left Sidebar"
                            aria-expanded={false}
                            aria-controls="left-sidebar-panel"
                            className="tw-h-8 tw-w-8 tw-p-0"
                        >
                            <Menu size={18} />
                        </Button>
                    </div>
                ) : (
                    <LeftSidebar
                        onToggleCollapse={() => setLeftCollapsed(true)}
                        onSave={onSave}
                        onLoad={onLoad}
                        onExecute={() => onExecute({}, {})}
                        onClear={resetExecutionState}
                        onReset={onResetResults}
                        isExecuting={isExecuting}
                        isPaused={isPaused}
                        onAbort={onAbort}
                        onPauseToggle={onPauseToggle}
                        onNodeAdd={onNodeAdd}
                        selectedNode={activeNode}
                        onNodeUpdate={onNodeUpdate}
                        models={models}
                        onSaveCustomNode={onSaveCustomNode}
                        onDeleteCustomNode={onDeleteCustomNode}
                        onRenameCustomNode={onRenameCustomNode}
                        customNodes={customNodes}
                        subflows={subflows}
                        nodeErrors={nodeErrors}
                        storageScope={storageScope}
                        isTogglingScope={isTogglingScope}
                        onToggleStorageScope={() => {
                            vscodeAPI.postMessage({ type: 'toggle_storage_scope' } as any)
                        }}
                    />
                )}
            </div>
            <div
                style={{ width: HANDLE_THICKNESS }}
                className="hover:tw-bg-[var(--vscode-textLink-activeForeground)] tw-bg-[var(--vscode-panel-border)] tw-cursor-ew-resize tw-select-none"
                onMouseDown={handleMouseDown}
            />
        </>
    )
}
