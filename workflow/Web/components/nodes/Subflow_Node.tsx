import RunFromHereButton from '@shared/RunFromHereButton'
import RunOnlyThisButton from '@shared/RunOnlyThisButton'
import { useUpdateNodeInternals } from '@xyflow/react'
import type React from 'react'
import { useEffect } from 'react'
import { FanInTargetHandles } from './FanInTargetHandles'
import { FanOutSourceHandles } from './FanOutSourceHandles'
import {
    type BaseNodeData,
    type BaseNodeProps,
    NodeType,
    type WorkflowNode,
    getBorderColor,
    getNodeStyle,
} from './Nodes'

export type SubflowNode = Omit<WorkflowNode, 'data'> & {
    type: NodeType.SUBFLOW
    data: BaseNodeData & {
        subflowId: string
        inputPortCount?: number
        outputPortCount?: number
        title: string
        disabledOutputHandles?: string[]
    }
}

export const SubflowNode: React.FC<BaseNodeProps & { data: SubflowNode['data'] }> = ({
    id,
    data,
    selected,
}) => {
    const updateNodeInternals = useUpdateNodeInternals()

    // Keep React Flow's handle registry in sync when fan-in/out ports change
    // biome-ignore lint/correctness/useExhaustiveDependencies: we must refresh handles when the count changes
    useEffect(() => {
        updateNodeInternals(id)
    }, [id, data?.inputPortCount, data?.outputPortCount, updateNodeInternals])

    const openSubflow = () => {
        window.dispatchEvent(
            new CustomEvent('nebula-open-subflow' as any, {
                detail: { nodeId: id, subflowId: data.subflowId },
            })
        )
    }

    const stop = (e: React.MouseEvent | React.PointerEvent) => {
        e.stopPropagation()
        e.preventDefault()
    }

    return (
        <div
            role="button"
            tabIndex={0}
            style={getNodeStyle(
                NodeType.SUBFLOW,
                data.moving,
                selected,
                data.executing,
                data.error,
                data.active,
                data.interrupted,
                data.bypass
            )}
        >
            {
                <FanInTargetHandles
                    count={Math.max(1, data?.inputPortCount ?? 1)}
                    edgeByHandle={data?.inputEdgeIdByHandle}
                />
            }
            <div className="tw-flex tw-flex-col">
                <div
                    className="tw-flex tw-items-center tw-mb-1 tw-rounded-t-sm tw-font-bold tw-pl-1 tw-pr-1"
                    style={{
                        background: `linear-gradient(to top, #1e1e1e, ${getBorderColor(
                            NodeType.SUBFLOW,
                            {
                                error: data.error,
                                executing: data.executing,
                                moving: data.moving,
                                selected,
                                interrupted: data.interrupted,
                                active: data.active,
                            }
                        )})`,
                        color: '#1e1e1e',
                        marginLeft: '-0.5rem',
                        marginRight: '-0.5rem',
                        marginTop: '-0.5rem',
                    }}
                >
                    <div className="tw-flex-grow tw-text-center">SUBFLOW</div>
                    <button
                        type="button"
                        className="nodrag nopan tw-text-xs tw-mr-1 tw-border tw-rounded tw-px-1 tw-py-0"
                        onMouseDown={stop}
                        onPointerDown={stop}
                        onClick={e => {
                            stop(e)
                            openSubflow()
                        }}
                        title="Open Subflow"
                        disabled={!data.subflowId}
                    >
                        Open
                    </button>
                    <button
                        type="button"
                        className="nodrag nopan tw-text-xs tw-mr-1 tw-border tw-rounded tw-px-1 tw-py-0"
                        onMouseDown={stop}
                        onPointerDown={stop}
                        onClick={e => {
                            stop(e)
                            window.dispatchEvent(
                                new CustomEvent('nebula-duplicate-subflow' as any, {
                                    detail: { id: data.subflowId, nodeId: id },
                                })
                            )
                        }}
                        title="Convert to Inline Copy"
                        disabled={!!data.executing}
                    >
                        Inline Copy
                    </button>
                    <RunOnlyThisButton
                        nodeId={id}
                        className="tw-w-[1.75rem] tw-h-[1.75rem]"
                        title="Run only this node"
                        disabled={!data.subflowId || !!data.executing}
                    />
                    <RunFromHereButton
                        nodeId={id}
                        className="tw-w-[1.75rem] tw-h-[1.75rem]"
                        disabled={!data.subflowId || !!data.executing}
                    />
                </div>
                <div className="tw-flex tw-items-center tw-justify-center">
                    <span style={{ whiteSpace: 'pre-wrap' }}>{data.title || 'Subflow'}</span>
                </div>
                {data.executing && typeof data.result === 'string' && data.result.includes('/') ? (
                    <div className="tw-text-center tw-text-xs" style={{ opacity: 0.8 }}>
                        {data.result}
                    </div>
                ) : null}
            </div>
            {
                <FanOutSourceHandles
                    count={Math.max(1, data?.outputPortCount ?? 1)}
                    disabledHandles={new Set(data?.disabledOutputHandles ?? [])}
                />
            }
        </div>
    )
}
