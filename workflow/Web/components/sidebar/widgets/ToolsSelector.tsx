import type React from 'react'
import { getAllToolNames } from '../../../services/toolNames'
import { Button } from '../../../ui/shadcn/ui/button'
import { Label } from '../../../ui/shadcn/ui/label'
import type { LLMNode } from '../../nodes/LLM_Node'

interface ToolsSelectorProps {
    node: LLMNode
    onUpdate: (nodeId: string, data: Partial<LLMNode['data']>) => void
}

export const ToolsSelector: React.FC<ToolsSelectorProps> = ({ node, onUpdate }) => {
    const toolNames = getAllToolNames()
    const disabled = (node.data.disabledTools ?? []) as string[]

    const onToggle = (tool: string, enabled: boolean) => {
        const next = new Set(disabled)
        if (enabled) next.delete(tool)
        else next.add(tool)
        const updates: Partial<LLMNode['data']> = {
            disabledTools: Array.from(next),
        }
        if (tool === 'Bash' && !enabled && (node.data.dangerouslyAllowAll ?? false)) {
            updates.dangerouslyAllowAll = false
        }
        onUpdate(node.id, updates)
    }

    return (
        <div className="tw-mt-2">
            <Label>Tools</Label>
            <div className="tw-flex tw-flex-wrap tw-gap-1.5 tw-mt-2">
                {toolNames.map(tool => {
                    const isDisabled = disabled.includes(tool)
                    const enabled = !isDisabled
                    return (
                        <Button
                            key={tool}
                            type="button"
                            size="sm"
                            variant={enabled ? 'secondary' : 'outline'}
                            aria-pressed={enabled}
                            onClick={() => onToggle(tool, !enabled)}
                            className="tw-h-7 tw-text-xs tw-rounded-full tw-px-2 tw-whitespace-nowrap tw-max-w-full tw-overflow-hidden tw-text-ellipsis"
                            title={tool}
                        >
                            <span className={enabled ? '' : 'tw-line-through tw-opacity-70'}>
                                {tool}
                            </span>
                        </Button>
                    )
                })}
            </div>
        </div>
    )
}
