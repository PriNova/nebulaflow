import {
    AbortedError,
    type ApprovalResult,
    type AssistantContentItem,
    type ExtensionToWorkflow,
    type WorkflowNodes,
} from '../../../Core/models'
import { computeLLMAmpSettings } from '../../../LLMIntegration/Application/llm-settings'
import type { IMessagePort } from '../../../Shared/Host/index'
import { safePost } from '../../../Shared/Infrastructure/messaging/safePost'
import { DEFAULT_LLM_MODEL_ID } from '../../../Shared/LLM/default-model'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { replaceIndexedInputs } from '../../Core/execution/inputs'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'

const DEFAULT_LLM_TIMEOUT_MS = 300_000

export async function executeLLMNode(
    node: WorkflowNodes,
    context: IndexedExecutionContext,
    abortSignal: AbortSignal,
    port: IMessagePort,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>
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
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        ;({ createAmp } = require('@prinova/amp-sdk'))
    } catch (error) {
        throw new Error(
            `Amp SDK not available: ${error instanceof Error ? error.message : String(error)}`
        )
    }

    const apiKey = process.env.AMP_API_KEY
    if (!apiKey) {
        throw new Error('AMP_API_KEY is not set')
    }

    const { getActiveWorkspaceRoots } = await import('../../../Shared/Infrastructure/workspace.js')
    const workspaceRoots = getActiveWorkspaceRoots()
    console.debug('executeLLMNode: ', JSON.stringify(workspaceRoots, null, 2))

    // Determine model key from node selection, validating with SDK when available
    const defaultModelKey = DEFAULT_LLM_MODEL_ID
    const modelId = (node as any)?.data?.model?.id as string | undefined
    let selectedKey: string | undefined
    if (modelId) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const sdk = require('@prinova/amp-sdk') as any
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

    const { settings: llmSettings, debug: llmDebug } = computeLLMAmpSettings(node)
    if (
        llmDebug.dangerouslyAllowAll &&
        llmDebug.disabledTools.some(t => typeof t === 'string' && t.toLowerCase() === 'bash')
    ) {
        console.debug('[ExecuteWorkflow] Bash is disabled; ignoring dangerouslyAllowAll flag for safety')
    }
    const autoApprove = Boolean((llmSettings as any)['amp.dangerouslyAllowAll'])

    const rawSystemPrompt = ((node as any).data?.systemPromptTemplate ?? '').toString()
    const trimmedSystemPrompt = rawSystemPrompt.trim()
    const systemPromptTemplate = trimmedSystemPrompt.length > 0 ? rawSystemPrompt : undefined

    const amp = await createAmp({
        apiKey,
        workspaceRoots,
        systemPromptTemplate,
        settings: {
            'internal.primaryModel': selectedKey ?? defaultModelKey,
            ...llmSettings,
        },
    })
    // Ensure tools are registered before first run
    try {
        if (typeof (amp as any).whenToolsReady === 'function') {
            const enabled = await (amp as any).whenToolsReady()
            console.debug('[ExecuteWorkflow] Tools ready for node', node.id, {
                enabled,
                disabled: llmDebug.disabledTools,
                allowAll: llmDebug.dangerouslyAllowAll,
                effort: llmDebug.reasoningEffort,
            })
        }
    } catch {
        // Non-fatal: continue
    }
    try {
        let finalText = ''
        const handledBlocked = new Set<string>()
        const streamP = (async () => {
            for await (const event of amp.runJSONL({ prompt })) {
                abortSignal.throwIfAborted()
                if (event.type === 'messages') {
                    const thread = event.thread as any
                    const items = extractAssistantTimeline(thread)
                    await safePost(port, {
                        type: 'node_assistant_content',
                        data: {
                            nodeId: node.id,
                            threadID: thread.id,
                            content: items,
                        },
                    } as ExtensionToWorkflow)

                    // Detect blocked-on-user tool results and request approval
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

                            // Auto-approve when dangerouslyAllowAll is enabled, regardless of toAllow content
                            if (autoApprove) {
                                if (!b.toAllow || b.toAllow.length === 0) {
                                    console.warn(
                                        '[ExecuteWorkflow] Auto-approving toolUseID=%s with no explicit toAllow',
                                        b.toolUseID
                                    )
                                }
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

                            await safePost(port, {
                                type: 'node_execution_status',
                                data: { nodeId: node.id, status: 'pending_approval', result: display },
                            } as ExtensionToWorkflow)

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
                        // If approval wait aborted, surface abort
                        if (e instanceof AbortedError) throw e
                        // Otherwise, continue streaming; errors here shouldn't crash the node
                    }

                    // Update latest assistant text for final result only
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

export function extractAssistantTimeline(thread: any): AssistantContentItem[] {
    const items: AssistantContentItem[] = []

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
                    const resultJSON = safeSafeStringify(block.result)
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
                    const resultJSON = safeSafeStringify(run)
                    items.push({ type: 'tool_result', toolUseID: block.toolUseID, resultJSON })
                }
            }
        }
    }

    return items
}

export function safeSafeStringify(obj: any, maxLength = 100000): string {
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
