# Loop Nodes

Loop nodes enable iterative execution within workflows, allowing you to repeat a block of nodes multiple times. NebulaFlow supports two loop modes: **fixed iteration count** and **while variable not empty** (foreach-style).

## Configuration

### Loop Start Node

The Loop Start node initiates a loop block. It must be paired with a Loop End node to define the loop body.

#### Iterations (Fixed Mode)
- **Type**: Integer (1-100, default: 1)
- **Description**: Number of times the loop body will execute when using fixed iteration mode.
- **Range**: Automatically clamped between 1 and 100 for safety.

#### Loop Variable Name
- **Type**: String (default: `i`)
- **Description**: The name of the variable that holds the current iteration index (or item) within the loop body.
- **Usage**: Referenced as `${loopVariable}` in child nodes (e.g., `${i}`).
- **Example**: If set to `index`, you can use `${index}` in LLM prompts or CLI commands.

#### Loop Mode
Two modes are available:

1. **Fixed iterations** (`fixed`)
   - Executes the loop body a predetermined number of times.
   - Uses the **Iterations** field.
   - Optionally, the iteration count can be overridden by connecting a parent node to the special **Iterations Override** input port.

2. **While variable not empty** (`while-variable-not-empty`)
   - Executes the loop body as long as a collection variable contains items.
   - Useful for processing lists, queues, or dynamic data.
   - Requires a **Collection Variable** to be specified.

#### Collection Variable (While Mode Only)
- **Type**: String
- **Description**: Name of the variable that holds a collection (array, list, etc.).
- **Behavior**: The loop continues while the variable is not empty (truthy). The variable is typically updated within the loop body (e.g., by a CLI node that pops an item).
- **Safety**: A **Max Safe Iterations** limit prevents infinite loops.

#### Max Safe Iterations (While Mode Only)
- **Type**: Integer (optional, default: 100)
- **Description**: Upper bound on loop iterations when using while mode.
- **Purpose**: Prevents accidental infinite loops. The loop will stop after this many iterations even if the collection variable is still non‑empty.

#### Override Iterations (Fixed Mode Only)
- **Type**: Boolean (default: false)
- **Description**: When enabled, the loop start node displays an extra input port labeled **Iterations Override**.
- **Usage**: Connect a parent node (e.g., a Start node with a numeric output) to this port to dynamically set the iteration count at runtime.
- **Clamping**: The override value is clamped between 1 and 100.

### Loop End Node

The Loop End node marks the end of a loop block. It has no configuration options.

## Execution Behavior

### Fixed Iteration Mode
1. The loop start node initializes a counter (`currentIteration = 0`) and a maximum (`maxIterations`).
2. For each iteration, the loop body (nodes between Loop Start and Loop End) is executed sequentially.
3. The loop variable (`loopVariable`) is updated with the current iteration index (starting from 0).
4. After the last iteration, execution continues to the node after Loop End.

### While Variable Not Empty Mode
1. The loop start node checks the specified collection variable.
2. If the variable is empty (or undefined), the loop body is skipped entirely.
3. If non‑empty, the loop body executes once, then re‑checks the variable.
4. The loop continues until the variable becomes empty or the **Max Safe Iterations** limit is reached.
5. The loop variable (`loopVariable`) holds the current iteration index (starting from 0) but is not directly tied to the collection items.

### Loop Variable Substitution
Within the loop body, the loop variable is available as a template variable. For example, if the loop variable is `i`, you can use `${i}` in:
- LLM prompts
- CLI command content
- Condition node expressions
- Variable node values

### Nested Loops
Nested loops are not currently supported. If you need nested iteration, consider using a single loop with a composite data structure.

## UI Components

### Loop Start Node Visuals
- **Header**: Displays "LOOP START" and a Run From Here button.
- **Body**: Shows the node title, current iteration count, and whether iterations are overridden.
- **Input Handles**:
  - Top: Standard input (receives data from parent nodes).
  - Left (special): **Iterations Override** (visible when override is enabled).
- **Output Handle**: Bottom (connects to the first node of the loop body).

### Loop End Node Visuals
- **Header**: Displays "LOOP END" and a Run From Here button.
- **Body**: Shows the node title.
- **Input Handle**: Top (receives data from the last node of the loop body).
- **Output Handle**: Bottom (connects to the node after the loop).

### Property Editor
The Loop Start node's property editor provides fields for all configuration options. The Loop End node has no editable properties.

## Examples

### Fixed Iterations (Simple Counter)
```
Start → Loop Start → LLM (Generate) → CLI (Save) → Loop End → End
```
- **Loop Start**: Iterations = 3, Loop Variable = `i`, Mode = `fixed`
- **LLM**: System Prompt = "Generate a greeting for iteration ${i}."
- **CLI**: Content = `echo "${1}" >> greetings.txt` (where `${1}` is LLM output)

### While Variable Not Empty (Task Queue)
```
Start → Variable (tasks = ["task1", "task2", "task3"]) → Loop Start → CLI (Process) → Loop End → End
```
- **Loop Start**: Collection Variable = `tasks`, Mode = `while-variable-not-empty`, Max Safe Iterations = 100
- **CLI**: Content = `echo "Processing ${tasks[0]}" && pop tasks` (pseudo‑command; actual implementation would update the variable)
- **Note**: The CLI node must modify the `tasks` variable (e.g., by using a Variable node or accumulator) to eventually empty the collection.

### Dynamic Iteration Count
```
Start (output = "5") → Loop Start (override enabled) → ... → Loop End → End
```
- **Loop Start**: Iterations = 1 (fallback), Override Iterations = true
- The Start node's numeric output overrides the loop count at runtime.

## Troubleshooting

### Loop Never Terminates (While Mode)
- **Cause**: Collection variable never becomes empty.
- **Solution**: Ensure the loop body updates the collection (e.g., removes items). Add a Max Safe Iterations limit to prevent infinite loops.

### Loop Variable Not Available
- **Cause**: Misspelled variable name or using the wrong variable.
- **Solution**: Verify the Loop Variable Name matches the placeholder used in child nodes (e.g., `${i}`).

### Override Iterations Not Working
- **Cause**: Override port not connected or non‑numeric input.
- **Solution**: Connect a node with numeric output (e.g., Start node with `5`) to the left input port of Loop Start. Ensure the input is a valid integer.

### Loop Body Executes Only Once (Fixed Mode)
- **Cause**: Iterations set to 1 (default).
- **Solution**: Increase the Iterations field or enable override.

### Loop Body Not Executing at All (While Mode)
- **Cause**: Collection variable is empty or undefined at loop start.
- **Solution**: Verify the variable is populated before the loop. Use a Variable node to initialize the collection.

### Performance Issues with Large Iterations
- **Cause**: High iteration count (e.g., 100) with heavy nodes.
- **Solution**: Reduce iterations, or consider batching items in the collection variable.

## Related Documentation
- [Workflow Design](../workflow-design.md) – Understanding loop placement in graphs
- [Condition Nodes](condition-nodes.md) – Using conditions inside loops
- [CLI Nodes](cli-nodes.md) – Updating collection variables via CLI
- [Variables & State](../variables-state.md) – Managing loop variables and collections
