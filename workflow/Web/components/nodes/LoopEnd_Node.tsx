import { Handle, Position } from '@xyflow/react'
import type React from 'react'
import RunFromHereButton from '../RunFromHereButton'
import {
    type BaseNodeData,
    type BaseNodeProps,
    NodeType,
    type WorkflowNode,
    getBorderColor,
    getNodeStyle,
} from './Nodes'

export type LoopEndNode = Omit<WorkflowNode, 'data'> & { type: NodeType.LOOP_END; data: BaseNodeData }

export const LoopEndNode: React.FC<BaseNodeProps> = ({ id, data, selected }) => (
    <div
        style={getNodeStyle(
            NodeType.LOOP_END,
            data.moving,
            selected,
            data.executing,
            data.error,
            data.active,
            data.interrupted,
            data.bypass,
            'double'
        )}
    >
        <Handle type="target" position={Position.Top} />
        <div className="tw-flex tw-flex-col">
            <div
                className="tw-flex tw-items-center tw-mb-1 tw-rounded-t-sm tw-font-bold tw-pl-1 tw-pr-1"
                style={{
                    background: `linear-gradient(to top, #1e1e1e, ${getBorderColor(NodeType.LOOP_END, {
                        error: data.error,
                        executing: data.executing,
                        moving: data.moving,
                        selected,
                        interrupted: data.interrupted,
                        active: data.active,
                    })}`,
                    color: ' #1e1e1e',
                    marginLeft: '-0.5rem',
                    marginRight: '-0.5rem',
                    marginTop: '-0.5rem',
                }}
            >
                <div className="tw-flex-grow tw-text-center">LOOP END</div>
                <RunFromHereButton nodeId={id} className="tw-w-[1.75rem] tw-h-[1.75rem]" />
            </div>
            <div className="tw-flex tw-items-center tw-justify-center">
                <span>{data.title}</span>
            </div>
        </div>
        <Handle type="source" position={Position.Bottom} />
    </div>
)
