import { BaseEdge, type Edge as ReactFlowEdge } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import type React from 'react'
import { memo, useMemo } from 'react'
import { selectEdgePathStrategy } from './edges/edgePaths'

export type EdgeData = { orderNumber?: number; edgeStyle?: 'bezier' | 'smoothstep' }

export type Edge = ReactFlowEdge<EdgeData>

export type OrderedEdgeProps = EdgeProps & {
    data?: EdgeData
}

const EDGE_STYLE_DEFAULT = 'bezier' as const

export const CustomOrderedEdgeComponent: React.FC<OrderedEdgeProps> = ({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    data,
}) => {
    const strategy = useMemo(
        () => selectEdgePathStrategy(data?.edgeStyle ?? EDGE_STYLE_DEFAULT),
        [data?.edgeStyle]
    )
    const [edgePath] = strategy({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
        </>
    )
}

export const CustomOrderedEdge = memo(CustomOrderedEdgeComponent)

export const edgeTypes: { [key: string]: React.FC<OrderedEdgeProps> } = {
    'ordered-edge': CustomOrderedEdgeComponent,
}
