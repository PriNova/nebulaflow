import type { IndexedExecutionContext } from '../../Application/handlers/ExecuteWorkflow'
import { type ShellType, escapeForShell } from './sanitize'

export interface ReplaceOptions {
    shell?: ShellType
}

export function replaceIndexedInputs(
    template: string,
    parentOutputs: string[],
    context?: IndexedExecutionContext,
    options?: ReplaceOptions
): string {
    const escapeFn = options?.shell ? (v: string) => escapeForShell(v, options.shell!) : (v: string) => v

    let result = template.replace(/\${(\d+)}(?!\w)/g, (_match, index) => {
        const adjustedIndex = Number.parseInt(index, 10) - 1
        return adjustedIndex >= 0 && adjustedIndex < parentOutputs.length
            ? escapeFn(parentOutputs[adjustedIndex])
            : ''
    })

    if (context) {
        if (context.loopStates) {
            for (const [, loopState] of context.loopStates) {
                result = result.replace(
                    new RegExp(`\\$\{${loopState.variable}}(?!\\w)`, 'g'),
                    escapeFn(String(loopState.currentIteration))
                )
            }
        }
        const accumulatorVars = context.accumulatorValues
            ? Array.from(context.accumulatorValues.keys())
            : []
        for (const varName of accumulatorVars) {
            result = result.replace(
                new RegExp(`\\$\{${varName}}(?!\\w)`, 'g'),
                escapeFn(context.accumulatorValues?.get(varName) || '')
            )
        }
        const variableVars = context.variableValues ? Array.from(context.variableValues.keys()) : []
        for (const varName of variableVars) {
            result = result.replace(
                new RegExp(`\\$\{${varName}}(?!\\w)`, 'g'),
                escapeFn(context.variableValues?.get(varName) || '')
            )
        }
    }
    return result
}

export function evalTemplate(
    template: string,
    inputs: string[],
    context?: IndexedExecutionContext | Partial<IndexedExecutionContext>
): string {
    if (!template) {
        return ''
    }
    return replaceIndexedInputs(template, inputs, context as IndexedExecutionContext | undefined)
}
