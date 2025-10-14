import * as React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string; asChild?: boolean }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, children, ...props }, ref) => {
    return (
        <button ref={ref} className={className} {...props}>
            {children}
        </button>
    )
})
Button.displayName = 'Button'
