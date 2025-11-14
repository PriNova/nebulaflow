import { TextEditorModal } from '@modals/TextEditorModal'
import RunFromHereButton from '@shared/RunFromHereButton'
import RunOnlyThisButton from '@shared/RunOnlyThisButton'
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import nebulaMark from '../../assets/nebula-mark.svg'
import type { Model } from '../../services/Protocol'
import { FanInTargetHandles } from './FanInTargetHandles'
import {
    type BaseNodeData,
    type BaseNodeProps,
    NodeType,
    type WorkflowNode,
    getBorderColor,
    getNodeStyle,
} from './Nodes'

export type LLMNode = Omit<WorkflowNode, 'data'> & {
    type: NodeType.LLM
    data: BaseNodeData & {
        model?: Model
        disabledTools?: string[]
        timeoutSec?: number
        dangerouslyAllowAll?: boolean
        reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
    }
}

export const LLMNode: React.FC<BaseNodeProps> = ({ id, data, selected }) => {
    const [draft, setDraft] = useState('')
    const updateNodeInternals = useUpdateNodeInternals()

    // biome-ignore lint/correctness/useExhaustiveDependencies: we must refresh handles when the count changes
    useEffect(() => {
        if (data?.fanInEnabled) updateNodeInternals(id)
    }, [id, data?.fanInEnabled, data?.inputPortCount, updateNodeInternals])

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
                NodeType.LLM,
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
                        background: `linear-gradient(to top, #1e1e1e, ${getBorderColor(NodeType.LLM, {
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
                    <img
                        src={nebulaMark}
                        alt="NebulaFlow"
                        style={{ width: '21px', height: '21px', marginRight: '0.25rem' }}
                    />
                    <div className="tw-text-center tw-flex-grow">Agent</div>
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
                    title={data.title ?? 'Edit Agent Prompt'}
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
