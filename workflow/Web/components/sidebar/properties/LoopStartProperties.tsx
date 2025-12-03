import type React from 'react'
import { Input } from '../../../ui/shadcn/ui/input'
import { Label } from '../../../ui/shadcn/ui/label'
import type { LoopStartNode } from '../../nodes/LoopStart_Node'

interface LoopStartPropertiesProps {
    node: LoopStartNode
    onUpdate: (nodeId: string, data: Partial<LoopStartNode['data']>) => void
}

export const LoopStartProperties: React.FC<LoopStartPropertiesProps> = ({ node, onUpdate }) => {
    const loopMode = (node.data.loopMode ?? 'fixed') as 'fixed' | 'while-variable-not-empty'
    const isWhileMode = loopMode === 'while-variable-not-empty'

    const handleMaxSafeIterationsChange = (e: { target: { value: any } }) => {
        const rawValue = e.target.value
        if (rawValue === '') {
            onUpdate(node.id, { maxSafeIterations: undefined })
            return
        }
        const parsed = Number.parseInt(rawValue, 10)
        if (Number.isNaN(parsed)) {
            onUpdate(node.id, { maxSafeIterations: undefined })
            return
        }
        onUpdate(node.id, { maxSafeIterations: parsed })
    }

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
            <div>
                <Label className="tw-block">Loop Mode</Label>
                <div className="tw-flex tw-gap-1.5">
                    {(['fixed', 'while-variable-not-empty'] as const).map(mode => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => onUpdate(node.id, { loopMode: mode })}
                            className={`tw-px-3 tw-py-1 tw-text-sm tw-font-medium tw-border tw-rounded tw-transition-colors ${
                                loopMode === mode
                                    ? 'tw-bg-[var(--vscode-button-background)] tw-text-[var(--vscode-button-foreground)] tw-border-[var(--vscode-button-background)]'
                                    : 'tw-bg-transparent tw-text-[var(--vscode-foreground)] tw-border-[var(--vscode-input-border)]'
                            }`}
                        >
                            {mode === 'fixed' ? 'Fixed iterations' : 'While variable not empty'}
                        </button>
                    ))}
                </div>
            </div>
            {isWhileMode && (
                <div>
                    <Label htmlFor="loop-collection-variable">Collection Variable</Label>
                    <Input
                        id="loop-collection-variable"
                        className="tw-h-8 tw-py-1 tw-text-sm"
                        value={node.data.collectionVariable || ''}
                        onChange={(e: { target: { value: any } }) =>
                            onUpdate(node.id, { collectionVariable: e.target.value })
                        }
                        placeholder="Variable name to check (e.g. tasks)"
                    />
                </div>
            )}
            {isWhileMode && (
                <div>
                    <Label htmlFor="loop-max-safe-iterations">Max Safe Iterations (optional)</Label>
                    <Input
                        id="loop-max-safe-iterations"
                        className="tw-h-8 tw-py-1 tw-text-sm"
                        type="number"
                        min={1}
                        value={node.data.maxSafeIterations ?? ''}
                        onChange={handleMaxSafeIterationsChange}
                        placeholder="Defaults to 100 if left empty"
                    />
                </div>
            )}
        </div>
    )
}
