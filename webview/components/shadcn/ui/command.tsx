import * as React from 'react'

export const Command: React.FC<React.ComponentPropsWithoutRef<'div'>> = ({ className, children, ...props }) => (
    <div className={className} {...props}>{children}</div>
)
export const CommandInput = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<'input'>>(({ className, ...props }, ref) => (
    <input ref={ref} className={className} {...props} />
))
CommandInput.displayName = 'CommandInput'
export const CommandList: React.FC<React.ComponentPropsWithoutRef<'div'>> = ({ className, children, ...props }) => (
    <div className={className} {...props}>{children}</div>
)
export const CommandEmpty: React.FC<React.ComponentPropsWithoutRef<'div'>> = ({ className, children, ...props }) => (
    <div className={className} {...props}>{children}</div>
)
export const CommandLoading = CommandEmpty
export const CommandGroup: React.FC<React.ComponentPropsWithoutRef<'div'>> = ({ className, children, ...props }) => (
    <div className={className} {...props}>{children}</div>
)
export const CommandItem = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'> & { onSelect?: () => void }>(( { className, onSelect, children, ...props }, ref) => (
    <div ref={ref} className={className} onClick={() => onSelect?.()} {...props}>{children}</div>
))
CommandItem.displayName = 'CommandItem'
export const CommandRow: React.FC<React.ComponentPropsWithoutRef<'div'>> = ({ className, children, ...props }) => (
    <div className={className} {...props}>{children}</div>
)
export const CommandShortcut: React.FC<React.ComponentPropsWithoutRef<'span'>> = ({ className, children, ...props }) => (
    <span className={className} {...props}>{children}</span>
)
export const CommandSeparator: React.FC<React.ComponentPropsWithoutRef<'div'>> = ({ className, ...props }) => (
    <div className={className} {...props} />
)
export const CommandLink: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement> & { onSelect?: () => void }> = ({ href, className, children, onSelect, ...props }) => (
    <a href={href} className={className} onClick={onSelect as any} {...props}>{children}</a>
)
