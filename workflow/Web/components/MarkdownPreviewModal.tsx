import { Button } from '../ui/shadcn/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/shadcn/ui/dialog'
import { Markdown } from './Markdown'

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
                    <Markdown content={value} />
                </div>
                <DialogFooter>
                    <Button onClick={onConfirm}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
