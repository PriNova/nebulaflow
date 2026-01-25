# Variables & State

NebulaFlow provides mechanisms for storing and manipulating data across workflow execution. Variables allow you to persist values, accumulate results, and reference data in different parts of your workflow.

## Variable Node

The **Variable Node** (`variable`) stores a single value that can be referenced by other nodes.

### Configuration
- **Variable Name**: Unique identifier for the variable (e.g., `summary`, `counter`)
- **Initial Value**: Optional default value if the variable hasn't been set yet
- **Content**: Template expression that evaluates to the value to store (supports parent outputs and other variables)

### Execution
1. Collects outputs from connected parent nodes (in connection order)
2. Evaluates the template expression using parent outputs and existing variables
3. Stores the result in the variable map under the given variable name
4. Outputs the stored value (can be used by downstream nodes)

### Example
```
[LLM Node] → [Variable Node: name="summary"]
```
The LLM output is stored in the variable `summary`. Later nodes can reference `${summary}`.

## Accumulator Node

The **Accumulator Node** (`accumulator`) appends to a variable across multiple inputs or loop iterations.

### Configuration
- **Variable Name**: Unique identifier for the accumulator variable
- **Initial Value**: Optional starting value (default empty string)
- **Content**: Template expression that evaluates to the text to append

### Execution
1. Retrieves the current accumulated value (or initial value if first time)
2. Evaluates the template expression using parent outputs
3. Appends a newline and the new value to the accumulated value
4. Stores the updated value in the variable map
5. Outputs the accumulated value

### Use Cases
- Collecting results from multiple parallel branches
- Building a log across loop iterations
- Aggregating text from multiple sources

## Variable Storage & Scope

### Execution Context
During workflow execution, NebulaFlow maintains several runtime contexts:

- **Variable Values**: Map of variable names to their current values
- **Accumulator Values**: Map of accumulator variable names to their accumulated values
- **Loop States**: Track iteration counts and loop variables
- **Node Outputs**: Map of node IDs to their execution results
- **Conditional Decisions**: Store IF/ELSE branch decisions

### Lifetime
- Variables persist for the duration of the workflow execution
- Variables are reset when the workflow starts (unless resumed from a pause)
- Variables can be seeded when resuming a paused workflow

### Scope
- Variables are **global** to the workflow execution
- Variables can be referenced from any node after they are set
- Variable names are case-sensitive

## Template Variables

NebulaFlow uses a template syntax for substituting values in node content.

### Parent Output Variables
Reference outputs from connected parent nodes by order:

- `${1}` - First parent output (oldest connection)
- `${2}` - Second parent output
- `${n}` - Nth parent output

### Variable References
Reference stored variables by name:

- `${variableName}` - References the current value of a variable
- `${summary}` - Example variable reference

### Loop Variables
Loop Start nodes automatically create a loop variable:

- `${i}` - Current iteration number (default loop variable name)
- Custom loop variable names can be configured in Loop Start properties

### Accumulator Variables
Accumulator variables are referenced the same way as regular variables:

- `${accumulatedLog}` - References the current accumulated value

### Evaluation Order
Template evaluation follows this order:
1. Parent output substitution (`${1}`, `${2}`, ...)
2. Loop variable substitution (`${i}`, `${loopVar}`, ...)
3. Accumulator variable substitution (`${accumulatorVar}`)
4. Variable substitution (`${variableName}`)

All substitutions happen in a single pass; later substitutions cannot reference earlier ones.

## Environment Variables

Environment variables are **not** substituted in template expressions. However, they can be used in CLI nodes:

### CLI Node Environment Mapping
CLI nodes can expose parent outputs as environment variables:

- **Default**: `INPUT_1`, `INPUT_2`, ... (when `exposeParents` is enabled)
- **Custom names**: Configure `names` array in the node's environment settings

### Static Environment Variables
CLI nodes can also define static environment variables with template substitution:

```json
{
  "static": {
    "MY_VAR": "${variableName}",
    "PATH": "/usr/local/bin:${PATH}"
  }
}
```

### System Environment Variables
The extension can read system environment variables (like `AMP_API_KEY`) for configuration, but these are not available in template expressions.

## Examples

### Storing LLM Output
```
Start → LLM Node → Variable Node (name="summary") → Preview Node
```
The LLM's response is stored in `summary` and can be referenced later.

### Accumulating Loop Results
```
Loop Start → CLI Node → Accumulator Node (name="log") → Loop End
```
Each iteration appends CLI output to the `log` variable.

### Using Variables in CLI Commands
```
Variable Node (name="filename") → CLI Node (content="cat ${filename}")
```
The CLI command uses the variable value.

### Conditional Branching with Variables
```
Variable Node (name="status") → If/Else Node (condition="${status} == 'success'")
```
The variable value determines the branch.

## Troubleshooting

### Variable Not Found
**Symptom**: `${variableName}` appears unchanged in output.

**Causes**:
- Variable hasn't been set yet (check execution order)
- Variable name mismatch (case-sensitive)
- Variable was set in a different branch that didn't execute

**Solution**:
- Ensure the variable node executes before the referencing node
- Verify variable name spelling and case
- Check that the variable node is connected and active

### Accumulator Not Accumulating
**Symptom**: Accumulator variable only contains the last value, not all values.

**Causes**:
- Accumulator node receives only one input
- Variable name conflict with regular variable

**Solution**:
- Ensure multiple inputs are connected to the accumulator
- Use a unique variable name for accumulator vs regular variable

### Loop Variable Not Available
**Symptom**: `${i}` or custom loop variable not substituted.

**Causes**:
- Loop variable name mismatch
- Node is outside loop body

**Solution**:
- Check Loop Start configuration for loop variable name
- Ensure node is inside the loop (between Loop Start and Loop End)

### Template Syntax Errors
**Symptom**: Template substitution fails or produces unexpected results.

**Causes**:
- Missing closing brace `}`
- Invalid variable name (contains spaces, special characters)
- Nested template syntax not supported

**Solution**:
- Use simple variable names (alphanumeric, underscore)
- Avoid `${` inside template expressions
- Test with Preview nodes to verify substitution

## Best Practices

1. **Descriptive Names**: Use meaningful variable names (`userSummary` vs `var1`)
2. **Initialize**: Set initial values for variables that may be referenced before assignment
3. **Avoid Conflicts**: Don't reuse variable names for different purposes
4. **Test Incrementally**: Use Preview nodes to verify variable values at each step
5. **Document**: Add comments to nodes explaining variable usage
6. **Scope Awareness**: Remember variables are global; consider prefixing for subflows

## Related Topics

- [Connections](connections.md) - Understanding data flow between nodes
- [Workflow Design](workflow-design.md) - Workflow execution context
- [Loop Nodes](nodes/loop-nodes.md) - Loop variables and iteration
- [CLI Nodes](nodes/cli-nodes.md) - Environment variable mapping
