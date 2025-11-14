import { Copy } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Button } from '../../ui/shadcn/ui/button'

interface CopyToClipboardButtonProps {
    text: string
    title?: string
    className?: string
    size?: 'sm' | 'default' | 'lg' | 'icon'
    variant?: 'secondary' | 'outline' | 'default' | 'ghost'
}

export const CopyToClipboardButton: React.FC<CopyToClipboardButtonProps> = ({
    text,
    title = 'Copy to Clipboard',
    className,
    size = 'sm',
    variant = 'secondary',
}) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text ?? '')
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
        } catch {
            // no-op (clipboard may be unavailable); we avoid throwing in UI
        }
    }

    return (
        <Button
            size={size}
            variant={variant}
            onClick={handleCopy}
            className={className}
            title={title}
            aria-label={title}
        >
            <Copy className="tw-h-4 tw-w-4" />
            {copied ? <span className="tw-text-[10px] tw-ml-1">Copied</span> : null}
        </Button>
    )
}
