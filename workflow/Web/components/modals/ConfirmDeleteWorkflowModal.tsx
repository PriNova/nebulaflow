import type React from 'react'
import { Button } from '../../ui/shadcn/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/shadcn/ui/dialog'

interface ConfirmDeleteWorkflowModalProps {
    isOpen: boolean
    onConfirm: () => void
    onCancel: () => void
    title?: string
    message?: string
}

export const ConfirmDeleteWorkflowModal: React.FC<ConfirmDeleteWorkflowModalProps> = ({
    isOpen,
    onConfirm,
    onCancel,
    title = 'Delete Workflow?',
    message = 'This will clear all nodes, edges, and execution state from the canvas.',
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={() => onCancel()}>
            <DialogContent className="tw-max-w-sm">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <p className="tw-text-sm tw-text-muted-foreground tw-mb-6">{message}</p>
                <div className="tw-flex tw-gap-3 tw-justify-end">
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={onConfirm}>
                        Delete
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
