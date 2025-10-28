import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import { useEffect } from 'react'
import RunFromHereButton from '../RunFromHereButton'
import { FanInTargetHandles } from './FanInTargetHandles'
import {
    type BaseNodeData,
    type BaseNodeProps,
    NodeType,
    type WorkflowNode,
    getBorderColor,
    getNodeStyle,
} from './Nodes'

export type AccumulatorNode = Omit<WorkflowNode, 'data'> & {
    type: NodeType.ACCUMULATOR
    data: BaseNodeData & { variableName: string; initialValue?: string }
}

export const AccumulatorNode: React.FC<BaseNodeProps> = ({ id, data, selected }) => {
    const updateNodeInternals = useUpdateNodeInternals()

    // biome-ignore lint/correctness/useExhaustiveDependencies: we must refresh handles when the count changes
    useEffect(() => {
        if (data?.fanInEnabled) updateNodeInternals(id)
    }, [id, data?.fanInEnabled, data?.inputPortCount, updateNodeInternals])

    return (
        <div
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
                    <div className="tw-flex-grow tw-text-center">ACCUMULATOR</div>
                    <RunFromHereButton nodeId={id} className="tw-w-[1.75rem] tw-h-[1.75rem]" />
                </div>
                <div className="tw-flex tw-items-center tw-justify-center">
                    <span>{data.title}</span>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    )
}
