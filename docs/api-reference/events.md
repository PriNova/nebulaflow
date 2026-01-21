# Events API Reference

## Overview

Events are notifications sent from the extension to the webview. They provide real-time updates about workflow execution, state changes, and system status. All events are defined in `workflow/Core/Contracts/Protocol.ts` and follow a strict type-safe contract.

## Event Flow

```
Extension (VS Code) → Webview (React UI)
```

Events are **notifications** - they inform the webview about changes but don't expect a response. The webview listens for events and updates its UI accordingly.

## Event Categories

### Workflow State Events

These events track the lifecycle of workflow operations:

1. **workflow_loaded** - Workflow data loaded from disk
2. **workflow_saved** - Workflow successfully saved
3. **workflow_save_failed** - Workflow save failed

### Execution Events

These events track the execution status of workflows and nodes:

4. **execution_started** - Workflow execution started
5. **execution_completed** - Workflow execution completed
6. **execution_paused** - Workflow execution paused
7. **node_execution_status** - Node execution status update

### Content Streaming Events

These events stream content from LLM and CLI nodes:

8. **node_assistant_content** - LLM assistant content stream
9. **node_output_chunk** - CLI output stream
10. **token_count** - Token count result

### Model & Configuration Events

These events provide system configuration information:

11. **models_loaded** - Available LLM models loaded
12. **provide_custom_nodes** - Custom nodes loaded
13. **storage_scope** - Storage scope information

### Subflow Events

These events handle subflow operations:

14. **subflow_saved** - Subflow saved successfully
15. **provide_subflow** - Subflow data provided
16. **provide_subflows** - List of subflows provided
17. **subflow_copied** - Subflow duplicated

### Subflow-Scoped Events

These events are forwarded when viewing a subflow:

18. **subflow_node_execution_status** - Node execution status in subflow
19. **subflow_node_assistant_content** - Assistant content in subflow

### Clipboard Events

These events handle clipboard operations:

20. **clipboard_paste** - Clipboard paste result

## Event Details

### Workflow State Events

#### workflow_loaded

**Type:** `workflow_loaded`  
**Payload:** `WorkflowPayloadDTO`

**Description:** Sent when workflow data is successfully loaded from disk.

**Payload Structure:**
```typescript
{
    nodes?: WorkflowNodeDTO[]
    edges?: EdgeDTO[]
    state?: WorkflowStateDTO
    resume?: ResumeDTO
}
```

**Usage:**
- Webview receives this event after requesting to load a workflow
- Updates the canvas with the loaded nodes and edges
- Restores execution state if available

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'workflow_loaded') {
        const { nodes, edges, state } = event.data.data
        // Update canvas with loaded workflow
        setNodes(nodes)
        setEdges(edges)
        // Restore execution state
        if (state) {
            restoreExecutionState(state)
        }
    }
})
```

#### workflow_saved

**Type:** `workflow_saved`  
**Payload:** `{ path?: string }`

**Description:** Sent when workflow is successfully saved to disk.

**Payload Structure:**
```typescript
{
    path?: string  // Optional path where workflow was saved
}
```

**Usage:**
- Confirms successful save operation
- Can display success notification to user
- Updates UI to reflect saved state

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'workflow_saved') {
        const path = event.data.data?.path
        showNotification(`Workflow saved${path ? ` to ${path}` : ''}`)
    }
})
```

#### workflow_save_failed

**Type:** `workflow_save_failed`  
**Payload:** `{ error?: string }`

**Description:** Sent when workflow save operation fails.

**Payload Structure:**
```typescript
{
    error?: string  // Optional error message
}
```

**Usage:**
- Displays error notification to user
- Logs error for debugging
- Allows retry of save operation

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'workflow_save_failed') {
        const error = event.data.data?.error ?? 'Unknown error'
        showNotification(`Save failed: ${error}`, 'error')
    }
})
```

### Execution Events

#### execution_started

**Type:** `execution_started`  
**Payload:** None

**Description:** Sent when workflow execution begins.

**Usage:**
- Updates UI to show execution state
- Resets any previous execution results
- Enables execution controls

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'execution_started') {
        setExecutionState('running')
        resetNodeResults()
    }
})
```

#### execution_completed

**Type:** `execution_completed`  
**Payload:** `{ stoppedAtNodeId?: string }`

**Description:** Sent when workflow execution completes successfully.

**Payload Structure:**
```typescript
{
    stoppedAtNodeId?: string  // Optional node ID where execution stopped
}
```

**Usage:**
- Updates UI to show completion state
- Displays execution summary
- If stoppedAtNodeId is provided, indicates where execution was interrupted

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'execution_completed') {
        const stoppedAt = event.data.data?.stoppedAtNodeId
        setExecutionState('completed')
        showNotification(
            stoppedAt 
                ? `Execution completed at node ${stoppedAt}`
                : 'Execution completed successfully'
        )
    }
})
```

#### execution_paused

**Type:** `execution_paused`  
**Payload:** `{ stoppedAtNodeId?: string }`

**Description:** Sent when workflow execution is paused (e.g., for user approval).

**Payload Structure:**
```typescript
{
    stoppedAtNodeId?: string  // Node ID where execution paused
}
```

**Usage:**
- Updates UI to show paused state
- Displays pause notification
- Enables resume controls

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'execution_paused') {
        const stoppedAt = event.data.data?.stoppedAtNodeId
        setExecutionState('paused')
        showNotification(`Execution paused at node ${stoppedAt}`)
    }
})
```

#### node_execution_status

**Type:** `node_execution_status`  
**Payload:** `NodeExecutionPayload`

**Description:** Sent when a node's execution status changes.

**Payload Structure:**
```typescript
{
    nodeId: string
    status: 'running' | 'completed' | 'error' | 'interrupted' | 'pending_approval'
    result?: string
    multi?: string[]
    command?: string
}
```

**Fields:**
- `nodeId`: Node identifier
- `status`: Current execution status
- `result`: Execution result (for completed/error nodes)
- `multi`: Multi-output results (for nodes like Subflow)
- `command`: CLI command (for CLI nodes)

**Usage:**
- Updates node visual state (color, icon, etc.)
- Displays execution progress
- Shows errors when status is 'error'
- Handles approval requests when status is 'pending_approval'

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'node_execution_status') {
        const { nodeId, status, result } = event.data.data
        updateNodeStatus(nodeId, status)
        
        if (status === 'completed' && result) {
            updateNodeResult(nodeId, result)
        } else if (status === 'error') {
            showNodeError(nodeId, result)
        } else if (status === 'pending_approval') {
            showApprovalDialog(nodeId, event.data.data.command)
        }
    }
})
```

### Content Streaming Events

#### node_assistant_content

**Type:** `node_assistant_content`  
**Payload:** `NodeAssistantContentEvent`

**Description:** Streams assistant content from LLM nodes during execution.

**Payload Structure:**
```typescript
{
    nodeId: string
    threadID?: string
    content: AssistantContentItem[]
    mode?: 'workflow' | 'single-node'
}
```

**Fields:**
- `nodeId`: Node identifier
- `threadID`: Thread identifier for chat continuity
- `content`: Array of assistant content items
- `mode`: Execution mode hint

**Content Types:**
- `text`: Plain text content
- `user_message`: User message in conversation
- `thinking`: Assistant's internal reasoning
- `tool_use`: Tool/function call request
- `tool_result`: Tool/function call result
- `server_tool_use`: Server-side tool execution
- `server_web_search_result`: Web search results

**Usage:**
- Streams LLM responses in real-time
- Updates node content display
- Maintains conversation history
- Supports tool calls and function calling

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'node_assistant_content') {
        const { nodeId, content } = event.data.data
        
        content.forEach(item => {
            switch (item.type) {
                case 'text':
                    appendNodeContent(nodeId, item.text)
                    break
                case 'tool_use':
                    showToolCall(nodeId, item.name, item.inputJSON)
                    break
                case 'tool_result':
                    showToolResult(nodeId, item.resultJSON)
                    break
            }
        })
    }
})
```

#### node_output_chunk

**Type:** `node_output_chunk`  
**Payload:** `NodeOutputChunkEvent`

**Description:** Streams output chunks from CLI nodes during execution.

**Payload Structure:**
```typescript
{
    nodeId: string
    chunk: string
    stream: 'stdout' | 'stderr'
}
```

**Fields:**
- `nodeId`: Node identifier
- `chunk`: Output chunk text
- `stream`: Output stream type

**Usage:**
- Streams CLI output in real-time
- Displays stdout and stderr separately
- Updates node output display

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'node_output_chunk') {
        const { nodeId, chunk, stream } = event.data.data
        
        if (stream === 'stdout') {
            appendStdout(nodeId, chunk)
        } else {
            appendStderr(nodeId, chunk)
        }
    }
})
```

#### token_count

**Type:** `token_count`  
**Payload:** `TokenCountEvent`

**Description:** Reports token count for text processing.

**Payload Structure:**
```typescript
{
    count: number
    nodeId: string
}
```

**Fields:**
- `count`: Token count
- `nodeId`: Node identifier

**Usage:**
- Displays token usage for LLM nodes
- Helps monitor API costs
- Updates node metadata

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'token_count') {
        const { count, nodeId } = event.data.data
        updateNodeTokenCount(nodeId, count)
    }
})
```

### Model & Configuration Events

#### models_loaded

**Type:** `models_loaded`  
**Payload:** `Model[]`

**Description:** Reports available LLM models.

**Payload Structure:**
```typescript
Model[]  // Array of available models
```

**Model Structure:**
```typescript
interface Model {
    id: string
    title?: string
}
```

**Usage:**
- Populates model selection dropdowns
- Updates available models in UI
- Validates model selection

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'models_loaded') {
        const models = event.data.data
        setAvailableModels(models)
    }
})
```

#### provide_custom_nodes

**Type:** `provide_custom_nodes`  
**Payload:** `WorkflowNodeDTO[]`

**Description:** Reports custom nodes loaded from storage.

**Payload Structure:**
```typescript
WorkflowNodeDTO[]  // Array of custom nodes
```

**Usage:**
- Populates custom node palette
- Updates available custom nodes
- Enables custom node usage

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'provide_custom_nodes') {
        const customNodes = event.data.data
        setCustomNodes(customNodes)
    }
})
```

#### storage_scope

**Type:** `storage_scope`  
**Payload:** `{ scope: 'workspace' | 'user'; basePath?: string }`

**Description:** Reports current storage scope configuration.

**Payload Structure:**
```typescript
{
    scope: 'workspace' | 'user'
    basePath?: string
}
```

**Fields:**
- `scope`: Current storage scope
- `basePath`: Base path for storage

**Usage:**
- Updates UI to reflect current storage scope
- Displays storage location information
- Validates storage operations

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'storage_scope') {
        const { scope, basePath } = event.data.data
        updateStorageScopeDisplay(scope, basePath)
    }
})
```

### Subflow Events

#### subflow_saved

**Type:** `subflow_saved`  
**Payload:** `{ id: string }`

**Description:** Confirms subflow was successfully saved.

**Payload Structure:**
```typescript
{
    id: string  // Subflow identifier
}
```

**Usage:**
- Confirms subflow save operation
- Updates subflow list
- Displays success notification

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'subflow_saved') {
        const subflowId = event.data.data.id
        showNotification(`Subflow ${subflowId} saved`)
        refreshSubflowList()
    }
})
```

#### provide_subflow

**Type:** `provide_subflow`  
**Payload:** `SubflowDefinitionDTO`

**Description:** Provides subflow data when requested.

**Payload Structure:**
```typescript
SubflowDefinitionDTO  // Complete subflow definition
```

**SubflowDefinitionDTO Structure:**
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

**Usage:**
- Loads subflow for editing
- Displays subflow in canvas
- Enables subflow modification

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'provide_subflow') {
        const subflow = event.data.data
        loadSubflowIntoCanvas(subflow)
    }
})
```

#### provide_subflows

**Type:** `provide_subflows`  
**Payload:** `Array<{ id: string; title: string; version: string }>`

**Description:** Provides list of available subflows.

**Payload Structure:**
```typescript
Array<{
    id: string
    title: string
    version: string
}>
```

**Usage:**
- Populates subflow selection list
- Displays available subflows
- Enables subflow selection

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'provide_subflows') {
        const subflows = event.data.data
        setAvailableSubflows(subflows)
    }
})
```

#### subflow_copied

**Type:** `subflow_copied`  
**Payload:** `{ nodeId: string; oldId: string; newId: string }`

**Description:** Confirms subflow duplication.

**Payload Structure:**
```typescript
{
    nodeId: string    // Node that received the new subflow
    oldId: string     // Original subflow ID
    newId: string     // New subflow ID
}
```

**Usage:**
- Confirms subflow duplication
- Updates node with new subflow ID
- Displays success notification

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'subflow_copied') {
        const { nodeId, oldId, newId } = event.data.data
        updateNodeSubflowId(nodeId, newId)
        showNotification(`Subflow duplicated: ${oldId} → ${newId}`)
    }
})
```

### Subflow-Scoped Events

#### subflow_node_execution_status

**Type:** `subflow_node_execution_status`  
**Payload:** `{ subflowId: string; payload: NodeExecutionPayload }`

**Description:** Forwards node execution status from a subflow.

**Payload Structure:**
```typescript
{
    subflowId: string
    payload: NodeExecutionPayload
}
```

**Usage:**
- Displays execution status of nodes within a subflow
- Updates subflow node visual states
- Maintains execution context

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'subflow_node_execution_status') {
        const { subflowId, payload } = event.data.data
        updateSubflowNodeStatus(subflowId, payload.nodeId, payload.status)
    }
})
```

#### subflow_node_assistant_content

**Type:** `subflow_node_assistant_content`  
**Payload:** `SubflowNodeAssistantContentEvent`

**Description:** Forwards assistant content from nodes within a subflow.

**Payload Structure:**
```typescript
{
    subflowId: string
    nodeId: string
    threadID?: string
    content: AssistantContentItem[]
    mode?: 'workflow' | 'single-node'
}
```

**Usage:**
- Streams LLM content from subflow nodes
- Maintains chat history within subflows
- Displays subflow node content

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'subflow_node_assistant_content') {
        const { subflowId, nodeId, content } = event.data.data
        appendSubflowNodeContent(subflowId, nodeId, content)
    }
})
```

### Clipboard Events

#### clipboard_paste

**Type:** `clipboard_paste`  
**Payload:** `WorkflowPayloadDTO`

**Description:** Provides pasted clipboard content.

**Payload Structure:**
```typescript
{
    nodes?: WorkflowNodeDTO[]
    edges?: EdgeDTO[]
    state?: WorkflowStateDTO
    resume?: ResumeDTO
}
```

**Usage:**
- Inserts pasted nodes and edges into canvas
- Updates workflow with clipboard content
- Handles paste operation completion

**Example:**
```typescript
window.addEventListener('message', (event) => {
    if (event.data.type === 'clipboard_paste') {
        const { nodes, edges } = event.data.data
        if (nodes && edges) {
            insertNodesAndEdges(nodes, edges)
        }
    }
})
```

## Event Handling Patterns

### Type-Safe Event Handling

```typescript
import type { ExtensionToWorkflow } from './Protocol'

function handleEvent(message: ExtensionToWorkflow) {
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
        
        case 'workflow_loaded':
            // TypeScript knows message.data is WorkflowPayloadDTO
            const { nodes, edges, state } = message.data
            // Update UI...
            break
        
        // ... other event types
    }
}
```

### Event Filtering

```typescript
window.addEventListener('message', (event) => {
    const message = event.data as ExtensionToWorkflow
    
    // Filter by event type
    if (message.type === 'node_execution_status') {
        // Handle execution status
    }
    
    // Filter by category
    if (message.type.endsWith('_event')) {
        // Handle all events
    }
    
    // Filter by pattern
    if (message.type.startsWith('execution_')) {
        // Handle execution events
    }
})
```

### Event Aggregation

```typescript
class EventAggregator {
    private listeners: Map<string, ((data: any) => void)[]> = new Map()
    
    on(eventType: string, callback: (data: any) => void) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, [])
        }
        this.listeners.get(eventType)!.push(callback)
    }
    
    handleEvent(message: ExtensionToWorkflow) {
        const callbacks = this.listeners.get(message.type)
        if (callbacks) {
            callbacks.forEach(cb => cb(message.data))
        }
    }
}

// Usage
const aggregator = new EventAggregator()
aggregator.on('node_execution_status', (data) => {
    console.log('Node status:', data.nodeId, data.status)
})
```

## Event Timing & Ordering

### Event Ordering Guarantees

1. **Workflow Lifecycle**: `workflow_loaded` → `execution_started` → `execution_completed`
2. **Node Execution**: `node_execution_status` (running) → `node_execution_status` (completed)
3. **Streaming**: Multiple `node_assistant_content` or `node_output_chunk` events for a single node
4. **Subflows**: Subflow events are forwarded after inner node events

### Event Throttling

Some events may be throttled to prevent UI overload:

- **Streaming events**: `node_assistant_content` and `node_output_chunk` are batched
- **Status updates**: `node_execution_status` may be throttled for high-frequency updates
- **Token counts**: `token_count` events are debounced

## Error Handling

### Missing Event Data

```typescript
window.addEventListener('message', (event) => {
    const message = event.data as ExtensionToWorkflow
    
    switch (message.type) {
        case 'node_execution_status':
            if (!message.data) {
                console.error('Missing execution status data')
                return
            }
            // Process data...
            break
        
        case 'workflow_loaded':
            if (!message.data?.nodes) {
                console.warn('Loaded workflow has no nodes')
            }
            // Process data...
            break
    }
})
```

### Event Validation

```typescript
function validateEvent(message: ExtensionToWorkflow): boolean {
    switch (message.type) {
        case 'node_execution_status':
            return (
                typeof message.data?.nodeId === 'string' &&
                ['running', 'completed', 'error', 'interrupted', 'pending_approval']
                    .includes(message.data.status)
            )
        
        case 'workflow_loaded':
            return Array.isArray(message.data?.nodes)
        
        default:
            return true
    }
}
```

## Performance Considerations

### Event Volume

- **High-frequency events**: `node_assistant_content`, `node_output_chunk`, `node_execution_status`
- **Low-frequency events**: `workflow_loaded`, `execution_completed`, `models_loaded`
- **Batching**: Consider batching multiple events for better performance

### Memory Management

```typescript
class EventBuffer {
    private buffer: ExtensionToWorkflow[] = []
    private maxBufferSize = 100
    
    add(message: ExtensionToWorkflow) {
        this.buffer.push(message)
        if (this.buffer.length > this.maxBufferSize) {
            this.buffer.shift() // Remove oldest
        }
    }
    
    flush(): ExtensionToWorkflow[] {
        const events = [...this.buffer]
        this.buffer = []
        return events
    }
}
```

## Related Documentation

- [Protocol Reference](protocol.md) - Message protocol and data types
- [Extension API Reference](extension.md) - Extension API and commands
- [Node Types Reference](node-types.md) - Available node types
