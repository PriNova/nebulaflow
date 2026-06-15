/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, jsx-a11y/no-static-element-interactions */
import type { WorkflowNodes } from '@nodes/Nodes'
import { RightSidebar } from '@sidebar/RightSidebar'
import { Menu } from 'lucide-react'
import type React from 'react'
import type { SelectionSummary } from '../hooks/selectionHandling'
import type { AssistantContentItem } from '../../../Core/models'
import { Button } from '../../ui/shadcn/ui/button'

const COLLAPSED_WIDTH = 36 // px
const HANDLE_THICKNESS = '6px'
const OVERLAY_Z = 40

interface RightSidebarContainerProps {
    overlay: boolean
    rightCollapsed: boolean
    rightSidebarWidth: number
    sortedNodes: WorkflowNodes[]
    nodeResults: Map<string, string>
    executingNodeIds: Set<string>
    pendingApprovalNodeId: string | null
    interruptedNodeId: string | null
    stoppedAtNodeId: string | null
    nodeAssistantContent: Map<string, AssistantContentItem[]>
    nodeThreadIDs: Map<string, string>
    nodeSubAgentContent: Map<
        string,
        Map<
            string,
            {
                subThreadID: string
                parentThreadID?: string
                agentType: string
                status: 'running' | 'done' | 'error' | 'cancelled'
                content: AssistantContentItem[]
            }
        >
    >
    executionRunId: number
    isPaused: boolean
     
    selectionSummary: any
    parallelSteps: string[][]
    parallelStepByNodeId: Map<string, number>
    branchByIfElseId: Map<string, { true: Set<string>; false: Set<string> }>
    nodes: WorkflowNodes[]
    setRightCollapsed: React.Dispatch<React.SetStateAction<boolean>>
    handleNodeApproval: (nodeId: string, approved: boolean, modifiedCommand?: string) => void
    handleResultUpdate: (nodeId: string, value: string) => void
    handleRightSidebarMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
    onChat?: (args: { nodeId: string; threadID: string; message: string }) => void
}

/**
 * Right sidebar container with collapse handling and mobile overlay support.
 */
export const RightSidebarContainer: React.FC<RightSidebarContainerProps> = ({
    overlay,
    rightCollapsed,
    rightSidebarWidth,
    sortedNodes,
    nodeResults,
    executingNodeIds,
    pendingApprovalNodeId,
    interruptedNodeId,
    stoppedAtNodeId,
    nodeAssistantContent,
    nodeThreadIDs,
    nodeSubAgentContent,
    executionRunId,
    isPaused,
    selectionSummary,
    parallelSteps,
    parallelStepByNodeId,
    branchByIfElseId,
    nodes,
    setRightCollapsed,
    handleNodeApproval,
    handleResultUpdate,
    handleRightSidebarMouseDown,
    onChat,
}) => {
    const expanded = !rightCollapsed

    // Overlay backdrop — shown when expanded on mobile
    const backdrop = overlay && expanded ? (
        <div
            className="tw-fixed tw-inset-0 tw-bg-black/30 tw-z-[39]"
            onClick={() => setRightCollapsed(true)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    setRightCollapsed(true)
                }
            }}
            role="button"
            tabIndex={0}
        />
    ) : null

    const panelClass = overlay
        ? `tw-absolute tw-right-0 tw-top-0 tw-bottom-0 tw-z-[${OVERLAY_Z}] tw-bg-[var(--vscode-sideBar-background)] tw-h-full tw-overflow-y-auto tw-shadow-2xl`
        : 'tw-flex-shrink-0 tw-border-r tw-border-solid tw-border-[var(--vscode-panel-border)] tw-bg-[var(--vscode-sideBar-background)] tw-h-full tw-overflow-y-auto'

    const collapsedToggle = overlay ? (
        <div className="tw-absolute tw-right-0 tw-top-0 tw-z-[41] tw-p-1">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setRightCollapsed(false)}
                aria-label="Expand Right Sidebar"
                title="Expand Right Sidebar"
                aria-expanded={false}
                aria-controls="right-sidebar-panel"
                className="tw-h-8 tw-w-8 tw-p-0 tw-shadow-md"
            >
                <Menu size={18} />
            </Button>
        </div>
    ) : (
        <div className="tw-border-b tw-border-border tw-bg-sidebar-background tw-px-2 tw-py-2 tw-flex tw-justify-center">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setRightCollapsed(false)}
                aria-label="Expand Right Sidebar"
                title="Expand Right Sidebar"
                aria-expanded={false}
                aria-controls="right-sidebar-panel"
                className="tw-h-8 tw-w-8 tw-p-0"
            >
                <Menu size={18} />
            </Button>
        </div>
    )

    return (
        <>
            <div
                style={{ width: HANDLE_THICKNESS }}
                className="hover:tw-bg-[var(--vscode-textLink-activeForeground)] tw-bg-[var(--vscode-panel-border)] tw-cursor-ew-resize tw-select-none"
                onMouseDown={handleRightSidebarMouseDown}
            />
            {backdrop}
            <div
                id="right-sidebar-panel"
                style={{ width: (rightCollapsed ? COLLAPSED_WIDTH : rightSidebarWidth) + 'px' }}
                className={panelClass}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
            >
                {rightCollapsed ? (
                    collapsedToggle
                ) : (
                    <RightSidebar
                        sortedNodes={sortedNodes}
                        nodeResults={nodeResults}
                        executingNodeIds={executingNodeIds}
                        pendingApprovalNodeId={pendingApprovalNodeId}
                        onApprove={handleNodeApproval}
                        interruptedNodeId={interruptedNodeId}
                        stoppedAtNodeId={stoppedAtNodeId}
                        nodeAssistantContent={nodeAssistantContent}
                        nodeThreadIDs={nodeThreadIDs}
                        nodeSubAgentContent={nodeSubAgentContent}
                        executionRunId={executionRunId}
                        isPaused={isPaused}
                        selection={selectionSummary}
                        parallelSteps={parallelSteps}
                        parallelStepByNodeId={parallelStepByNodeId}
                        branchByIfElseId={branchByIfElseId}
                        onToggleCollapse={() => setRightCollapsed(true)}
                        onResultUpdate={handleResultUpdate}
                        onChat={onChat}
                    />
                )}
            </div>
        </>
    )
}
