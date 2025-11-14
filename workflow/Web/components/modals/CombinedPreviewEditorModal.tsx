import { CopyToClipboardButton } from '@shared/CopyToClipboardButton'
import { Markdown } from '@shared/Markdown'
import { useEffect, useState } from 'react'
import { Button } from '../../ui/shadcn/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../ui/shadcn/ui/dialog'
import { Textarea } from '../../ui/shadcn/ui/textarea'

export function CombinedPreviewEditorModal({
    isOpen,
    value,
    title = 'Preview / Edit',
    onConfirm,
    onCancel,
    onChange,
    initialTab = 'preview',
    onSwitchToInput,
}: {
    isOpen: boolean
    value: string
    title?: string
    onConfirm: (value: string) => void
    onCancel: () => void
    onChange?: (v: string) => void
    initialTab?: 'preview' | 'edit'
    onSwitchToInput?: () => void
}) {
    const [tab, setTab] = useState<'preview' | 'edit'>(initialTab)
    const [draft, setDraft] = useState<string>(value)

    useEffect(() => {
        if (isOpen) {
            setDraft(value)
            setTab(initialTab)
        }
    }, [isOpen, value, initialTab])

    const handleSave = () => onConfirm(draft)

    return (
        <Dialog
            open={isOpen}
            onOpenChange={next => {
                if (!next) onCancel()
            }}
        >
            <DialogContent className="tw-max-w-[900px] tw-w-[95vw] tw-h-[90vh] tw-flex tw-flex-col">
                <DialogHeader>
                    <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                        <DialogTitle>{title}</DialogTitle>
                        {onSwitchToInput && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    onSwitchToInput?.()
                                    onCancel()
                                }}
                            >
                                Switch to Input
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                <div className="tw-flex tw-gap-2 tw-mb-2">
                    <Button
                        variant={tab === 'preview' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTab('preview')}
                    >
                        Preview
                    </Button>
                    <Button
                        variant={tab === 'edit' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTab('edit')}
                    >
                        Edit
                    </Button>
                </div>

                <div className="tw-flex tw-flex-col tw-flex-1 tw-min-h-0 tw-pr-1">
                    {tab === 'preview' ? (
                        <div className="tw-bg-[var(--vscode-editor-background)] tw-p-3 tw-rounded tw-border tw-border-[var(--vscode-panel-border)] tw-ml-[-1px] tw-overflow-auto tw-flex-1">
                            <Markdown content={draft} />
                        </div>
                    ) : (
                        <Textarea
                            value={draft}
                            onChange={e => {
                                setDraft(e.target.value)
                                onChange?.(e.target.value)
                            }}
                            className="tw-flex-1 tw-resize-none"
                        />
                    )}
                </div>

                <DialogFooter className="tw-flex tw-justify-between">
                    <CopyToClipboardButton
                        text={draft}
                        title="Copy Text"
                        size="sm"
                        variant="secondary"
                    />
                    <div className="tw-flex tw-gap-2">
                        <Button variant="outline" onClick={onCancel}>
                            Close
                        </Button>
                        <Button onClick={handleSave}>Save</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
