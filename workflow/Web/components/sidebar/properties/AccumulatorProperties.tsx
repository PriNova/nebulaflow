import { Save } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Button } from '../../../ui/shadcn/ui/button'
import { Input } from '../../../ui/shadcn/ui/input'
import { Label } from '../../../ui/shadcn/ui/label'
import { Textarea } from '../../../ui/shadcn/ui/textarea'
import { TextEditorModal } from '../../modals/TextEditorModal'
import type { AccumulatorNode } from '../../nodes/Accumulator_Node'

interface AccumulatorPropertiesProps {
    node: AccumulatorNode
    onUpdate: (nodeId: string, data: Partial<AccumulatorNode['data']>) => void
    onSaveCustomNode: (node: AccumulatorNode) => void
}

export const AccumulatorProperties: React.FC<AccumulatorPropertiesProps> = ({
    node,
    onUpdate,
    onSaveCustomNode,
}) => {
    const [isInputEditorOpen, setIsInputEditorOpen] = useState(false)
    const [inputDraft, setInputDraft] = useState('')

    return (
        <div className="tw-flex tw-flex-col tw-gap-4">
            <div>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onSaveCustomNode(node)}
                    className="tw-w-full"
                >
                    <Save className="tw-mr-2" size={14} />
                    Save as Custom Node
                </Button>
                <Label htmlFor="accumulator-variable-name">Unique Variable Name</Label>
                <Input
                    id="accumulator-variable-name"
                    className="tw-h-8 tw-py-1 tw-text-sm"
                    value={node.data.variableName || ''}
                    onChange={(e: { target: { value: any } }) =>
                        onUpdate(node.id, { variableName: e.target.value })
                    }
                    placeholder="Unique variable name to access accumulated value (e.g., accumulatedSummary)"
                    required
                />
            </div>
            <div>
                <Label htmlFor="accumulator-initial-value">Input Text</Label>
                <Textarea
                    id="node-input"
                    className="tw-min-h-[48px] tw-text-sm tw-py-1"
                    value={node.data.content || ''}
                    onChange={(e: { target: { value: any } }) =>
                        onUpdate(node.id, { content: e.target.value })
                    }
                    onDoubleClick={() => {
                        setInputDraft(node.data.content || '')
                        setIsInputEditorOpen(true)
                    }}
                    placeholder="Enter input text... (use ${1}, ${2} and so on for positional inputs)"
                />
                <TextEditorModal
                    isOpen={isInputEditorOpen}
                    value={inputDraft}
                    onChange={setInputDraft}
                    onConfirm={() => {
                        onUpdate(node.id, { content: inputDraft })
                        setIsInputEditorOpen(false)
                    }}
                    onCancel={() => setIsInputEditorOpen(false)}
                    title={node.data.title ?? 'Edit Accumulator Input'}
                />
            </div>
        </div>
    )
}
