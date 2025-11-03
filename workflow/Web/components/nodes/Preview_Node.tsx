import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import type React from 'react'
import { useCallback, useEffect } from 'react'
import { Textarea } from '../../ui/shadcn/ui/textarea'
import { MarkdownPreviewModal } from '../MarkdownPreviewModal'
import { FanInTargetHandles } from './FanInTargetHandles'
import {
    type BaseNodeData,
    type BaseNodeProps,
    NodeType,
    type WorkflowNode,
    getBorderColor,
    getNodeStyle,
} from './Nodes'

export type PreviewNode = Omit<WorkflowNode, 'data'> & { type: NodeType.PREVIEW; data: BaseNodeData }

export const PreviewNode: React.FC<BaseNodeProps & { data: BaseNodeData }> = ({
    id,
    data,
    selected,
}) => {
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

    const handleBodyDoubleClick = () => {
        dispatchEditEvent('start')
    }

    const handleConfirm = () => {
        dispatchEditEvent('commit')
    }

    const handleCancel = () => {
        dispatchEditEvent('cancel')
    }

    return (
        <div
            style={getNodeStyle(
                NodeType.PREVIEW,
                data.moving,
                selected,
                data.executing,
                data.error,
                data.active,
                data.interrupted
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
                <div className="tw-flex tw-flex-col">
                    <div
                        className="tw-text-center tw-mb-1 tw-rounded-t-sm tw-font-bold"
                        style={{
                            background: `linear-gradient(to top, #1e1e1e, ${getBorderColor(
                                NodeType.PREVIEW,
                                {
                                    error: data.error,
                                    executing: data.executing,
                                    moving: data.moving,
                                    selected,
                                    interrupted: data.interrupted,
                                    active: data.active,
                                }
                            )})`,
                            color: 'var(--vscode-dropdown-foreground)',
                            marginLeft: '-0.5rem',
                            marginRight: '-0.5rem',
                            marginTop: '-0.5rem',
                        }}
                    >
                        PREVIEW
                    </div>
                    <div className="tw-flex tw-justify-between tw-items-center">
                        <span>{data.title}</span>
                        <span className="tw-text-sm tw-opacity-70">Tokens: {data.tokenCount || 0}</span>
                    </div>
                </div>
                <Textarea
                    className="tw-w-full tw-h-24 tw-p-2 tw-rounded nodrag tw-resize tw-border-2 tw-border-solid tw-border-[var(--xy-node-border-default)]"
                    style={{
                        color: 'var(--vscode-editor-foreground)',
                        backgroundColor: 'var(--vscode-input-background)',
                        outline: 'none',
                    }}
                    value={data.content || ''}
                    readOnly
                    onDoubleClick={handleBodyDoubleClick}
                    placeholder="Preview content will appear here..."
                />
                <MarkdownPreviewModal
                    isOpen={data.isEditing === true}
                    value={data.content || ''}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    title={data.title ?? 'Preview'}
                />
            </div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    )
}
