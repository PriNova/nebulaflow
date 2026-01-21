# Architecture

This document provides a detailed overview of NebulaFlow's architecture, including its component structure, execution model, and design patterns.

## Overview

NebulaFlow is a VS Code extension that provides a visual workflow editor for LLM+CLI workflows. The architecture consists of two main components:

1. **VS Code Extension** (`src/extension.ts`): Runs in VS Code, manages the webview interface, and orchestrates workflow execution
2. **Webview UI** (`workflow/Web/`): React-based interface using React Flow for visual graph editing

The extension uses the Amp SDK and OpenRouter SDK for LLM operations and executes CLI commands through the Node.js child_process API. Execution is orchestrated in the extension with streaming output, approval system, and real-time event handling.

## Vertical Slice Architecture (VSA)

NebulaFlow follows a **Vertical Slice Architecture** where code is organized by features (slices) rather than technical layers. This maximizes context locality and keeps all code required to understand a feature within the fewest possible files and folders.

### Directory Structure

```
src/
  extension.ts                    # VS Code extension entry point
workflow/
  Application/                    # Orchestration and message handling
    register.ts                   # Extension activation and webview setup
    messaging/                    # Protocol converters and message handling
    workflow-session.ts           # Workflow session management
  Core/                          # Pure business logic (no side effects)
    models.ts                     # Node types and data structures
    Contracts/                    # Shared protocol contracts
      Protocol.ts                 # Message types for extension-webview communication
  DataAccess/                     # I/O operations (file system, storage)
    fs.ts                         # File system operations for workflows/subflows
  Execution/                      # Node execution logic
    Application/handlers/         # Workflow execution handler
    Core/engine/                  # Parallel scheduler
    Core/execution/               # Input evaluation, output combination
    Application/node-runners/     # Individual node executors
  LLMIntegration/                 # LLM provider integrations (Amp, OpenRouter)
  Shared/                         # Generic primitives (Host, Infrastructure)
    Host/                         # VS Code host adapter
    Infrastructure/               # Messaging, workspace management
  Web/                           # Webview UI (React + React Flow)
    components/                   # React components
      nodes/                      # Node UI components
    services/                     # Protocol communication
    WorkflowApp.tsx               # Main webview application
```

### Flow Model (REPR)

Requests flow through these logical stages:

1. **Entry** (Component/API): Receives input from VS Code command or webview UI
2. **Application** (Handler/Validator): Orchestrates and validates workflow execution
3. **Core** (Pure Logic): Transforms data without side effects
4. **Infra** (DataAccess/External): Performs I/O (file system, network, CLI execution)

Example: Executing a workflow
- **Entry**: `nebulaFlow.openWorkflow` command → webview sends `execute_workflow` message
- **Application**: `ExecuteWorkflow.ts` handler validates nodes/edges, sets up execution context
- **Core**: Pure functions evaluate inputs, combine outputs, manage state
- **Infra**: `executeCLINode` runs shell commands, `executeLLMNode` calls Amp SDK

## Execution Model

### Streaming Output

Execution events stream in real-time from the extension to the webview:

- **Node Execution Status**: `node_execution_status` events report running/completed/error states
- **Assistant Content**: `node_assistant_content` streams LLM responses (text, thinking, tool use)
- **CLI Output**: `node_output_chunk` streams stdout/stderr from shell commands

### Approval System

CLI nodes require explicit user approval before execution:

1. Node enters `pending_approval` state
2. Webview displays approval prompt with command details
3. User approves (`node_approved`) or rejects (`node_rejected`)
4. Execution continues or aborts

### Parallel Execution

NebulaFlow uses a **parallel scheduler** that executes nodes when their dependencies are satisfied:

- Nodes with no dependencies run immediately
- Nodes wait for all parent nodes to complete
- Loops are handled via `loop-start` and `loop-end` nodes
- Subflows execute as isolated subgraphs

### Pause/Resume

Workflows can be paused and resumed from any node:

- **Pause**: Sends `execution_paused` event with `stoppedAtNodeId`
- **Resume**: Provides `ResumeDTO` with seeds for variables, decisions, outputs
- **Interruption**: Nodes can be interrupted (e.g., user aborts, error occurs)

## Node Types

NebulaFlow provides the following node types (defined in `workflow/Core/models.ts` and `workflow/Web/components/nodes/Nodes.tsx`):

### Agent Nodes
- **LLM Node** (`NodeType.LLM`): Interact with Large Language Models
  - Configuration: model selection, reasoning effort, system prompt, attachments
  - Integration: Amp SDK (primary), OpenRouter SDK (optional)
  - Streaming: Assistant content chunks, tool calls, thinking tokens

### Shell Nodes
- **CLI Node** (`NodeType.CLI`): Execute shell commands
  - Configuration: command, shell type, stdin, environment, safety levels
  - Approval: Requires user approval for execution (configurable)
  - Output: Streaming stdout/stderr, exit code tracking

### Text Nodes
- **Text Node** (`NodeType.INPUT`): Input text data (formerly "Input Node")
  - Configuration: content, title
  - Purpose: Provide initial input to workflow

- **Accumulator Node** (`NodeType.ACCUMULATOR`): Accumulate text across multiple inputs
  - Configuration: variable name, initial value
  - Behavior: Concatenates inputs with newline separator

- **Variable Node** (`NodeType.VARIABLE`): Store and reference variables
  - Configuration: variable name, initial value
  - Behavior: Sets variable value from input template

### Logic Nodes
- **If/Else Node** (`NodeType.IF_ELSE`): Branch workflow based on conditions
  - Configuration: condition evaluation (true/false paths)
  - Behavior: Routes execution based on condition result

- **Loop Start Node** (`NodeType.LOOP_START`): Begin a loop iteration
  - Configuration: iterations, loop variable, loop mode (fixed/while)
  - Behavior: Controls loop iteration count and variable

- **Loop End Node** (`NodeType.LOOP_END`): End a loop iteration
  - Configuration: None (paired with Loop Start)
  - Behavior: Marks loop boundary for scheduler

### Preview Node
- **Preview Node** (`NodeType.PREVIEW`): Display data for debugging
  - Configuration: None
  - Behavior: Shows input data in execution panel

### Subflow Nodes
- **Subflow Node** (`NodeType.SUBFLOW`): Embed a reusable subflow
  - Configuration: subflow ID, input/output port counts
  - Behavior: Executes a saved workflow as a subgraph

- **Subflow Input Node** (`NodeType.SUBFLOW_INPUT`): Define input ports for subflows
- **Subflow Output Node** (`NodeType.SUBFLOW_OUTPUT`): Define output ports for subflows

## Protocol

The extension and webview communicate using a custom workflow message protocol defined in `workflow/Core/Contracts/Protocol.ts`. All messages extend `BaseWorkflowMessage` with a `type` field.

### Message Categories

#### Commands (Webview → Extension)
- `execute_workflow`: Start workflow execution
- `abort_workflow`: Stop execution
- `pause_workflow`: Pause execution
- `node_approved` / `node_rejected`: Approval responses
- `save_workflow`: Persist workflow to disk
- `load_workflow`: Load workflow from disk

#### Events (Extension → Webview)
- `execution_started` / `execution_completed` / `execution_paused`: Execution lifecycle
- `node_execution_status`: Node state changes
- `node_output_chunk`: Streaming CLI output
- `node_assistant_content`: Streaming LLM responses
- `workflow_loaded`: Workflow data loaded
- `workflow_saved`: Save confirmation

#### Data Transfer
- `provide_custom_nodes`: Custom node definitions
- `storage_scope`: Storage configuration
- `provide_subflow`: Subflow definition

### Payload Types

- `WorkflowPayloadDTO`: Contains nodes, edges, state, resume metadata
- `NodeExecutionPayload`: Node status, result, error information
- `AssistantContentItem`: Structured LLM content (text, thinking, tool use)
- `SubflowDefinitionDTO`: Reusable workflow definition

## Configuration

### Environment Variables

- **AMP_API_KEY**: Required for LLM node execution (Amp SDK)
- **OPENROUTER_API_KEY**: Optional for OpenRouter SDK integration

### VS Code Settings

- `nebulaFlow.storageScope`: Choose between user or workspace storage (`user` | `workspace`)
- `nebulaFlow.globalStoragePath`: Custom storage path for workflows/subflows

### Workflow Settings

- **Model Selection**: Via Amp SDK or OpenRouter (configured per LLM node)
- **Node Configuration**: Each node type has specific settings (prompts, commands, conditions, etc.)
- **Approval Settings**: CLI nodes can be configured to require approval or auto-execute (unsafe)

## Dependencies

### Core Dependencies
- **VS Code API**: Extension host, webview, commands, file system
- **Node.js**: Built-in modules (`child_process`, `fs`, `path`, `events`)

### Webview Dependencies
- **React**: UI components
- **@xyflow/react**: React Flow for graph visualization
- **Vite**: Build tool for webview bundle

### SDK Integrations
- **Amp SDK**: Primary LLM provider (requires API key)
- **OpenRouter SDK**: Alternative LLM provider (optional)

### Development Dependencies
- **TypeScript**: Type checking
- **Biome**: Linting and formatting
- **Esbuild**: Extension bundling

## Development Workflow

### Build Process
1. **Webview**: `npm run build:webview` → Vite bundles React app into `dist/webviews/`
2. **Extension**: `npm run build:ext` → Esbuild bundles extension + SDK into `dist/extension.js`
3. **Full Build**: `npm run build` → Both steps, auto-syncs SDK via `sync:sdk`

### Testing
- **Type Checking**: `npm run check` (TS 5.x)
- **Linting**: `npm run lint` (Biome)
- **Formatting**: `npm run format` (Biome)

### Debugging
1. Set `AMP_API_KEY` environment variable
2. Launch VS Code extension host (F5)
3. Open NebulaFlow panel
4. Test workflows with LLM/CLI nodes

## Performance Considerations

### Parallel Execution
- Nodes execute in parallel when dependencies are satisfied
- Reduces total execution time for independent branches
- Loop iterations execute sequentially within each iteration

### Streaming
- LLM responses stream token-by-token for low latency
- CLI output streams line-by-line for real-time feedback
- Events are batched to reduce message overhead

### Caching
- Subflow definitions are cached per panel session
- Model lists are cached after first fetch
- Workflow state persists across saves/loads

## Security

### CLI Execution
- **Approval System**: CLI nodes require explicit user approval
- **Safety Levels**: Configurable safety levels (`safe` | `advanced`)
- **Environment Isolation**: Controlled environment variable exposure
- **Shell Selection**: Configurable shell (bash, zsh, pwsh, etc.)

### LLM Integration
- **API Key Management**: Keys stored in environment variables (not in workflow files)
- **Model Selection**: User chooses models per node
- **Content Filtering**: Optional content safety checks

### File System
- **Workspace Isolation**: Workflows stored in workspace or user scope
- **Path Validation**: Sanitized file paths
- **Subflow Sandboxing**: Subflows execute in isolated contexts

## Extensibility

### Custom Nodes
- Users can save custom node configurations
- Nodes are stored as JSON definitions
- Loaded via `provide_custom_nodes` event

### Subflows
- Reusable workflow components
- Defined with input/output ports
- Stored in workspace or global storage

### Protocol Extensions
- Message types are extensible via union types
- New commands/events can be added without breaking existing functionality
- Backward compatibility maintained through versioning

## References

- [Vertical Slice Architecture Guide](../../../agent-docs/vsa-architecture.md)
- [Protocol Definition](../../workflow/Core/Contracts/Protocol.ts)
- [Node Types](../../workflow/Core/models.ts)
- [Execution Handler](../../workflow/WorkflowExecution/Application/handlers/ExecuteWorkflow.ts)
