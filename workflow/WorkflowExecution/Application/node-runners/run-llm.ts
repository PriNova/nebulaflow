import * as nodePath from 'node:path'

// Local type mirroring pi-ai's ImageContent to avoid ESM import in CJS context
interface ImageContent {
    type: 'image'
    data: string
    mimeType: string
}

import {
    AbortedError,
    type ApprovalResult,
    type AssistantContentItem,
    type LLMNode,
    type WorkflowNodes,
} from '../../../Core/models'
import type { IMessagePort } from '../../../Shared/Host/index'
import { safePost } from '../../../Shared/Infrastructure/messaging/safePost'
import { readNebulaflowSettingsFromWorkspaceRoots } from '../../../Shared/Infrastructure/nebulaflow-settings'
import { DEFAULT_PI_MODEL_ID } from '../../../Shared/LLM/default-model'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { replaceIndexedInputs } from '../../Core/execution/inputs'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'
import { buildPiTools } from '../../../PiIntegration/Application/pi-tools'
import { imageFromFile, imageFromURL } from '../../../PiIntegration/utils/image-utils'
import { resolvePiModel } from '../../../PiIntegration/Application/pi-models'

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

// ---------------------------------------------------------------------------
// Image attachment resolution
// ---------------------------------------------------------------------------

export async function resolveLLMAttachmentsToImages(
    node: WorkflowNodes,
    workspaceRoots: string[]
): Promise<ImageContent[] | undefined> {
    const llmNode = node as LLMNode
    const attachments = llmNode.data.attachments ?? []

    if (!Array.isArray(attachments) || attachments.length === 0) {
        return undefined
    }

    const images: ImageContent[] = []

    for (const attachment of attachments) {
        if (!attachment || attachment.kind !== 'image') continue

        if (attachment.source === 'file' && attachment.path) {
            const filePath = resolveAttachmentFilePath(attachment.path, workspaceRoots)
            try {
                const image = await imageFromFile(filePath)
                images.push(image)
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error)
                throw new Error(
                    `Failed to load image attachment "${attachment.path}" for LLM node ${node.id}: ${reason}`
                )
            }
        } else if (attachment.source === 'url' && attachment.url) {
            try {
                const image = await imageFromURL(attachment.url)
                images.push(image)
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error)
                throw new Error(
                    `Failed to load image attachment "${attachment.url}" for LLM node ${node.id}: ${reason}`
                )
            }
        }
    }

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

    if (nodePath.isAbsolute(trimmed)) {
        return nodePath.normalize(trimmed)
    }

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

// ---------------------------------------------------------------------------
// Model resolution from node config
// ---------------------------------------------------------------------------

async function resolveModelForNode(
    node: WorkflowNodes
): Promise<{ model: unknown; modelKey: string }> {
    const llmNode = node as LLMNode
    const modelId = llmNode.data.model?.id
    const piModel = modelId ? await resolvePiModel(modelId) : undefined
    return {
        model: piModel,
        modelKey: modelId ?? DEFAULT_PI_MODEL_ID,
    }
}

// ---------------------------------------------------------------------------
// Timeline accumulation from pi Agent events
// ---------------------------------------------------------------------------

interface TimelineState {
    items: AssistantContentItem[]
    toolCallNames: Map<string, string> // toolCallId → toolName
    currentAssistantMessageId: string | null
}

function createTimelineState(): TimelineState {
    return {
        items: [],
        toolCallNames: new Map(),
        currentAssistantMessageId: null,
    }
}

function addTextToTimeline(state: TimelineState, text: string): void {
    if (text.length === 0) return
    const last = state.items[state.items.length - 1]
    if (last?.type === 'text') {
        // Merge consecutive text deltas into one item to avoid
        // creating one sidebar block per streaming chunk.
        last.text += text
        return
    }
    state.items.push({ type: 'text', text })
}

function addThinkingToTimeline(state: TimelineState, thinking: string): void {
    if (thinking.length === 0) return
    const last = state.items[state.items.length - 1]
    if (last?.type === 'thinking') {
        // Merge consecutive thinking deltas into one item.
        last.thinking += thinking
        return
    }
    state.items.push({ type: 'thinking', thinking })
}

function addToolUseToTimeline(
    state: TimelineState,
    toolCallId: string,
    toolName: string,
    args: unknown
): void {
    state.toolCallNames.set(toolCallId, toolName)
    const inputJSON = safeStringify(args)
    state.items.push({ type: 'tool_use', id: toolCallId, name: toolName, inputJSON })
}

function addToolResultToTimeline(
    state: TimelineState,
    toolCallId: string,
    result: unknown,
    isError: boolean
): void {
    const name = state.toolCallNames.get(toolCallId)
    const resultStr = isError && typeof result === 'string' ? `Error: ${result}` : safeStringify(result)
    state.items.push({ type: 'tool_result', toolUseID: toolCallId, resultJSON: resultStr })

    // Detect sub-agent completion from Task tool
    if (name === 'task' || name === 'Task') {
        // Post sub-agent result as a node_sub_agent_content event if we can extract thread info
        // For now, the tool_result item in the timeline shows the sub-agent output
    }
}

// ---------------------------------------------------------------------------
// Core LLM execution with pi Agent
// ---------------------------------------------------------------------------

export async function runLLMCore(args: LLMRunArgs): Promise<string> {
    const { node, prompt, workspaceRoots, abortSignal, port, approvalHandler, mode } = args

    const llmNode = node as LLMNode
    const extData = node.data as { label?: unknown }
    const nodeLabel = typeof extData.label === 'string' ? extData.label : node.data.title
    const labelSuffix =
        typeof nodeLabel === 'string' && nodeLabel.trim().length > 0 ? ` "${nodeLabel.trim()}"` : ''

    const wrapErrorWithContext = (error: unknown): Error => {
        if (error instanceof AbortedError) return error
        const baseMessage = error instanceof Error ? error.message : String(error)
        return new Error(`[LLM node ${node.id}${labelSuffix} (${mode})] ${baseMessage}`)
    }

    try {
        // Dynamic import pi SDK (ESM packages from CJS context)
        const [{ Agent }, { streamSimple }] = await Promise.all([
            import('@earendil-works/pi-agent-core'),
            import('@earendil-works/pi-ai'),
        ])

        // Resolve model
        const { model: piModel, modelKey: _modelKey } = await resolveModelForNode(node)

        // Resolve images
        const images = await resolveLLMAttachmentsToImages(node, workspaceRoots)

        // Read node settings
        const disabledTools: string[] = Array.isArray(llmNode.data.disabledTools)
            ? llmNode.data.disabledTools
            : []
        const dangerouslyAllowAll: boolean = llmNode.data.dangerouslyAllowAll === true
        const reasoningEffort: string = llmNode.data.reasoningEffort ?? 'medium'

        // Read NebulaFlow workspace settings
        const nebulaflowWorkspaceSettings = await readNebulaflowSettingsFromWorkspaceRoots(
            workspaceRoots,
            {
                warnOnError: process.env.NEBULAFLOW_DEBUG_LLM === '1',
                debugTag: 'WorkflowExecution/run-llm',
            }
        )

        // Build tools
        const cwd = workspaceRoots[0] ?? process.cwd()
        const tools = await buildPiTools({
            cwd,
            disabledTools,
            allowAll: dangerouslyAllowAll,
        })

        // Build system prompt
        const rawSystemPrompt = String(llmNode.data.systemPromptTemplate ?? '')
        const trimmedSystemPrompt = rawSystemPrompt.trim()
        const systemPrompt = trimmedSystemPrompt.length > 0 ? rawSystemPrompt : undefined

        // Get API key for the model's provider
        // eslint-disable-next-line @typescript-eslint/require-await
        const getApiKey = async (provider: string): Promise<string | undefined> => {
            // 1. Check env vars
            const envKey = process.env[`${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`]
                ?? process.env.AMP_API_KEY // legacy Amp fallback
                ?? process.env.OPENROUTER_API_KEY
            if (envKey) return envKey

            // 2. Check NebulaFlow workspace settings
            const wsKey = nebulaflowWorkspaceSettings[`api_key_${provider}`] as string | undefined
            if (wsKey) return wsKey

            return undefined
        }

        // Create the pi Agent
        const agent = new Agent({
            streamFn: streamSimple,
            getApiKey,
            toolExecution: 'parallel',
        })

        // Set initial state
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        agent.state.tools = tools as any
        if (systemPrompt) {
            agent.state.systemPrompt = systemPrompt
        }
        if (piModel) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
            agent.state.model = piModel as any
        }

        // Map pi thinking levels
        const thinkingLevelMap: Record<string, 'off' | 'minimal' | 'low' | 'medium' | 'high'> = {
            off: 'off',
            minimal: 'minimal',
            low: 'low',
            medium: 'medium',
            high: 'high',
        }
        agent.state.thinkingLevel = thinkingLevelMap[reasoningEffort] ?? 'medium'

        const timeline = createTimelineState()

        // Set up event subscription
        // pi SDK events are untyped at runtime — use any with permissive access guarded by runtime checks
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
        const unsubscribe = agent.subscribe(async (event: any, signal: any) => {
            if (signal?.aborted) return

            switch (event.type) {
                case 'message_update': {
                    const msg: any = event.assistantMessageEvent
                    if (msg.type === 'text_delta') {
                        addTextToTimeline(timeline, msg.delta)
                    } else if (msg.type === 'thinking_delta') {
                        addThinkingToTimeline(timeline, msg.delta)
                    }
                    // Post the current timeline to webview
                    await safePost(port, {
                        type: 'node_assistant_content',
                        data: {
                            nodeId: node.id,
                            content: [...timeline.items],
                            mode,
                        },
                    })
                    break
                }

                case 'tool_execution_start': {
                    const { toolCallId, toolName, args } = event
                    addToolUseToTimeline(timeline, toolCallId, toolName, args)

                    await safePost(port, {
                        type: 'node_assistant_content',
                        data: {
                            nodeId: node.id,
                            content: [...timeline.items],
                            mode,
                        },
                    })

                    // If this is a Task/sub-agent tool, emit sub-agent start event
                    if (toolName === 'task' || toolName === 'Task') {
                        await safePost(port, {
                            type: 'node_sub_agent_content',
                            data: {
                                nodeId: node.id,
                                subThreadID: toolCallId,
                                agentType: 'task',
                                status: 'running',
                                content: [],
                            },
                        })
                    }
                    break
                }

                case 'tool_execution_update': {
                    const { toolCallId, partialResult } = event
                    // Stream tool partial results (e.g., bash stdout chunks)
                    if (typeof partialResult === 'string') {
                        await safePost(port, {
                            type: 'node_output_chunk',
                            data: {
                                nodeId: node.id,
                                chunk: partialResult,
                                stream: 'stdout',
                            },
                        })
                    }
                    // Update sub-agent content if this is a Task tool
                    const toolName = timeline.toolCallNames.get(toolCallId)
                    if (toolName === 'task' || toolName === 'Task') {
                        const resultStr = typeof partialResult === 'string'
                            ? partialResult
                            : safeStringify(partialResult)
                        await safePost(port, {
                            type: 'node_sub_agent_content',
                            data: {
                                nodeId: node.id,
                                subThreadID: toolCallId,
                                agentType: 'task',
                                status: 'running',
                                content: [{ type: 'text', text: resultStr }],
                            },
                        })
                    }
                    break
                }

                case 'tool_execution_end': {
                    const { toolCallId, toolName, result, isError } = event
                    addToolResultToTimeline(timeline, toolCallId, result, isError)

                    // Emit sub-agent end for Task tool
                    if (toolName === 'task' || toolName === 'Task') {
                        const resultStr = safeStringify(result)
                        await safePost(port, {
                            type: 'node_sub_agent_content',
                            data: {
                                nodeId: node.id,
                                subThreadID: toolCallId,
                                agentType: 'task',
                                status: isError ? 'error' : 'done',
                                content: [{ type: 'text', text: resultStr }],
                            },
                        })
                    }
                    break
                }

                case 'turn_end': {
                    // Post the complete timeline for this turn
                    await safePost(port, {
                        type: 'node_assistant_content',
                        data: {
                            nodeId: node.id,
                            content: [...timeline.items],
                            mode,
                        },
                    })
                    break
                }
            }
        })
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

        // Approval hook: block tool calls that need user approval
        agent.beforeToolCall = async (ctx, signal) => {
            if (signal?.aborted) return { block: true }

            // If auto-approve is enabled, allow all
            if (dangerouslyAllowAll) return { block: false }

            // Check if this node requires user approval for all tool calls
            const needsApproval = node.data.needsUserApproval === true
            if (!needsApproval) return { block: false }

            // Show approval prompt in webview
            const toolName = ctx.toolCall.name
            const display = `Tool call awaiting approval: ${toolName}\nArguments: ${safeStringify(ctx.args)}`

            await safePost(port, {
                type: 'node_execution_status',
                data: {
                    nodeId: node.id,
                    status: 'pending_approval',
                    result: display,
                },
            })

            try {
                const decision = await approvalHandler(node.id)
                if (decision.type === 'aborted') {
                    return { block: true, reason: 'User rejected tool execution' }
                }
                return { block: false }
            } catch {
                return { block: true, reason: 'Approval handler failed' }
            }
        }

        // Set up timeout and abort
        const sec = Number(llmNode.data.timeoutSec)
        const disableTimeout = sec === 0
        const timeoutMs =
            Number.isFinite(sec) && sec > 0 ? Math.floor(sec * 1000) : DEFAULT_LLM_TIMEOUT_MS

        let timer: ReturnType<typeof setTimeout> | undefined
        if (!disableTimeout) {
            timer = setTimeout(() => {
                agent.abort()
            }, timeoutMs)
        }

        // Wire abort signal to agent
        const onAbort = () => agent.abort()
        abortSignal.addEventListener('abort', onAbort)

        let finalResult = ''
        try {
            // Run the agent
            await agent.prompt(prompt, images)

            // Wait for completion
            await agent.waitForIdle()

            // Extract final text from the last assistant message
            const messages = agent.state.messages
            const lastAssistant = [...messages].reverse().find(
                (m) => m.role === 'assistant' && 'content' in m
            )
            if (lastAssistant) {
                const content = (lastAssistant as { content: Array<{ type: string; text?: string }> }).content
                const textBlocks = (content || []).filter((b) => b.type === 'text')
                if (textBlocks.length > 0) {
                    finalResult = textBlocks
                        .map((b) => b.text ?? '')
                        .join('\n')
                        .trim()
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new AbortedError()
            }
            throw error
        } finally {
            if (timer) clearTimeout(timer)
            abortSignal.removeEventListener('abort', onAbort)
            unsubscribe()
        }

        return finalResult
    } catch (error) {
        throw wrapErrorWithContext(error)
    }
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

export async function executeLLMNode(
    node: WorkflowNodes,
    context: IndexedExecutionContext,
    abortSignal: AbortSignal,
    port: IMessagePort,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>
): Promise<string> {
    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
    const template = node.data.content || ''
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
    _threadID: string,
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
        prompt,
    })

    // Chat turns always create a new Agent instance (no persistent state between turns in this model).
    // The threadID is no longer needed — pi handles multi-turn differently.
    return await runLLMCore({
        node,
        prompt,
        workspaceRoots,
        abortSignal,
        port,
        approvalHandler,
        mode: 'single-node',
    })
}

// ---------------------------------------------------------------------------
// Timeline extraction utilities (kept for backward compat)
// ---------------------------------------------------------------------------

export function extractAssistantTimeline(_thread: unknown): AssistantContentItem[] {
    // With pi Agent, timeline is built incrementally from events.
    // This function remains as a stub for any legacy callers that relied on
    // the old Amp SDK thread format.
    return []
}

export function safeStringify(obj: unknown, maxLength = 100000): string {
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
