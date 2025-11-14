import { TextEditorModal } from '@modals/TextEditorModal'
import RunFromHereButton from '@shared/RunFromHereButton'
import RunOnlyThisButton from '@shared/RunOnlyThisButton'
import { Handle, Position } from '@xyflow/react'
import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
    type BaseNodeData,
    type BaseNodeProps,
    NodeType,
    type WorkflowNode,
    getBorderColor,
    getNodeStyle,
} from './Nodes'

export type VariableNode = Omit<WorkflowNode, 'data'> & {
    type: NodeType.VARIABLE
    data: BaseNodeData & { variableName: string; initialValue?: string }
}

export const VariableNode: React.FC<BaseNodeProps> = ({ id, data, selected }) => {
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
                NodeType.INPUT,
                data.moving,
                selected,
                data.executing,
                data.error,
                data.active,
                data.interrupted,
                data.bypass
            )}
        >
            <Handle type="target" position={Position.Top} />
            <div className="tw-flex tw-flex-col">
                <div
                    className="tw-flex tw-items-center tw-mb-1 tw-rounded-t-sm tw-font-bold tw-pl-1 tw-pr-1"
                    style={{
                        background: `linear-gradient(to top, #1e1e1e, ${getBorderColor(NodeType.INPUT, {
                            error: data.error,
                            executing: data.executing,
                            moving: data.moving,
                            selected,
                            interrupted: data.interrupted,
                            active: data.active,
                        })})`,
                        color: '#1e1e1e',
                        marginLeft: '-0.5rem',
                        marginRight: '-0.5rem',
                        marginTop: '-0.5rem',
                    }}
                >
                    <div className="tw-flex-grow tw-text-center">VARIABLE</div>
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
                    title={data.title ?? 'Edit Variable Input'}
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
