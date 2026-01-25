# Protocol API Reference

## Overview

The NebulaFlow protocol defines the message contract between the VS Code extension (host) and the webview (React UI). All messages are typed for type safety and follow a strict schema. The protocol is defined in `workflow/Core/Contracts/Protocol.ts`.

## Message Flow

```
Webview (React UI) ←→ Extension (VS Code)
```

### Direction

- **Webview → Extension**: Commands (requests for actions)
- **Extension → Webview**: Events (notifications and data)

## Message Types

### Commands (Webview → Extension)

Commands are requests from the webview to the extension to perform actions.

#### Workflow Management

| Command | Description | Payload |
|---------|-------------|---------|
| `save_workflow` | Save workflow to disk | `{ nodes, edges, state }` |
| `load_workflow` | Load workflow from disk | - |
| `load_last_workflow` | Load last opened workflow | - |
| `execute_workflow` | Start workflow execution | `{ nodes, edges, state, resume }` |
| `abort_workflow` | Stop all workflow execution | - |
| `pause_workflow` | Pause running workflow | - |
| `clear_workflow` | Clear current workflow | - |
| `reset_results` | Clear execution results | - |

#### Node Operations

| Command | Description | Payload |
|---------|-------------|---------|
| `execute_node` | Execute single node | `{ node, inputs, runId, variables }` |
| `llm_node_chat` | Chat with LLM node | `{ node, threadID, message, mode }` |
| `node_approved` | Approve node execution | `{ nodeId, modifiedCommand }` |
| `node_rejected` | Reject node execution | `{ nodeId, reason }` |
| `calculate_tokens` | Calculate token count | `{ text, nodeId }` |

#### Custom Nodes

| Command | Description | Payload |
|---------|-------------|---------|
| `save_customNode` | Save custom node definition | `{ node: WorkflowNodeDTO }` |
| `delete_customNode` | Delete custom node | `{ nodeId: string }` |
| `rename_customNode` | Rename custom node | `{ oldNodeTitle, newNodeTitle }` |
| `get_custom_nodes` | Request custom nodes | - |

#### Subflows

| Command | Description | Payload |
|---------|-------------|---------|
| `create_subflow` | Create new subflow | `{ subflow: SubflowDefinitionDTO }` |
| `get_subflow` | Get subflow by ID | `{ id: string }` |
| `get_subflows` | List all subflows | - |
| `duplicate_subflow` | Duplicate subflow | `{ id, nodeId }` |

#### Storage & Configuration

| Command | Description | Payload |
|---------|-------------|---------|
| `get_storage_scope` | Request storage scope info | - |
| `toggle_storage_scope` | Toggle storage scope | - |
| `get_models` | Request available LLM models | - |

#### Clipboard

| Command | Description | Payload |
|---------|-------------|---------|
| `copy_selection` | Copy selected nodes/edges | `{ nodes, edges }` |
| `paste_selection` | Paste clipboard content | - |

#### External

| Command | Description | Payload |
|---------|-------------|---------|
| `open_external_link` | Open URL in external browser | `{ url: string }` |

### Events (Extension → Webview)

Events are notifications from the extension to the webview, typically containing data or status updates.

#### Workflow State

| Event | Description | Payload |
|-------|-------------|---------|
| `workflow_loaded` | Workflow data loaded from disk | `{ nodes, edges, state }` |
| `workflow_saved` | Workflow successfully saved | `{ path? }` |
| `workflow_save_failed` | Workflow save failed | `{ error? }` |

#### Execution Status

| Event | Description | Payload |
|-------|-------------|---------|
| `execution_started` | Workflow execution started | - |
| `execution_completed` | Workflow execution completed | `{ stoppedAtNodeId? }` |
| `execution_paused` | Workflow execution paused | `{ stoppedAtNodeId? }` |
| `node_execution_status` | Node execution status update | `{ nodeId, status, result, command }` |

#### Content Streaming

| Event | Description | Payload |
|-------|-------------|---------|
| `node_assistant_content` | LLM assistant content stream | `{ nodeId, threadID?, content, mode? }` |
| `node_output_chunk` | CLI output stream | `{ nodeId, chunk, stream }` |
| `token_count` | Token count result | `{ count, nodeId }` |

#### Models & Configuration

| Event | Description | Payload |
|-------|-------------|---------|
| `models_loaded` | Available LLM models loaded | `{ models: Model[] }` |
| `provide_custom_nodes` | Custom nodes loaded | `{ nodes: WorkflowNodeDTO[] }` |
| `storage_scope` | Storage scope information | `{ scope, basePath? }` |

#### Subflow Events

| Event | Description | Payload |
|-------|-------------|---------|
| `subflow_saved` | Subflow saved successfully | `{ id }` |
| `provide_subflow` | Subflow data provided | `{ subflow: SubflowDefinitionDTO }` |
| `provide_subflows` | List of subflows provided | `{ id, title, version }[]` |
| `subflow_copied` | Subflow duplicated | `{ nodeId, oldId, newId }` |

#### Subflow-Scoped Events

When viewing a subflow, these events are forwarded from the inner workflow:

| Event | Description | Payload |
|-------|-------------|---------|
| `subflow_node_execution_status` | Node execution status in subflow | `{ subflowId, payload }` |
| `subflow_node_assistant_content` | Assistant content in subflow | `{ subflowId, nodeId, threadID?, content, mode? }` |

#### Clipboard Events

| Event | Description | Payload |
|-------|-------------|---------|
| `clipboard_paste` | Clipboard paste result | `{ nodes, edges }` |

## Data Types

### Basic Types

#### Model

```typescript
interface Model {
    id: string
    title?: string
}
```

Represents an available LLM model.

### Node & Edge Types

#### WorkflowNodeDTO

```typescript
interface WorkflowNodeDTO {
    id: string
    type: string
    data: Record<string, unknown>
    position: { x: number; y: number }
    selected?: boolean
}
```

Transport-friendly workflow node DTO (neutral shape).

**Fields:**
- `id`: Unique node identifier
- `type`: Node type (e.g., 'llm', 'cli', 'condition')
- `data`: Node-specific configuration data
- `position`: Visual position in the workflow editor
- `selected`: Whether the node is currently selected

#### EdgeDTO

```typescript
interface EdgeDTO {
    id: string
    source: string
    target: string
    sourceHandle?: string
    targetHandle?: string
}
```

Transport-friendly edge DTO.

**Fields:**
- `id`: Unique edge identifier
- `source`: Source node ID
- `target`: Target node ID
- `sourceHandle`: Source handle identifier (optional)
- `targetHandle`: Target handle identifier (optional)

### Execution Types

#### NodeExecutionPayload

```typescript
interface NodeExecutionPayload {
    nodeId: string
    status: 'running' | 'completed' | 'error' | 'interrupted' | 'pending_approval'
    result?: string
    multi?: string[]
    command?: string
}
```

Execution status payload for node updates.

**Fields:**
- `nodeId`: Node identifier
- `status`: Current execution status
- `result`: Execution result (for completed/error nodes)
- `multi`: Multi-output results (for nodes like Subflow)
- `command`: CLI command (for CLI nodes)

#### NodeSavedState

```typescript
interface NodeSavedState {
    status: 'completed' | 'error' | 'interrupted'
    output: string
    error?: string
    tokenCount?: number
}
```

Saved state for a single node after execution.

**Fields:**
- `status`: Final execution status
- `output`: Node output
- `error`: Error message (if failed)
- `tokenCount`: Token count (for LLM nodes)

### Workflow State

#### WorkflowStateDTO

```typescript
interface WorkflowStateDTO {
    nodeResults: Record<string, NodeSavedState>
    ifElseDecisions?: Record<string, 'true' | 'false'>
    nodeAssistantContent?: Record<string, AssistantContentItem[]>
    nodeThreadIDs?: Record<string, string>
}
```

Workflow state envelope persisted across save/load.

**Fields:**
- `nodeResults`: Saved state for each executed node
- `ifElseDecisions`: Branch decisions for If/Else nodes
- `nodeAssistantContent`: Persisted assistant timelines per node (for LLM chat history)
- `nodeThreadIDs`: Thread identifiers per node (for LLM chat continuity)

#### WorkflowPayloadDTO

```typescript
interface WorkflowPayloadDTO {
    nodes?: WorkflowNodeDTO[]
    edges?: EdgeDTO[]
    state?: WorkflowStateDTO
    resume?: ResumeDTO
}
```

Common workflow payload for commands/events.

**Fields:**
- `nodes`: Workflow nodes
- `edges`: Workflow edges
- `state`: Workflow execution state
- `resume`: Resume metadata for paused workflows

### Assistant Content

#### AssistantContentItem

```typescript
type AssistantContentItem =
    | { type: 'text'; text: string }
    | { type: 'user_message'; text: string }
    | { type: 'thinking'; thinking: string }
    | { type: 'tool_use'; id: string; name: string; inputJSON?: string }
    | { type: 'tool_result'; toolUseID: string; resultJSON?: string }
    | { type: 'server_tool_use'; name: string; inputJSON?: string }
    | { type: 'server_web_search_result'; query?: string; resultJSON?: string }
```

Assistant/user/tool content blocks streamed during LLM node execution.

**Types:**
- `text`: Plain text content from the assistant
- `user_message`: User message in the conversation
- `thinking`: Assistant's internal reasoning
- `tool_use`: Tool/function call request
- `tool_result`: Tool/function call result
- `server_tool_use`: Server-side tool execution
- `server_web_search_result`: Web search results

### Subflow Types

#### SubflowPortDTO

```typescript
interface SubflowPortDTO {
    id: string
    name: string
    index: number
}
```

Input/output port for subflows.

**Fields:**
- `id`: Port identifier
- `name`: Port name
- `index`: Port order/index

#### SubflowGraphDTO

```typescript
interface SubflowGraphDTO {
    nodes: WorkflowNodeDTO[]
    edges: EdgeDTO[]
}
```

Subflow graph definition.

**Fields:**
- `nodes`: Nodes in the subflow
- `edges`: Edges in the subflow

#### SubflowDefinitionDTO

```typescript
interface SubflowDefinitionDTO {
    id: string
    title: string
    version: string
    inputs: SubflowPortDTO[]
    outputs: SubflowPortDTO[]
    graph: SubflowGraphDTO
}
```

Complete subflow definition.

**Fields:**
- `id`: Subflow identifier
- `title`: Subflow display name
- `version`: Subflow version
- `inputs`: Input ports
- `outputs`: Output ports
- `graph`: Subflow graph structure

### Resume Types

#### ResumeDTO

```typescript
interface ResumeDTO {
    fromNodeId?: string
    seeds?: {
        outputs?: Record<string, string>
        decisions?: Record<string, 'true' | 'false'>
        variables?: Record<string, string>
    }
}
```

Resume metadata for paused/interrupted workflows.

**Fields:**
- `fromNodeId`: Node to resume from
- `seeds`: Data to inject when resuming
  - `outputs`: Node output values
  - `decisions`: Branch decisions
  - `variables`: Variable values

## Message Envelope

### BaseWorkflowMessage

```typescript
interface BaseWorkflowMessage {
    type: string
}
```

Base interface for all workflow messages. Every message must have a `type` field.

## Protocol Implementation Notes

### Type Safety

All messages are typed using TypeScript interfaces. This ensures:

1. **Compile-time validation**: Type errors are caught during development
2. **IntelliSense support**: IDE provides autocomplete and type hints
3. **Runtime safety**: Message validation can be added for production

### Message Validation

In development mode, messages are validated strictly. In production, validation may be relaxed for performance.

### Message Flow Patterns

1. **Request-Response**: Webview sends command → Extension processes → Extension sends event
2. **Streaming**: Extension sends multiple events for a single operation (e.g., LLM streaming)
3. **Broadcast**: Extension sends events to all listeners (e.g., execution status updates)

### Error Handling

- **Invalid messages**: Logged to console, may be ignored
- **Missing data**: Handled gracefully with default values
- **Network errors**: Reconnection logic in webview

## Usage Examples

### Sending a Command from Webview

```typescript
import type { ExecuteWorkflowCommand } from './Protocol'

const message: ExecuteWorkflowCommand = {
    type: 'execute_workflow',
    data: {
        nodes: workflowNodes,
        edges: workflowEdges,
        state: workflowState,
    },
}

// Send to extension
vscode.postMessage(message)
```

### Receiving an Event in Webview

```typescript
import type { NodeExecutionStatusEvent } from './Protocol'

window.addEventListener('message', (event) => {
    const message = event.data as NodeExecutionStatusEvent
    
    if (message.type === 'node_execution_status') {
        const { nodeId, status, result } = message.data
        // Update UI based on node execution status
    }
})
```

### Type-Safe Message Handling

```typescript
import type { ExtensionToWorkflow } from './Protocol'

function handleMessage(message: ExtensionToWorkflow) {
    switch (message.type) {
        case 'node_execution_status':
            // TypeScript knows message.data is NodeExecutionPayload
            console.log(message.data.nodeId, message.data.status)
            break
        
        case 'node_assistant_content':
            // TypeScript knows message.data has content array
            message.data.content.forEach(item => {
                console.log(item.type, item.text)
            })
            break
        
        // ... other message types
    }
}
```

## Related Documentation

- [Extension API Reference](extension.md) - Extension API and commands
- [Node Types Reference](node-types.md) - Available node types
- [Events Reference](events.md) - Event system documentation
