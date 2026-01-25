# Execution & Debugging

This guide covers how to debug workflows in NebulaFlow, including inspecting intermediate results, monitoring execution, and troubleshooting common issues.

## Overview

NebulaFlow provides several debugging tools to help you understand and fix workflow behavior:

- **Preview Nodes**: Display intermediate data at any point in your workflow
- **Single-Node Execution**: Test individual nodes without running the entire workflow
- **Execution Logs**: Real-time status updates and streaming output
- **Token Counting**: Monitor LLM usage and costs
- **Approval System**: Inspect and approve/reject CLI commands and LLM tool calls
- **Pause & Resume**: Debug long-running workflows by pausing and resuming
- **Environment Flags**: Enable verbose logging for specific components

## Preview Nodes

Preview nodes are the primary debugging tool. They display the output of any connected node without affecting the workflow flow.

### Using Preview Nodes

1. **Add a Preview Node**: Drag a **Preview** node from the Library (under **Preview** category)
2. **Connect**: Connect any node's output to the Preview node's input
3. **View Results**: After execution, click the Preview node to see its content

### Best Practices

- **Place checkpoints**: Add Preview nodes after each major transformation
- **Inspect inputs**: Connect Preview nodes before complex nodes to verify inputs
- **Multiple inputs**: Preview nodes can receive from multiple parents (fan-in)
- **Edit content**: Preview nodes have an "Edit" tab to modify displayed content

### Example

```
Input → LLM → Preview → Variable → Preview
```

The first Preview shows the LLM's raw output, the second shows the stored variable value.

## Single-Node Execution

Test nodes individually without executing the entire workflow.

### How to Execute a Single Node

1. **Right-click** on a node in the workflow graph
2. **Select "Execute Node"** from the context menu
3. **Provide inputs** if the node requires them (optional)
4. **View results** in the node's output area or connected Preview nodes

### Use Cases

- **Debug LLM prompts**: Test prompt templates with different inputs
- **Verify CLI commands**: Test shell commands before adding them to a workflow
- **Check condition logic**: Test If/Else conditions with various inputs
- **Inspect variable values**: See what a Variable node would store

### Limitations

- Single-node execution does not propagate to downstream nodes automatically
- Loop structures require full workflow execution
- Some nodes (like Loop Start/End) need the full workflow context

## Execution Logs & Status

During execution, NebulaFlow provides real-time feedback through the webview interface.

### Node Status Indicators

- **Pending** (gray): Node waiting for dependencies
- **Running** (blue): Node currently executing
- **Completed** (green): Node finished successfully
- **Error** (red): Node failed with an error
- **Pending Approval** (yellow): Node waiting for user approval

### Streaming Output

**LLM Nodes**: Stream token-by-token as the model generates content. You can see the response in real-time.

**CLI Nodes**: Stream stdout and stderr as the command runs. Output appears in the node's output area.

### Execution Events

The extension sends events to the webview for each node:
- `node_execution_status`: Status updates
- `node_assistant_content`: LLM streaming content
- `node_output_chunk`: CLI output chunks
- `execution_completed`: Workflow finished

## Token Counting

Monitor LLM usage to understand costs and optimize prompts.

### Automatic Token Counting

- **Preview Nodes**: Automatically calculate token count for displayed content
- **LLM Nodes**: Track input and output tokens per execution
- **Display**: Token count appears in the node's result area (when available)

### Viewing Token Counts

1. **Execute a workflow** with LLM nodes
2. **Check Preview nodes** for token count display
3. **Inspect node results** in the Right Sidebar

### Optimization Tips

- **Reduce prompt size**: Remove unnecessary context
- **Use appropriate models**: Smaller models for simple tasks
- **Cache outputs**: Reuse LLM outputs when possible
- **Batch operations**: Combine multiple small requests

## Approval System Debugging

CLI nodes and LLM tool calls can require approval before execution. This is a security feature that also aids debugging.

### Approval Flow

1. **Node reaches approval point**: Execution pauses
2. **Right Sidebar shows preview**: Command/script and structured summary
3. **Review details**: Mode, Shell, Safety, Stdin, Flags
4. **Approve or Reject**: Continue or stop execution

### Debugging Approval Issues

**CLI node not executing:**
- Check **Safety** setting (safe vs advanced)
- Verify **Approval** is enabled (default for safe mode)
- Look for "Pending Approval" status indicator

**LLM tool calls blocked:**
- Check `dangerouslyAllowAll` setting in workspace configuration
- Review `tools.disable` array
- Verify tool call is expected behavior

## Pause & Resume

For long-running workflows, you can pause execution and resume later.

### Pausing a Workflow

1. **Click "Pause"** button during execution
2. **Execution stops** at the current node
3. **State is saved** automatically

### Resuming from Pause

1. **Click "Resume"** button
2. **Choose starting point**: Resume from paused node or specific node
3. **Provide seeds** (optional): Override outputs, decisions, or variables

### Debugging with Pause

- **Test specific sections**: Pause before a problematic node, then resume
- **Inspect state**: Check variable values and node outputs before resuming
- **Modify inputs**: Change workflow data before resuming

## Environment Variables for Debugging

Set these environment variables to enable additional debugging features.

### Debug Flags

- **`NEBULAFLOW_DEBUG_LLM`**: Set to `1` to enable verbose logging for LLM node execution
- **`NEBULAFLOW_DISABLE_HYBRID_PARALLEL`**: Disable hybrid parallel execution (affects looped graphs)
- **`NEBULAFLOW_FILTER_PAUSE_SEEDS`**: Filter pause seeds in certain resume scenarios
- **`NEBULAFLOW_SHELL_MAX_OUTPUT`**: Maximum characters to capture from shell command output (default: `1000000`)

### Setting Environment Variables

**Linux/macOS:**
```bash
export NEBULAFLOW_DEBUG_LLM=1
```

**Windows (PowerShell):**
```powershell
$env:NEBULAFLOW_DEBUG_LLM=1
```

**Using `.env` file:**
Create a `.env` file in your workspace root:
```
NEBULAFLOW_DEBUG_LLM=1
```

## Troubleshooting Common Issues

### Workflow Doesn't Execute

**Symptom**: Clicking "Execute" does nothing
**Causes**:
- Missing API key (`AMP_API_KEY` not set)
- Invalid workflow structure (missing connections)
- Node validation errors

**Solution**:
1. Check environment variables are set
2. Verify all nodes have required connections
3. Check node configuration for errors

### Node Stuck in "Pending" State

**Symptom**: Node never starts executing
**Causes**:
- Missing dependencies (parent nodes not completed)
- Circular dependencies
- Node disabled

**Solution**:
1. Check in-degree (number of incoming edges)
2. Verify all parent nodes completed successfully
3. Ensure node is not disabled (check node settings)

### LLM Node Timeout

**Symptom**: LLM node times out after 300 seconds
**Causes**:
- Slow model response
- Large context window
- Network issues

**Solution**:
1. Increase timeout in node configuration
2. Try a faster model
3. Reduce prompt size
4. Check API key validity

### CLI Node Command Fails

**Symptom**: Shell command exits with error
**Causes**:
- Command not found in PATH
- Incorrect shell selection
- Safety sanitization blocking valid commands

**Solution**:
1. Verify command exists in system PATH
2. Check shell configuration (bash, zsh, pwsh, etc.)
3. Review safety settings (safe vs advanced mode)
4. Check approval requirements

### Preview Node Shows Nothing

**Symptom**: Preview node is empty after execution
**Causes**:
- No data reaching the node
- Node not executed (dependency issue)
- Data is empty string

**Solution**:
1. Check upstream nodes completed successfully
2. Add another Preview node before to inspect data flow
3. Verify connections are correct (source/target handles)

### Token Count Not Displayed

**Symptom**: No token count shown for LLM output
**Causes**:
- Token counting not implemented for that model
- Output too large (truncated)
- Feature not yet available

**Solution**:
1. Check node result area for token count
2. Use Preview node to see raw output
3. Monitor execution logs for token-related messages

## Best Practices for Debugging

### Incremental Development

1. **Build small**: Start with simple linear workflows
2. **Test each node**: Execute nodes individually before connecting
3. **Add Preview nodes**: Place checkpoints at each stage
4. **Verify outputs**: Check each node's result before proceeding

### Systematic Approach

1. **Isolate the problem**: Identify which node is failing
2. **Check inputs**: Verify data reaching the node
3. **Check configuration**: Review node settings
4. **Check dependencies**: Ensure parent nodes completed
5. **Check logs**: Review execution status and errors

### Common Patterns

**Debug LLM prompts:**
```
Input → Preview (check input) → LLM → Preview (check output)
```

**Debug CLI commands:**
```
Input → CLI → Preview (check output) → Next step
```

**Debug condition logic:**
```
Input → Preview (check value) → If/Else → Preview (true path)
                                 → Preview (false path)
```

## Advanced Debugging

### Inspecting Execution State

The extension maintains execution state that can be inspected:

- **Node outputs**: Stored in `nodeResults` map
- **Variable values**: Stored in `variableValues` map
- **Loop states**: Current iteration and max iterations
- **LLM thread IDs**: For chat continuation

### Debugging Parallel Execution

NebulaFlow uses parallel execution by default. To debug parallel issues:

1. **Disable hybrid parallel**: Set `NEBULAFLOW_DISABLE_HYBRID_PARALLEL=1`
2. **Add Preview nodes**: After parallel branches to inspect outputs
3. **Check edge ordering**: Ensure inputs arrive in correct order

### Debugging Subflows

Subflows have their own execution context:

1. **Open subflow**: Double-click subflow node
2. **Debug internally**: Use same debugging techniques inside subflow
3. **Check ports**: Verify input/output port mappings

## See Also

- [Workflow Design](./workflow-design.md) - Design patterns and best practices
- [Nodes Overview](./nodes/index.md) - Reference for all node types
- [Configuration](../getting-started/configuration.md) - Environment variables and settings
- [Troubleshooting](../resources/troubleshooting.md) - Common errors and solutions
