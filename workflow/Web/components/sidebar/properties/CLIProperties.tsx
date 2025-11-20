import type { WorkflowNodes } from '@nodes/Nodes'
import { Save } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Button } from '../../../ui/shadcn/ui/button'
import { Checkbox } from '../../../ui/shadcn/ui/checkbox'
import { Input } from '../../../ui/shadcn/ui/input'
import { Label } from '../../../ui/shadcn/ui/label'
import { Textarea } from '../../../ui/shadcn/ui/textarea'
import { TextEditorModal } from '../../modals/TextEditorModal'

interface CLIPropertiesProps {
    node: WorkflowNodes
    onUpdate: (nodeId: string, data: Partial<WorkflowNodes['data']>) => void
    onSaveCustomNode: (node: WorkflowNodes) => void
    nodeError?: string
}

export const CLIProperties: React.FC<CLIPropertiesProps> = ({
    node,
    onUpdate,
    onSaveCustomNode,
    nodeError,
}) => {
    const [isCliEditorOpen, setIsCliEditorOpen] = useState(false)
    const [cliDraft, setCliDraft] = useState('')
    const [showAdvanced, setShowAdvanced] = useState(false)

    return (
        <div className="tw-flex tw-flex-col tw-gap-3">
            <Button
                variant="secondary"
                size="sm"
                onClick={() => onSaveCustomNode(node)}
                className="tw-w-full"
            >
                <Save className="tw-mr-2" size={14} />
                Save as Custom Node
            </Button>

            {/* Mode */}
            <div className="tw-flex tw-items-center tw-gap-2">
                <Label>Mode</Label>
                {(['command', 'script'] as const).map(m => (
                    <button
                        key={m}
                        type="button"
                        className={`tw-px-2 tw-py-0.5 tw-text-xs tw-border tw-rounded ${
                            ((node as any).data?.mode ?? 'command') === m
                                ? 'tw-bg-[var(--vscode-button-background)] tw-text-[var(--vscode-button-foreground)] tw-border-[var(--vscode-button-background)]'
                                : 'tw-bg-transparent tw-text-[var(--vscode-foreground)] tw-border-[var(--vscode-input-border)]'
                        }`}
                        onClick={() => onUpdate(node.id, { mode: m } as any)}
                    >
                        {m}
                    </button>
                ))}
            </div>

            {/* Content */}
            <Label htmlFor="node-command">
                {((node as any).data?.mode ?? 'command') === 'script' ? 'Script' : 'Command'}
            </Label>
            {((node as any).data?.mode ?? 'command') === 'script' ? (
                <Textarea
                    id="node-script"
                    className="tw-min-h-[80px] tw-text-sm tw-py-1"
                    value={node.data.content || ''}
                    onChange={(e: { target: { value: any } }) =>
                        onUpdate(node.id, { content: e.target.value })
                    }
                    onDoubleClick={() => {
                        setCliDraft(node.data.content || '')
                        setIsCliEditorOpen(true)
                    }}
                    placeholder="Enter script... (use ${1}, ${2} and so on for positional inputs)"
                    aria-invalid={!!nodeError}
                />
            ) : (
                <Input
                    id="node-command"
                    className="tw-h-8 tw-py-1 tw-text-sm"
                    value={node.data.content}
                    onChange={(e: { target: { value: any } }) =>
                        onUpdate(node.id, { content: e.target.value })
                    }
                    onDoubleClick={() => {
                        setCliDraft(node.data.content || '')
                        setIsCliEditorOpen(true)
                    }}
                    placeholder="Enter CLI command... (use ${1}, ${2} and so on for positional inputs)"
                    aria-invalid={!!nodeError}
                />
            )}
            <TextEditorModal
                isOpen={isCliEditorOpen}
                value={cliDraft}
                onChange={setCliDraft}
                onConfirm={() => {
                    onUpdate(node.id, { content: cliDraft })
                    setIsCliEditorOpen(false)
                }}
                onCancel={() => setIsCliEditorOpen(false)}
                title={
                    node.data.title ??
                    (((node as any).data?.mode ?? 'command') === 'script'
                        ? 'Edit Script'
                        : 'Edit Command')
                }
            />
            {(() => {
                const m = (node as any).data?.mode ?? 'command'
                const expose = Boolean((node as any).data?.env?.exposeParents)
                if (m === 'script' && !expose) {
                    const txt = String(node.data.content || '')
                    const pattern = /\$(INPUT_\d+)|\$env:INPUT_\d+/i
                    if (pattern.test(txt)) {
                        return (
                            <div className="tw-text-xs tw-text-[var(--vscode-editor-foreground)] tw-opacity-80">
                                Detected $INPUT_N usage.{' '}
                                <button
                                    type="button"
                                    className="tw-underline"
                                    onClick={() =>
                                        onUpdate(node.id, {
                                            env: {
                                                ...((node as any).data?.env || {}),
                                                exposeParents: true,
                                            },
                                        } as any)
                                    }
                                >
                                    Enable env mapping
                                </button>
                            </div>
                        )
                    }
                }
                return null
            })()}
            {nodeError && <p className="tw-text-xs tw-text-red-500">{nodeError}</p>}

            {/* Shell + Flags (visible for any mode) */}
            <div className="tw-flex tw-flex-col tw-gap-2">
                <div className="tw-flex tw-items-center tw-gap-2">
                    <Label>Shell</Label>
                    {(['bash', 'sh', 'zsh', 'pwsh', 'cmd'] as const).map(s => (
                        <button
                            key={s}
                            type="button"
                            className={`tw-px-2 tw-py-0.5 tw-text-xs tw-border tw-rounded ${
                                ((node as any).data?.shell ?? 'bash') === s
                                    ? 'tw-bg-[var(--vscode-button-background)] tw-text-[var(--vscode-button-foreground)] tw-border-[var(--vscode-button-background)]'
                                    : 'tw-bg-transparent tw-text-[var(--vscode-foreground)] tw-border-[var(--vscode-input-border)]'
                            }`}
                            onClick={() => onUpdate(node.id, { shell: s } as any)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stdin (script mode oriented) */}
            <div className="tw-flex tw-flex-col tw-gap-2">
                <Label>Stdin Source</Label>
                <div className="tw-flex tw-items-center tw-gap-2">
                    {(['none', 'parents-all', 'parent-index', 'literal'] as const).map(s => (
                        <button
                            key={s}
                            type="button"
                            className={`tw-px-2 tw-py-0.5 tw-text-xs tw-border tw-rounded ${
                                ((node as any).data?.stdin?.source ?? 'none') === s
                                    ? 'tw-bg-[var(--vscode-button-background)] tw-text-[var(--vscode-button-foreground)] tw-border-[var(--vscode-button-background)]'
                                    : 'tw-bg-transparent tw-text-[var(--vscode-foreground)] tw-border-[var(--vscode-input-border)]'
                            }`}
                            onClick={() =>
                                onUpdate(node.id, {
                                    stdin: { ...((node as any).data?.stdin || {}), source: s },
                                } as any)
                            }
                        >
                            {s}
                        </button>
                    ))}
                </div>
                {((node as any).data?.stdin?.source ?? 'none') === 'parent-index' && (
                    <div className="tw-flex tw-items-center tw-gap-2">
                        <Label htmlFor={`stdin-index-${node.id}`}>Parent Index</Label>
                        <Input
                            id={`stdin-index-${node.id}`}
                            className="tw-h-8 tw-py-1 tw-text-sm tw-w-20"
                            type="number"
                            min={1}
                            value={String((node as any).data?.stdin?.parentIndex ?? 1)}
                            onChange={(e: { target: { value: string } }) =>
                                onUpdate(node.id, {
                                    stdin: {
                                        ...((node as any).data?.stdin || {}),
                                        parentIndex: Number.parseInt(e.target.value || '1', 10),
                                    },
                                } as any)
                            }
                        />
                    </div>
                )}
                {((node as any).data?.stdin?.source ?? 'none') === 'literal' && (
                    <div>
                        <Label htmlFor={`stdin-literal-${node.id}`}>Stdin Literal</Label>
                        <Textarea
                            id={`stdin-literal-${node.id}`}
                            className="tw-min-h-[60px] tw-text-sm tw-py-1"
                            value={(node as any).data?.stdin?.literal || ''}
                            onChange={(e: { target: { value: any } }) =>
                                onUpdate(node.id, {
                                    stdin: {
                                        ...((node as any).data?.stdin || {}),
                                        literal: e.target.value,
                                    },
                                } as any)
                            }
                            placeholder="Optional input text (use ${1}, ${2} …)"
                        />
                    </div>
                )}
            </div>

            {/* Env mapping */}
            <div className="tw-flex tw-flex-col tw-gap-2">
                <Label>Env Mapping</Label>
                <div className="tw-flex tw-items-center tw-gap-3">
                    <div className="tw-flex tw-items-center tw-space-x-1">
                        <Checkbox
                            id={`env-expose-${node.id}`}
                            checked={Boolean((node as any).data?.env?.exposeParents)}
                            onCheckedChange={checked =>
                                onUpdate(node.id, {
                                    env: {
                                        ...((node as any).data?.env || {}),
                                        exposeParents: checked === true,
                                    },
                                } as any)
                            }
                        />
                        <Label htmlFor={`env-expose-${node.id}`}>Expose parents as INPUT_1…N</Label>
                    </div>
                </div>
            </div>

            {/* Safety + Approval */}
            <div className="tw-flex tw-items-center tw-space-x-2">
                <Label>Safety</Label>
                {(['safe', 'advanced'] as const).map(s => (
                    <button
                        key={s}
                        type="button"
                        className={`tw-px-2 tw-py-0.5 tw-text-xs tw-border tw-rounded ${
                            ((node as any).data?.safetyLevel ?? 'safe') === s
                                ? 'tw-bg-[var(--vscode-button-background)] tw-text-[var(--vscode-button-foreground)] tw-border-[var(--vscode-button-background)]'
                                : 'tw-bg-transparent tw-text-[var(--vscode-foreground)] tw-border-[var(--vscode-input-border)]'
                        }`}
                        onClick={() => onUpdate(node.id, { safetyLevel: s } as any)}
                    >
                        {s}
                    </button>
                ))}
            </div>
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
                    onCheckedChange={checked => onUpdate(node.id, { shouldAbort: checked === true })}
                />
                <Label htmlFor="node-aborting">Abort on Error</Label>
            </div>

            <div className="tw-flex tw-justify-end">
                <button
                    type="button"
                    className="tw-text-xs tw-underline tw-opacity-80"
                    onClick={() => setShowAdvanced(v => !v)}
                >
                    {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                </button>
            </div>

            {showAdvanced && (
                <>
                    <div className="tw-border-t tw-border-[var(--vscode-input-border)] tw-my-2" />
                    <div className="tw-flex tw-flex-col tw-gap-3">
                        {/* Shell flags */}
                        {(['bash', 'sh', 'zsh'] as const).includes(
                            ((node as any).data?.shell ?? 'bash') as any
                        ) && (
                            <div className="tw-flex tw-items-center tw-gap-3">
                                <div className="tw-flex tw-items-center tw-space-x-1">
                                    <Checkbox
                                        id={`flag-exit-${node.id}`}
                                        checked={Boolean((node as any).data?.flags?.exitOnError)}
                                        onCheckedChange={checked =>
                                            onUpdate(node.id, {
                                                flags: {
                                                    ...((node as any).data?.flags || {}),
                                                    exitOnError: checked === true,
                                                },
                                            } as any)
                                        }
                                    />
                                    <Label htmlFor={`flag-exit-${node.id}`}>set -e</Label>
                                </div>
                                <div className="tw-flex tw-items-center tw-space-x-1">
                                    <Checkbox
                                        id={`flag-unset-${node.id}`}
                                        checked={Boolean((node as any).data?.flags?.unsetVars)}
                                        onCheckedChange={checked =>
                                            onUpdate(node.id, {
                                                flags: {
                                                    ...((node as any).data?.flags || {}),
                                                    unsetVars: checked === true,
                                                },
                                            } as any)
                                        }
                                    />
                                    <Label htmlFor={`flag-unset-${node.id}`}>set -u</Label>
                                </div>
                                <div className="tw-flex tw-items-center tw-space-x-1">
                                    <Checkbox
                                        id={`flag-pipe-${node.id}`}
                                        checked={Boolean((node as any).data?.flags?.pipefail)}
                                        onCheckedChange={checked =>
                                            onUpdate(node.id, {
                                                flags: {
                                                    ...((node as any).data?.flags || {}),
                                                    pipefail: checked === true,
                                                },
                                            } as any)
                                        }
                                    />
                                    <Label htmlFor={`flag-pipe-${node.id}`}>set -o pipefail</Label>
                                </div>
                            </div>
                        )}
                        {((node as any).data?.shell ?? 'bash') === 'pwsh' && (
                            <div className="tw-flex tw-items-center tw-gap-3">
                                <div className="tw-flex tw-items-center tw-space-x-1">
                                    <Checkbox
                                        id={`flag-np-${node.id}`}
                                        checked={(node as any).data?.flags?.noProfile !== false}
                                        onCheckedChange={checked =>
                                            onUpdate(node.id, {
                                                flags: {
                                                    ...((node as any).data?.flags || {}),
                                                    noProfile: checked !== false,
                                                },
                                            } as any)
                                        }
                                    />
                                    <Label htmlFor={`flag-np-${node.id}`}>-NoProfile</Label>
                                </div>
                                <div className="tw-flex tw-items-center tw-space-x-1">
                                    <Checkbox
                                        id={`flag-ni-${node.id}`}
                                        checked={(node as any).data?.flags?.nonInteractive !== false}
                                        onCheckedChange={checked =>
                                            onUpdate(node.id, {
                                                flags: {
                                                    ...((node as any).data?.flags || {}),
                                                    nonInteractive: checked !== false,
                                                },
                                            } as any)
                                        }
                                    />
                                    <Label htmlFor={`flag-ni-${node.id}`}>-NonInteractive</Label>
                                </div>
                                <div className="tw-flex tw-items-center tw-space-x-1">
                                    <Checkbox
                                        id={`flag-ep-${node.id}`}
                                        checked={Boolean(
                                            (node as any).data?.flags?.executionPolicyBypass
                                        )}
                                        onCheckedChange={checked =>
                                            onUpdate(node.id, {
                                                flags: {
                                                    ...((node as any).data?.flags || {}),
                                                    executionPolicyBypass: checked === true,
                                                },
                                            } as any)
                                        }
                                    />
                                    <Label htmlFor={`flag-ep-${node.id}`}>-ExecutionPolicy Bypass</Label>
                                </div>
                            </div>
                        )}

                        {/* Stdin advanced */}
                        <div className="tw-flex tw-items-center tw-gap-3">
                            <div className="tw-flex tw-items-center tw-space-x-1">
                                <Checkbox
                                    id={`stdin-fences-${node.id}`}
                                    checked={Boolean((node as any).data?.stdin?.stripCodeFences)}
                                    onCheckedChange={checked =>
                                        onUpdate(node.id, {
                                            stdin: {
                                                ...((node as any).data?.stdin || {}),
                                                stripCodeFences: checked === true,
                                            },
                                        } as any)
                                    }
                                />
                                <Label htmlFor={`stdin-fences-${node.id}`}>Strip code fences</Label>
                            </div>
                            <div className="tw-flex tw-items-center tw-space-x-1">
                                <Checkbox
                                    id={`stdin-crlf-${node.id}`}
                                    checked={(node as any).data?.stdin?.normalizeCRLF !== false}
                                    onCheckedChange={checked =>
                                        onUpdate(node.id, {
                                            stdin: {
                                                ...((node as any).data?.stdin || {}),
                                                normalizeCRLF: checked !== false,
                                            },
                                        } as any)
                                    }
                                />
                                <Label htmlFor={`stdin-crlf-${node.id}`}>Normalize CRLF</Label>
                            </div>
                        </div>

                        {/* Env advanced */}
                        <div className="tw-flex tw-flex-col tw-gap-2">
                            <div>
                                <Label htmlFor={`env-names-${node.id}`}>
                                    Custom names (comma separated)
                                </Label>
                                <Input
                                    id={`env-names-${node.id}`}
                                    className="tw-h-8 tw-py-1 tw-text-sm"
                                    value={
                                        Array.isArray((node as any).data?.env?.names)
                                            ? ((node as any).data?.env?.names || []).join(',')
                                            : ''
                                    }
                                    onChange={(e: { target: { value: string } }) =>
                                        onUpdate(node.id, {
                                            env: {
                                                ...((node as any).data?.env || {}),
                                                names: e.target.value
                                                    .split(',')
                                                    .map(s => s.trim())
                                                    .filter(Boolean),
                                            },
                                        } as any)
                                    }
                                    placeholder="e.g. SRC_FILE, DEST_DIR"
                                />
                            </div>
                            <div>
                                <Label htmlFor={`env-static-${node.id}`}>Static env (JSON object)</Label>
                                <Textarea
                                    id={`env-static-${node.id}`}
                                    className="tw-min-h-[60px] tw-text-sm tw-py-1"
                                    value={(() => {
                                        try {
                                            return JSON.stringify(
                                                (node as any).data?.env?.static || {},
                                                null,
                                                2
                                            )
                                        } catch {
                                            return '{}'
                                        }
                                    })()}
                                    onChange={(e: { target: { value: string } }) => {
                                        try {
                                            const obj = JSON.parse(e.target.value || '{}')
                                            if (obj && typeof obj === 'object') {
                                                onUpdate(node.id, {
                                                    env: {
                                                        ...((node as any).data?.env || {}),
                                                        static: obj,
                                                    },
                                                } as any)
                                            }
                                        } catch {
                                            // ignore invalid JSON in editor; user can fix
                                        }
                                    }}
                                    placeholder='{"FOO":"bar"}'
                                />
                            </div>
                        </div>

                        {/* Safety advanced */}
                        <div className="tw-flex tw-items-center tw-space-x-2">
                            <Checkbox
                                id="node-stream"
                                checked={Boolean((node as any).data?.streamOutput)}
                                onCheckedChange={checked =>
                                    onUpdate(node.id, { streamOutput: checked === true } as any)
                                }
                            />
                            <Label htmlFor="node-stream">Spawn (buffered) (command mode)</Label>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
