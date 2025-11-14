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
    const orderNumber = data?.orderNumber
    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            <circle r="7" fill="rgb(255, 136, 0)">
                <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} calcMode="linear" />
            </circle>
            {typeof orderNumber === 'number' && (
                <text
                    x={0}
                    y={0}
                    style={{
                        fontSize: 10,
                        fontWeight: 'bold',
                        dominantBaseline: 'central',
                        textAnchor: 'middle',
                        pointerEvents: 'none',
                        fill: 'rgb(0, 0, 0)',
                    }}
                >
                    <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} calcMode="linear" />
                    {orderNumber}
                </text>
            )}
        </>
    )
}

export const CustomOrderedEdge = memo(CustomOrderedEdgeComponent)

export const edgeTypes: { [key: string]: React.FC<OrderedEdgeProps> } = {
    'ordered-edge': CustomOrderedEdgeComponent,
}
