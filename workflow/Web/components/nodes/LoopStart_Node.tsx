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

export type LoopStartNode = Omit<WorkflowNode, 'data'> & {
    type: NodeType.LOOP_START
    data: BaseNodeData & { iterations: number; loopVariable: string; overrideIterations?: boolean }
}

export const LoopStartNode: React.FC<BaseNodeProps> = ({ id, data, selected }) => (
    <div
        style={getNodeStyle(
            NodeType.LOOP_START,
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
        <Handle type="target" position={Position.Left} id="iterations-override" style={{ top: '83%' }} />
        <div className="tw-flex tw-flex-col">
            <div
                className="tw-flex tw-items-center tw-mb-1 tw-rounded-t-sm tw-font-bold tw-pl-1 tw-pr-1"
                style={{
                    background: `linear-gradient(to top, #1e1e1e, ${getBorderColor(NodeType.LOOP_START, {
                        error: data.error,
                        executing: data.executing,
                        moving: data.moving,
                        selected,
                        interrupted: data.interrupted,
                        active: data.active,
                    })})`,
                    color: ' #1e1e1e',
                    marginLeft: '-0.5rem',
                    marginRight: '-0.5rem',
                    marginTop: '-0.5rem',
                }}
            >
                <div className="tw-flex-grow tw-text-center">LOOP START</div>
                <RunFromHereButton nodeId={id} className="tw-w-[1.75rem] tw-h-[1.75rem]" />
            </div>
            <div className="tw-flex tw-flex-col tw-justify-center">
                <span>{data.title}</span>
                <span className="tw-text-sm tw-opacity-70">Iterations: {data.iterations || 1}</span>
                <span className="tw-text-xs tw-opacity-50">← Iterations Override</span>
            </div>
        </div>
        <Handle type="source" position={Position.Bottom} />
    </div>
)
