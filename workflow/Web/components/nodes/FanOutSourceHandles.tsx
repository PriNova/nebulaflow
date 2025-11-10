import { Handle, Position } from '@xyflow/react'

export function FanOutSourceHandles({
    count,
    className,
    edgeByHandle,
    disabledHandles,
}: {
    count: number
    className?: string
    edgeByHandle?: Record<string, string>
    disabledHandles?: Set<string>
}) {
    const handles = Array.from({ length: Math.max(1, count) }, (_, i) => i)
    const layoutSlots = Math.max(2, count)
    return (
        <>
            {handles.map(i => {
                const id = `out-${i}`
                const edgeId = edgeByHandle?.[id]
                const isDisabled = disabledHandles?.has(id)
                return (
                    <Handle
                        key={id}
                        id={id}
                        type="source"
                        position={Position.Bottom}
                        className={className}
                        title={edgeId || undefined}
                        data-edge-id={edgeId}
                        data-disabled={isDisabled ? 'true' : undefined}
                        style={{
                            left: `${((i + 1) / (layoutSlots + 1)) * 100}%`,
                            transform: 'translate(-50%, 50%)',
                            marginLeft: 0,
                            opacity: isDisabled ? 0.4 : 1,
                            pointerEvents: isDisabled ? 'none' : undefined,
                        }}
                    />
                )
            })}
        </>
    )
}
