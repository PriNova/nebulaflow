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
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
            }}
            onClick={() => context.setOpen(false)}
            onKeyDown={e => {
                if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    context.setOpen(false)
                }
            }}
        >
            <div
                className={className}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
                style={{ background: 'white', padding: '20px', borderRadius: '8px', maxWidth: '500px' }}
            >
                {children}
            </div>
        </div>
    )
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children, className }) => {
    return <div className={className}>{children}</div>
}

export const DialogTitle: React.FC<DialogTitleProps> = ({ children, className }) => {
    return <h2 className={className}>{children}</h2>
}
