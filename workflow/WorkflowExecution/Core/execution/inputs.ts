import type { IndexedExecutionContext } from '../../Application/handlers/ExecuteWorkflow'

export function replaceIndexedInputs(
    template: string,
    parentOutputs: string[],
    context?: IndexedExecutionContext
): string {
    let result = template.replace(/\${(\d+)}(?!\w)/g, (_match, index) => {
        const adjustedIndex = Number.parseInt(index, 10) - 1
        return adjustedIndex >= 0 && adjustedIndex < parentOutputs.length
            ? parentOutputs[adjustedIndex]
            : ''
    })

    if (context) {
        if (context.loopStates) {
            for (const [, loopState] of context.loopStates) {
                result = result.replace(
                    new RegExp(`\\$\{${loopState.variable}}(?!\\w)`, 'g'),
                    String(loopState.currentIteration)
                )
            }
        }
        const accumulatorVars = context.accumulatorValues
            ? Array.from(context.accumulatorValues.keys())
            : []
        for (const varName of accumulatorVars) {
            result = result.replace(
                new RegExp(`\\$\{${varName}}(?!\\w)`, 'g'),
                context.accumulatorValues?.get(varName) || ''
            )
        }
        const variableVars = context.variableValues ? Array.from(context.variableValues.keys()) : []
        for (const varName of variableVars) {
            result = result.replace(
                new RegExp(`\\$\{${varName}}(?!\\w)`, 'g'),
                context.variableValues?.get(varName) || ''
            )
        }
    }
    return result
}
