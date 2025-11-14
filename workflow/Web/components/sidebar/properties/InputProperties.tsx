import type { WorkflowNodes } from '@nodes/Nodes'
import { Save } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Button } from '../../../ui/shadcn/ui/button'
import { Label } from '../../../ui/shadcn/ui/label'
import { Textarea } from '../../../ui/shadcn/ui/textarea'
import { TextEditorModal } from '../../modals/TextEditorModal'

interface InputPropertiesProps {
    node: WorkflowNodes
    onUpdate: (nodeId: string, data: Partial<WorkflowNodes['data']>) => void
    onSaveCustomNode: (node: WorkflowNodes) => void
}

export const InputProperties: React.FC<InputPropertiesProps> = ({
    node,
    onUpdate,
    onSaveCustomNode,
}) => {
    const [isInputEditorOpen, setIsInputEditorOpen] = useState(false)
    const [inputDraft, setInputDraft] = useState('')

    return (
        <div className="tw-flex tw-flex-col tw-gap-2">
            <Button
                variant="secondary"
                size="sm"
                onClick={() => onSaveCustomNode(node)}
                className="tw-w-full"
            >
                <Save className="tw-mr-2" size={14} />
                Save as Custom Node
            </Button>
            <div>
                <Label htmlFor="node-input">Input Text</Label>
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
                    title={node.data.title ?? 'Edit Input Text'}
                />
            </div>
        </div>
    )
}
