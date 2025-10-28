import type React from 'react'
import { useEffect, useRef } from 'react'
import { Button } from '../ui/shadcn/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/shadcn/ui/dialog'
import { Textarea } from '../ui/shadcn/ui/textarea'

interface TextEditorModalProps {
    isOpen: boolean
    value: string
    onChange?: (value: string) => void
    onConfirm: () => void
    onCancel: () => void
    title?: string
    readOnly?: boolean
}

export const TextEditorModal: React.FC<TextEditorModalProps> = ({
    isOpen,
    value,
    onChange,
    onConfirm,
    onCancel,
    title = 'Edit Text',
    readOnly = false,
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

    return (
        <Dialog
            open={isOpen}
            onOpenChange={next => {
                if (!next) onCancel()
            }}
        >
            <DialogContent className="tw-max-w-[720px] tw-w-[90vw] tw-h-[90vh] tw-flex tw-flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
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
                    {!readOnly && (
                        <Button variant="outline" onClick={onCancel}>
                            Cancel
                        </Button>
                    )}
                    <Button onClick={onConfirm}>{readOnly ? 'Close' : 'OK'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
