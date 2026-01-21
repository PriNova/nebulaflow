# Node Types Overview

NebulaFlow provides several types of nodes that you can use to build workflows. Each node type serves a specific purpose in the execution flow.

## Core Nodes

### Start Node
- **Purpose**: Entry point for every workflow
- **Inputs**: None
- **Outputs**: Triggers the first connected node
- **Configuration**: None required

### End Node
- **Purpose**: Marks the completion of a workflow
- **Inputs**: Any node
- **Outputs**: None
- **Configuration**: None required

## Processing Nodes

### LLM Node
- **Purpose**: Interact with Large Language Models
- **Inputs**: Previous node output
- **Outputs**: Generated text from the LLM
- **Configuration**:
  - Model selection
  - Prompt template
  - Temperature
  - Max tokens
  - System prompt

### CLI Node
- **Purpose**: Execute shell commands
- **Inputs**: Previous node output
- **Outputs**: Command output and exit code
- **Configuration**:
  - Command to execute
  - Arguments
  - Working directory
  - Environment variables
  - Timeout settings

### Condition Node
- **Purpose**: Branch workflow based on conditions
- **Inputs**: Previous node output
- **Outputs**: True/False branches
- **Configuration**:
  - Condition expression
  - Comparison operator
  - Value to compare against

### Loop Node
- **Purpose**: Iterate over data or repeat operations
- **Inputs**: Previous node output
- **Outputs**: Repeated execution
- **Configuration**:
  - Loop type (for, while, foreach)
  - Iteration count or condition
  - Delay between iterations

### Transform Node
- **Purpose**: Modify or filter data
- **Inputs**: Previous node output
- **Outputs**: Transformed data
- **Configuration**:
  - Transformation logic
  - Output format

## Integration Nodes

### API Node
- **Purpose**: Make HTTP requests to external APIs
- **Inputs**: Previous node output
- **Outputs**: API response
- **Configuration**:
  - Endpoint URL
  - Method (GET, POST, etc.)
  - Headers
  - Body/Payload
  - Authentication

### Database Node
- **Purpose**: Query or update databases
- **Inputs**: Previous node output
- **Outputs**: Query results
- **Configuration**:
  - Connection string
  - Query/Statement
  - Parameters

## Utility Nodes

### Delay Node
- **Purpose**: Pause workflow execution
- **Inputs**: Previous node output
- **Outputs**: Continued flow after delay
- **Configuration**:
  - Delay duration

### Log Node
- **Purpose**: Log information during execution
- **Inputs**: Previous node output
- **Outputs**: Original data (passthrough)
- **Configuration**:
  - Log level
  - Message template

### Comment Node
- **Purpose**: Add notes to your workflow
- **Inputs**: None
- **Outputs**: None
- **Configuration**:
  - Comment text

## Node Connections

### Visual Connections
- Drag from output port to input port
- Nodes connect automatically when dropped near each other
- Multiple connections supported for branching

### Data Flow
- Output from one node becomes input to the next
- Data flows sequentially through the workflow
- Branching allows parallel execution paths

## Node Configuration

### Property Editor
- Click any node to open the property editor
- Configure node-specific settings
- Use variables and expressions where supported
- Changes apply immediately

### Variable Support
- Reference previous node outputs using `{{nodeId.output}}`
- Use environment variables with `{{env.VARIABLE_NAME}}`
- Access workflow context with `{{context.property}}`

## Best Practices

### Node Naming
- Give nodes descriptive names
- Use consistent naming conventions
- Add comments for complex logic

### Error Handling
- Add condition nodes for error detection
- Use error output ports when available
- Log errors for debugging

### Performance
- Avoid unnecessary loops
- Use delays sparingly
- Batch operations when possible

### Testing
- Test nodes individually
- Validate data flows
- Check edge cases

## Node Properties

Each node has common properties:
- **ID**: Unique identifier (auto-generated)
- **Name**: Display name (editable)
- **Position**: X/Y coordinates on canvas
- **Data**: Node-specific configuration
- **Metadata**: Additional information

## Next Steps

- [LLM Nodes](llm-nodes.md) - Deep dive into LLM node configuration
- [CLI Nodes](cli-nodes.md) - Learn about shell command execution
- [Condition Nodes](condition-nodes.md) - Master conditional logic
- [Workflow Design](../workflow-design.md) - Design effective workflows
