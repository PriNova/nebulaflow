import { Handle, Position } from '@xyflow/react'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Textarea } from '../../ui/shadcn/ui/textarea'
import RunFromHereButton from '../RunFromHereButton'
import RunOnlyThisButton from '../RunOnlyThisButton'
import {
    type BaseNodeData,
    type BaseNodeProps,
    NodeType,
    type WorkflowNode,
    getBorderColor,
    getNodeStyle,
} from './Nodes'

export type TextNode = Omit<WorkflowNode, 'data'> & { type: NodeType.INPUT; data: BaseNodeData }

export const TextNode: React.FC<BaseNodeProps & { data: BaseNodeData }> = ({ id, data, selected }) => {
    const [draft, setDraft] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const shouldRefocusRef = useRef(false)

    const dispatchEditEvent = useCallback(
        (action: 'start' | 'commit' | 'cancel', content?: string) => {
            const detail: any = { id, action }
            if (content !== undefined) {
                detail.content = content
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
        if (data.isEditing && textareaRef.current) {
            setDraft(data.content || '')
            textareaRef.current.focus()
            textareaRef.current.selectionStart = textareaRef.current.value.length
            textareaRef.current.selectionEnd = textareaRef.current.value.length
        }
    }, [data.isEditing, data.content])

    const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Allow Shift+Enter to create a newline but prevent bubbling to background handlers
        if (e.key === 'Enter' && e.shiftKey) {
            e.stopPropagation()
            return
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            e.stopPropagation()
            dispatchEditEvent('commit', draft)
        } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            dispatchEditEvent('cancel')
        }
    }

    const handleTextareaBlur = () => {
        if (data.isEditing && !shouldRefocusRef.current) {
            dispatchEditEvent('commit', draft)
        }
    }

    const handleBodyDoubleClick = () => {
        dispatchEditEvent('start')
    }

    return (
        <div
            role="button"
            tabIndex={selected ? 0 : -1}
            style={getNodeStyle(
                NodeType.INPUT,
                data.moving,
                selected,
                data.executing,
                data.error,
                data.active,
                data.interrupted
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
                    <div className="tw-flex-grow tw-text-center">TEXT</div>
                    <RunOnlyThisButton
                        nodeId={id}
                        className="tw-w-[1.75rem] tw-h-[1.75rem]"
                        title="Run only this node"
                        disabled={!!data.executing}
                    />
                    <RunFromHereButton nodeId={id} className="tw-w-[1.75rem] tw-h-[1.75rem]" />
                </div>
                {data.isEditing ? (
                    <Textarea
                        ref={textareaRef}
                        className="tw-w-full tw-h-24 tw-p-2 tw-rounded nodrag tw-resize tw-border-2 tw-border-solid tw-border-[var(--xy-node-border-default)]"
                        style={{
                            color: 'var(--vscode-editor-foreground)',
                            backgroundColor: 'var(--vscode-input-background)',
                            outline: 'none',
                        }}
                        value={draft}
                        onChange={e => {
                            setDraft(e.currentTarget.value)
                        }}
                        onKeyDown={handleTextareaKeyDown}
                        onBlur={handleTextareaBlur}
                        onMouseDown={e => e.stopPropagation()}
                    />
                ) : (
                    <div
                        className="tw-flex tw-items-center tw-justify-center tw-cursor-text"
                        onDoubleClick={handleBodyDoubleClick}
                    >
                        <span style={{ whiteSpace: 'pre-wrap' }}>{data.title || 'Text'}</span>
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    )
}
