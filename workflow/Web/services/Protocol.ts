// Re-export shared, types-only protocol contracts for webview usage
export type {
    Model,
    BaseWorkflowMessage,
    NodeExecutionPayload,
    NodeSavedState,
    WorkflowStateDTO,
    WorkflowPayloadDTO,
    WorkflowNodeDTO,
    EdgeDTO,
    WorkflowToExtension,
    ExtensionToWorkflow,
} from '../../Core/Contracts/Protocol'
