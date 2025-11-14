import { Save } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Button } from '../../../ui/shadcn/ui/button'
import { Input } from '../../../ui/shadcn/ui/input'
import { Label } from '../../../ui/shadcn/ui/label'
import { Textarea } from '../../../ui/shadcn/ui/textarea'
import { TextEditorModal } from '../../modals/TextEditorModal'
import type { VariableNode } from '../../nodes/Variable_Node'

interface VariablePropertiesProps {
    node: VariableNode
    onUpdate: (nodeId: string, data: Partial<VariableNode['data']>) => void
    onSaveCustomNode: (node: VariableNode) => void
}

export const VariableProperties: React.FC<VariablePropertiesProps> = ({
    node,
    onUpdate,
    onSaveCustomNode,
}) => {
    const [isVariableEditorOpen, setIsVariableEditorOpen] = useState(false)
    const [variableDraft, setVariableDraft] = useState('')

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
                <Label htmlFor="variable-variable-name">Unique Variable Name</Label>
                <Input
                    id="variable-variable-name"
                    className="tw-h-8 tw-py-1 tw-text-sm"
                    value={node.data.variableName || ''}
                    onChange={(e: { target: { value: any } }) =>
                        onUpdate(node.id, { variableName: e.target.value })
                    }
                    placeholder="Unique variable name to access variable value (e.g., summaryText)"
                    required
                />
            </div>
            <div>
                <Label htmlFor="variable-initial-value">Input Text</Label>
                <Textarea
                    id="node-input"
                    className="tw-min-h-[48px] tw-text-sm tw-py-1"
                    value={node.data.content || ''}
                    onChange={(e: { target: { value: any } }) =>
                        onUpdate(node.id, { content: e.target.value })
                    }
                    onDoubleClick={() => {
                        setVariableDraft(node.data.content || '')
                        setIsVariableEditorOpen(true)
                    }}
                    placeholder="Enter input text... (use ${1}, ${2} and so on for positional inputs)"
                />
                <TextEditorModal
                    isOpen={isVariableEditorOpen}
                    value={variableDraft}
                    onChange={setVariableDraft}
                    onConfirm={() => {
                        onUpdate(node.id, { content: variableDraft })
                        setIsVariableEditorOpen(false)
                    }}
                    onCancel={() => setIsVariableEditorOpen(false)}
                    title={node.data.title ?? 'Edit Input Text'}
                />
            </div>
        </div>
    )
}
