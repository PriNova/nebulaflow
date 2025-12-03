import type { Edge, WorkflowNodes } from '../../../Core/models'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { shouldContinueLoop } from '../../Core/execution/task-list'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'

function computeLoopMaxIterations(baseIterations: number, overrideValues: string[]): number {
    const min = 1
    const max = 100

    if (!overrideValues || overrideValues.length === 0) return baseIterations

    for (const raw of overrideValues) {
        const trimmed = (raw ?? '').trim()
        if (!/^\d+$/.test(trimmed)) {
            continue
        }

        const parsed = Number.parseInt(trimmed, 10)
        if (Number.isNaN(parsed)) {
            continue
        }

        const clamped = Math.min(max, Math.max(min, parsed))
        return clamped
    }

    return baseIterations
}

type LoopStartData = {
    iterations: number
    loopVariable: string
    overrideIterations?: boolean
    loopMode?: 'fixed' | 'while-variable-not-empty'
    collectionVariable?: string
    maxSafeIterations?: number
}

export async function executeLoopStartNode(
    node: WorkflowNodes,
    context: IndexedExecutionContext
): Promise<string> {
    const allEdgesForNode = (context.edgeIndex.byTarget.get(node.id) || []) as Edge[]

    const getInputsFromEdges = (edges: Edge[]) =>
        combineParentOutputsByConnectionOrder(node.id, {
            ...context,
            edgeIndex: {
                ...context.edgeIndex,
                byTarget: new Map([...context.edgeIndex.byTarget, [node.id, edges]]),
            },
        })

    const overrideEdges = allEdgesForNode.filter(edge => edge.targetHandle === 'iterations-override')
    const mainEdges = allEdgesForNode.filter(edge => edge.targetHandle !== 'iterations-override')

    const mainInputs = getInputsFromEdges(mainEdges)
    const iterationOverrides = getInputsFromEdges(overrideEdges)

    const data = (node as any).data as LoopStartData
    const loopMode = data.loopMode ?? 'fixed'

    const rawMaxSafe = data.maxSafeIterations
    const maxSafeIterations = rawMaxSafe && rawMaxSafe > 0 ? rawMaxSafe : 100

    const collectionVariable = data.collectionVariable

    let loopState = context.loopStates.get(node.id)

    if (loopMode === 'fixed') {
        if (!loopState) {
            const baseIterations = data.iterations
            const maxIterations = computeLoopMaxIterations(baseIterations, iterationOverrides)
            loopState = { currentIteration: 0, maxIterations, variable: data.loopVariable }
            context.loopStates.set(node.id, loopState)
        } else if (loopState.currentIteration < loopState.maxIterations - 1) {
            context.loopStates.set(node.id, {
                ...loopState,
                currentIteration: loopState.currentIteration + 1,
            })
        }

        return mainInputs.join('\n')
    }

    if (!loopState) {
        if (!collectionVariable) {
            loopState = { currentIteration: 0, maxIterations: 0, variable: data.loopVariable }
            context.loopStates.set(node.id, loopState)
            return mainInputs.join('\n')
        }

        const collectionValue = context.variableValues?.get(collectionVariable)
        const shouldContinue = shouldContinueLoop(collectionValue)

        if (!shouldContinue) {
            loopState = { currentIteration: 0, maxIterations: 0, variable: data.loopVariable }
        } else {
            loopState = {
                currentIteration: 0,
                maxIterations: maxSafeIterations,
                variable: data.loopVariable,
            }
        }

        context.loopStates.set(node.id, loopState)
        return mainInputs.join('\n')
    }

    if (!collectionVariable) {
        context.loopStates.set(node.id, {
            ...loopState,
            maxIterations: loopState.currentIteration + 1,
        })
        return mainInputs.join('\n')
    }

    const collectionValue = context.variableValues?.get(collectionVariable)
    const shouldContinue = shouldContinueLoop(collectionValue)

    if (!shouldContinue) {
        context.loopStates.set(node.id, {
            ...loopState,
            maxIterations: loopState.currentIteration + 1,
        })
        return mainInputs.join('\n')
    }

    if (loopState.currentIteration < loopState.maxIterations - 1) {
        context.loopStates.set(node.id, {
            ...loopState,
            currentIteration: loopState.currentIteration + 1,
        })
    }

    return mainInputs.join('\n')
}
