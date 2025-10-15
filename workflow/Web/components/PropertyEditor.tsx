import { Save } from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../ui/shadcn/ui/button'
import { Checkbox } from '../ui/shadcn/ui/checkbox'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '../ui/shadcn/ui/command'
import { Input } from '../ui/shadcn/ui/input'
import { Label } from '../ui/shadcn/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/shadcn/ui/popover'
import { Slider } from '../ui/shadcn/ui/slider'
import { Textarea } from '../ui/shadcn/ui/textarea'
import type { AccumulatorNode } from './nodes/Accumulator_Node'
import type { LLMNode } from './nodes/LLM_Node'
import type { LoopStartNode } from './nodes/LoopStart_Node'
import { NodeType, type WorkflowNodes } from './nodes/Nodes'
import type { SearchContextNode } from './nodes/SearchContext_Node'
import type { VariableNode } from './nodes/Variable_Node'

interface PropertyEditorProps {
    node: WorkflowNodes
    onUpdate: (nodeId: string, data: Partial<WorkflowNodes['data']>) => void
    models: { id: string; title?: string }[]
    onSaveCustomNode: (node: WorkflowNodes) => void
}

export const PropertyEditor: React.FC<PropertyEditorProps> = ({
    node,
    onUpdate,
    models,
    onSaveCustomNode,
}) => {
    const [open, setOpen] = useState(false)
    const [selectedModel, setSelectedModel] = useState<{ id: string; title?: string } | undefined>(
        undefined
    )

    useEffect(() => {
        if (node.type === NodeType.LLM) {
            setSelectedModel((node as LLMNode).data.model as any)
        } else {
            setSelectedModel(undefined)
        }
    }, [node])

    const onModelSelect = useCallback(
        (model: { id: string; title?: string }) => {
            setSelectedModel(model)
            setOpen(false)
            onUpdate(node.id, { model: { ...model } as any })
        },
        [node.id, onUpdate]
    )

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
            <div>
                <Label htmlFor="node-title">Node ID: {node.id}</Label>
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
            </div>
            {node.type === NodeType.CLI && (
                <div className="tw-flex tw-flex-col tw-gap-2">
                    <Button variant="secondary" size="sm" className="tw-w-full">
                        <Save className="tw-mr-2" size={14} />
                        Save as Custom Node
                    </Button>
                    <Label htmlFor="node-command">Command</Label>
                    <Input
                        id="node-command"
                        className="tw-h-8 tw-py-1 tw-text-sm"
                        value={node.data.content}
                        onChange={(e: { target: { value: any } }) =>
                            onUpdate(node.id, { content: e.target.value })
                        }
                        placeholder="Enter CLI command... (use ${1}, ${2} and so on for positional inputs)"
                    />
                    <div className="tw-flex tw-items-center tw-space-x-2">
                        <Checkbox
                            id="node-approval"
                            checked={node.data.needsUserApproval || false}
                            onCheckedChange={checked =>
                                onUpdate(node.id, { needsUserApproval: checked === true })
                            }
                        />
                        <Label htmlFor="node-approval">Require User Approval</Label>
                        <Checkbox
                            id="node-aborting"
                            checked={node.data.shouldAbort || false}
                            onCheckedChange={checked =>
                                onUpdate(node.id, { shouldAbort: checked === true })
                            }
                        />
                        <Label htmlFor="node-aborting">Abort on Error</Label>
                    </div>
                </div>
            )}
            {node.type === NodeType.LLM && (
                <div className="tw-flex tw-flex-col tw-gap-2">
                    <Button variant="secondary" size="sm" className="tw-w-full">
                        <Save className="tw-mr-2" size={14} />
                        Save as Custom Node
                    </Button>
                    <div>
                        <Label htmlFor="node-prompt">Prompt</Label>
                        <Textarea
                            id="node-prompt"
                            className="tw-min-h-[48px] tw-text-sm tw-py-1"
                            value={node.data.content || ''}
                            onChange={(e: { target: { value: any } }) =>
                                onUpdate(node.id, { content: e.target.value })
                            }
                            placeholder="Enter LLM prompt... (use ${1}, ${2} and so on for positional inputs)"
                        />
                    </div>
                    {models && (
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
                                        {selectedModel?.id ||
                                            (node as LLMNode).data.model?.id ||
                                            'Select a model'}
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
                                            <CommandGroup className="[&_[cmdk-group-heading]]:tw-font-semibold [&_[cmdk-group-heading]]:tw-text-[var(--vscode-editor-foreground)] [&_[cmdk-group-heading]]:tw-bg-[var(--vscode-editor-selectionBackground)] [&_[cmdk-group-heading]]:tw-px-2 [&_[cmdk-group-heading]]:tw-py-1">
                                                <div className="tw-font-semibold tw-text-[var(--vscode-editor-foreground)] tw-bg-[var(--vscode-editor-selectionBackground)] tw-px-2 tw-py-1">
                                                    Available Models
                                                </div>
                                                {models.map(model => (
                                                    <CommandItem
                                                        key={model.id}
                                                        onSelect={() => onModelSelect(model)}
                                                    >
                                                        {model.id}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}
                    <div>
                        <Label htmlFor="node-temperature">Temperature</Label>
                        <Slider
                            className="tw-p-4"
                            id="node-temperature"
                            min={0}
                            max={1}
                            step={0.05}
                            value={[(node as LLMNode).data.temperature || 0]}
                            onValueChange={([value]) => onUpdate(node.id, { temperature: value })}
                        />
                        <span className="tw-text-sm tw-text-muted-foreground">
                            {(node as LLMNode).data.temperature || 0}
                        </span>
                    </div>
                    <div>
                        <Label htmlFor="node-maxTokens">Maximum Tokens</Label>
                        <Slider
                            className="tw-p-4"
                            id="node-maxTokens"
                            min={250}
                            max={4000}
                            step={250}
                            value={[(node as LLMNode).data.maxTokens || 250]}
                            onValueChange={([value]) => onUpdate(node.id, { maxTokens: value })}
                        />
                        <span className="tw-text-sm tw-text-muted-foreground">
                            {(node as LLMNode).data.maxTokens || 250}
                        </span>
                    </div>
                    <div className="tw-flex tw-items-center tw-space-x-2">
                        <Checkbox
                            id="node-google-search"
                            checked={(node as LLMNode).data.hasGoogleSearch || false}
                            onCheckedChange={checked =>
                                onUpdate(node.id, { hasGoogleSearch: checked === true })
                            }
                        />
                        <Label htmlFor="node-google-search">Google Search</Label>
                    </div>
                </div>
            )}
            {node.type === NodeType.INPUT && (
                <div>
                    <Button variant="secondary" size="sm" className="tw-w-full">
                        <Save className="tw-mr-2" size={14} />
                        Save as Custom Node
                    </Button>
                    <Label htmlFor="node-input">Input Text</Label>
                    <Textarea
                        id="node-input"
                        className="tw-min-h-[48px] tw-text-sm tw-py-1"
                        value={node.data.content || ''}
                        onChange={(e: { target: { value: any } }) =>
                            onUpdate(node.id, { content: e.target.value })
                        }
                        placeholder="Enter input text... (use ${1}, ${2} and so on for positional inputs)"
                    />
                </div>
            )}
            {node.type === NodeType.SEARCH_CONTEXT && (
                <div className="tw-flex tw-flex-col tw-gap-2">
                    <Button variant="secondary" size="sm" className="tw-w-full">
                        <Save className="tw-mr-2" size={14} />
                        Save as Custom Node
                    </Button>
                    <Label htmlFor="node-input">Context</Label>
                    <Textarea
                        id="node-input"
                        className="tw-min-h-[48px] tw-text-sm tw-py-1"
                        value={node.data.content || ''}
                        onChange={(e: { target: { value: any } }) =>
                            onUpdate(node.id, { content: e.target.value })
                        }
                        placeholder="Enter input text... (use ${1}, ${2} and so on for positional inputs)"
                    />
                    <div className="tw-flex tw-items-center tw-space-x-2">
                        <Checkbox
                            id="context-scope"
                            checked={(node as SearchContextNode).data.local_remote || false}
                            onCheckedChange={checked =>
                                onUpdate(node.id, { local_remote: checked === true })
                            }
                        />
                        <Label htmlFor="context-scope">Use Remote Context</Label>
                    </div>
                </div>
            )}
            {node.type === NodeType.PREVIEW && (
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
            )}
            {node.type === NodeType.LOOP_START && (
                <div className="tw-flex tw-flex-col tw-gap-4">
                    <div>
                        <Label htmlFor="loop-iterations">Iterations</Label>
                        <Input
                            id="loop-iterations"
                            className="tw-h-8 tw-py-1 tw-text-sm"
                            type="number"
                            min={1}
                            max={100}
                            value={(node as LoopStartNode).data.iterations || 1}
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
                            value={(node as LoopStartNode).data.loopVariable || 'i'}
                            onChange={(e: { target: { value: any } }) =>
                                onUpdate(node.id, { loopVariable: e.target.value })
                            }
                            placeholder="Variable name (e.g. i, counter, index)"
                        />
                    </div>
                </div>
            )}
            {node.type === NodeType.ACCUMULATOR && (
                <div className="tw-flex tw-flex-col tw-gap-4">
                    <div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleSaveCustomNode}
                            className="tw-w-full"
                        >
                            <Save className="tw-mr-2" size={14} />
                            Save as Custom Node
                        </Button>
                        <Label htmlFor="accumulator-variable-name">Unique Variable Name</Label>
                        <Input
                            id="accumulator-variable-name"
                            className="tw-h-8 tw-py-1 tw-text-sm"
                            value={(node as AccumulatorNode).data.variableName || ''}
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
                            placeholder="Enter input text... (use ${1}, ${2} and so on for positional inputs)"
                        />
                    </div>
                </div>
            )}
            {node.type === NodeType.VARIABLE && (
                <div className="tw-flex tw-flex-col tw-gap-4">
                    <div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleSaveCustomNode}
                            className="tw-w-full"
                        >
                            <Save className="tw-mr-2" size={14} />
                            Save as Custom Node
                        </Button>
                        <Label htmlFor="variable-variable-name">Unique Variable Name</Label>
                        <Input
                            id="variable-variable-name"
                            className="tw-h-8 tw-py-1 tw-text-sm"
                            value={(node as VariableNode).data.variableName || ''}
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
                            placeholder="Enter input text... (use ${1}, ${2} and so on for positional inputs)"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
