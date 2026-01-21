# Condition Nodes (If/Else Nodes)

Condition nodes, also called **If/Else nodes**, provide conditional branching in workflows. They evaluate expressions and route execution to either the "true" or "false" path based on the result. These nodes are essential for creating dynamic workflows that respond to data and execution outcomes.

## How Condition Nodes Work

A condition node evaluates a boolean expression and directs workflow execution accordingly:

- **True Path**: Execution continues through the "true" output handle (left side)
- **False Path**: Execution continues through the "false" output handle (right side)

The node has two distinct output ports labeled "True" and "False" in the UI, allowing you to connect different branches of your workflow.

## Condition Evaluation Modes

Condition nodes support two evaluation modes based on their input connections:

### 1. Exit Code Mode (CLI-Connected)
When a condition node is connected to a **CLI node**, it automatically evaluates the CLI command's exit code:

- **Exit Code 0**: Condition evaluates to `true`
- **Non-Zero Exit Code**: Condition evaluates to `false`

This is the most common pattern for checking command success or failure.

**Example:**
```
CLI Node (mkdir /tmp/data) → If/Else Node → [True: Process Data] / [False: Error Handler]
```

### 2. Expression Mode (Custom Condition)
When not connected to a CLI node (or when you want to override the exit code behavior), the condition node evaluates a custom expression stored in the `content` field.

**Supported Operators:**
- `==` (equals)
- `!=` (not equals)

**Syntax:**
```
[left_side] [operator] [right_side]
```

**Example Conditions:**
- `${1} == success` - Check if previous output equals "success"
- `${1} != error` - Check if previous output does not equal "error"
- `${1} == ${2}` - Compare two inputs
- `true == ${1}` - Check if a boolean variable is true

## Configuration

### Condition Expression (Content Field)
- **Location**: Node properties panel → "Condition" textarea
- **Purpose**: Defines the expression to evaluate (only used in expression mode)
- **Template Variables**: Use `${1}`, `${2}`, etc. to reference inputs from parent nodes
- **Double-Click**: Opens a larger text editor for complex conditions
- **Placeholder**: `e.g., ${1} === done or ${1} !== error`

### Node Properties
- **Title**: Descriptive name for the condition (e.g., "Check Success", "Validate Output")
- **Active**: Controls whether the node participates in workflow execution
- **Bypass**: Skips the node and always takes the "true" path (for debugging)

## Input/Output

### Inputs
- **CLI Exit Code**: When connected to a CLI node, the exit code is automatically used
- **Parent Outputs**: For expression mode, outputs from connected parent nodes are available as template variables
- **Positional Inputs**: Use `${1}`, `${2}`, etc. to reference inputs by connection order

### Outputs
- **True Path**: Output handle labeled "True" (left side) - triggered when condition evaluates to true
- **False Path**: Output handle labeled "False" (right side) - triggered when condition evaluates to false
- **Result**: The evaluation result ("true" or "false") is stored in the node's result field

## Execution Behavior

### Path Selection
- The condition is evaluated before executing the next nodes
- Only one path is taken based on the result
- The other path is completely skipped (including all downstream nodes)
- This enables efficient workflows by avoiding unnecessary execution

### Parallel Execution
- Condition nodes work with the parallel execution engine
- Both branches can be prepared for execution, but only the selected path runs
- The skipped path is marked as inactive in the execution context

## Examples

### Example 1: Check CLI Exit Code
**Workflow:**
```
CLI Node: mkdir /tmp/data
  ↓
If/Else Node: (auto-evaluates exit code)
  ↓
True Path → LLM Node: "Directory created successfully"
False Path → CLI Node: echo "Failed to create directory"
```

**Configuration:**
- CLI Node: `mkdir /tmp/data`
- If/Else Node: No condition expression needed (uses exit code)

### Example 2: Validate Output Content
**Workflow:**
```
LLM Node: "Generate a status message"
  ↓
If/Else Node: ${1} == success
  ↓
True Path → CLI Node: echo "Task completed"
False Path → LLM Node: "Analyze the failure"
```

**Configuration:**
- If/Else Node Condition: `${1} == success`

### Example 3: Compare Two Values
**Workflow:**
```
Variable Node: "expected" = "done"
  ↓
CLI Node: process-data.sh
  ↓
If/Else Node: ${1} == ${2}
  ↓
True Path → Preview Node: "Values match"
False Path → Preview Node: "Values don't match"
```

**Configuration:**
- If/Else Node Condition: `${1} == ${2}`

### Example 4: Error Handling Pattern
**Workflow:**
```
CLI Node: fetch-data.sh
  ↓
If/Else Node: (checks exit code)
  ↓
True Path → LLM Node: "Process the data"
False Path → CLI Node: send-alert.sh
  ↓
If/Else Node: ${1} == retry
  ↓
True Path → Loop Node (retry fetch)
False Path → End Workflow
```

## Best Practices

### 1. Clear Naming
- Use descriptive titles: "Check Success", "Validate Response", "Error Handler"
- Document the condition logic in the title or comments

### 2. Exit Code vs Expression
- **Use Exit Code**: When checking command success/failure (most common)
- **Use Expression**: When checking output content or comparing values
- **Don't Mix**: Avoid connecting CLI nodes when using custom expressions

### 3. Template Variables
- Use explicit variable names: `${1}`, `${2}` for positional inputs
- Keep conditions simple and readable
- Test conditions with preview nodes before connecting

### 4. Error Handling
- Always handle the false path for critical operations
- Use the false path for logging, alerts, or retry logic
- Consider using a loop node for retry patterns

### 5. Avoid Complex Conditions
- Keep expressions simple: single comparison per node
- Use multiple condition nodes for complex logic instead of one complex expression
- Document complex conditions with comments

### 6. Testing
- Test both true and false paths independently
- Use preview nodes to inspect values before conditions
- Verify edge cases (empty strings, special characters)

## Troubleshooting

### Condition Always Evaluates to False
- **Check**: Verify the operator (`==` vs `!=`)
- **Check**: Ensure template variables are correctly formatted (`${1}`)
- **Check**: Confirm parent nodes are producing expected output
- **Debug**: Add a preview node before the condition to inspect values

### Condition Always Evaluates to True
- **Check**: Verify the condition expression is not empty
- **Check**: Ensure you're not in exit code mode when you want expression mode
- **Debug**: Check the node's result field after execution

### Exit Code Not Working
- **Check**: CLI node must be directly connected (no other nodes in between)
- **Check**: CLI node must have executed (not bypassed or skipped)
- **Check**: Exit code is stored in `cliMetadata` in execution context

### Template Variables Not Substituted
- **Check**: Variable format must be `${1}`, `${2}`, etc. (with curly braces)
- **Check**: Parent nodes must have output data
- **Check**: Connection order matters (first parent is `${1}`, second is `${2}`)

### Both Paths Executing
- **Check**: This shouldn't happen - only one path should execute
- **Check**: Verify the condition is being evaluated (node should show result)
- **Check**: Look for bypass or active flags that might affect execution

### Condition Node Not Executing
- **Check**: Node must be "active" (not bypassed)
- **Check**: All parent nodes must complete successfully
- **Check**: Workflow must be in "run" mode (not paused or aborted)

## Integration with Other Nodes

### Before Condition
- **CLI Node**: Provide exit code for automatic evaluation
- **LLM Node**: Generate text to evaluate
- **Variable Node**: Provide comparison values
- **Accumulator Node**: Collect data for comparison

### After Condition (True Path)
- **CLI Node**: Execute success actions
- **LLM Node**: Process successful results
- **Loop Node**: Iterate on success
- **Preview Node**: Display success message

### After Condition (False Path)
- **CLI Node**: Execute error handling
- **LLM Node**: Analyze failures
- **Loop Node**: Retry logic
- **Preview Node**: Display error information

### Common Patterns
- **Success/Failure Routing**: CLI → Condition → Success Handler / Error Handler
- **Data Validation**: LLM → Condition → Process / Reject
- **Retry Logic**: CLI → Condition → Loop (retry) / Alert
- **Conditional Execution**: Variable → Condition → Execute / Skip

## Configuration Example

```yaml
ifelse_node:
  title: "Check Data Quality"
  content: "${1} == valid"
  active: true
  bypass: false
  needsUserApproval: false
  shouldAbort: false
```

## Next Steps

- [Loop Nodes](loop-nodes.md) - Implement retry patterns with condition nodes
- [CLI Nodes](cli-nodes.md) - Generate exit codes for condition evaluation
- [Workflow Design](../workflow-design.md) - Design conditional workflows
- [Node Types Overview](index.md) - Complete node specifications
