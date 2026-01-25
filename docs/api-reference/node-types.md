# Node Types API Reference

## Overview

NebulaFlow provides a variety of node types for building workflows. Each node type has specific functionality, configuration options, and execution behavior. All node types are defined in `workflow/Core/models.ts` and `workflow/Web/components/nodes/Nodes.tsx`.

## Node Type Enum

```typescript
enum NodeType {
    CLI = 'cli',
    LLM = 'llm',
    PREVIEW = 'preview',
    INPUT = 'text-format',
    LOOP_START = 'loop-start',
    LOOP_END = 'loop-end',
    ACCUMULATOR = 'accumulator',
    VARIABLE = 'variable',
    IF_ELSE = 'if-else',
    SUBFLOW = 'subflow',
    SUBFLOW_INPUT = 'subflow-input',
    SUBFLOW_OUTPUT = 'subflow-output',
}
```

## Node Categories

### Execution Nodes

These nodes perform actual work and produce outputs:

1. **LLM Node** (`NodeType.LLM`) - Interact with Large Language Models
2. **CLI Node** (`NodeType.CLI`) - Execute shell commands
3. **Preview Node** (`NodeType.PREVIEW`) - Display data for debugging

### Data Nodes

These nodes handle data storage and transformation:

4. **Text Node** (`NodeType.INPUT`) - Input text data
5. **Variable Node** (`NodeType.VARIABLE`) - Store and reference variables
6. **Accumulator Node** (`NodeType.ACCUMULATOR`) - Accumulate text across multiple inputs

### Control Flow Nodes

These nodes control the execution flow:

7. **If/Else Node** (`NodeType.IF_ELSE`) - Branch workflow based on conditions
8. **Loop Start Node** (`NodeType.LOOP_START`) - Begin a loop iteration
9. **Loop End Node** (`NodeType.LOOP_END`) - End a loop iteration

### Subflow Nodes

These nodes handle reusable workflow components:

10. **Subflow Node** (`NodeType.SUBFLOW`) - Embed a reusable subflow
11. **Subflow Input Node** (`NodeType.SUBFLOW_INPUT`) - Define input ports for subflows
12. **Subflow Output Node** (`NodeType.SUBFLOW_OUTPUT`) - Define output ports for subflows

## Node Type Details

### LLM Node

**Type:** `NodeType.LLM`  
**Display Label:** Agent Node  
**Category:** Execution

#### Description
Interacts with Large Language Models using Amp SDK or OpenRouter SDK. Supports streaming, tool calls, and conversation history.

#### Configuration

```typescript
interface LLMNode extends WorkflowNode {
    type: NodeType.LLM
    data: BaseNodeData & {
        model?: Model
        disabledTools?: string[]
        timeoutSec?: number
        dangerouslyAllowAll?: boolean
        reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
        systemPromptTemplate?: string
        attachments?: AttachmentRef[]
    }
}
```

**Fields:**
- `model`: Selected LLM model (e.g., `{ id: 'gpt-4', title: 'GPT-4' }`)
- `disabledTools`: Array of tool names to disable
- `timeoutSec`: Timeout in seconds for the LLM call
- `dangerouslyAllowAll`: Bypass safety checks (use with caution)
- `reasoningEffort`: Reasoning effort level (affects token usage)
- `systemPromptTemplate`: Custom system prompt template
- `attachments`: Array of attachment references (images)

#### Execution Behavior
- Streams assistant content via `node_assistant_content` events
- Maintains conversation history per node
- Supports tool calls and function calling
- Can be executed in single-node mode or workflow mode

#### Example Configuration
```typescript
{
    type: NodeType.LLM,
    data: {
        title: 'Generate Commit Message',
        content: 'Generate a commit message for the following git diff: ${1}',
        active: true,
        model: { id: 'gpt-4', title: 'GPT-4' },
        reasoningEffort: 'medium',
        systemPromptTemplate: 'You are a helpful assistant.'
    }
}
```

### CLI Node

**Type:** `NodeType.CLI`  
**Display Label:** Shell Node  
**Category:** Execution

#### Description
Executes shell commands via Node.js `child_process`. Requires approval by default for safety.

#### Configuration

```typescript
interface CLINode extends WorkflowNode {
    type: NodeType.CLI
    data: BaseNodeData & CLINodeConfig
}

interface CLINodeConfig {
    mode?: 'command' | 'script'
    shell?: 'bash' | 'sh' | 'zsh' | 'pwsh' | 'cmd'
    safetyLevel?: 'safe' | 'advanced'
    streamOutput?: boolean
    stdin?: {
        source?: 'none' | 'parents-all' | 'parent-index' | 'literal'
        parentIndex?: number
        literal?: string
        stripCodeFences?: boolean
        normalizeCRLF?: boolean
    }
    env?: {
        exposeParents?: boolean
        names?: string[]
        static?: Record<string, string>
    }
    flags?: {
        exitOnError?: boolean
        unsetVars?: boolean
        pipefail?: boolean
        noProfile?: boolean
        nonInteractive?: boolean
        executionPolicyBypass?: boolean
    }
}
```

**Fields:**
- `mode`: Execution mode (`'command'` or `'script'`)
- `shell`: Shell to use for execution
- `safetyLevel`: Safety level for command execution
- `streamOutput`: Stream output in real-time
- `stdin`: Input configuration for stdin
- `env`: Environment variable configuration
- `flags`: Execution flags and options

#### Execution Behavior
- Streams stdout/stderr via `node_output_chunk` events
- Requires approval by default (can be bypassed with `executionPolicyBypass`)
- Supports environment variable substitution
- Can capture stdin from parent nodes

#### Example Configuration
```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Git Diff',
        content: 'git diff',
        active: true,
        mode: 'command',
        shell: 'bash',
        streamOutput: true,
        flags: { exitOnError: true }
    }
}
```

### Preview Node

**Type:** `NodeType.PREVIEW`  
**Display Label:** Preview Node  
**Category:** Execution

#### Description
Displays data for debugging and inspection. Useful for viewing intermediate results.

#### Configuration

```typescript
interface PreviewNode extends WorkflowNode {
    type: NodeType.PREVIEW
    data: BaseNodeData
}
```

**Fields:**
- Uses standard `BaseNodeData` fields

#### Execution Behavior
- Displays the output from the previous node
- Supports fan-in (multiple inputs)
- Non-destructive - passes through data unchanged

#### Example Configuration
```typescript
{
    type: NodeType.PREVIEW,
    data: {
        title: 'Debug Output',
        content: '',
        active: true
    }
}
```

### Text Node (Input Node)

**Type:** `NodeType.INPUT`  
**Display Label:** Text Node  
**Category:** Data

#### Description
Provides text input data to the workflow. Can be used as a starting point or to inject data.

#### Configuration

```typescript
interface TextNode extends WorkflowNode {
    type: NodeType.INPUT
    data: BaseNodeData
}
```

**Fields:**
- `content`: The text content to provide
- Uses standard `BaseNodeData` fields

#### Execution Behavior
- Outputs the `content` field as the node result
- Supports fan-in (multiple inputs)
- Can be connected to multiple downstream nodes

#### Example Configuration
```typescript
{
    type: NodeType.INPUT,
    data: {
        title: 'User Query',
        content: 'What is the weather in San Francisco?',
        active: true
    }
}
```

### Variable Node

**Type:** `NodeType.VARIABLE`  
**Display Label:** Variable Node  
**Category:** Data

#### Description
Stores and references variables. Variables can be accessed by other nodes using `${variableName}` syntax.

#### Configuration

```typescript
interface VariableNode extends WorkflowNode {
    type: NodeType.VARIABLE
    data: BaseNodeData & {
        variableName: string
        initialValue?: string
    }
}
```

**Fields:**
- `variableName`: Name of the variable (used for reference)
- `initialValue`: Optional initial value for the variable

#### Execution Behavior
- Stores the input value in the workflow state
- Variables can be referenced in other nodes using `${variableName}` syntax
- Supports fan-in (multiple inputs)

#### Example Configuration
```typescript
{
    type: NodeType.VARIABLE,
    data: {
        title: 'User Input',
        content: '',
        active: true,
        variableName: 'userQuery',
        initialValue: 'default query'
    }
}
```

### Accumulator Node

**Type:** `NodeType.ACCUMULATOR`  
**Display Label:** Accumulator Node  
**Category:** Data

#### Description
Accumulates text from multiple inputs into a single output. Useful for collecting results from loops or parallel branches.

#### Configuration

```typescript
interface AccumulatorNode extends WorkflowNode {
    type: NodeType.ACCUMULATOR
    data: BaseNodeData & {
        variableName: string
        initialValue?: string
    }
}
```

**Fields:**
- `variableName`: Name of the variable to accumulate into
- `initialValue`: Optional initial value

#### Execution Behavior
- Collects all input values
- Concatenates them with newlines
- Stores the result in the specified variable
- Supports fan-in (multiple inputs)

#### Example Configuration
```typescript
{
    type: NodeType.ACCUMULATOR,
    data: {
        title: 'Collect Results',
        content: '',
        active: true,
        variableName: 'allResults',
        initialValue: ''
    }
}
```

### If/Else Node

**Type:** `NodeType.IF_ELSE`  
**Display Label:** If/Else Node  
**Category:** Control Flow

#### Description
Branches workflow execution based on a condition. Evaluates the input and routes to either true or false path.

#### Configuration

```typescript
interface IfElseNode extends WorkflowNode {
    type: NodeType.IF_ELSE
    data: BaseNodeData & {
        truePathActive?: boolean
        falsePathActive?: boolean
    }
}
```

**Fields:**
- `truePathActive`: Visual indicator for true branch
- `falsePathActive`: Visual indicator for false branch

#### Execution Behavior
- Evaluates the input value as a boolean
- Routes execution to the appropriate branch
- Supports dynamic branching based on conditions

#### Example Configuration
```typescript
{
    type: NodeType.IF_ELSE,
    data: {
        title: 'Check Condition',
        content: '',
        active: true
    }
}
```

### Loop Start Node

**Type:** `NodeType.LOOP_START`  
**Display Label:** Loop Start Node  
**Category:** Control Flow

#### Description
Begins a loop iteration. Defines loop parameters and controls iteration count.

#### Configuration

```typescript
interface LoopStartNode extends WorkflowNode {
    type: NodeType.LOOP_START
    data: BaseNodeData & {
        iterations: number
        loopVariable: string
        overrideIterations?: boolean
        loopMode?: 'fixed' | 'while-variable-not-empty'
        collectionVariable?: string
        maxSafeIterations?: number
    }
}
```

**Fields:**
- `iterations`: Number of iterations to run
- `loopVariable`: Variable name for the current iteration
- `overrideIterations`: Allow overriding iteration count at runtime
- `loopMode`: Loop execution mode
- `collectionVariable`: Variable containing collection to iterate over
- `maxSafeIterations`: Maximum safe iterations (prevents infinite loops)

#### Execution Behavior
- Repeats the loop body for the specified number of iterations
- Updates the loop variable with each iteration
- Can iterate over a collection or fixed count
- Must be paired with a Loop End node

#### Example Configuration
```typescript
{
    type: NodeType.LOOP_START,
    data: {
        title: 'For Each Item',
        content: '',
        active: true,
        iterations: 5,
        loopVariable: 'i',
        loopMode: 'fixed'
    }
}
```

### Loop End Node

**Type:** `NodeType.LOOP_END`  
**Display Label:** Loop End Node  
**Category:** Control Flow

#### Description
Ends a loop iteration. Signals the completion of the current iteration.

#### Configuration

```typescript
interface LoopEndNode extends WorkflowNode {
    type: NodeType.LOOP_END
}
```

**Fields:**
- Uses standard `BaseNodeData` fields

#### Execution Behavior
- Marks the end of a loop body
- Returns control to the corresponding Loop Start node
- Must be paired with a Loop Start node

#### Example Configuration
```typescript
{
    type: NodeType.LOOP_END,
    data: {
        title: 'End Loop',
        content: '',
        active: true
    }
}
```

### Subflow Node

**Type:** `NodeType.SUBFLOW`  
**Display Label:** Subflow Node  
**Category:** Subflow

#### Description
Embeds a reusable subflow (workflow) as a single node. Allows for modular workflow design.

#### Configuration

```typescript
interface SubflowNode extends WorkflowNode {
    type: NodeType.SUBFLOW
    data: BaseNodeData & {
        subflowId: string
        inputPortCount?: number
        outputPortCount?: number
    }
}
```

**Fields:**
- `subflowId`: ID of the subflow to embed
- `inputPortCount`: Number of input ports
- `outputPortCount`: Number of output ports

#### Execution Behavior
- Executes the embedded subflow as a unit
- Passes inputs to subflow input ports
- Receives outputs from subflow output ports
- Supports fan-in and fan-out

#### Example Configuration
```typescript
{
    type: NodeType.SUBFLOW,
    data: {
        title: 'Process Data',
        content: '',
        active: true,
        subflowId: 'data-processor-v1',
        inputPortCount: 2,
        outputPortCount: 1
    }
}
```

### Subflow Input Node

**Type:** `NodeType.SUBFLOW_INPUT`  
**Display Label:** Subflow Input  
**Category:** Subflow

#### Description
Defines an input port for a subflow. Used only within subflow definitions.

#### Configuration

```typescript
interface WorkflowNode {
    type: NodeType.SUBFLOW_INPUT
    data: BaseNodeData & {
        portId?: string
        portName?: string
    }
}
```

**Fields:**
- `portId`: Unique identifier for the input port
- `portName`: Human-readable name for the input port

#### Execution Behavior
- Receives input from the parent workflow
- Outputs to nodes within the subflow
- Only available inside subflow definitions

### Subflow Output Node

**Type:** `NodeType.SUBFLOW_OUTPUT`  
**Display Label:** Subflow Output  
**Category:** Subflow

#### Description
Defines an output port for a subflow. Used only within subflow definitions.

#### Configuration

```typescript
interface WorkflowNode {
    type: NodeType.SUBFLOW_OUTPUT
    data: BaseNodeData & {
        portId?: string
        portName?: string
    }
}
```

**Fields:**
- `portId`: Unique identifier for the output port
- `portName`: Human-readable name for the output port

#### Execution Behavior
- Receives input from nodes within the subflow
- Outputs to the parent workflow
- Only available inside subflow definitions

## Common Node Data Fields

All nodes share the following base data structure:

```typescript
interface BaseNodeData {
    title: string              // Display name of the node
    input?: string             // Input data (from previous nodes)
    output?: string            // Output data (result of execution)
    content: string            // Node-specific content (command, prompt, etc.)
    active: boolean            // Whether the node is active/enabled
    bypass?: boolean           // Whether to bypass this node during execution
    needsUserApproval?: boolean // Whether node requires approval
    tokenCount?: number        // Token count (for LLM nodes)
    local_remote?: boolean     // Local vs remote execution flag
    moving?: boolean           // Visual state for dragging
    executing?: boolean        // Visual state for execution
    error?: boolean            // Visual state for error
    interrupted?: boolean      // Visual state for interruption
    result?: string            // Final result of execution
    shouldAbort?: boolean      // Flag to abort execution
    isEditing?: boolean        // Visual state for editing
    fanInEnabled?: boolean     // Whether fan-in is supported
    inputPortCount?: number    // Number of input ports
    inputEdgeIdByHandle?: Record<string, string> // Input handle to edge mapping
}
```

## Node Type Display Labels

| Node Type | Display Label |
|-----------|---------------|
| `NodeType.LLM` | Agent Node |
| `NodeType.CLI` | Shell Node |
| `NodeType.PREVIEW` | Preview Node |
| `NodeType.INPUT` | Text Node |
| `NodeType.LOOP_START` | Loop Start Node |
| `NodeType.LOOP_END` | Loop End Node |
| `NodeType.ACCUMULATOR` | Accumulator Node |
| `NodeType.VARIABLE` | Variable Node |
| `NodeType.IF_ELSE` | If/Else Node |
| `NodeType.SUBFLOW` | Subflow Node |
| `NodeType.SUBFLOW_INPUT` | Subflow Input |
| `NodeType.SUBFLOW_OUTPUT` | Subflow Output |

## Node Type Categories in UI

The sidebar organizes nodes into categories:

- **Agent**: LLM nodes
- **Text**: Text nodes
- **Shell**: CLI nodes
- **Preview**: Preview nodes
- **Conditionals**: If/Else nodes
- **Subflows**: Subflow nodes
- **Loops**: Loop Start and Loop End nodes

## Node Type Validation

Node types are validated at runtime:

1. **Type Safety**: TypeScript ensures correct node types
2. **Execution Validation**: NodeDispatch validates node types before execution
3. **Storage Validation**: File system operations validate node types on save/load

## Related Documentation

- [Protocol Reference](protocol.md) - Message protocol for node execution
- [Extension API Reference](extension.md) - Extension API and commands
- [Events Reference](events.md) - Event system documentation
