import type { WorkflowNodes } from '@nodes/Nodes'
import type React from 'react'
import { useState } from 'react'
import { Label } from '../../../ui/shadcn/ui/label'
import { Textarea } from '../../../ui/shadcn/ui/textarea'
import { TextEditorModal } from '../../modals/TextEditorModal'

interface IfElsePropertiesProps {
    node: WorkflowNodes
    onUpdate: (nodeId: string, data: Partial<WorkflowNodes['data']>) => void
}

export const IfElseProperties: React.FC<IfElsePropertiesProps> = ({ node, onUpdate }) => {
    const [isConditionEditorOpen, setIsConditionEditorOpen] = useState(false)
    const [conditionDraft, setConditionDraft] = useState('')

    return (
        <div className="tw-flex tw-flex-col tw-gap-2">
            <Label htmlFor="ifelse-condition">Condition</Label>
            <Textarea
                id="ifelse-condition"
                className="tw-min-h-[48px] tw-text-sm tw-py-1"
                value={node.data.content || ''}
                onChange={(e: { target: { value: any } }) =>
                    onUpdate(node.id, { content: e.target.value })
                }
                onDoubleClick={() => {
                    setConditionDraft(node.data.content || '')
                    setIsConditionEditorOpen(true)
                }}
                placeholder="e.g., ${1} === done or ${1} !== error"
            />
            <TextEditorModal
                isOpen={isConditionEditorOpen}
                value={conditionDraft}
                onChange={setConditionDraft}
                onConfirm={() => {
                    onUpdate(node.id, { content: conditionDraft })
                    setIsConditionEditorOpen(false)
                }}
                onCancel={() => setIsConditionEditorOpen(false)}
                title={node.data.title ?? 'Edit Condition'}
            />
        </div>
    )
}
