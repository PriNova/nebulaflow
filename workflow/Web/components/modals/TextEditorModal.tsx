import type React from 'react'
import { useEffect, useRef } from 'react'
import { Button } from '../../ui/shadcn/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../ui/shadcn/ui/dialog'
import { Textarea } from '../../ui/shadcn/ui/textarea'

interface TextEditorModalProps {
    isOpen: boolean
    value: string
    onChange?: (value: string) => void
    onConfirm: () => void
    onCancel: () => void
    title?: string
    readOnly?: boolean
    onSwitchToResults?: () => void
}

export const TextEditorModal: React.FC<TextEditorModalProps> = ({
    isOpen,
    value,
    onChange,
    onConfirm,
    onCancel,
    title = 'Edit Text',
    readOnly = false,
    onSwitchToResults,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)

    useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.focus()
        }
    }, [isOpen])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
            e.stopPropagation()
        }
    }

    const handleSwitch = () => {
        try {
            onSwitchToResults?.()
        } finally {
            // Close the input editor when switching to results for a clean UX
            onCancel()
        }
    }

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
                        {onSwitchToResults && !readOnly && (
                            <Button variant="secondary" size="sm" onClick={handleSwitch}>
                                Switch to Results
                            </Button>
                        )}
                    </div>
                </DialogHeader>
                <Textarea
                    ref={textareaRef}
                    value={value}
                    readOnly={readOnly}
                    onChange={e => onChange?.(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="tw-flex-1 tw-resize-none"
                />
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>
                        Close
                    </Button>
                    {!readOnly && <Button onClick={onConfirm}>Save</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
