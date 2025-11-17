import { Save } from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'
import { isToolEnabled } from '../../../services/toolNames'
import { Button } from '../../../ui/shadcn/ui/button'
import { Checkbox } from '../../../ui/shadcn/ui/checkbox'
import { Label } from '../../../ui/shadcn/ui/label'
import { Textarea } from '../../../ui/shadcn/ui/textarea'
import { TextEditorModal } from '../../modals/TextEditorModal'
import type { LLMNode } from '../../nodes/LLM_Node'
import { LLMTimeoutField } from '../widgets/LLMTimeoutField'
import { ModelSelector } from '../widgets/ModelSelector'
import { ToolsSelector } from '../widgets/ToolsSelector'

interface LLMPropertiesProps {
    node: LLMNode
    onUpdate: (nodeId: string, data: Partial<LLMNode['data']>) => void
    models: { id: string; title?: string }[]
    onSaveCustomNode: (node: LLMNode) => void
    nodeError?: string
}

export const LLMProperties: React.FC<LLMPropertiesProps> = ({
    node,
    onUpdate,
    models,
    onSaveCustomNode,
    nodeError,
}) => {
    const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false)
    const [promptDraft, setPromptDraft] = useState('')
    const [isSystemPromptEditorOpen, setIsSystemPromptEditorOpen] = useState(false)
    const [systemPromptDraft, setSystemPromptDraft] = useState('')

    useEffect(() => {
        if (node.data.reasoningEffort === undefined) {
            onUpdate(node.id, { reasoningEffort: 'medium' } as any)
        }
    }, [node, onUpdate])

    // Close editor if the selected node changes
    // biome-ignore lint/correctness/useExhaustiveDependencies: Only need to track node.id, not entire node object
    useEffect(() => {
        setIsPromptEditorOpen(false)
        setIsSystemPromptEditorOpen(false)
    }, [node.id])

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
                <Label htmlFor="node-prompt">Prompt</Label>
                <Textarea
                    id="node-prompt"
                    className="tw-min-h-[48px] tw-text-sm tw-py-1"
                    value={node.data.content || ''}
                    onChange={(e: { target: { value: any } }) =>
                        onUpdate(node.id, { content: e.target.value })
                    }
                    onDoubleClick={() => {
                        setPromptDraft(node.data.content || '')
                        setIsPromptEditorOpen(true)
                    }}
                    placeholder="Enter LLM prompt... (use ${1}, ${2} and so on for positional inputs)"
                    aria-invalid={!!nodeError}
                />
                {nodeError && <p className="tw-text-xs tw-text-red-500">{nodeError}</p>}
                <TextEditorModal
                    isOpen={isPromptEditorOpen}
                    value={promptDraft}
                    onChange={setPromptDraft}
                    onConfirm={() => {
                        onUpdate(node.id, { content: promptDraft })
                        setIsPromptEditorOpen(false)
                    }}
                    onCancel={() => setIsPromptEditorOpen(false)}
                    title={node.data.title ?? 'Edit Prompt'}
                />
            </div>
            {models && <ModelSelector node={node} models={models} onUpdate={onUpdate} />}
            {(() => {
                const disabled = (node.data.disabledTools ?? []) as string[]
                const isBashAvailable = isToolEnabled('Bash', disabled)
                return (
                    <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
                        <Checkbox
                            id={`llm-dangerously-allow-all-${node.id}`}
                            checked={node.data.dangerouslyAllowAll ?? false}
                            disabled={!isBashAvailable}
                            onCheckedChange={checked => {
                                if (isBashAvailable) {
                                    onUpdate(node.id, { dangerouslyAllowAll: Boolean(checked) })
                                }
                            }}
                        />
                        <Label
                            htmlFor={`llm-dangerously-allow-all-${node.id}`}
                            className={`tw-cursor-pointer tw-font-normal ${
                                !isBashAvailable ? 'tw-line-through tw-opacity-60' : ''
                            }`}
                            title={
                                !isBashAvailable
                                    ? 'Requires Bash tool. Enable Bash under Tools to use this.'
                                    : ''
                            }
                            aria-disabled={!isBashAvailable}
                        >
                            Dangerously allow all commands
                        </Label>
                    </div>
                )
            })()}
            {(() => {
                const current = (node.data as any).reasoningEffort ?? 'medium'
                return (
                    <div className="tw-mt-4">
                        <Label className="tw-block tw-mb-2">Reasoning Effort</Label>
                        <div className="tw-flex tw-gap-1.5">
                            {(['minimal', 'low', 'medium', 'high'] as const).map(effort => (
                                <button
                                    key={effort}
                                    type="button"
                                    onClick={() => onUpdate(node.id, { reasoningEffort: effort } as any)}
                                    className={`tw-px-3 tw-py-1 tw-text-sm tw-font-medium tw-border tw-rounded tw-transition-colors ${
                                        current === effort
                                            ? 'tw-bg-[var(--vscode-button-background)] tw-text-[var(--vscode-button-foreground)] tw-border-[var(--vscode-button-background)]'
                                            : 'tw-bg-transparent tw-text-[var(--vscode-foreground)] tw-border-[var(--vscode-input-border)]'
                                    }`}
                                >
                                    {effort.charAt(0).toUpperCase() + effort.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                )
            })()}
            <ToolsSelector node={node} onUpdate={onUpdate} />
            <div>
                <Label htmlFor={`llm-timeout-sec-${node.id}`}>Timeout (seconds)</Label>
                <LLMTimeoutField key={node.id} node={node} onUpdate={onUpdate} />
                <p className="tw-text-xs tw-text-gray-500 tw-mt-1">0 = no timeout; use Stop to abort</p>
            </div>
            <div className="tw-mt-3 tw-flex tw-flex-col tw-gap-1">
                <Label>System prompt override</Label>
                <p className="tw-text-xs tw-text-gray-500">
                    {node.data.systemPromptTemplate && node.data.systemPromptTemplate.trim().length > 0
                        ? 'Custom system prompt set for this node.'
                        : 'Using Amp default system prompt for this node.'}
                </p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setSystemPromptDraft(node.data.systemPromptTemplate || '')
                        setIsSystemPromptEditorOpen(true)
                    }}
                >
                    Edit system prompt...
                </Button>
                <TextEditorModal
                    isOpen={isSystemPromptEditorOpen}
                    value={systemPromptDraft}
                    onChange={setSystemPromptDraft}
                    onConfirm={() => {
                        const trimmed = systemPromptDraft.trim()
                        onUpdate(node.id, {
                            systemPromptTemplate: trimmed.length > 0 ? systemPromptDraft : undefined,
                        } as any)
                        setIsSystemPromptEditorOpen(false)
                    }}
                    onCancel={() => setIsSystemPromptEditorOpen(false)}
                    title={node.data.title ?? 'Edit System Prompt Override'}
                />
            </div>
        </div>
    )
}
