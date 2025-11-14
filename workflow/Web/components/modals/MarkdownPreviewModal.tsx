import { CopyToClipboardButton } from '@shared/CopyToClipboardButton'
import { Markdown } from '@shared/Markdown'
import { Button } from '../../ui/shadcn/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../ui/shadcn/ui/dialog'

interface MarkdownPreviewModalProps {
    isOpen: boolean
    value: string
    title?: string
    onConfirm: () => void
    onCancel: () => void
}

export function MarkdownPreviewModal({
    isOpen,
    value,
    title = 'Preview',
    onConfirm,
    onCancel,
}: MarkdownPreviewModalProps) {
    return (
        <Dialog
            open={isOpen}
            onOpenChange={next => {
                if (!next) onCancel()
            }}
        >
            <DialogContent className="tw-max-w-[900px] tw-w-[95vw] tw-h-[90vh] tw-flex tw-flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="tw-flex-1 tw-min-h-0 tw-overflow-auto tw-pr-1">
                    <div className="tw-bg-[var(--vscode-editor-background)] tw-p-3 tw-rounded tw-border tw-border-[var(--vscode-panel-border)] tw-ml-[-1px]">
                        <Markdown content={value} />
                    </div>
                </div>
                <DialogFooter className="tw-flex tw-justify-between">
                    <div>
                        <CopyToClipboardButton
                            text={value}
                            title="Copy Raw Text"
                            size="sm"
                            variant="secondary"
                        />
                    </div>
                    <Button onClick={onConfirm}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
