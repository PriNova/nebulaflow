import { NodeType, type WorkflowNode, type WorkflowNodes } from '../../Core/models'

export type Mode = 'workflow' | 'single-node'

export interface NodeImplementations {
    runCLI?: (...args: any[]) => Promise<any>
    runLLM?: (...args: any[]) => Promise<any>
    runPreview?: (...args: any[]) => Promise<any>
    runInput?: (...args: any[]) => Promise<any>
    runIfElse?: (...args: any[]) => Promise<any>
    runAccumulator?: (...args: any[]) => Promise<any>
    runVariable?: (...args: any[]) => Promise<any>
    runLoopStart?: (...args: any[]) => Promise<any>
    runLoopEnd?: (...args: any[]) => Promise<any>
    runSubflow?: (...args: any[]) => Promise<any>
    runSubflowOutput?: (...args: any[]) => Promise<any>
    runSubflowInput?: (...args: any[]) => Promise<any>
}

export async function routeNodeExecution(
    node: WorkflowNodes | WorkflowNode,
    mode: Mode,
    impl: NodeImplementations,
    ...args: any[]
): Promise<any> {
    switch ((node as WorkflowNodes).type) {
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
        default:
            throw new Error(`Unknown node type: ${(node as any).type}`)
    }
}

function unsupported(node: WorkflowNodes | WorkflowNode, mode: Mode): never {
    throw new Error(`Run mode "${mode}" is not supported for node type: ${(node as any).type}`)
}
