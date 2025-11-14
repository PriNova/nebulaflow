import type React from 'react'
import { Input } from '../../../ui/shadcn/ui/input'
import { Label } from '../../../ui/shadcn/ui/label'
import type { LoopStartNode } from '../../nodes/LoopStart_Node'

interface LoopStartPropertiesProps {
    node: LoopStartNode
    onUpdate: (nodeId: string, data: Partial<LoopStartNode['data']>) => void
}

export const LoopStartProperties: React.FC<LoopStartPropertiesProps> = ({ node, onUpdate }) => {
    return (
        <div className="tw-flex tw-flex-col tw-gap-4">
            <div>
                <Label htmlFor="loop-iterations">Iterations</Label>
                <Input
                    id="loop-iterations"
                    className="tw-h-8 tw-py-1 tw-text-sm"
                    type="number"
                    min={1}
                    max={100}
                    value={node.data.iterations || 1}
                    onChange={(e: { target: { value: any } }) =>
                        onUpdate(node.id, { iterations: Number.parseInt(e.target.value, 10) })
                    }
                />
            </div>
            <div>
                <Label htmlFor="loop-variable">Loop Variable Name</Label>
                <Input
                    id="loop-variable"
                    className="tw-h-8 tw-py-1 tw-text-sm"
                    value={node.data.loopVariable || 'i'}
                    onChange={(e: { target: { value: any } }) =>
                        onUpdate(node.id, { loopVariable: e.target.value })
                    }
                    placeholder="Variable name (e.g. i, counter, index)"
                />
            </div>
        </div>
    )
}
