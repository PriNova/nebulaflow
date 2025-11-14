import { TextEditorModal } from '@modals/TextEditorModal'
import RunFromHereButton from '@shared/RunFromHereButton'
import RunOnlyThisButton from '@shared/RunOnlyThisButton'
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { FanInTargetHandles } from './FanInTargetHandles'
import {
    type BaseNodeData,
    type BaseNodeProps,
    NodeType,
    type WorkflowNode,
    getBorderColor,
    getNodeStyle,
} from './Nodes'

export type CLINode = Omit<WorkflowNode, 'data'> & {
    type: NodeType.CLI
    data: BaseNodeData & { shouldAbort: boolean }
}

export const CLINode: React.FC<BaseNodeProps> = ({ id, data, selected }) => {
    const updateNodeInternals = useUpdateNodeInternals()

    // biome-ignore lint/correctness/useExhaustiveDependencies: we must refresh handles when the count changes
    useEffect(() => {
        if (data?.fanInEnabled) updateNodeInternals(id)
    }, [id, data?.fanInEnabled, data?.inputPortCount, updateNodeInternals])

    const [draft, setDraft] = useState('')

    const dispatchEditEvent = useCallback(
        (action: 'start' | 'commit' | 'cancel', payload?: any) => {
            const detail: any = { id, action }
            if (payload?.content !== undefined) {
                detail.content = payload.content
            }
            window.dispatchEvent(
                new CustomEvent('nebula-edit-node', {
                    detail,
                })
            )
        },
        [id]
    )

    useEffect(() => {
        if (data.isEditing) {
            setDraft(data.content || '')
        }
    }, [data.isEditing, data.content])

    const handleBodyDoubleClick = () => {
        dispatchEditEvent('start')
    }

    const handleCommit = () => {
        dispatchEditEvent('commit', { content: draft })
    }

    const handleCancel = () => {
        dispatchEditEvent('cancel')
    }

    return (
        <div
            style={getNodeStyle(
                NodeType.CLI,
                data.moving,
                selected,
                data.executing,
                data.error,
                data.active,
                data.interrupted,
                data.bypass
            )}
        >
            {data?.fanInEnabled ? (
                <FanInTargetHandles
                    count={data?.inputPortCount ?? 1}
                    edgeByHandle={data?.inputEdgeIdByHandle}
                />
            ) : (
                <Handle type="target" position={Position.Top} />
            )}
            <div className="tw-flex tw-flex-col">
                <div
                    className="tw-flex tw-items-center tw-mb-1 tw-rounded-t-sm tw-font-bold tw-pl-1 tw-pr-1"
                    style={{
                        background: `linear-gradient(to top, #1e1e1e, ${getBorderColor(NodeType.CLI, {
                            error: data.error,
                            executing: data.executing,
                            moving: data.moving,
                            selected,
                            interrupted: data.interrupted,
                            active: data.active,
                        })}`,
                        color: 'var(--vscode-dropdown-foreground)',
                        marginLeft: '-0.5rem',
                        marginRight: '-0.5rem',
                        marginTop: '-0.5rem',
                    }}
                >
                    <div className="tw-flex-grow tw-text-center">CLI</div>
                    <RunOnlyThisButton
                        nodeId={id}
                        className="tw-w-[1.75rem] tw-h-[1.75rem]"
                        title="Run only this node"
                        disabled={!!data.executing}
                    />
                    <RunFromHereButton nodeId={id} className="tw-w-[1.75rem] tw-h-[1.75rem]" />
                </div>
                <div
                    className="tw-flex tw-items-center tw-justify-center tw-cursor-pointer"
                    onDoubleClick={handleBodyDoubleClick}
                >
                    <span>{data.title}</span>
                </div>
                <TextEditorModal
                    isOpen={data.isEditing === true}
                    value={draft}
                    onChange={setDraft}
                    onConfirm={handleCommit}
                    onCancel={handleCancel}
                    title={
                        data.title ??
                        (((data as any).mode ?? 'command') === 'script' ? 'Edit Script' : 'Edit Command')
                    }
                    onSwitchToResults={() => {
                        window.dispatchEvent(
                            new CustomEvent('nebula-open-result-editor', { detail: { id } })
                        )
                    }}
                />
            </div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    )
}
