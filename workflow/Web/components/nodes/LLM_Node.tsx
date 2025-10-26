import { Handle, Position } from '@xyflow/react'
import type React from 'react'
import nebulaMark from '../../assets/nebula-mark.svg'
import type { Model } from '../../services/Protocol'
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

export const LLMNode: React.FC<BaseNodeProps> = ({ id, data, selected }) => (
    <div
        style={getNodeStyle(
            NodeType.LLM,
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
            <div className="tw-flex tw-items-center tw-justify-center">
                <span>{data.title}</span>
            </div>
        </div>
        <Handle type="source" position={Position.Bottom} />
    </div>
)
