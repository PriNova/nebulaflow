import { Menu } from 'lucide-react'
import type React from 'react'
import { Button } from '../ui/shadcn/ui/button'
import { SidebarActionsBar } from './SidebarActionsBar'
import { WorkflowSidebar } from './WorkflowSidebar'
import type { BaseNodeData, NodeType, WorkflowNodes } from './nodes/Nodes'

interface LeftSidebarProps {
    // Collapse control
    onToggleCollapse?: () => void

    // SidebarActionsBar props
    onSave: () => void
    onLoad: () => void
    onExecute: () => void
    onAbort: () => void
    onClear: () => void
    onReset: () => void
    isExecuting: boolean
    isPaused: boolean
    onPauseToggle: () => void

    // WorkflowSidebar props
    onNodeAdd: (
        nodeOrLabel: WorkflowNodes | string,
        nodeType?: NodeType,
        options?: { position?: { x: number; y: number }; initialData?: Partial<BaseNodeData> }
    ) => void
    selectedNode?: WorkflowNodes | null
    onNodeUpdate?: (nodeId: string, data: Partial<WorkflowNodes['data']>) => void
    models: { id: string; title?: string }[]
    onSaveCustomNode: (node: WorkflowNodes) => void
    onDeleteCustomNode: (nodeId: string) => void
    onRenameCustomNode: (oldNodeTitle: string, newNodeTitle: string) => void
    customNodes: WorkflowNodes[]
    subflows: Array<{ id: string; title: string; version: string }>
    nodeErrors?: Map<string, string>
    storageScope?: 'workspace' | 'user'
    onToggleStorageScope?: () => void
    isTogglingScope?: boolean
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
    onToggleCollapse,
    onSave,
    onLoad,
    onExecute,
    onAbort,
    onClear,
    onReset,
    isExecuting,
    isPaused,
    onPauseToggle,
    onNodeAdd,
    selectedNode,
    onNodeUpdate,
    models,
    onSaveCustomNode,
    onDeleteCustomNode,
    onRenameCustomNode,
    customNodes,
    subflows,
    nodeErrors,
    storageScope = 'user',
    onToggleStorageScope,
    isTogglingScope = false,
}) => {
    return (
        <div className="tw-w-full tw-border-r tw-border-border tw-h-full tw-bg-sidebar-background tw-flex tw-flex-col">
            <div className="tw-border-b tw-border-border tw-bg-sidebar-background tw-px-2 tw-py-2 tw-flex tw-items-center tw-justify-end tw-gap-2">
                <h3 className="tw-text-[var(--vscode-sideBarTitle-foreground)] tw-font-medium">
                    Library
                </h3>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggleCollapse}
                    aria-label="Toggle Left Sidebar"
                    title="Toggle Left Sidebar"
                    aria-expanded={true}
                    aria-controls="left-sidebar-panel"
                    className="tw-h-7 tw-w-7 tw-p-0"
                >
                    <Menu size={18} />
                </Button>
            </div>

            <SidebarActionsBar
                onSave={onSave}
                onLoad={onLoad}
                onExecute={onExecute}
                onClear={onClear}
                onReset={onReset}
                isExecuting={isExecuting}
                isPaused={isPaused}
                onAbort={onAbort}
                onPauseToggle={onPauseToggle}
                storageScope={storageScope}
                isTogglingScope={isTogglingScope}
                onToggleStorageScope={onToggleStorageScope}
            />

            <div className="tw-flex-1 tw-overflow-y-auto tw-min-h-0">
                <WorkflowSidebar
                    onNodeAdd={onNodeAdd}
                    selectedNode={selectedNode ?? undefined}
                    onNodeUpdate={onNodeUpdate}
                    models={models}
                    onSaveCustomNode={onSaveCustomNode}
                    onDeleteCustomNode={onDeleteCustomNode}
                    onRenameCustomNode={onRenameCustomNode}
                    customNodes={customNodes}
                    subflows={subflows}
                    nodeErrors={nodeErrors}
                />
            </div>
        </div>
    )
}
