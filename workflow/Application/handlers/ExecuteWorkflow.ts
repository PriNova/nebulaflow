import * as vscode from 'vscode'
import { processGraphComposition } from '../../Core/engine/node-sorting'
import { AbortedError } from '../../Core/models'
import type { ApprovalResult, ExtensionToWorkflow } from '../../Core/models'
import {
    type Edge,
    type IfElseNode,
    NodeType,
    type WorkflowNode,
    type WorkflowNodes,
} from '../../Core/models'
import { expandHome, execute as shellExecute } from '../../DataAccess/shell'
import { safePost } from '../messaging/safePost'

interface IndexedEdges {
    bySource: Map<string, Edge[]>
    byTarget: Map<string, Edge[]>
    byId: Map<string, Edge>
}

export interface IndexedExecutionContext {
    nodeOutputs: Map<string, string | string[]>
    nodeIndex: Map<string, WorkflowNodes>
    edgeIndex: IndexedEdges
    loopStates: Map<string, { currentIteration: number; maxIterations: number; variable: string }>
    accumulatorValues?: Map<string, string>
    cliMetadata?: Map<string, { exitCode: string }>
    variableValues?: Map<string, string>
    ifelseSkipPaths?: Map<string, Set<string>>
}

export async function executeWorkflow(
    nodes: WorkflowNodes[],
    edges: Edge[],
    webview: vscode.Webview,
    abortSignal: AbortSignal,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>
): Promise<void> {
    const edgeIndex = createEdgeIndex(edges)
    const nodeIndex = new Map(nodes.map(node => [node.id, node]))
    const context: IndexedExecutionContext = {
        nodeOutputs: new Map(),
        nodeIndex,
        edgeIndex,
        loopStates: new Map(),
        accumulatorValues: new Map(),
        cliMetadata: new Map(),
        variableValues: new Map(),
        ifelseSkipPaths: new Map(),
    }

    const allInactiveNodes = new Set<string>()
    for (const node of nodes) {
        if (node.data.active === false) {
            const dependentInactiveNodes = getInactiveNodes(edges, node.id)
            for (const id of dependentInactiveNodes) {
                allInactiveNodes.add(id)
            }
        }
    }
    const sortedNodes = processGraphComposition(nodes, edges, true)

    await safePost(webview, { type: 'execution_started' } as ExtensionToWorkflow)

    for (const node of sortedNodes) {
        const shouldSkip = Array.from(context.ifelseSkipPaths?.values() ?? []).some(skipNodes =>
            skipNodes.has(node.id)
        )
        if (shouldSkip) {
            continue
        }
        if (allInactiveNodes.has(node.id)) {
            continue
        }

        await safePost(webview, {
            type: 'node_execution_status',
            data: { nodeId: node.id, status: 'running' },
        } as ExtensionToWorkflow)

        let result: string | string[] = ''
        try {
            switch (node.type) {
                case NodeType.CLI: {
                    result = await executeCLINode(node, abortSignal, webview, approvalHandler, context)
                    break
                }
                case NodeType.LLM: {
                    result = await executeLLMNode(node, context, abortSignal)
                    break
                }
                case NodeType.PREVIEW: {
                    result = await executePreviewNode(node.id, webview, context)
                    break
                }
                case NodeType.INPUT: {
                    result = await executeInputNode(node, context)
                    break
                }
                case NodeType.SEARCH_CONTEXT: {
                    result = ''
                    break
                }
                case NodeType.CODY_OUTPUT: {
                    result = ''
                    break
                }
                case NodeType.LOOP_START: {
                    result = await executeLoopStartNode(node, context)
                    break
                }
                case NodeType.LOOP_END: {
                    result = await executePreviewNode(node.id, webview, context)
                    break
                }
                case NodeType.ACCUMULATOR: {
                    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
                    const inputValue = node.data.content
                        ? replaceIndexedInputs(node.data.content, inputs, context)
                        : ''
                    const variableName = (node as any).data.variableName as string
                    const initialValue = (node as any).data.initialValue as string | undefined
                    let accumulatedValue =
                        context.accumulatorValues?.get(variableName) || initialValue || ''
                    accumulatedValue += '\n' + inputValue
                    context.accumulatorValues?.set(variableName, accumulatedValue)
                    result = accumulatedValue
                    break
                }
                case NodeType.IF_ELSE: {
                    result = await executeIfElseNode(context, node)
                    break
                }
                case NodeType.VARIABLE: {
                    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
                    const inputValue = node.data.content
                        ? replaceIndexedInputs(node.data.content, inputs, context)
                        : ''
                    const variableName = (node as any).data.variableName as string
                    const initialValue = (node as any).data.initialValue as string | undefined
                    let variableValue = context.variableValues?.get(variableName) || initialValue || ''
                    variableValue = inputValue
                    context.variableValues?.set(variableName, variableValue)
                    result = variableValue
                    break
                }
                default:
                    throw new Error(`Unknown node type: ${(node as WorkflowNodes).type}`)
            }
        } catch (error: unknown) {
            if (abortSignal.aborted) {
                await safePost(webview, {
                    type: 'node_execution_status',
                    data: { nodeId: node.id, status: 'interrupted' },
                } as ExtensionToWorkflow)
                await safePost(webview, { type: 'execution_completed' } as ExtensionToWorkflow)
                return
            }
            if (error instanceof AbortedError) {
                await safePost(webview, {
                    type: 'node_execution_status',
                    data: { nodeId: node.id, status: 'interrupted' },
                } as ExtensionToWorkflow)
                await safePost(webview, { type: 'execution_completed' } as ExtensionToWorkflow)
                return
            }
            const errorMessage = error instanceof Error ? error.message : String(error)
            void vscode.window.showErrorMessage(`Node Error: ${errorMessage}`)
            await safePost(webview, {
                type: 'node_execution_status',
                data: { nodeId: node.id, status: 'error', result: errorMessage },
            } as ExtensionToWorkflow)
            await safePost(webview, { type: 'execution_completed' } as ExtensionToWorkflow)
            return
        }

        context.nodeOutputs.set(node.id, result)
        const safeResult = Array.isArray(result)
            ? result.join('\n')
            : typeof result === 'string'
              ? result
              : JSON.stringify(result)
        await safePost(webview, {
            type: 'node_execution_status',
            data: { nodeId: node.id, status: 'completed', result: safeResult },
        } as ExtensionToWorkflow)
    }

    await safePost(webview, { type: 'execution_completed' } as ExtensionToWorkflow)
    context.loopStates.clear()
}

export function createEdgeIndex(edges: Edge[]): IndexedEdges {
    const bySource = new Map<string, Edge[]>()
    const byTarget = new Map<string, Edge[]>()
    const byId = new Map<string, Edge>()

    for (const edge of edges) {
        const sourceEdges = bySource.get(edge.source) || []
        sourceEdges.push(edge)
        bySource.set(edge.source, sourceEdges)

        const targetEdges = byTarget.get(edge.target) || []
        targetEdges.push(edge)
        byTarget.set(edge.target, targetEdges)

        byId.set(edge.id, edge)
    }

    return { bySource, byTarget, byId }
}

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
        for (const [, loopState] of context.loopStates) {
            result = result.replace(
                new RegExp(`\\$\{${loopState.variable}}(?!\\w)`, 'g'),
                String(loopState.currentIteration)
            )
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

export function combineParentOutputsByConnectionOrder(
    nodeId: string,
    context?: IndexedExecutionContext
): string[] {
    const parentEdges = context?.edgeIndex.byTarget.get(nodeId) || []
    return parentEdges
        .map(edge => {
            let output = context?.nodeOutputs.get(edge.source)
            if (Array.isArray(output)) {
                output = output.join('\n')
            }
            if (output === undefined) {
                return ''
            }
            return output.replace(/\r\n/g, '\n').trim()
        })
        .filter(output => output !== undefined)
}

async function executeLLMNode(
    node: WorkflowNodes,
    context: IndexedExecutionContext,
    abortSignal: AbortSignal
): Promise<string> {
    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
    const template = ((node as any).data?.content || '').toString()
    const prompt = template
        ? replaceIndexedInputs(template, inputs, context).trim()
        : (inputs[0] || '').trim()
    if (!prompt) {
        throw new Error('LLM Node requires a non-empty prompt')
    }

    let createAmp: any
    try {
        ;({ createAmp } = require('@sourcegraph/amp-sdk'))
    } catch {
        throw new Error('Amp SDK not available')
    }

    const apiKey = process.env.AMP_API_KEY
    if (!apiKey) {
        throw new Error('AMP_API_KEY is not set')
    }

    const workspaceRoots = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath)

    // Determine model key from node selection, validating with SDK when available
    const defaultModelKey = 'anthropic/claude-sonnet-4-5-20250929'
    const modelId = (node as any)?.data?.model?.id as string | undefined
    let selectedKey: string | undefined
    if (modelId) {
        try {
            const sdk = require('@sourcegraph/amp-sdk') as any
            const resolveModel:
                | ((args: { key: string } | { displayName: string; provider?: any }) => { key: string })
                | undefined = sdk?.resolveModel
            if (typeof resolveModel === 'function') {
                const { key } = resolveModel({ key: modelId })
                selectedKey = key
            }
        } catch {
            // Ignore and fall back
        }
    }

    const amp = await createAmp({
        apiKey,
        workspaceRoots,
        settings: {
            'internal.primaryModel': selectedKey ?? defaultModelKey,
        },
    })
    try {
        const runP = amp.run({ prompt })
        const abortP = new Promise<never>((_, rej) =>
            abortSignal.addEventListener('abort', () => rej(new AbortedError()), { once: true })
        )
        const timeoutP = new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('LLM request timed out')), 120000)
        )
        const { message } = (await Promise.race([runP, abortP, timeoutP])) as any
        const text = (message.content || [])
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('\n')
            .trim()
        return text
    } finally {
        await amp.dispose()
    }
}

export async function executeCLINode(
    node: WorkflowNodes,
    abortSignal: AbortSignal,
    webview: vscode.Webview,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>,
    context?: IndexedExecutionContext
): Promise<string> {
    abortSignal.throwIfAborted()
    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
    const command = node.data.content ? replaceIndexedInputs(node.data.content, inputs, context) : ''
    if (!command.trim()) {
        throw new Error('CLI Node requires a non-empty command')
    }

    let filteredCommand = expandHome(command) || ''

    if (node.data.needsUserApproval) {
        await safePost(webview, {
            type: 'node_execution_status',
            data: { nodeId: node.id, status: 'pending_approval', result: `${filteredCommand}` },
        } as ExtensionToWorkflow)
        const approval = await approvalHandler(node.id)
        if (approval.type === 'aborted') {
            throw new AbortedError()
        }
        if (approval.type === 'approved' && approval.command) {
            filteredCommand = approval.command
        }
    }

    if (commandsNotAllowed.some(cmd => sanitizeForShell(filteredCommand).startsWith(cmd))) {
        void vscode.window.showErrorMessage('Command cannot be executed')
        throw new Error('Command cannot be executed')
    }

    try {
        const { output, exitCode } = await shellExecute(filteredCommand, abortSignal)
        if (exitCode !== '0' && (node as any).data?.shouldAbort) {
            throw new Error(output)
        }
        context?.cliMetadata?.set(node.id, { exitCode: exitCode })
        return output
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`CLI Node execution failed: ${errorMessage}`)
    }
}

async function executePreviewNode(
    nodeId: string,
    webview: vscode.Webview,
    context: IndexedExecutionContext
): Promise<string> {
    const input = combineParentOutputsByConnectionOrder(nodeId, context).join('\n')
    const processedInput = replaceIndexedInputs(input, [], context)
    const trimmedInput = processedInput.trim()
    const tokenCount = trimmedInput.length
    await safePost(webview, {
        type: 'token_count',
        data: { nodeId, count: tokenCount },
    } as ExtensionToWorkflow)
    return trimmedInput
}

async function executeInputNode(node: WorkflowNode, context: IndexedExecutionContext): Promise<string> {
    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
    const text = node.data.content ? replaceIndexedInputs(node.data.content, inputs, context) : ''
    return text.trim()
}

async function executeIfElseNode(
    context: IndexedExecutionContext,
    node: WorkflowNode | IfElseNode
): Promise<string> {
    let result = ''
    const parentEdges = context.edgeIndex.byTarget.get(node.id) || []
    let cliNode: WorkflowNodes | undefined
    let cliExitCode: string | undefined

    for (const edge of parentEdges) {
        const parentNode = context.nodeIndex.get(edge.source)
        if (parentNode?.type === NodeType.CLI) {
            cliNode = parentNode
            cliExitCode = context.cliMetadata?.get(parentNode.id)?.exitCode
            break
        }
    }

    let hasResult: boolean

    if (cliNode) {
        hasResult = cliExitCode === '0'
        result = context.nodeOutputs.get(cliNode.id) as string
    } else {
        const inputs = combineParentOutputsByConnectionOrder(node.id, context)
        const condition = node.data.content
            ? replaceIndexedInputs(node.data.content, inputs, context)
            : ''
        const [leftSide, operator, rightSide] = condition.trim().split(/\s+(===|!==)\s+/)
        hasResult = operator === '===' ? leftSide === rightSide : leftSide !== rightSide
        result = hasResult ? 'true' : 'false'
    }

    context.ifelseSkipPaths?.set(node.id, new Set<string>())
    const edges = context.edgeIndex.bySource.get(node.id) || []
    const nonTakenPath = edges.find(edge => edge.sourceHandle === (hasResult ? 'false' : 'true'))
    if (nonTakenPath) {
        if (!context.ifelseSkipPaths) {
            context.ifelseSkipPaths = new Map<string, Set<string>>()
        }
        let skipNodes = context.ifelseSkipPaths?.get(node.id)
        skipNodes = new Set<string>()
        context.ifelseSkipPaths?.set(node.id, skipNodes)
        const allEdges = Array.from(context.edgeIndex.byId.values())
        const nodesToSkip = getInactiveNodes(allEdges, nonTakenPath.target)
        for (const nodeId of nodesToSkip) {
            skipNodes.add(nodeId)
        }
    }
    return result
}

function getInactiveNodes(edges: Edge[], startNodeId: string): Set<string> {
    const inactiveNodes = new Set<string>()
    const queue = [startNodeId]
    while (queue.length > 0) {
        const currentId = queue.shift()!
        inactiveNodes.add(currentId)
        for (const edge of edges) {
            if (edge.source === currentId && !inactiveNodes.has(edge.target)) {
                queue.push(edge.target)
            }
        }
    }
    return inactiveNodes
}

export function sanitizeForShell(input: string): string {
    let sanitized = input.replace(/\\/g, '\\\\')
    sanitized = sanitized.replace(/\${/g, '\\${')
    sanitized = sanitized.replace(/\"/g, '\\"')
    for (const char of ["'", ';']) {
        sanitized = sanitized.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`)
    }
    return sanitized
}

async function executeLoopStartNode(
    node: WorkflowNodes,
    context: IndexedExecutionContext
): Promise<string> {
    const getInputsByHandle = (handleType: string) =>
        combineParentOutputsByConnectionOrder(node.id, {
            ...context,
            edgeIndex: {
                ...context.edgeIndex,
                byTarget: new Map([
                    [
                        node.id,
                        (context.edgeIndex.byTarget.get(node.id) || []).filter(
                            edge => edge.targetHandle === handleType
                        ),
                    ],
                ]),
            },
        })

    const mainInputs = getInputsByHandle('main')
    const iterationOverrides = getInputsByHandle('iterations-override')

    let loopState = context.loopStates.get(node.id)

    if (!loopState) {
        const maxIterations =
            iterationOverrides.length > 0
                ? Number.parseInt(iterationOverrides[0], 10) || (node as any).data.iterations
                : (node as any).data.iterations
        loopState = { currentIteration: 0, maxIterations, variable: (node as any).data.loopVariable }
        context.loopStates.set(node.id, loopState)
    } else if (loopState.currentIteration < loopState.maxIterations - 1) {
        context.loopStates.set(node.id, {
            ...loopState,
            currentIteration: loopState.currentIteration + 1,
        })
    }
    return mainInputs.join('\n')
}

const commandsNotAllowed = [
    'rm',
    'chmod',
    'shutdown',
    'history',
    'user',
    'sudo',
    'su',
    'passwd',
    'chown',
    'chgrp',
    'kill',
    'reboot',
    'poweroff',
    'init',
    'systemctl',
    'journalctl',
    'dmesg',
    'lsblk',
    'lsmod',
    'modprobe',
    'insmod',
    'rmmod',
    'lsusb',
    'lspci',
]
