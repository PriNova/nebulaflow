import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../../ui/shadcn/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '../../../ui/shadcn/ui/command'
import { Label } from '../../../ui/shadcn/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/shadcn/ui/popover'
import type { LLMNode } from '../../nodes/LLM_Node'

interface ModelSelectorProps {
    node: LLMNode
    models: { id: string; title?: string }[]
    onUpdate: (nodeId: string, data: Partial<LLMNode['data']>) => void
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ node, models, onUpdate }) => {
    const [open, setOpen] = useState(false)
    const [selectedModel, setSelectedModel] = useState<{ id: string; title?: string } | undefined>(
        undefined
    )

    useEffect(() => {
        setSelectedModel(node.data.model as any)
    }, [node])

    const groupedModels = useMemo(() => {
        const groups = new Map<string, { id: string; title?: string }[]>()
        for (const m of models) {
            const provider = m.id.split('/', 1)[0]
            if (!groups.has(provider)) groups.set(provider, [])
            groups.get(provider)!.push(m)
        }
        const providers = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b))
        return providers.map(provider => ({
            provider,
            items: groups
                .get(provider)!
                .slice()
                .sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id)),
        }))
    }, [models])

    const nodeModelId = node.data.model?.id
    const nodeModelTitle = node.data.model?.title

    const selectedLabel = useMemo(() => {
        const id = selectedModel?.id ?? nodeModelId
        if (!id) return 'Select a model'
        const found = models.find(m => m.id === id)
        return found?.title ?? selectedModel?.title ?? nodeModelTitle ?? id
    }, [selectedModel?.id, selectedModel?.title, nodeModelId, nodeModelTitle, models])

    const onModelSelect = useCallback(
        (model: { id: string; title?: string }) => {
            setSelectedModel(model)
            setOpen(false)
            onUpdate(node.id, { model: { ...model } as any })
        },
        [node.id, onUpdate]
    )

    return (
        <div>
            <Label htmlFor="model-select">Model</Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="secondary"
                        size="sm"
                        role="combobox"
                        aria-controls="model-menu"
                        aria-expanded={open}
                        className="tw-w-full justify-between"
                    >
                        {selectedLabel}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="tw-p-0" side="bottom" align="start">
                    <Command>
                        <CommandInput
                            placeholder="Search models..."
                            className="tw-bg-[var(--vscode-input-background)] tw-text-[var(--vscode-input-foreground)]"
                        />
                        <CommandList className="tw-max-h-[200px] tw-overflow-y-auto">
                            <CommandEmpty>No models found.</CommandEmpty>
                            {groupedModels.map(group => (
                                <CommandGroup
                                    key={group.provider}
                                    className="[&_[cmdk-group-heading]]:tw-font-semibold [&_[cmdk-group-heading]]:tw-text-[var(--vscode-editor-foreground)] [&_[cmdk-group-heading]]:tw-bg-[var(--vscode-editor-selectionBackground)] [&_[cmdk-group-heading]]:tw-px-2 [&_[cmdk-group-heading]]:tw-py-1"
                                >
                                    <div className="tw-font-semibold tw-text-[var(--vscode-editor-foreground)] tw-bg-[var(--vscode-editor-selectionBackground)] tw-px-2 tw-py-1">
                                        {group.provider}
                                    </div>
                                    {group.items.map(model => (
                                        <CommandItem
                                            key={model.id}
                                            onSelect={() => onModelSelect(model)}
                                        >
                                            {model.title ?? model.id}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            ))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
