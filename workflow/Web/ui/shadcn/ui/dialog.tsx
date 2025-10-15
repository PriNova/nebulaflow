import type React from 'react'
import { createContext, useContext, useState } from 'react'

const DialogContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null)

interface DialogProps {
    children: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

interface DialogContentProps {
    children: React.ReactNode
    className?: string
}

interface DialogHeaderProps {
    children: React.ReactNode
    className?: string
}

interface DialogTitleProps {
    children: React.ReactNode
    className?: string
}

export const Dialog: React.FC<DialogProps> = ({ children, open, onOpenChange }) => {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = open !== undefined
    const actualOpen = isControlled ? open : internalOpen
    const setActualOpen = isControlled ? onOpenChange || (() => {}) : setInternalOpen

    return (
        <DialogContext.Provider value={{ open: actualOpen, setOpen: setActualOpen }}>
            {children}
        </DialogContext.Provider>
    )
}

export const DialogContent: React.FC<DialogContentProps> = ({ children, className }) => {
    const context = useContext(DialogContext)
    if (!context || !context.open) return null

    return (
        <div
            role="button"
            tabIndex={0}
            className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-center tw-justify-center tw-bg-[rgba(0,0,0,0.35)] tw-backdrop-blur-sm"
            onClick={() => context.setOpen(false)}
            onKeyDown={e => {
                if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    context.setOpen(false)
                }
            }}
        >
            <div
                className={[
                    'tw-bg-popover tw-text-popover-foreground tw-border tw-border-border tw-rounded-lg tw-shadow-lg tw-p-4',
                    className || '',
                ].join(' ')}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                {children}
            </div>
        </div>
    )
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children, className }) => {
    return <div className={['tw-mb-4', className || ''].join(' ')}>{children}</div>
}

export const DialogTitle: React.FC<DialogTitleProps> = ({ children, className }) => {
    return <h2 className={['tw-text-lg tw-font-semibold', className || ''].join(' ')}>{children}</h2>
}
