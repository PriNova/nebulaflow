import { type BaseNodeData, NodeType, type WorkflowNodes } from '@nodes/Nodes'
import clsx from 'clsx'
import { Edit, Trash2 } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '../../ui/shadcn/ui/accordion'
import styles from '../../ui/shadcn/ui/accordion.module.css'
import { Button } from '../../ui/shadcn/ui/button'
import { Input } from '../../ui/shadcn/ui/input'
import { PropertyEditor } from './PropertyEditor'

interface WorkflowSidebarProps {
    onNodeAdd: (
        nodeOrLabel: WorkflowNodes | string,
        nodeType?: NodeType,
        options?: { position?: { x: number; y: number }; initialData?: Partial<BaseNodeData> }
    ) => void
    selectedNode?: WorkflowNodes | null
    onNodeUpdate?: (nodeId: string, data: Partial<WorkflowNodes['data']>) => void
    models: { id: string; title?: string }[]
    onSaveCustomNode: (node: WorkflowNodes) => void
    onDeleteCustomNode: (nodeId: string) => void
    onRenameCustomNode: (oldNodeTitle: string, newNodeTitle: string) => void
    customNodes: WorkflowNodes[]
    subflows: Array<{ id: string; title: string; version: string }>
    nodeErrors?: Map<string, string>
}

type CustomNodesByType = { [key in NodeType]?: WorkflowNodes[] }

const sidebarCardContainer =
    'tw-rounded tw-px-2 tw-py-1 tw-border tw-border-[var(--vscode-panel-border)] tw-bg-[var(--vscode-editor-background)]'
const accordionTriggerNode = clsx(
    'tw-w-full tw-text-sm tw-h-6 tw-py-[.1rem]',
    styles['sidebar-accordion-trigger']
)
const libraryButton =
    'tw-w-full tw-text-left tw-px-2 tw-py-1 tw-rounded tw-truncate hover:tw-bg-[var(--vscode-button-secondaryHoverBackground)]'
const innerListContainer =
    'tw-bg-[var(--vscode-editor-background)] tw-p-2 tw-rounded tw-border tw-border-[var(--vscode-panel-border)]'

const displayCategoryLabel = (type: string): string => {
    const categoryLabels: Record<string, string> = {
        [NodeType.LLM]: 'Agent',
        [NodeType.INPUT]: 'Text',
        [NodeType.CLI]: 'Shell',
        [NodeType.PREVIEW]: 'Preview',
        [NodeType.IF_ELSE]: 'Conditionals',
        [NodeType.SUBFLOW]: 'Subflows',
        [NodeType.LOOP_START]: 'Loops',
        [NodeType.LOOP_END]: 'Loops',
    }
    return categoryLabels[type] || type
}

export const WorkflowSidebar: React.FC<WorkflowSidebarProps> = ({
    onNodeAdd,
    selectedNode,
    onNodeUpdate,
    models,
    onSaveCustomNode,
    customNodes,
    subflows,
    onDeleteCustomNode,
    onRenameCustomNode,
    nodeErrors,
}) => {
    const [renamingNode, setRenamingNode] = useState<string | null>(null)
    const [newNodeTitle, setNewNodeTitle] = useState<string>('')

    const handleRenameClick = (nodeTitle: string) => {
        setRenamingNode(nodeTitle)
        setNewNodeTitle(nodeTitle)
    }
    const handleRenameConfirm = (oldNodeTitle: string) => {
        if (onRenameCustomNode && newNodeTitle) {
            onRenameCustomNode(oldNodeTitle, newNodeTitle)
            setRenamingNode(null)
            setNewNodeTitle('')
        }
    }
    const handleRenameCancel = () => {
        setRenamingNode(null)
        setNewNodeTitle('')
    }

    const customNodesByType: CustomNodesByType = customNodes.reduce(
        (acc: CustomNodesByType, node: WorkflowNodes) => {
            const type = node.type || NodeType.CLI
            if (!acc[type]) {
                acc[type] = []
            }
            acc[type]?.push(node)
            return acc
        },
        {}
    )

    return (
        <div className="tw-w-full tw-border-r tw-border-border tw-h-full tw-bg-sidebar-background tw-p-4">
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
                <div className="tw-text-xs tw-text-muted-foreground">Library</div>
            </div>
            <Accordion type="single" collapsible>
                {/* Agent */}
                <AccordionItem value="llm" className={sidebarCardContainer}>
                    <AccordionTrigger className={accordionTriggerNode}>Agent</AccordionTrigger>
                    <AccordionContent className="tw-pt-1">
                        <ul className="tw-space-y-1">
                            <li>
                                <button
                                    type="button"
                                    className={libraryButton}
                                    onClick={() => onNodeAdd('General Agent', NodeType.LLM)}
                                >
                                    General Agent
                                </button>
                            </li>
                        </ul>
                    </AccordionContent>
                </AccordionItem>
                {/* Text */}
                <AccordionItem value="input" className={sidebarCardContainer}>
                    <AccordionTrigger className={accordionTriggerNode}>Text</AccordionTrigger>
                    <AccordionContent className="tw-pt-1">
                        <ul className="tw-space-y-1">
                            <li>
                                <button
                                    type="button"
                                    className={libraryButton}
                                    onClick={() => onNodeAdd('Text', NodeType.INPUT)}
                                >
                                    Text
                                </button>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    className={libraryButton}
                                    onClick={() => onNodeAdd('Accumulator', NodeType.ACCUMULATOR)}
                                >
                                    Accumulator
                                </button>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    className={libraryButton}
                                    onClick={() => onNodeAdd('Variable', NodeType.VARIABLE)}
                                >
                                    Variable
                                </button>
                            </li>
                        </ul>
                    </AccordionContent>
                </AccordionItem>
                {/* Shell */}
                <AccordionItem value="cli" className={sidebarCardContainer}>
                    <AccordionTrigger className={accordionTriggerNode}>Shell</AccordionTrigger>
                    <AccordionContent className="tw-pt-1">
                        <ul className="tw-space-y-1">
                            <li>
                                <button
                                    type="button"
                                    className={libraryButton}
                                    onClick={() => onNodeAdd('Shell Command', NodeType.CLI)}
                                >
                                    Shell
                                </button>
                            </li>
                        </ul>
                    </AccordionContent>
                </AccordionItem>
                {/* Preview */}
                <AccordionItem value="preview" className={sidebarCardContainer}>
                    <AccordionTrigger className={accordionTriggerNode}>Preview</AccordionTrigger>
                    <AccordionContent className="tw-pt-1">
                        <ul className="tw-space-y-1">
                            <li>
                                <button
                                    type="button"
                                    className={libraryButton}
                                    onClick={() => onNodeAdd('Preview', NodeType.PREVIEW)}
                                >
                                    Preview
                                </button>
                            </li>
                        </ul>
                    </AccordionContent>
                </AccordionItem>
                {/* Conditionals */}
                <AccordionItem value="conditionals" className={sidebarCardContainer}>
                    <AccordionTrigger className={accordionTriggerNode}>Conditionals</AccordionTrigger>
                    <AccordionContent className="tw-pt-1">
                        <ul className="tw-space-y-1">
                            <li>
                                <button
                                    type="button"
                                    className={libraryButton}
                                    onClick={() => onNodeAdd('If/Else', NodeType.IF_ELSE)}
                                >
                                    If/Else
                                </button>
                            </li>
                        </ul>
                    </AccordionContent>
                </AccordionItem>
                {/* Loops */}
                <AccordionItem value="loops" className={sidebarCardContainer}>
                    <AccordionTrigger className={accordionTriggerNode}>Loops</AccordionTrigger>
                    <AccordionContent className="tw-pt-1">
                        <ul className="tw-space-y-1">
                            <li>
                                <button
                                    type="button"
                                    className={libraryButton}
                                    onClick={() => onNodeAdd('Loop Start', NodeType.LOOP_START)}
                                >
                                    Loop Start
                                </button>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    className={libraryButton}
                                    onClick={() => onNodeAdd('Loop End', NodeType.LOOP_END)}
                                >
                                    Loop End
                                </button>
                            </li>
                        </ul>
                    </AccordionContent>
                </AccordionItem>
                {/* Subflows */}
                <AccordionItem value="subflows" className={sidebarCardContainer}>
                    <AccordionTrigger className={accordionTriggerNode}>Subflows</AccordionTrigger>
                    <AccordionContent className="tw-pt-1">
                        <ul className="tw-space-y-1">
                            {subflows.map(sf => (
                                <li key={sf.id} className="tw-flex tw-items-center tw-justify-between">
                                    <button
                                        type="button"
                                        className={libraryButton}
                                        onClick={() => {
                                            const node = {
                                                type: NodeType.SUBFLOW,
                                                data: {
                                                    title: sf.title,
                                                    content: '',
                                                    active: true,
                                                    subflowId: sf.id,
                                                },
                                                position: { x: 0, y: 0 },
                                                id: 'temp',
                                            } as any
                                            onNodeAdd(node)
                                        }}
                                    >
                                        <span className="tw-truncate">{sf.title}</span>
                                    </button>
                                </li>
                            ))}
                            {subflows.length === 0 && (
                                <li className="tw-text-xs tw-text-muted-foreground">
                                    No subflows found
                                </li>
                            )}
                        </ul>
                    </AccordionContent>
                </AccordionItem>
                {/* Custom Nodes */}
                {Object.entries(customNodesByType).length > 0 && (
                    <AccordionItem value="custom_nodes" className={sidebarCardContainer}>
                        <AccordionTrigger className={accordionTriggerNode}>
                            Custom Nodes
                        </AccordionTrigger>
                        <AccordionContent className="tw-pt-1">
                            {Object.entries(customNodesByType).map(([type, nodes]) => (
                                <div key={type} className="tw-mb-1">
                                    <h4 className="tw-text-sm tw-font-medium tw-mb-1">
                                        {displayCategoryLabel(type)}
                                    </h4>
                                    <ul className={`tw-space-y-1 ${innerListContainer}`}>
                                        {nodes?.map(node => (
                                            <li
                                                key={node.id}
                                                className="tw-flex tw-items-center tw-justify-between"
                                            >
                                                <button
                                                    type="button"
                                                    className={libraryButton}
                                                    onClick={() => onNodeAdd(node)}
                                                >
                                                    <span className="tw-truncate">
                                                        {node.data.title}
                                                    </span>
                                                </button>
                                                <div className="tw-ml-2 tw-flex tw-flex-row tw-gap-1">
                                                    {renamingNode === node.data.title ? (
                                                        <div className="tw-flex tw-flex-row tw-gap-1">
                                                            <Input
                                                                value={newNodeTitle}
                                                                onChange={e =>
                                                                    setNewNodeTitle(e.target.value)
                                                                }
                                                                className="tw-h-6 tw-text-sm"
                                                            />
                                                            <Button
                                                                variant="secondary"
                                                                className="tw-h-6 tw-px-2 tw-text-sm"
                                                                onClick={() =>
                                                                    handleRenameConfirm(node.data.title)
                                                                }
                                                            >
                                                                Save
                                                            </Button>
                                                            <Button
                                                                variant="secondary"
                                                                className="tw-h-6 tw-px-2 tw-text-sm"
                                                                onClick={handleRenameCancel}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                variant="secondary"
                                                                className="tw-h-6 tw-px-2"
                                                                title="Rename"
                                                                onClick={() =>
                                                                    handleRenameClick(node.data.title)
                                                                }
                                                            >
                                                                <Edit size={14} />
                                                            </Button>
                                                            <Button
                                                                variant="secondary"
                                                                className="tw-h-6 tw-px-2"
                                                                title="Delete"
                                                                onClick={() =>
                                                                    onDeleteCustomNode(node.data.title)
                                                                }
                                                            >
                                                                <Trash2 size={14} />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                )}
            </Accordion>

            <div className="tw-my-4 tw-border-t tw-border-border" />
            <div className={`tw-text-sm ${styles['accordion-trigger']}`}>Property Editor</div>
            <div className="tw-p-2">
                {selectedNode ? (
                    <PropertyEditor
                        node={selectedNode}
                        onUpdate={onNodeUpdate!}
                        models={models}
                        onSaveCustomNode={onSaveCustomNode}
                        nodeError={nodeErrors?.get(selectedNode.id)}
                    />
                ) : (
                    <p className="tw-text-sm tw-text-muted-foreground tw-mt-2">
                        Select a node to edit its properties
                    </p>
                )}
            </div>
            <div className="tw-my-4 tw-border-t tw-border-border" />
        </div>
    )
}
