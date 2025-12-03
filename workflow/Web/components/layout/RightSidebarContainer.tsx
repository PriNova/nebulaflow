import type { WorkflowNodes } from '@nodes/Nodes'
import { RightSidebar } from '@sidebar/RightSidebar'
import { Menu } from 'lucide-react'
import type React from 'react'
import type { AssistantContentItem } from '../../../Core/models'
import { Button } from '../../ui/shadcn/ui/button'

const COLLAPSED_WIDTH = 36 // px
const HANDLE_THICKNESS = '6px'

interface RightSidebarContainerProps {
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
    executionRunId: number
    isPaused: boolean
    selectionSummary: any
    parallelSteps: any[]
    parallelStepByNodeId: Map<string, any>
    branchByIfElseId: Map<string, any>
    nodes: WorkflowNodes[]
    setRightCollapsed: React.Dispatch<React.SetStateAction<boolean>>
    handleNodeApproval: (nodeId: string, approved: boolean, modifiedCommand?: string) => void
    onRunFromHere: (nodeId: string) => void
    onResume: (nodeId: string, outputs: Record<string, string>) => void
    handleResultUpdate: (nodeId: string, value: string) => void
    handleRightSidebarMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
    onChat?: (args: { nodeId: string; threadID: string; message: string }) => void
}

/**
 * Right sidebar container with collapse handling.
 */
export const RightSidebarContainer: React.FC<RightSidebarContainerProps> = ({
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
    executionRunId,
    isPaused,
    selectionSummary,
    parallelSteps,
    parallelStepByNodeId,
    branchByIfElseId,
    nodes,
    setRightCollapsed,
    handleNodeApproval,
    onRunFromHere,
    onResume,
    handleResultUpdate,
    handleRightSidebarMouseDown,
    onChat,
}) => {
    return (
        <>
            <div
                style={{ width: HANDLE_THICKNESS }}
                className="hover:tw-bg-[var(--vscode-textLink-activeForeground)] tw-bg-[var(--vscode-panel-border)] tw-cursor-ew-resize tw-select-none"
                onMouseDown={handleRightSidebarMouseDown}
            />
            <div
                id="right-sidebar-panel"
                style={{ width: (rightCollapsed ? COLLAPSED_WIDTH : rightSidebarWidth) + 'px' }}
                className="tw-flex-shrink-0 tw-border-r tw-border-solid tw-border-[var(--vscode-panel-border)] tw-bg-[var(--vscode-sideBar-background)] tw-h-full tw-overflow-y-auto"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
            >
                {rightCollapsed ? (
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
                        executionRunId={executionRunId}
                        isPaused={isPaused}
                        onRunFromHere={(nodeId: string) => {
                            const outputs: Record<string, string> = {}
                            const nodeIdSet = new Set(nodes.map(n => n.id))
                            for (const [k, v] of nodeResults) {
                                if (nodeIdSet.has(k) && k !== nodeId) {
                                    outputs[k] = v
                                }
                            }
                            onResume(nodeId, outputs)
                        }}
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
