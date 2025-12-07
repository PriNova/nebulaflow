import type React from 'react'
import { getAllToolNames } from '../../../services/toolNames'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '../../../ui/shadcn/ui/accordion'
import { Checkbox } from '../../../ui/shadcn/ui/checkbox'
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

    const allEnabled = toolNames.every(tool => !disabled.includes(tool))

    const onToggleAll = (enabled: boolean) => {
        const updates: Partial<LLMNode['data']> = {
            disabledTools: enabled ? [] : [...toolNames],
        }

        if (!enabled && (node.data.dangerouslyAllowAll ?? false)) {
            updates.dangerouslyAllowAll = false
        }

        onUpdate(node.id, updates)
    }

    return (
        <div className="tw-mt-2">
            <Accordion type="single" collapsible defaultValue="builtin-tools">
                <AccordionItem
                    value="builtin-tools"
                    className="tw-border tw-border-[var(--vscode-panel-border)] tw-rounded"
                >
                    <AccordionTrigger className="tw-px-2 tw-py-1">
                        <div className="tw-flex tw-items-center tw-justify-between tw-w-full tw-gap-2">
                            <div className="tw-flex tw-items-center tw-gap-2">
                                <Checkbox
                                    id={`llm-tools-all-${node.id}`}
                                    checked={allEnabled}
                                    onCheckedChange={checked => onToggleAll(checked === true)}
                                    onClick={event => event.stopPropagation()}
                                />
                                <Label
                                    htmlFor={`llm-tools-all-${node.id}`}
                                    className="tw-text-sm tw-cursor-pointer"
                                >
                                    Builtin tools
                                </Label>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="tw-pt-1 tw-pb-2 tw-px-2">
                        <div className="tw-flex tw-flex-col tw-gap-1 tw-mt-1">
                            {toolNames.map(tool => {
                                const isDisabled = disabled.includes(tool)
                                const enabled = !isDisabled
                                return (
                                    <div
                                        key={tool}
                                        className="tw-flex tw-items-center tw-gap-2 tw-text-xs"
                                    >
                                        <Checkbox
                                            id={`llm-tool-${node.id}-${tool}`}
                                            checked={enabled}
                                            onCheckedChange={checked => onToggle(tool, checked === true)}
                                        />
                                        <Label
                                            htmlFor={`llm-tool-${node.id}-${tool}`}
                                            className="tw-cursor-pointer tw-truncate"
                                            title={tool}
                                        >
                                            {tool}
                                        </Label>
                                    </div>
                                )
                            })}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    )
}
