import * as React from 'react'

interface InputProps extends React.ComponentProps<'input'> { variant?: 'default' | 'search' }

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
    return <input ref={ref} type={type} className={className} {...props} />
})
Input.displayName = 'Input'
