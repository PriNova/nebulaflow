import * as React from 'react'

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> & { onCheckedChange?: (checked: boolean) => void }

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, onCheckedChange, checked, ...props }, ref) => {
    return <input ref={ref} type="checkbox" className={className} checked={!!checked} onChange={e => onCheckedChange?.(e.target.checked)} {...props} />
})
Checkbox.displayName = 'Checkbox'
