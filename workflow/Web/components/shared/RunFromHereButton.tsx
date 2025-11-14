import { Play } from 'lucide-react'
import type * as React from 'react'
import { Button } from '../../ui/shadcn/ui/button'

interface Props {
    nodeId: string
    disabled?: boolean
    className?: string
    title?: string
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export const RunFromHereButton: React.FC<Props> = ({
    nodeId,
    disabled,
    className,
    title = 'Run from here',
    onClick,
}) => {
    return (
        <Button
            type="button"
            size="icon"
            variant="ghostRoundedIcon"
            className={className}
            title={title}
            aria-label={title}
            disabled={disabled}
            onClick={e => {
                e.stopPropagation()
                if (onClick) {
                    onClick(e)
                    return
                }
                window.dispatchEvent(new CustomEvent('nebula-run-from-here', { detail: { nodeId } }))
            }}
        >
            <Play size={14} />
        </Button>
    )
}

export default RunFromHereButton
