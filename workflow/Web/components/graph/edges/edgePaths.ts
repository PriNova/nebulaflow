import type { Position } from '@xyflow/react'
import { getBezierPath, getSmoothStepPath } from '@xyflow/react'

export type EdgePathInput = {
    sourceX: number
    sourceY: number
    targetX: number
    targetY: number
    sourcePosition?: Position
    targetPosition?: Position
}

export type EdgePathResult = [
    path: string,
    labelX: number,
    labelY: number,
    offsetX: number,
    offsetY: number,
]

export type EdgePathStrategy = (input: EdgePathInput) => EdgePathResult

export const bezierPathStrategy: EdgePathStrategy = ({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
}) => getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

export const smoothStepPathStrategy: EdgePathStrategy = ({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
}) => getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

export type EdgeStyleKey = 'bezier' | 'smoothstep'

const STRATEGY_MAP: Record<EdgeStyleKey, EdgePathStrategy> = {
    bezier: bezierPathStrategy,
    smoothstep: smoothStepPathStrategy,
}

export function selectEdgePathStrategy(style: EdgeStyleKey | undefined): EdgePathStrategy {
    if (!style) return STRATEGY_MAP.bezier
    return STRATEGY_MAP[style] ?? STRATEGY_MAP.bezier
}
