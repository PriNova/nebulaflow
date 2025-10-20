import clsx from 'clsx'
import { Loader2Icon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AssistantContentItem } from '../../Core/models'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/shadcn/ui/accordion'
import { Button } from '../ui/shadcn/ui/button'
import { Textarea } from '../ui/shadcn/ui/textarea'
import { NodeType, type WorkflowNodes } from './nodes/Nodes'

interface RightSidebarProps {
    sortedNodes: WorkflowNodes[]
    nodeResults: Map<string, string>
    executingNodeId: string | null
    pendingApprovalNodeId: string | null
    onApprove: (nodeId: string, approved: boolean, modifiedCommand?: string) => void
    interruptedNodeId: string | null
    nodeAssistantContent: Map<string, AssistantContentItem[]>
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
    sortedNodes,
    nodeResults,
    executingNodeId,
    pendingApprovalNodeId,
    onApprove,
    interruptedNodeId,
    nodeAssistantContent,
}) => {
    const filteredByActiveNodes = useMemo(
        () => sortedNodes.filter(node => node.type !== NodeType.PREVIEW && node.data.active !== false),
        [sortedNodes]
    )

    const getBorderColorClass = (nodeId: string): string => {
        if (nodeId === executingNodeId) {
            return 'tw-border-[var(--vscode-charts-yellow)]'
        }
        if (nodeId === interruptedNodeId) {
            return 'tw-border-[var(--vscode-charts-orange)]'
        }
        return 'tw-border-transparent'
    }
    const [openItemId, setOpenItemId] = useState<string | undefined>(undefined)
    const [modifiedCommands, setModifiedCommands] = useState<Map<string, string>>(new Map())
    const [expandedJsonItems, setExpandedJsonItems] = useState<Set<string>>(new Set())

    const handleCommandChange = (nodeId: string, value: string) => {
        setModifiedCommands(prev => new Map(prev).set(nodeId, value))
    }

    const toggleJsonExpanded = (id: string) => {
        setExpandedJsonItems(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const renderJsonContent = (
        content: string | undefined,
        id: string,
        maxLength = 300
    ): React.ReactNode => {
        if (!content) return null
        const isLong = content.length > maxLength
        const isExpanded = expandedJsonItems.has(id)

        return (
            <div className="tw-font-mono tw-text-xs tw-bg-[var(--vscode-editor-background)] tw-p-2 tw-rounded tw-border tw-border-[var(--vscode-panel-border)] tw-max-h-32 tw-overflow-auto tw-break-words">
                {isLong && !isExpanded ? (
                    <div>
                        <pre className="tw-whitespace-pre-wrap tw-text-[var(--vscode-foreground)]">
                            {content.slice(0, maxLength)}
                        </pre>
                        <button
                            type="button"
                            className="tw-text-[var(--vscode-textLink-foreground)] hover:tw-underline tw-text-xs tw-mt-1"
                            onClick={() => toggleJsonExpanded(id)}
                        >
                            Expand
                        </button>
                    </div>
                ) : (
                    <div>
                        <pre className="tw-whitespace-pre-wrap tw-text-[var(--vscode-foreground)]">
                            {content}
                        </pre>
                        {isLong && isExpanded && (
                            <button
                                type="button"
                                className="tw-text-[var(--vscode-textLink-foreground)] hover:tw-underline tw-text-xs tw-mt-1"
                                onClick={() => toggleJsonExpanded(id)}
                            >
                                Collapse
                            </button>
                        )}
                    </div>
                )}
            </div>
        )
    }

    const shorten = (val: unknown, max = 80): string => {
        const s = String(val ?? '')
        if (s.length <= max) return s
        return s.slice(0, max - 1) + '…'
    }

    const safeParseJSON = (s?: string): unknown => {
        if (!s) return null
        try {
            return JSON.parse(s)
        } catch {
            return null
        }
    }

    const extractValues = (obj: any, keys: string[]): string[] => {
        const out: string[] = []
        for (const k of keys) {
            if (obj && Object.prototype.hasOwnProperty.call(obj, k)) {
                const v = obj[k]
                if (v == null) continue
                if (Array.isArray(v)) {
                    const flat = v
                        .filter(
                            x => typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean'
                        )
                        .map(x => String(x))
                        .join(', ')
                    if (flat) out.push(flat)
                } else if (typeof v === 'object') {
                    // skip nested objects for title brevity
                } else {
                    out.push(String(v))
                }
            }
        }
        return out
    }

    const TOOL_KEYS: Record<string, string[] | undefined> = {
        // workspace tools
        bash: ['cmd'],
        list_directory: ['path'],
        read: ['path'],
        grep: ['pattern', 'path'],
        glob: ['filePattern'],
        get_diagnostics: ['path'],
        format_file: ['path'],
        create_file: ['path'],
        edit_file: ['path'],
        undo_edit: ['path'],
        summarize_git_diff: ['gitDiffCommand'],
        multiple_choice: ['question'],
        run_javascript: ['codeFile', 'code'],
        codebase_search_agent: ['query'],
        librarian: ['query'],
        oracle: ['task'],
        task: ['description', 'prompt'],
        todo_read: [],
        todo_write: [],
        web_crawler: ['task'],
        mermaid: [],
    }

    const formatToolArgsFromInput = (name: string, inputJSON?: string): string => {
        const obj = safeParseJSON(inputJSON)
        if (!obj || typeof obj !== 'object') return ''
        const norm = name.toLowerCase()
        const keys = TOOL_KEYS[norm]
        let vals: string[] = []
        if (Array.isArray(keys)) {
            vals = extractValues(obj as any, keys)
        }
        if (vals.length === 0) {
            // fallback: pick first few primitive values
            const prims = Object.values(obj as any)
                .flatMap(v =>
                    Array.isArray(v)
                        ? v
                              .filter(x => ['string', 'number', 'boolean'].includes(typeof x))
                              .map(x => String(x))
                        : typeof v === 'object'
                          ? []
                          : [String(v)]
                )
                .filter(Boolean)
            vals = prims.slice(0, 2)
        }
        const joined = vals.map(v => shorten(v)).join(', ')
        return joined ? `: ${joined}` : ''
    }

    const renderAssistantAccordionItem = (
        item: AssistantContentItem,
        index: number,
        nodeId: string,
        pairedResultJSON?: string
    ) => {
        const key = `${nodeId}:${index}`
        let title = ''
        switch (item.type) {
            case 'text':
                title = '📝 Assistance Message'
                break
            case 'thinking':
                title = '🧠 Thinking'
                break
            case 'tool_use': {
                const suffix = formatToolArgsFromInput(item.name, item.inputJSON)
                title = `🔧 ${item.name}${suffix}`
                break
            }
            case 'tool_result':
                title = '✅ Result'
                break
            case 'server_tool_use': {
                const suffix = formatToolArgsFromInput(item.name, item.inputJSON)
                title = `🌐 ${item.name}${suffix}`
                break
            }
            case 'server_web_search_result': {
                const suffix = item.query ? `: ${shorten(item.query)}` : ''
                title = `🔍 Web Search${suffix}`
                break
            }
            default:
                title = 'Details'
        }

        return (
            <AccordionItem
                key={key}
                value={key}
                className="tw-border tw-border-[var(--vscode-panel-border)] tw-rounded"
            >
                <AccordionTrigger className="tw-w-full tw-text-xs tw-h-7 tw-py-1 tw-px-2 tw-bg-[var(--vscode-sideBar-background)] tw-rounded-t">
                    <div className="tw-flex tw-items-center tw-w-full tw-text-left tw-truncate">
                        <span className="tw-truncate">{title}</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="tw-p-2 tw-bg-[var(--vscode-editor-background)] tw-rounded-b">
                        {(() => {
                            switch (item.type) {
                                case 'text':
                                    return (
                                        <p className="tw-text-xs tw-text-[var(--vscode-foreground)] tw-whitespace-pre-wrap">
                                            {item.text}
                                        </p>
                                    )
                                case 'thinking': {
                                    const sanitizeThinking = (s: string): string =>
                                        s
                                            .replace(/<ENCRYPTED>[\s\S]*?<\/ENCRYPTED>/g, '')
                                            .replace(/<ID>[\s\S]*?<\/ID>/g, '')
                                    return (
                                        <p className="tw-text-xs tw-text-[var(--vscode-foreground)] tw-whitespace-pre-wrap tw-italic">
                                            {sanitizeThinking(item.thinking)}
                                        </p>
                                    )
                                }
                                case 'tool_use':
                                    return (
                                        <div className="tw-text-xs tw-space-y-1">
                                            {pairedResultJSON
                                                ? renderJsonContent(
                                                      pairedResultJSON,
                                                      `${key}/result`,
                                                      300
                                                  )
                                                : item.inputJSON && (
                                                      <div>
                                                          <p className="tw-text-[var(--vscode-foreground)] tw-mb-1">
                                                              Args:
                                                          </p>
                                                          {renderJsonContent(
                                                              item.inputJSON,
                                                              `${key}/args`,
                                                              300
                                                          )}
                                                      </div>
                                                  )}
                                        </div>
                                    )
                                case 'tool_result':
                                    return (
                                        <div className="tw-text-xs">
                                            {item.resultJSON &&
                                                renderJsonContent(item.resultJSON, `${key}/result`, 300)}
                                        </div>
                                    )
                                case 'server_tool_use':
                                    return (
                                        <div className="tw-text-xs tw-space-y-1">
                                            {item.inputJSON && (
                                                <div>
                                                    <p className="tw-text-[var(--vscode-foreground)] tw-mb-1">
                                                        Params:
                                                    </p>
                                                    {renderJsonContent(
                                                        item.inputJSON,
                                                        `${key}/params`,
                                                        300
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                case 'server_web_search_result':
                                    return (
                                        <div className="tw-text-xs tw-space-y-1">
                                            {item.query && (
                                                <p className="tw-text-[var(--vscode-foreground)]">
                                                    Query:{' '}
                                                    <span className="tw-italic">{item.query}</span>
                                                </p>
                                            )}
                                            {item.resultJSON &&
                                                renderJsonContent(item.resultJSON, `${key}/web`, 300)}
                                        </div>
                                    )
                                default:
                                    return null
                            }
                        })()}
                    </div>
                </AccordionContent>
            </AccordionItem>
        )
    }

    useEffect(() => {
        if (pendingApprovalNodeId) {
            setOpenItemId(pendingApprovalNodeId)
        }
    }, [pendingApprovalNodeId])
    useEffect(() => {
        if (executingNodeId !== null) {
            setModifiedCommands(new Map())
        }
    }, [executingNodeId])
    useEffect(() => {
        if (pendingApprovalNodeId !== null) {
            setModifiedCommands(new Map())
        }
    }, [pendingApprovalNodeId])

    return (
        <div
            className="tw-w-full tw-border-r tw-border-border tw-h-full tw-bg-sidebar-background tw-p-4"
            style={{ paddingBottom: '20px' }}
        >
            <div className="tw-flex tw-flex-col tw-gap-2 tw-mb-4">
                <h3 className="tw-text-[var(--vscode-sideBarTitle-foreground)] tw-font-medium tw-mb-4">
                    Workflow Execution Order & Results
                </h3>
                <div className="tw-space-y-2">
                    {filteredByActiveNodes.map(node => (
                        <div
                            key={node.id}
                            className={clsx(
                                'tw-flex tw-flex-col tw-gap-1 tw-px-2 tw-py-1 tw-rounded tw-bg-[var(--vscode-sideBar-dropBackground)]',
                                'tw-border',
                                getBorderColorClass(node.id)
                            )}
                        >
                            <Accordion
                                type="single"
                                collapsible
                                value={openItemId}
                                onValueChange={value => setOpenItemId(value || '')}
                            >
                                <AccordionItem value={node.id}>
                                    <AccordionTrigger className="tw-w-full tw-text-sm tw-h-6 tw-py-[.1rem]">
                                        <div className="tw-flex tw-items-center">
                                            <div className="tw-w-4 tw-mr-2">
                                                {node.id === executingNodeId && (
                                                    <Loader2Icon
                                                        stroke="#33ffcc"
                                                        strokeWidth={3}
                                                        size={24}
                                                        className="tw-h-4 tw-w-4 tw-animate-spin"
                                                    />
                                                )}
                                            </div>
                                            {node.data.title}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        {(nodeResults.has(node.id) ||
                                            (node.type === NodeType.LLM &&
                                                nodeAssistantContent.has(node.id))) && (
                                            <div className="tw-mt-1 tw-space-y-4">
                                                {node.type === NodeType.LLM &&
                                                    nodeAssistantContent.has(node.id) && (
                                                        <div className="tw-max-h-64 tw-overflow-y-auto">
                                                            <Accordion type="multiple">
                                                                {(() => {
                                                                    const items =
                                                                        nodeAssistantContent.get(
                                                                            node.id
                                                                        ) || []

                                                                    const filterLastTextMatchingResult =
                                                                        (
                                                                            arr: AssistantContentItem[],
                                                                            result: string | undefined
                                                                        ): AssistantContentItem[] => {
                                                                            const r = (
                                                                                result || ''
                                                                            ).trim()
                                                                            if (!r) return arr
                                                                            for (
                                                                                let i = arr.length - 1;
                                                                                i >= 0;
                                                                                i--
                                                                            ) {
                                                                                const it = arr[i]
                                                                                if (
                                                                                    it.type === 'text' &&
                                                                                    it.text.trim() === r
                                                                                ) {
                                                                                    return [
                                                                                        ...arr.slice(
                                                                                            0,
                                                                                            i
                                                                                        ),
                                                                                        ...arr.slice(
                                                                                            i + 1
                                                                                        ),
                                                                                    ]
                                                                                }
                                                                            }
                                                                            return arr
                                                                        }

                                                                    const finalResult = nodeResults.get(
                                                                        node.id
                                                                    )
                                                                    const displayItems =
                                                                        node.type === NodeType.LLM
                                                                            ? filterLastTextMatchingResult(
                                                                                  items,
                                                                                  finalResult
                                                                              )
                                                                            : items

                                                                    const pairedMap = new Map<
                                                                        string,
                                                                        string | undefined
                                                                    >()
                                                                    for (const it of items) {
                                                                        if (
                                                                            it.type === 'tool_result' &&
                                                                            it.toolUseID
                                                                        ) {
                                                                            pairedMap.set(
                                                                                it.toolUseID,
                                                                                it.resultJSON
                                                                            )
                                                                        }
                                                                    }
                                                                    return displayItems
                                                                        .filter(
                                                                            it =>
                                                                                it.type !== 'tool_result'
                                                                        )
                                                                        .map((it, idx) =>
                                                                            renderAssistantAccordionItem(
                                                                                it,
                                                                                idx,
                                                                                node.id,
                                                                                it.type === 'tool_use'
                                                                                    ? pairedMap.get(
                                                                                          it.id
                                                                                      )
                                                                                    : undefined
                                                                            )
                                                                        )
                                                                })()}
                                                            </Accordion>
                                                        </div>
                                                    )}

                                                <div>
                                                    <h4 className="tw-text-xs tw-font-semibold tw-text-[var(--vscode-foreground)] tw-mb-1">
                                                        Result
                                                    </h4>
                                                    {node.id === pendingApprovalNodeId ? (
                                                        <Textarea
                                                            value={
                                                                modifiedCommands.get(node.id) ||
                                                                nodeResults.get(node.id) ||
                                                                ''
                                                            }
                                                            readOnly={node.id !== pendingApprovalNodeId}
                                                            onChange={e =>
                                                                handleCommandChange(
                                                                    node.id,
                                                                    e.target.value
                                                                )
                                                            }
                                                        />
                                                    ) : (
                                                        <Textarea
                                                            value={nodeResults.get(node.id) || ''}
                                                            readOnly={true}
                                                            style={{
                                                                backgroundColor:
                                                                    'var(--vscode-sideBar-background)',
                                                            }}
                                                        />
                                                    )}
                                                </div>

                                                {node.type === NodeType.CLI &&
                                                    node.id === pendingApprovalNodeId && (
                                                        <div className="tw-flex tw-w-full tw-gap-2 tw-mt-2 tw-justify-center">
                                                            <Button
                                                                size="sm"
                                                                onClick={() =>
                                                                    onApprove(
                                                                        node.id,
                                                                        true,
                                                                        modifiedCommands.get(node.id)
                                                                    )
                                                                }
                                                                variant="secondary"
                                                                style={{
                                                                    backgroundColor:
                                                                        'var(--vscode-testing-iconPassed)',
                                                                    color: 'var(--vscode-button-foreground)',
                                                                }}
                                                            >
                                                                Approve
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => onApprove(node.id, false)}
                                                                variant="secondary"
                                                                style={{
                                                                    backgroundColor:
                                                                        'var(--vscode-charts-red)',
                                                                    color: 'var(--vscode-button-foreground)',
                                                                }}
                                                            >
                                                                Reject
                                                            </Button>
                                                        </div>
                                                    )}
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
