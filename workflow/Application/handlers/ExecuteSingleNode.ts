import * as vscode from 'vscode'
import type { ExtensionToWorkflow, WorkflowNodeDTO } from '../../Core/Contracts/Protocol'
import type { ApprovalResult } from '../../Core/models'
import { AbortedError } from '../../Core/models'
import type { WorkflowNodes } from '../../Core/models'
import { fromProtocolPayload } from '../messaging/converters'
import { safePost } from '../messaging/safePost'
import { replaceIndexedInputs } from './ExecuteWorkflow'
import type { IndexedExecutionContext } from './ExecuteWorkflow'
import { routeNodeExecution } from './NodeDispatch'

const DEFAULT_LLM_TIMEOUT_MS = 300_000

export interface ExecuteNodePayload {
    node: WorkflowNodeDTO
    inputs?: string[]
    runId?: number
    variables?: Record<string, string>
}

export async function executeSingleNode(
    payload: ExecuteNodePayload,
    webview: vscode.Webview,
    abortSignal: AbortSignal,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>
): Promise<void> {
    const { node: nodeDTO, inputs = [], variables } = payload

    const { nodes } = fromProtocolPayload({ nodes: [nodeDTO], edges: [] })
    const node = nodes[0] as WorkflowNodes

    await safePost(webview, {
        type: 'node_execution_status',
        data: { nodeId: node.id, status: 'running' },
    })

    try {
        const result = await routeNodeExecution(node, 'single-node', {
            runCLI: (..._args: any[]) =>
                executeSingleCLINode(node, inputs, abortSignal, webview, approvalHandler, variables),
            runLLM: (..._args: any[]) =>
                executeSingleLLMNode(node, inputs, abortSignal, webview, approvalHandler, variables),
            runPreview: (..._args: any[]) => executeSinglePreviewNode(node, inputs, webview, variables),
            runInput: (..._args: any[]) => executeSingleInputNode(node, inputs, variables),
            runVariable: (..._args: any[]) => executeSingleVariableNode(node, inputs, variables),
            runIfElse: (..._args: any[]) => executeSingleIfElseNode(node, inputs, variables),
            runAccumulator: undefined,
            runLoopStart: undefined,
            runLoopEnd: undefined,
        })

        const safeResult = Array.isArray(result) ? result.join('\n') : String(result)
        await safePost(webview, {
            type: 'node_execution_status',
            data: { nodeId: node.id, status: 'completed', result: safeResult },
        })
        const completedEvent: ExtensionToWorkflow = {
            type: 'execution_completed',
            stoppedAtNodeId: node.id,
        }
        await safePost(webview, completedEvent)
    } catch (error) {
        if (abortSignal.aborted || error instanceof AbortedError) {
            await safePost(webview, {
                type: 'node_execution_status',
                data: { nodeId: nodeDTO.id, status: 'interrupted' },
            })
            const interruptedEvent: ExtensionToWorkflow = {
                type: 'execution_completed',
                stoppedAtNodeId: nodeDTO.id,
            }
            await safePost(webview, interruptedEvent)
            return
        }
        const msg = error instanceof Error ? error.message : String(error)
        void vscode.window.showErrorMessage(`Node Error: ${msg}`)
        await safePost(webview, {
            type: 'node_execution_status',
            data: { nodeId: nodeDTO.id, status: 'error', result: msg },
        })
        const errorEvent: ExtensionToWorkflow = {
            type: 'execution_completed',
            stoppedAtNodeId: nodeDTO.id,
        }
        await safePost(webview, errorEvent)
    }
}

async function executeSingleLLMNode(
    node: WorkflowNodes,
    inputs: string[],
    abortSignal: AbortSignal,
    webview: vscode.Webview,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>,
    variables?: Record<string, string>
): Promise<string> {
    const template = ((node as any).data?.content || '').toString()
    const hasTemplate = template.trim().length > 0
    const hasParentResult = (inputs || []).some(v => typeof v === 'string' && v.trim().length > 0)
    if (!hasTemplate && !hasParentResult) {
        throw new Error('LLM Node requires content or an input from a parent node')
    }
    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) as any }
        : undefined
    const prompt = hasTemplate
        ? replaceIndexedInputs(template, inputs, ctx as any)
        : (inputs[0] ?? '').toString()

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

    const { getActiveWorkspaceRoots } = await import('../workspace.js')
    const workspaceRoots = getActiveWorkspaceRoots()
    console.debug('executeSingleLLMNode: ', JSON.stringify(workspaceRoots, null, 2))

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
            // ignore
        }
    }

    const disabledTools: string[] | undefined = (node as any)?.data?.disabledTools
    const dangerouslyAllowAll: boolean | undefined = (node as any)?.data?.dangerouslyAllowAll
    const rawReasoningEffort: string | undefined = (node as any)?.data?.reasoningEffort
    const validReasoningEfforts = new Set(['minimal', 'low', 'medium', 'high'])
    const reasoningEffort =
        rawReasoningEffort && validReasoningEfforts.has(rawReasoningEffort)
            ? rawReasoningEffort
            : 'medium'

    const bashDisabled = Array.isArray(disabledTools)
        ? disabledTools.some(t => String(t).toLowerCase() === 'bash')
        : false
    const shouldApplyAllowAll = dangerouslyAllowAll && !bashDisabled

    const amp = await createAmp({
        apiKey,
        workspaceRoots,
        settings: {
            'internal.primaryModel': selectedKey ?? defaultModelKey,
            ...(disabledTools && disabledTools.length > 0 ? { 'tools.disable': disabledTools } : {}),
            'reasoning.effort': reasoningEffort as any,
            ...(shouldApplyAllowAll
                ? {
                      'amp.dangerouslyAllowAll': true,
                      'amp.experimental.commandApproval.enabled': false,
                      'amp.commands.allowlist': ['*'],
                      'amp.commands.strict': false,
                  }
                : {}),
        },
    })

    try {
        let finalText = ''
        const handledBlocked = new Set<string>()
        const streamP = (async () => {
            for await (const event of amp.runJSONL({ prompt })) {
                abortSignal.throwIfAborted()
                if (event.type === 'messages') {
                    const thread = event.thread as any

                    // 1) Stream assistant timeline to webview so RightSidebar updates in real-time
                    const items = extractAssistantTimelineSingle(thread)
                    await safePost(webview, {
                        type: 'node_assistant_content',
                        data: { nodeId: node.id, threadID: thread.id, content: items },
                    })

                    // 2) Handle blocked-on-user approvals (mirror workflow path)
                    try {
                        const blocked: Array<{
                            toolUseID: string
                            toAllow?: string[]
                            reason?: string
                            tokens?: { percent?: number; threshold?: number }
                        }> = []
                        for (const msg of thread?.messages || []) {
                            if (msg.role === 'user') {
                                for (const block of msg.content || []) {
                                    if (block.type === 'tool_result') {
                                        const run = block.run || {}
                                        if (run?.status === 'blocked-on-user' && block.toolUseID) {
                                            blocked.push({
                                                toolUseID: block.toolUseID,
                                                toAllow: run.toAllow,
                                                reason: run.reason,
                                                tokens: run.tokens,
                                            })
                                        }
                                    }
                                }
                            }
                        }
                        for (const b of blocked) {
                            if (handledBlocked.has(b.toolUseID)) continue
                            handledBlocked.add(b.toolUseID)

                            if (shouldApplyAllowAll) {
                                await amp.sendToolInput({
                                    threadID: thread.id,
                                    toolUseID: b.toolUseID,
                                    value: { accepted: true },
                                })
                                continue
                            }

                            const summaryLines: string[] = []
                            if (b.toAllow && Array.isArray(b.toAllow) && b.toAllow.length > 0) {
                                summaryLines.push('Command(s) awaiting approval:')
                                for (const c of b.toAllow) summaryLines.push(`- ${c}`)
                            }
                            if (b.reason) summaryLines.push(`Reason: ${b.reason}`)
                            if (b.tokens && (b.tokens.percent != null || b.tokens.threshold != null)) {
                                const pct = b.tokens.percent != null ? `${b.tokens.percent}%` : 'n/a'
                                const thr = b.tokens.threshold != null ? `${b.tokens.threshold}` : 'n/a'
                                summaryLines.push(`Tokens: ${pct} (threshold ${thr})`)
                            }
                            const display = summaryLines.join('\n') || 'Approval required'

                            await safePost(webview, {
                                type: 'node_execution_status',
                                data: { nodeId: node.id, status: 'pending_approval', result: display },
                            })

                            let accepted = false
                            try {
                                const decision = await approvalHandler(node.id)
                                if ((decision as any)?.type === 'aborted') {
                                    throw new AbortedError()
                                }
                                accepted = true
                            } catch {
                                accepted = false
                            }

                            await amp.sendToolInput({
                                threadID: thread.id,
                                toolUseID: b.toolUseID,
                                value: { accepted },
                            })
                        }
                    } catch (e) {
                        if (e instanceof AbortedError) throw e
                    }

                    // 3) Track latest assistant text for final result
                    const lastAssistantMessage = thread.messages?.findLast(
                        (m: any) => m.role === 'assistant'
                    )
                    if (lastAssistantMessage) {
                        const textBlocks = (lastAssistantMessage.content || []).filter(
                            (b: any) => b.type === 'text'
                        )
                        if (textBlocks.length > 0) {
                            finalText = textBlocks
                                .map((b: any) => b.text)
                                .join('\n')
                                .trim()
                        }
                    }
                }
            }
        })()

        let abortHandler: (() => void) | undefined
        const abortP = new Promise<never>((_, rej) => {
            abortHandler = () => rej(new AbortedError())
            abortSignal.addEventListener('abort', abortHandler)
        }).catch(() => {})
        const sec = Number((node as any)?.data?.timeoutSec)
        const disableTimeout = sec === 0
        const timeoutMs =
            Number.isFinite(sec) && sec > 0 ? Math.floor(sec * 1000) : DEFAULT_LLM_TIMEOUT_MS
        let timer: ReturnType<typeof setTimeout> | undefined
        const timeoutP = disableTimeout
            ? undefined
            : new Promise<never>((_, rej) => {
                  timer = setTimeout(() => rej(new Error('LLM request timed out')), timeoutMs)
              })

        try {
            const racePromises = timeoutP ? [streamP, abortP, timeoutP] : [streamP, abortP]
            await Promise.race(racePromises)
        } finally {
            if (timer) clearTimeout(timer)
            if (abortHandler) abortSignal.removeEventListener('abort', abortHandler)
        }
        return finalText
    } finally {
        await amp.dispose()
    }
}

// Minimal copy of workflow helper to avoid cross-file dependency
function extractAssistantTimelineSingle(thread: any): any[] {
    const items: any[] = []
    for (const msg of thread?.messages || []) {
        if (msg.role === 'assistant') {
            for (const block of msg.content || []) {
                if (block.type === 'text') {
                    items.push({ type: 'text', text: block.text || '' })
                } else if (block.type === 'thinking') {
                    items.push({ type: 'thinking', thinking: block.thinking || '' })
                } else if (block.type === 'tool_use') {
                    const inputJSON = block.inputPartialJSON?.json || JSON.stringify(block.input || {})
                    items.push({ type: 'tool_use', id: block.id, name: block.name, inputJSON })
                } else if (block.type === 'server_tool_use') {
                    const inputJSON = JSON.stringify(block.input || {})
                    items.push({ type: 'server_tool_use', name: block.name, inputJSON })
                } else if (block.type === 'server_web_search_result') {
                    const resultJSON = safeSafeStringifySingle(block.result)
                    items.push({
                        type: 'server_web_search_result',
                        query: (block as any).query,
                        resultJSON,
                    })
                }
            }
        } else if (msg.role === 'user') {
            for (const block of msg.content || []) {
                if (block.type === 'tool_result') {
                    const run = block.run || {}
                    const resultJSON = safeSafeStringifySingle(run)
                    items.push({ type: 'tool_result', toolUseID: block.toolUseID, resultJSON })
                }
            }
        }
    }
    return items
}

function safeSafeStringifySingle(obj: any, maxLength = 100000): string {
    try {
        const str = JSON.stringify(obj, null, 2)
        if (str.length > maxLength) {
            return str.slice(0, maxLength) + '\n... (truncated)'
        }
        return str
    } catch {
        return String(obj)
    }
}

async function executeSingleCLINode(
    node: WorkflowNodes,
    inputs: string[],
    abortSignal: AbortSignal,
    webview: vscode.Webview,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>,
    variables?: Record<string, string>
): Promise<string> {
    abortSignal.throwIfAborted()
    const template = ((node as any).data?.content || '').toString()
    const hasTemplate = template.trim().length > 0
    const hasParentResult = (inputs || []).some(v => typeof v === 'string' && v.trim().length > 0)
    if (!hasTemplate && !hasParentResult) {
        throw new Error('CLI Node requires content or an input from a parent node')
    }
    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) as any }
        : undefined
    const command = hasTemplate
        ? replaceIndexedInputs(template, inputs, ctx as any)
        : (inputs[0] ?? '').toString()

    // Minimal approval path for single node execution: reuse existing hook
    if ((node as any).data?.needsUserApproval) {
        await safePost(webview, {
            type: 'node_execution_status',
            data: { nodeId: node.id, status: 'pending_approval', result: `${command}` },
        })
        const approval = await approvalHandler(node.id)
        if (approval.type === 'aborted') {
            throw new AbortedError()
        }
    }

    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    try {
        const { expandHome, execute: shellExecute } = await import('../../DataAccess/shell.js')
        const filteredCommand = expandHome(command) || ''
        const { output } = await shellExecute(filteredCommand, abortSignal, { cwd })
        return output
    } catch (error: unknown) {
        if (error instanceof AbortedError) {
            throw error
        }
        if (error instanceof Error) {
            throw error
        }
        throw new Error(String(error))
    }
}

async function executeSinglePreviewNode(
    node: WorkflowNodes,
    inputs: string[],
    webview: vscode.Webview,
    variables?: Record<string, string>
): Promise<string> {
    const inputJoined = (inputs || []).join('\n')
    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) as any }
        : undefined
    const processed = replaceIndexedInputs(inputJoined, inputs, ctx as any)
    const trimmed = processed.trim()
    const tokenCount = trimmed.length
    await safePost(webview, { type: 'token_count', data: { nodeId: node.id, count: tokenCount } })
    return trimmed
}

async function executeSingleInputNode(
    node: WorkflowNodes,
    inputs: string[],
    variables?: Record<string, string>
): Promise<string> {
    const template = ((node as any).data?.content || '').toString()
    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) as any }
        : undefined
    const text = template ? replaceIndexedInputs(template, inputs, ctx as any) : ''
    return text.trim()
}

async function executeSingleVariableNode(
    node: WorkflowNodes,
    inputs: string[],
    variables?: Record<string, string>
): Promise<string> {
    const template = ((node as any).data?.content || '').toString()
    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) as any }
        : undefined
    const value = template ? replaceIndexedInputs(template, inputs, ctx as any) : ''
    return value
}

async function executeSingleIfElseNode(
    node: WorkflowNodes,
    inputs: string[],
    variables?: Record<string, string>
): Promise<string> {
    const template = ((node as any).data?.content || '').toString()
    const ctx: Partial<IndexedExecutionContext> | undefined = variables
        ? { variableValues: new Map(Object.entries(variables)) as any }
        : undefined
    const condition = template ? replaceIndexedInputs(template, inputs, ctx as any) : ''
    const parts = condition.trim().split(/\s+(===|!==)\s+/)
    if (parts.length !== 3) {
        // Fallback: non-standard condition resolves to false
        return 'false'
    }
    const [leftSide, operator, rightSide] = parts
    const isTrue = operator === '===' ? leftSide === rightSide : leftSide !== rightSide
    return isTrue ? 'true' : 'false'
}
