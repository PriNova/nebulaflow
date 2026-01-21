# Extension API Reference

## Overview

The NebulaFlow extension is a VS Code extension that provides a visual workflow editor for designing and executing LLM+CLI workflows. It orchestrates workflow execution, manages the webview interface, and handles communication between the extension host and the workflow UI.

## Activation & Deactivation

### Activation

The extension activates when VS Code loads it. During activation:

1. **Host Initialization**: Creates a `VSCodeHost` adapter that provides access to VS Code APIs
2. **Workspace Setup**: Initializes workspace management for storing workflows and custom nodes
3. **Command Registration**: Registers the `nebulaFlow.openWorkflow` command
4. **Webview Setup**: Creates a webview panel when the command is executed

### Deactivation

When the extension deactivates, it cancels all active workflows to ensure clean shutdown.

## Commands

### `nebulaFlow.openWorkflow`

**Description**: Opens the NebulaFlow workflow editor in a new webview panel.

**Usage**: Run from VS Code Command Palette (Ctrl/Cmd+Shift+P) and search for "NebulaFlow: Open Workflow Editor"

**Behavior**:
- Creates a webview panel in the first column
- Loads the workflow editor UI from `dist/webviews/workflow.html`
- Sets up message communication between extension and webview
- Monitors workspace configuration changes
- In development mode, enables hot-reload for webview assets

## Configuration

### VS Code Settings

The extension provides the following configuration options:

#### `nebulaFlow.storageScope`

- **Type**: `string`
- **Enum**: `["workspace", "user"]`
- **Default**: `"user"`
- **Description**: Where NebulaFlow stores workflows and custom nodes
  - `workspace`: Store in current workspace (`.nebulaflow/` directory)
  - `user`: Store in user home directory (global storage)

#### `nebulaFlow.globalStoragePath`

- **Type**: `string`
- **Default**: `""`
- **Scope**: `application`
- **Description**: Absolute path for global storage. If empty, uses your home directory. Content is stored under `.nebulaflow/`

### Environment Variables

#### `AMP_API_KEY` (Required for LLM nodes)

- **Purpose**: Authentication for Amp SDK (LLM provider)
- **Usage**: Required for LLM node execution
- **How to set**: Add to your shell profile or VS Code environment

#### `OPENROUTER_API_KEY` (Optional)

- **Purpose**: Authentication for OpenRouter SDK (alternative LLM provider)
- **Usage**: Optional integration for additional LLM models
- **How to set**: Add to your shell profile or VS Code environment

## Protocol

The extension and webview communicate using a custom message protocol defined in `workflow/Core/Contracts/Protocol.ts`. All messages are typed for type safety.

### Message Flow

```
Webview (React UI) ←→ Extension (VS Code)
```

### Message Types

#### Commands (Webview → Extension)

These are requests from the webview to the extension:

| Command | Description | Payload |
|---------|-------------|---------|
| `open_external_link` | Open URL in external browser | `{ url: string }` |
| `save_workflow` | Save workflow to disk | `{ nodes, edges, state }` |
| `load_workflow` | Load workflow from disk | - |
| `load_last_workflow` | Load last opened workflow | - |
| `execute_workflow` | Start workflow execution | `{ nodes, edges, state, resume }` |
| `abort_workflow` | Stop all workflow execution | - |
| `pause_workflow` | Pause running workflow | - |
| `get_models` | Request available LLM models | - |
| `save_customNode` | Save custom node definition | `{ node: WorkflowNodeDTO }` |
| `delete_customNode` | Delete custom node | `{ nodeId: string }` |
| `rename_customNode` | Rename custom node | `{ oldNodeTitle, newNodeTitle }` |
| `get_custom_nodes` | Request custom nodes | - |
| `get_storage_scope` | Request storage scope info | - |
| `toggle_storage_scope` | Toggle storage scope | - |
| `reset_results` | Clear execution results | - |
| `clear_workflow` | Clear current workflow | - |
| `create_subflow` | Create new subflow | `{ subflow: SubflowDefinitionDTO }` |
| `get_subflow` | Get subflow by ID | `{ id: string }` |
| `get_subflows` | List all subflows | - |
| `duplicate_subflow` | Duplicate subflow | `{ id, nodeId }` |
| `copy_selection` | Copy selected nodes/edges | `{ nodes, edges }` |
| `paste_selection` | Paste clipboard content | - |
| `execute_node` | Execute single node | `{ node, inputs, runId, variables }` |
| `llm_node_chat` | Chat with LLM node | `{ node, threadID, message, mode }` |
| `node_approved` | Approve node execution | `{ nodeId, modifiedCommand }` |
| `node_rejected` | Reject node execution | `{ nodeId, reason }` |
| `calculate_tokens` | Calculate token count | `{ text, nodeId }` |

#### Events (Extension → Webview)

These are notifications from the extension to the webview:

| Event | Description | Payload |
|-------|-------------|---------|
| `workflow_loaded` | Workflow data loaded from disk | `{ nodes, edges, state }` |
| `workflow_saved` | Workflow successfully saved | `{ path? }` |
| `workflow_save_failed` | Workflow save failed | `{ error? }` |
| `execution_started` | Workflow execution started | - |
| `execution_completed` | Workflow execution completed | `{ stoppedAtNodeId? }` |
| `execution_paused` | Workflow execution paused | `{ stoppedAtNodeId? }` |
| `node_execution_status` | Node execution status update | `{ nodeId, status, result, command }` |
| `token_count` | Token count result | `{ count, nodeId }` |
| `node_assistant_content` | LLM assistant content stream | `{ nodeId, threadID?, content, mode? }` |
| `node_output_chunk` | CLI output stream | `{ nodeId, chunk, stream }` |
| `models_loaded` | Available LLM models loaded | `{ models: Model[] }` |
| `provide_custom_nodes` | Custom nodes loaded | `{ nodes: WorkflowNodeDTO[] }` |
| `storage_scope` | Storage scope information | `{ scope, basePath? }` |
| `subflow_saved` | Subflow saved successfully | `{ id }` |
| `provide_subflow` | Subflow data provided | `{ subflow: SubflowDefinitionDTO }` |
| `provide_subflows` | List of subflows provided | `{ id, title, version }[]` |
| `subflow_copied` | Subflow duplicated | `{ nodeId, oldId, newId }` |
| `clipboard_paste` | Clipboard paste result | `{ nodes, edges }` |

### Data Types

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

#### WorkflowPayloadDTO

```typescript
interface WorkflowPayloadDTO {
    nodes?: WorkflowNodeDTO[]
    edges?: EdgeDTO[]
    state?: WorkflowStateDTO
    resume?: ResumeDTO
}
```

#### NodeExecutionPayload

```typescript
interface NodeExecutionPayload {
    nodeId: string
    status: 'running' | 'completed' | 'error' | 'interrupted' | 'pending_approval'
    result?: string
    multi?: string[]  // For multi-output nodes
    command?: string
}
```

#### AssistantContentItem

Streamed content from LLM nodes:

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

## Storage & Workspace Management

### Storage Scopes

NebulaFlow supports two storage scopes:

1. **User Scope** (Default)
   - Location: `~/.nebulaflow/` (or custom path via `globalStoragePath`)
   - Shared across all workspaces
   - Ideal for reusable custom nodes and workflows

2. **Workspace Scope**
   - Location: `<workspace-root>/.nebulaflow/`
   - Isolated per workspace
   - Ideal for project-specific workflows

### Custom Nodes

Custom nodes are user-defined node types that extend NebulaFlow's capabilities:

- **Storage**: Saved as JSON files in the storage scope
- **Format**: `WorkflowNodeDTO` with custom type and data
- **Management**: Create, rename, delete via protocol commands
- **Discovery**: Automatically loaded when extension activates

### Workflow State

Workflow execution state is persisted across sessions:

```typescript
interface WorkflowStateDTO {
    nodeResults: Record<string, NodeSavedState>
    ifElseDecisions?: Record<string, 'true' | 'false'>
    nodeAssistantContent?: Record<string, AssistantContentItem[]>
    nodeThreadIDs?: Record<string, string>
}
```

## Execution Model

### Workflow Execution Flow

1. **Start**: Webview sends `execute_workflow` command
2. **Orchestration**: Extension creates execution engine
3. **Node Processing**: Nodes execute in topological order
4. **Streaming**: Real-time updates via `node_execution_status` and `node_output_chunk`
5. **Approval**: CLI nodes pause for user approval
6. **Completion**: Extension sends `execution_completed` event

### Node Types

#### LLM Nodes
- Uses Amp SDK or OpenRouter SDK
- Streams assistant content
- Supports tool calls and function calling
- Maintains conversation history

#### CLI Nodes
- Executes shell commands via `child_process`
- Requires approval by default
- Streams stdout/stderr
- Supports environment variable substitution

#### Logic Nodes
- **If/Else**: Branch based on conditions
- **Loop Start/End**: Iterative execution
- **Variable**: Store and reference data
- **Accumulator**: Collect outputs

#### Subflow Nodes
- Reusable workflow components
- Input/output ports
- Nested execution support

### Approval System

CLI nodes require approval before execution:

1. **Pending**: Node status set to `pending_approval`
2. **Prompt**: User sees approval dialog in webview
3. **Decision**: User approves or rejects
4. **Execution**: Approved nodes execute, rejected nodes skip

## Development Mode

When `context.extensionMode === vscode.ExtensionMode.Development`:

### Hot Reload
- Webview assets are watched for changes
- Auto-reload on file changes (150ms debounce)
- Console logging enabled

### Strict Mode
- Message validation is strict in development
- Type checking is more rigorous
- Error messages are more detailed

### Debug Logging
- Extension logs activation status
- Webview reload events are logged
- Error details are shown in console

## Error Handling

### Common Errors

#### "Amp SDK not available"
- **Cause**: Amp SDK not properly linked
- **Solution**: Run `npm i /home/prinova/CodeProjects/upstreamAmp/sdk`

#### "AMP_API_KEY is not set"
- **Cause**: Environment variable missing
- **Solution**: Set `AMP_API_KEY` in your environment

#### "Failed to load webview assets"
- **Cause**: Build artifacts missing
- **Solution**: Run `npm run build` or `npm run watch:webview`

### Error Reporting

Errors are reported to users via:
- `vscode.window.showErrorMessage()` for critical failures
- Webview error messages for workflow execution errors
- Console logging for debugging

## API Integration

### Amp SDK Integration

The extension integrates with the Amp SDK for LLM operations:

```typescript
import { AmpClient } from '@prinova/amp-sdk'

const client = new AmpClient({
    apiKey: process.env.AMP_API_KEY,
    // Additional configuration
})
```

### OpenRouter SDK Integration

Optional integration for alternative LLM providers:

```typescript
// Configuration via environment variables
// OPENROUTER_API_KEY
```

## File Structure

```
src/extension.ts                    # Extension entry point
workflow/Application/register.ts    # Command registration & setup
workflow/Core/Contracts/Protocol.ts # Message protocol types
workflow/WorkflowExecution/         # Execution orchestration
workflow/DataAccess/fs.ts           # File system operations
workflow/Shared/Host/VSCodeHost.ts  # VS Code API adapter
dist/webviews/workflow.html         # Webview entry point
```

## Best Practices

### For Extension Developers

1. **Type Safety**: Always use TypeScript interfaces from `Protocol.ts`
2. **Error Handling**: Validate inputs and handle errors gracefully
3. **Resource Management**: Dispose of event listeners and watchers
4. **Async/Await**: Use async/await for file operations and messaging

### For Workflow Designers

1. **Environment Variables**: Set `AMP_API_KEY` before using LLM nodes
2. **Approval**: Be cautious with CLI nodes that modify system state
3. **Testing**: Test workflows in preview mode first
4. **Version Control**: Store workflows in version control (git)

## Troubleshooting

### Extension Won't Activate

1. Check VS Code version (requires >=1.90.0)
2. Verify extension is enabled
3. Check extension logs (Help → Toggle Developer Tools)

### Webview Won't Load

1. Run `npm run build` to build webview assets
2. Check for build errors in terminal
3. Verify `dist/webviews/workflow.html` exists

### LLM Nodes Fail

1. Verify `AMP_API_KEY` is set
2. Check network connectivity
3. Review Amp SDK documentation

### CLI Nodes Fail

1. Check command syntax
2. Verify file permissions
3. Review shell environment

## Related Documentation

- [Protocol Reference](protocol.md) - Detailed message protocol documentation
- [Node Types Reference](node-types.md) - Available node types and configurations
- [Events Reference](events.md) - Event system documentation
