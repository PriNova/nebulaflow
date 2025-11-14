import { PlayCircle } from 'lucide-react'
import type * as React from 'react'
import { Button } from '../../ui/shadcn/ui/button'

interface Props {
    nodeId: string
    disabled?: boolean
    className?: string
    title?: string
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export const RunOnlyThisButton: React.FC<Props> = ({
    nodeId,
    disabled,
    className,
    title = 'Run only this node',
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
                window.dispatchEvent(
                    new CustomEvent('nebula-run-only-this' as any, { detail: { nodeId } })
                )
            }}
        >
            <PlayCircle size={14} />
        </Button>
    )
}

export default RunOnlyThisButton
