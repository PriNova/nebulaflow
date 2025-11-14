import type { WorkflowNodes } from '@nodes/Nodes'
import type React from 'react'
import { Button } from '../../../ui/shadcn/ui/button'

interface PreviewPropertiesProps {
    node: WorkflowNodes
    onUpdate: (nodeId: string, data: Partial<WorkflowNodes['data']>) => void
}

export const PreviewProperties: React.FC<PreviewPropertiesProps> = ({ node, onUpdate }) => {
    return (
        <div className="tw-flex tw-flex-col tw-gap-2">
            <div className="tw-flex tw-gap-2">
                <Button
                    size="sm"
                    className="tw-w-full tw-bg-red-500 tw-text-white hover:tw-bg-red-600"
                    onClick={() => onUpdate(node.id, { content: '' })}
                    title="Clear content"
                    variant={'secondary'}
                >
                    Clear Content
                </Button>
            </div>
        </div>
    )
}
