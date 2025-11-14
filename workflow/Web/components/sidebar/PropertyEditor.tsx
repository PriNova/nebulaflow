import { NodeType, type WorkflowNodes } from '@nodes/Nodes'
import type React from 'react'
import { Button } from '../../ui/shadcn/ui/button'
import { Checkbox } from '../../ui/shadcn/ui/checkbox'
import { Input } from '../../ui/shadcn/ui/input'
import { Label } from '../../ui/shadcn/ui/label'
import type { AccumulatorNode } from '../nodes/Accumulator_Node'
import type { LLMNode } from '../nodes/LLM_Node'
import type { LoopStartNode } from '../nodes/LoopStart_Node'
import type { VariableNode } from '../nodes/Variable_Node'
import { AccumulatorProperties } from './properties/AccumulatorProperties'
import { CLIProperties } from './properties/CLIProperties'
import { IfElseProperties } from './properties/IfElseProperties'
import { InputProperties } from './properties/InputProperties'
import { LLMProperties } from './properties/LLMProperties'
import { LoopStartProperties } from './properties/LoopStartProperties'
import { PreviewProperties } from './properties/PreviewProperties'
import { VariableProperties } from './properties/VariableProperties'

interface PropertyEditorProps {
    node: WorkflowNodes
    onUpdate: (nodeId: string, data: Partial<WorkflowNodes['data']>) => void
    models: { id: string; title?: string }[]
    onSaveCustomNode: (node: WorkflowNodes) => void
    nodeError?: string
}

export const PropertyEditor: React.FC<PropertyEditorProps> = ({
    node,
    onUpdate,
    models,
    onSaveCustomNode,
    nodeError,
}) => {
    const handleSaveCustomNode = () => {
        if (
            node.type !== NodeType.LOOP_START &&
            node.type !== NodeType.LOOP_END &&
            node.type !== NodeType.IF_ELSE &&
            node.type !== NodeType.PREVIEW
        ) {
            onSaveCustomNode(node)
        }
    }

    const renderNodeSpecificProperties = () => {
        switch (node.type) {
            case NodeType.CLI:
                return (
                    <CLIProperties
                        node={node}
                        onUpdate={onUpdate}
                        onSaveCustomNode={handleSaveCustomNode}
                        nodeError={nodeError}
                    />
                )
            case NodeType.LLM:
                return (
                    <LLMProperties
                        node={node as LLMNode}
                        onUpdate={onUpdate}
                        models={models}
                        onSaveCustomNode={handleSaveCustomNode}
                        nodeError={nodeError}
                    />
                )
            case NodeType.INPUT:
                return (
                    <InputProperties
                        node={node}
                        onUpdate={onUpdate}
                        onSaveCustomNode={handleSaveCustomNode}
                    />
                )
            case NodeType.PREVIEW:
                return <PreviewProperties node={node} onUpdate={onUpdate} />
            case NodeType.LOOP_START:
                return <LoopStartProperties node={node as LoopStartNode} onUpdate={onUpdate} />
            case NodeType.ACCUMULATOR:
                return (
                    <AccumulatorProperties
                        node={node as AccumulatorNode}
                        onUpdate={onUpdate}
                        onSaveCustomNode={handleSaveCustomNode}
                    />
                )
            case NodeType.VARIABLE:
                return (
                    <VariableProperties
                        node={node as VariableNode}
                        onUpdate={onUpdate}
                        onSaveCustomNode={handleSaveCustomNode}
                    />
                )
            case NodeType.IF_ELSE:
                return <IfElseProperties node={node} onUpdate={onUpdate} />
            default:
                return null
        }
    }

    return (
        <div className="tw-flex tw-flex-col tw-gap-4">
            <div className="tw-flex tw-items-center tw-space-x-1">
                <Checkbox
                    id="node-active"
                    checked={node.data.active !== false}
                    onCheckedChange={checked => onUpdate(node.id, { active: checked !== false })}
                />
                <Label htmlFor="node-active">Node Active</Label>
            </div>
            <div className="tw-flex tw-items-center tw-space-x-1">
                <Checkbox
                    id={`node-bypass-${node.id}`}
                    checked={!!node.data.bypass}
                    onCheckedChange={checked => onUpdate(node.id, { bypass: checked === true })}
                />
                <Label htmlFor={`node-bypass-${node.id}`}>Bypass (use previous result)</Label>
            </div>
            <div>
                <Label htmlFor="node-title">Title</Label>
                <Input
                    id="node-title"
                    className="tw-h-8 tw-py-1 tw-text-sm"
                    value={node.data.title}
                    onChange={(e: { target: { value: any } }) =>
                        onUpdate(node.id, { title: e.target.value })
                    }
                />
                {node.type === NodeType.SUBFLOW ? (
                    <div className="tw-mt-2 tw-flex tw-justify-end">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                window.dispatchEvent(
                                    new CustomEvent('nebula-save-subflow' as any, {
                                        detail: { nodeId: node.id },
                                    })
                                )
                            }}
                        >
                            Save as Subflow
                        </Button>
                    </div>
                ) : null}
            </div>
            {renderNodeSpecificProperties()}
        </div>
    )
}
