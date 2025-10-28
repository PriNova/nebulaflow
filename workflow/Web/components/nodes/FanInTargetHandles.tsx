import { Handle, Position } from '@xyflow/react'

export function FanInTargetHandles({
    count,
    className,
    edgeByHandle,
}: {
    count: number
    className?: string
    edgeByHandle?: Record<string, string>
}) {
    const handles = Array.from({ length: Math.max(1, count) }, (_, i) => i)
    // Use at least 2 layout slots so a single visible handle sits at ~33%,
    // keeping visual alignment stable when the first connection is made.
    const layoutSlots = Math.max(2, count)
    return (
        <>
            {handles.map(i => {
                const id = `in-${i}`
                const edgeId = edgeByHandle?.[id]
                return (
                    <Handle
                        key={id}
                        id={id}
                        type="target"
                        position={Position.Top}
                        className={className}
                        title={edgeId || undefined}
                        data-edge-id={edgeId}
                        style={{
                            left: `${((i + 1) / (layoutSlots + 1)) * 100}%`,
                            transform: 'translateX(-50%)',
                            marginLeft: 0,
                        }}
                    />
                )
            })}
        </>
    )
}
