# Node Types Overview

NebulaFlow provides several types of nodes that you can use to build workflows. Each node type serves a specific purpose in the execution flow.

## Agent Nodes

### LLM Node (Agent Node)
- **Purpose**: Interact with Large Language Models for AI-powered tasks
- **Inputs**: Previous node output (text or data)
- **Outputs**: Generated text from the LLM
- **Configuration**:
  - Model selection (via OpenRouter or Amp SDK)
  - Prompt template with variable substitution
  - System prompt template
  - Reasoning effort (minimal, low, medium, high)
  - Timeout settings
  - Tool usage permissions
  - Attachments (images)
- **Category**: Agent

## Text Nodes

### Text Node (Input Node)
- **Purpose**: Provide input text or data to the workflow
- **Inputs**: None (or previous node output)
- **Outputs**: Text content
- **Configuration**:
  - Text content (editable)
  - Active/inactive state
  - Fan-in support (multiple inputs)
- **Category**: Text

### Accumulator Node
- **Purpose**: Collect and accumulate data from multiple inputs
- **Inputs**: Multiple previous nodes
- **Outputs**: Accumulated result
- **Configuration**:
  - Variable name for storage
  - Initial value
  - Fan-in support (multiple inputs)
- **Category**: Text

### Variable Node
- **Purpose**: Store and manage workflow variables
- **Inputs**: Previous node output
- **Outputs**: Variable value
- **Configuration**:
  - Variable name
  - Initial value
- **Category**: Text

## Shell Nodes

### CLI Node (Shell Node)
- **Purpose**: Execute shell commands and scripts
- **Inputs**: Previous node output
- **Outputs**: Command output and exit code
- **Configuration**:
  - Command to execute
  - Arguments
  - Working directory
  - Environment variables
  - Timeout settings
  - Shell selection (bash, sh, zsh, pwsh, cmd)
  - Safety level (safe, advanced)
  - Stream output option
  - Flags (exitOnError, pipefail, etc.)
  - Stdin configuration
- **Category**: Shell

## Conditionals Nodes

### If/Else Node (Condition Node)
- **Purpose**: Branch workflow based on conditions
- **Inputs**: Previous node output
- **Outputs**: True/False branches
- **Configuration**:
  - Condition expression
  - Comparison operator
  - Value to compare against
  - Path activation states
- **Category**: Conditionals

## Loops Nodes

### Loop Start Node
- **Purpose**: Begin a loop iteration
- **Inputs**: Previous node output
- **Outputs**: Loop body execution
- **Configuration**:
  - Iteration count
  - Loop variable name
  - Loop mode (fixed, while-variable-not-empty)
  - Collection variable (for foreach)
  - Maximum safe iterations
  - Override iterations option
- **Category**: Loops

### Loop End Node
- **Purpose**: End a loop iteration
- **Inputs**: Loop body output
- **Outputs**: Next node after loop
- **Configuration**: None required
- **Category**: Loops

## Preview Nodes

### Preview Node
- **Purpose**: Display intermediate results for debugging
- **Inputs**: Previous node output
- **Outputs**: Passthrough (original data)
- **Configuration**:
  - Content display
  - Active/inactive state
- **Category**: Preview

## Subflows Nodes

### Subflow Node
- **Purpose**: Execute a nested workflow
- **Inputs**: Previous node output
- **Outputs**: Subflow results
- **Configuration**:
  - Subflow ID reference
  - Input port count
  - Output port count
  - Pending subflow definition
- **Category**: Subflows

### Subflow Input Node (Internal)
- **Purpose**: Define input ports for subflow (internal only)
- **Inputs**: None
- **Outputs**: Input data to subflow
- **Configuration**:
  - Port ID
  - Port name
  - Port index
- **Category**: Subflows (internal)

### Subflow Output Node (Internal)
- **Purpose**: Define output ports for subflow (internal only)
- **Inputs**: Subflow execution result
- **Outputs**: Output data from subflow
- **Configuration**:
  - Port ID
  - Port name
  - Port index
- **Category**: Subflows (internal)

## Node Connections

### Visual Connections
- Drag from output port to input port to create edges
- Nodes connect automatically when dropped near each other
- Multiple connections supported for branching and fan-in patterns
- Subflow nodes support dynamic input/output ports

### Data Flow
- Output from one node becomes input to the next
- Data flows sequentially through the workflow
- Branching allows parallel execution paths
- Fan-in patterns allow multiple nodes to feed into a single node (e.g., Accumulator)
- Subflows encapsulate complex workflows

## Node Configuration

### Property Editor
- Click any node to open the property editor
- Configure node-specific settings
- Use variables and expressions where supported
- Changes apply immediately
- Some nodes require user approval before execution

### Variable Support
- Reference parent node outputs using `${1}`, `${2}`, etc. (by connection order)
- Reference variables stored by Variable or Accumulator nodes using `${variableName}`
- Loop iteration counter is available as `${i}` (or custom loop variable name)
- Environment variables can be mapped in CLI nodes via environment configuration
- Variable nodes store persistent values across workflow execution

## Best Practices

### Node Naming
- Give nodes descriptive names
- Use consistent naming conventions
- Add comments for complex logic
- Use meaningful titles for LLM prompts

### Error Handling
- Add If/Else nodes for conditional branching
- Use Preview nodes for debugging intermediate results
- Check node execution states (executing, error, interrupted)
- Monitor token counts for LLM nodes

### Performance
- Avoid unnecessary loops
- Use loop iteration limits for safety
- Batch operations when possible
- Consider fan-in patterns for data aggregation

### Testing
- Test nodes individually using single-node execution
- Validate data flows between nodes
- Check edge cases in conditional logic
- Use Preview nodes to inspect data at any point

## Execution Model

### Streaming Execution
- LLM and CLI nodes support streaming output
- Real-time event handling during execution
- Progress indicators for long-running operations
- Pause/resume capability for workflows

### Approval System
- CLI nodes may require user approval before execution
- Safety levels control approval requirements
- Configurable via node properties

### Parallel Execution
- Workflow engine supports parallel node execution
- Automatic dependency analysis
- Configurable concurrency limits per node type

## Node Properties

Each node has common properties:
- **ID**: Unique identifier (auto-generated)
- **Name**: Display name (editable)
- **Position**: X/Y coordinates on canvas
- **Data**: Node-specific configuration
- **Active**: Enable/disable node execution
- **Bypass**: Skip node during execution (passthrough)
- **Needs User Approval**: Requires approval before execution
- **Token Count**: Track LLM token usage
- **Executing**: Current execution state
- **Error**: Error state indicator
- **Interrupted**: Paused/stopped state

## Next Steps

- [LLM Nodes](llm-nodes.md) - Deep dive into LLM node configuration
- [CLI Nodes](cli-nodes.md) - Learn about shell command execution
- [Condition Nodes](condition-nodes.md) - Master conditional logic
- [Loop Nodes](loop-nodes.md) - Understand iteration patterns
- [Workflow Design](../workflow-design.md) - Design effective workflows
