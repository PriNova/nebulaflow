import { BaseEdge, type Edge as ReactFlowEdge, getSmoothStepPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import type React from 'react'
import { memo } from 'react'

export type Edge = ReactFlowEdge<any>

export type OrderedEdgeProps = EdgeProps & {
    data?: { orderNumber: number }
    edges: Edge[]
}

export const CustomOrderedEdgeComponent: React.FC<OrderedEdgeProps> = ({
    sourceX,
    sourceY,
    targetX,
    targetY,
    style,
    markerEnd,
    data,
}) => {
    const [edgePath] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY })
    const orderNumber = data?.orderNumber
    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
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
