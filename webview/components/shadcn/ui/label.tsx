import * as React from 'react'

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className, children, ...props }) => (
    <label className={className} {...props}>{children}</label>
)
