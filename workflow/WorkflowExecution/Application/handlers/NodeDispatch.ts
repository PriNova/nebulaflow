import { NodeType, type WorkflowNode, type WorkflowNodes } from '../../../Core/models'

export type Mode = 'workflow' | 'single-node'

export interface NodeImplementations {
    runCLI?: (...args: unknown[]) => Promise<unknown>
    runLLM?: (...args: unknown[]) => Promise<unknown>
    runPreview?: (...args: unknown[]) => unknown
    runInput?: (...args: unknown[]) => unknown
    runIfElse?: (...args: unknown[]) => unknown
    runAccumulator?: (...args: unknown[]) => unknown
    runVariable?: (...args: unknown[]) => unknown
    runLoopStart?: (...args: unknown[]) => unknown
    runLoopEnd?: (...args: unknown[]) => unknown
    runSubflow?: (...args: unknown[]) => unknown
    runSubflowOutput?: (...args: unknown[]) => unknown
    runSubflowInput?: (...args: unknown[]) => unknown
}

export async function routeNodeExecution(
    node: WorkflowNodes | WorkflowNode,
    mode: Mode,
    impl: NodeImplementations,
    ...args: unknown[]
): Promise<unknown> {
    switch ((node).type) {
        case NodeType.CLI: {
            if (!impl.runCLI) return unsupported(node, mode)
            return impl.runCLI(...args)
        }
        case NodeType.LLM: {
            if (!impl.runLLM) return unsupported(node, mode)
            return impl.runLLM(...args)
        }
        case NodeType.PREVIEW: {
            if (!impl.runPreview) return unsupported(node, mode)
            return impl.runPreview(...args)
        }
        case NodeType.INPUT: {
            if (!impl.runInput) return unsupported(node, mode)
            return impl.runInput(...args)
        }
        case NodeType.IF_ELSE: {
            if (!impl.runIfElse) return unsupported(node, mode)
            return impl.runIfElse(...args)
        }
        case NodeType.ACCUMULATOR: {
            if (!impl.runAccumulator) return unsupported(node, mode)
            return impl.runAccumulator(...args)
        }
        case NodeType.VARIABLE: {
            if (!impl.runVariable) return unsupported(node, mode)
            return impl.runVariable(...args)
        }
        case NodeType.LOOP_START: {
            if (!impl.runLoopStart) return unsupported(node, mode)
            return impl.runLoopStart(...args)
        }
        case NodeType.LOOP_END: {
            if (!impl.runLoopEnd) return unsupported(node, mode)
            return impl.runLoopEnd(...args)
        }
        case NodeType.SUBFLOW: {
            if (!impl.runSubflow) return unsupported(node, mode)
            return impl.runSubflow(...args)
        }
        case NodeType.SUBFLOW_OUTPUT: {
            if (!impl.runSubflowOutput) return unsupported(node, mode)
            return impl.runSubflowOutput(...args)
        }
        case NodeType.SUBFLOW_INPUT: {
            if (!impl.runSubflowInput) return unsupported(node, mode)
            return impl.runSubflowInput(...args)
        }
        default: {
            const n = node as { type: string }
            throw new Error(`Unknown node type: ${n.type}`)
        }
    }
}

function unsupported(node: WorkflowNodes | WorkflowNode, mode: Mode): never {
    const n = node as { type: string }
    throw new Error(`Run mode "${mode}" is not supported for node type: ${n.type}`)
}
