import * as nodePath from 'node:path'
import {
    AbortedError,
    type ApprovalResult,
    type AssistantContentItem,
    type AttachmentRef,
    type ExtensionToWorkflow,
    type WorkflowNodes,
} from '../../../Core/models'
import { computeLLMAmpSettings } from '../../../LLMIntegration/Application/llm-settings'
import type { IMessagePort } from '../../../Shared/Host/index'
import { safePost } from '../../../Shared/Infrastructure/messaging/safePost'
import { readNebulaflowSettingsFromWorkspaceRoots } from '../../../Shared/Infrastructure/nebulaflow-settings'
import { DEFAULT_LLM_MODEL_ID } from '../../../Shared/LLM/default-model'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { replaceIndexedInputs } from '../../Core/execution/inputs'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'

const DEFAULT_LLM_TIMEOUT_MS = 300_000

export interface LLMRunArgs {
    node: WorkflowNodes
    prompt: string
    workspaceRoots: string[]
    abortSignal: AbortSignal
    port: IMessagePort
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>
    mode: 'workflow' | 'single-node'
}

export async function resolveLLMAttachmentsToImages(
    node: WorkflowNodes,
    ampSdk: any,
    workspaceRoots: string[]
): Promise<any[] | undefined> {
    const data = (node as any)?.data
    const attachments = (data?.attachments ?? []) as AttachmentRef[]
    /* console.debug(
        '[ExecuteWorkflow] LLM attachments for node %s: %s',
        node.id,
        JSON.stringify(attachments ?? [], null, 2)
    ) */

    if (!Array.isArray(attachments) || attachments.length === 0) {
        return undefined
    }

    if (!ampSdk) {
        console.debug('[ExecuteWorkflow] Amp SDK not available when resolving attachments')
        return undefined
    }

    const images: any[] = []

    for (const attachment of attachments) {
        if (!attachment || attachment.kind !== 'image') continue

        if (attachment.source === 'file' && attachment.path) {
            const filePath = resolveAttachmentFilePath(attachment.path, workspaceRoots)
            /* console.debug(
                '[ExecuteWorkflow] Resolving file attachment for node %s: %s -> %s',
                node.id,
                attachment.path,
                filePath
            ) */
            try {
                const image = await ampSdk.imageFromFile({ path: filePath })
                images.push(image)
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error)
                throw new Error(
                    `Failed to load image attachment "${attachment.path}" for LLM node ${node.id}: ${reason}`
                )
            }
        } else if (attachment.source === 'url' && attachment.url) {
            /*  console.debug(
                '[ExecuteWorkflow] Resolving URL attachment for node %s: %s',
                node.id,
                attachment.url
            ) */
            try {
                const image = await ampSdk.imageFromURL({ url: attachment.url })
                images.push(image)
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error)
                throw new Error(
                    `Failed to load image attachment "${attachment.url}" for LLM node ${node.id}: ${reason}`
                )
            }
        }
    }

    /* console.debug(
        '[ExecuteWorkflow] Resolved %d image attachment(s) for node %s',
        images.length,
        node.id
    ) */

    return images.length > 0 ? images : undefined
}

export function resolveAttachmentFilePath(
    relativeOrAbsolutePath: string,
    workspaceRoots: string[]
): string {
    const trimmed = relativeOrAbsolutePath.trim()
    if (!trimmed) {
        throw new Error('Attachment file path is empty')
    }

    // Absolute path for the current OS: use as-is (after normalisation)
    if (nodePath.isAbsolute(trimmed)) {
        return nodePath.normalize(trimmed)
    }

    // Otherwise, treat as workspace-relative (first root preferred)
    if (!Array.isArray(workspaceRoots) || workspaceRoots.length === 0) {
        throw new Error(
            `Relative attachment path "${trimmed}" cannot be resolved: no active workspace roots. ` +
                'Provide an absolute path or open a workspace.'
        )
    }

    const base = workspaceRoots[0]
    const resolved = nodePath.join(base, trimmed)
    return nodePath.normalize(resolved)
}

export async function runLLMCore(args: LLMRunArgs, existingThreadID?: string): Promise<string> {
    const { node, prompt, workspaceRoots, abortSignal, port, approvalHandler, mode } = args

    const nodeLabel = (node as any)?.data?.label ?? (node as any)?.data?.title
    const labelSuffix =
        typeof nodeLabel === 'string' && nodeLabel.trim().length > 0 ? ` "${nodeLabel.trim()}"` : ''

    const wrapErrorWithContext = (error: unknown): Error => {
        if (error instanceof AbortedError) {
            return error
        }
        const baseMessage = error instanceof Error ? error.message : String(error)
        return new Error(`[LLM node ${node.id}${labelSuffix} (${mode})] ${baseMessage}`)
    }

    try {
        let ampSdk: any
        try {
            ampSdk = await import('@prinova/amp-sdk')
        } catch (error) {
            throw new Error(
                `Amp SDK not available: ${error instanceof Error ? error.message : String(error)}`
            )
        }

        const apiKey = process.env.AMP_API_KEY
        if (!apiKey) {
            throw new Error('AMP_API_KEY is not set')
        }

        const defaultModelKey = DEFAULT_LLM_MODEL_ID
        const modelId = (node as any)?.data?.model?.id as string | undefined

        // Prefer the node-level model ID; normalize via SDK when possible, but never
        // silently ignore a user-selected model and fall back to the hardcoded default.
        let selectedKey: string | undefined = modelId
        try {
            const resolveModel:
                | ((args: { key: string } | { displayName: string; provider?: any }) => { key: string })
                | undefined = ampSdk?.resolveModel
            if (modelId && typeof resolveModel === 'function') {
                try {
                    const { key } = resolveModel({ key: modelId })
                    if (key) {
                        selectedKey = key
                    }
                } catch {
                    // If resolution fails, fall back to the raw modelId
                    selectedKey = modelId
                }
            }
        } catch {
            // Keep whatever selectedKey we already have (modelId or undefined)
        }

        const { settings: llmSettings, debug: llmDebug } = await computeLLMAmpSettings(node)
        if (
            llmDebug.dangerouslyAllowAll &&
            llmDebug.disabledTools.some(t => typeof t === 'string' && t.toLowerCase() === 'bash')
        ) {
            console.debug(
                '[ExecuteWorkflow] Bash is disabled; ignoring dangerouslyAllowAll flag for safety'
            )
        }

        const nebulaflowWorkspaceSettings = await readNebulaflowSettingsFromWorkspaceRoots(
            workspaceRoots,
            {
                warnOnError: process.env.NEBULAFLOW_DEBUG_LLM === '1',
                debugTag: 'WorkflowExecution/run-llm',
            }
        )
        const mergedSettings: Record<string, unknown> = {
            ...nebulaflowWorkspaceSettings,
            ...llmSettings,
        }

        const configuredPrimary =
            (nebulaflowWorkspaceSettings['internal.primaryModel'] as string | undefined)?.trim() ||
            undefined
        const primaryModelKey = selectedKey ?? configuredPrimary ?? defaultModelKey

        const autoApprove = Boolean((mergedSettings as any)['amp.dangerouslyAllowAll'])

        const rawSystemPrompt = ((node as any).data?.systemPromptTemplate ?? '').toString()
        const trimmedSystemPrompt = rawSystemPrompt.trim()
        const systemPromptTemplate = trimmedSystemPrompt.length > 0 ? rawSystemPrompt : undefined

        const { createAmp } = ampSdk
        const amp = await createAmp({
            apiKey,
            workspaceRoots,
            systemPromptTemplate,
            settings: {
                ...mergedSettings,
                'internal.primaryModel': primaryModelKey,
            },
        })

        const logPrefix = mode === 'workflow' ? '[ExecuteWorkflow]' : '[ExecuteSingleNode]'

        // Ensure tools are registered before first run
        try {
            if (typeof (amp as any).whenToolsReady === 'function') {
                const enabled = await (amp as any).whenToolsReady()
                console.debug(`${logPrefix} Tools ready for node`, node.id, {
                    enabled,
                    disabled: llmDebug.disabledTools,
                    allowAll: llmDebug.dangerouslyAllowAll,
                    effort: llmDebug.reasoningEffort,
                })
            }
        } catch {
            // Non-fatal: continue
        }

        const images = await resolveLLMAttachmentsToImages(node, ampSdk, workspaceRoots)

        try {
            let finalText = ''
            const handledBlocked = new Set<string>()
            const subAgentThreads = new Map<
                string,
                {
                    parentThreadID?: string
                    agentType: string
                    status: 'running' | 'done' | 'error' | 'cancelled'
                    messages: any[]
                }
            >()
            const postSubAgentContent = async (subThreadID: string) => {
                const entry = subAgentThreads.get(subThreadID)
                if (!entry) return
                const items = extractAssistantTimeline({ messages: entry.messages })
                await safePost(port, {
                    type: 'node_sub_agent_content',
                    data: {
                        nodeId: node.id,
                        subThreadID,
                        parentThreadID: entry.parentThreadID,
                        agentType: entry.agentType,
                        status: entry.status,
                        content: items,
                    },
                } as ExtensionToWorkflow)
            }
            const upsertSubAgentMessage = (messages: any[], message: any): any[] => {
                if (!message) return messages
                const messageId = message?.id
                if (messageId) {
                    const index = messages.findIndex(existing => existing?.id === messageId)
                    if (index === -1) return [...messages, message]
                    return messages.map((existing, idx) => (idx === index ? message : existing))
                }

                const last = messages[messages.length - 1]
                if (last?.role && message?.role && last.role === message.role) {
                    const lastState = last?.state?.type
                    const nextState = message?.state?.type
                    if (lastState === 'streaming' || nextState === 'streaming') {
                        return [...messages.slice(0, -1), message]
                    }
                }

                return [...messages, message]
            }
            const streamP = (async () => {
                const runOptions: any = { prompt }
                if (images && images.length > 0) {
                    runOptions.images = images
                }
                if (existingThreadID) {
                    runOptions.threadID = existingThreadID
                }

                /* console.debug(
                    `${logPrefix} Starting amp.runJSONL for node %s with images=%s`,
                    node.id,
                    images && images.length > 0 ? String(images.length) : '0'
                ) */

                for await (const event of amp.runJSONL(runOptions)) {
                    abortSignal.throwIfAborted()
                    switch (event.type) {
                        case 'messages': {
                            const thread = event.thread as any

                            // Debug: log first user message content block types to confirm image blocks are present
                            try {
                                const firstUser = (thread?.messages || []).find(
                                    (m: any) => m.role === 'user'
                                )
                                const types = (firstUser?.content || []).map((b: any) => b.type)
                                /* console.debug(
                                    `${logPrefix} First user message block types for node %s: %s`,
                                    node.id,
                                    JSON.stringify(types)
                                ) */
                            } catch {
                                // best-effort only
                            }

                            const items = extractAssistantTimeline(thread)
                            await safePost(port, {
                                type: 'node_assistant_content',
                                data: {
                                    nodeId: node.id,
                                    threadID: thread.id,
                                    content: items,
                                    mode,
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
                                                if (
                                                    run?.status === 'blocked-on-user' &&
                                                    block.toolUseID
                                                ) {
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
                                                `${logPrefix} Auto-approving toolUseID=%s with no explicit toAllow`,
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
                                    if (
                                        b.tokens &&
                                        (b.tokens.percent != null || b.tokens.threshold != null)
                                    ) {
                                        const pct =
                                            b.tokens.percent != null ? `${b.tokens.percent}%` : 'n/a'
                                        const thr =
                                            b.tokens.threshold != null ? `${b.tokens.threshold}` : 'n/a'
                                        summaryLines.push(`Tokens: ${pct} (threshold ${thr})`)
                                    }
                                    const display = summaryLines.join('\n') || 'Approval required'

                                    await safePost(port, {
                                        type: 'node_execution_status',
                                        data: {
                                            nodeId: node.id,
                                            status: 'pending_approval',
                                            result: display,
                                        },
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
                            break
                        }
                        case 'sub-agent-start': {
                            const subThreadID = (event as any).subThreadID as string | undefined
                            if (!subThreadID) break
                            const existing = subAgentThreads.get(subThreadID)
                            subAgentThreads.set(subThreadID, {
                                parentThreadID:
                                    (event as any).parentThreadID ?? existing?.parentThreadID,
                                agentType:
                                    (event as any).agentType ?? existing?.agentType ?? 'sub-agent',
                                status: 'running',
                                messages: existing?.messages ?? [],
                            })
                            await postSubAgentContent(subThreadID)
                            break
                        }
                        case 'sub-agent-message': {
                            const subThreadID = (event as any).threadID as string | undefined
                            if (!subThreadID) break
                            const existing = subAgentThreads.get(subThreadID)
                            const messages = upsertSubAgentMessage(
                                existing?.messages ?? [],
                                (event as any).message
                            )
                            subAgentThreads.set(subThreadID, {
                                parentThreadID: existing?.parentThreadID,
                                agentType:
                                    (event as any).agentType ?? existing?.agentType ?? 'sub-agent',
                                status: existing?.status ?? 'running',
                                messages,
                            })
                            await postSubAgentContent(subThreadID)
                            break
                        }
                        case 'sub-agent-end': {
                            const subThreadID = (event as any).subThreadID as string | undefined
                            if (!subThreadID) break
                            const existing = subAgentThreads.get(subThreadID)
                            subAgentThreads.set(subThreadID, {
                                parentThreadID:
                                    (event as any).parentThreadID ?? existing?.parentThreadID,
                                agentType:
                                    (event as any).agentType ?? existing?.agentType ?? 'sub-agent',
                                status: (event as any).status ?? existing?.status ?? 'done',
                                messages: existing?.messages ?? [],
                            })
                            await postSubAgentContent(subThreadID)
                            break
                        }
                        default:
                            break
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
    } catch (error) {
        throw wrapErrorWithContext(error)
    }
}

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

    const { getActiveWorkspaceRoots } = await import('../../../Shared/Infrastructure/workspace.js')
    const workspaceRoots = getActiveWorkspaceRoots()
    console.debug('executeLLMNode workspaceRoots: %s', JSON.stringify(workspaceRoots, null, 2))

    return await runLLMCore({
        node,
        prompt,
        workspaceRoots,
        abortSignal,
        port,
        approvalHandler,
        mode: 'workflow',
    })
}

export async function executeLLMChatTurn(
    node: WorkflowNodes,
    threadID: string,
    userMessage: string,
    abortSignal: AbortSignal,
    port: IMessagePort,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>
): Promise<string> {
    const prompt = (userMessage ?? '').toString().trim()
    if (!prompt) {
        throw new Error('Chat message must be non-empty')
    }

    const { getActiveWorkspaceRoots } = await import('../../../Shared/Infrastructure/workspace.js')
    const workspaceRoots = getActiveWorkspaceRoots()
    console.debug('executeLLMChatTurn workspaceRoots: %s', JSON.stringify(workspaceRoots, null, 2))
    console.debug('executeLLMChatTurn prompt', {
        nodeId: node.id,
        threadID,
        prompt,
    })

    return await runLLMCore(
        {
            node,
            prompt,
            workspaceRoots,
            abortSignal,
            port,
            approvalHandler,
            mode: 'single-node',
        },
        threadID
    )
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
                if (block.type === 'text') {
                    items.push({ type: 'user_message', text: block.text || '' })
                } else if (block.type === 'tool_result') {
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
