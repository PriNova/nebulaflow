# Connections

Connections in NebulaFlow define the data flow and execution order between nodes in a workflow. They are represented as edges in the visual graph editor and determine how outputs from one node become inputs to another.

## Connection Basics

### Visual Representation
- **Edges**: Lines connecting nodes in the workflow graph
- **Handles**: Connection points on nodes (top for inputs, bottom for outputs)
- **Direction**: Edges flow from source (output) to target (input)

### Edge Properties
Each connection has the following properties:
- **ID**: Unique identifier (format: `{sourceNodeId}-{targetNodeId}`)
- **Source**: The node producing output
- **Target**: The node receiving input
- **Source Handle**: Specific output port on the source node
- **Target Handle**: Specific input port on the target node

## Node Connection Patterns

### Standard Nodes (Single Input/Output)
Most nodes follow a simple pattern with one input and one output:

**Input Handle**: `target` (top position)
**Output Handle**: `source` (bottom position)

**Supported Nodes**:
- **CLI Node**: Executes shell commands
- **LLM Node**: Processes with AI models
- **Preview Node**: Displays output
- **Text Node**: Provides text input
- **Accumulator Node**: Collects data
- **Variable Node**: Stores values
- **Subflow Node**: References external workflows

**Example**:
```
[Node A] --(source)--> (target)[Node B]
```

### Fan-In Nodes (Multiple Inputs)
Some nodes support multiple incoming connections (fan-in):

**Supported Nodes**:
- **CLI Node**: Can receive from multiple parents
- **LLM Node**: Can receive from multiple parents
- **Preview Node**: Can receive from multiple parents
- **Text Node**: Can receive from multiple parents
- **Accumulator Node**: Can receive from multiple parents
- **Subflow Node**: Can receive from multiple parents

**Handle Pattern**:
- Multiple input handles: `in-0`, `in-1`, `in-2`, ...
- Handles are positioned horizontally across the top
- Connections must be made to the rightmost free handle
- Handles are added dynamically as connections are made

**Example**:
```
[Node A] --(source)--> (in-0)[Node B]
[Node C] --(source)--> (in-1)[Node B]
```

### Multi-Output Nodes (Fan-Out)
Some nodes have multiple output ports for conditional branching:

**Supported Nodes**:
- **If/Else Node**: Has `true` and `false` output handles

**Handle Pattern**:
- Multiple output handles: `true`, `false`
- Positioned at bottom: `true` at 25%, `false` at 75%

**Example**:
```
[If/Else Node]
    |--(true)--> [Node A]
    |--(false)--> [Node B]
```

### Special Connection Types

#### Loop Iteration Override
**Loop Start Node** has a special input handle for dynamic iteration count:

- **Handle ID**: `iterations-override`
- **Position**: Left side, near bottom
- **Purpose**: Connect an Input node to override loop iterations at runtime
- **Data Format**: Integer value (1-100, clamped)

**Example**:
```
[Input Node] --(source)--> (iterations-override)[Loop Start]
```

## Connection Validation Rules

### Prevented Connections
The system enforces several validation rules to maintain workflow integrity:

1. **Self-Loops**: Cannot connect a node to itself
   ```
   ❌ [Node A] --> (target)[Node A]
   ```

2. **Duplicate Edges**: Cannot create identical connections
   ```
   ❌ [Node A] --> [Node B] (already exists)
   ```

3. **Fan-In Handle Order**: For fan-in nodes, connections must be made to the rightmost free handle
   ```
   ✅ [Node A] --> (in-0)[Node B]
   ✅ [Node C] --> (in-1)[Node B]  (in-0 is already used)
   ❌ [Node C] --> (in-0)[Node B]  (in-0 is already used)
   ```

4. **Invalid Target Handle**: Cannot connect to body of fan-in node (must target specific handle)
   ```
   ❌ [Node A] --> (body)[Node B]  (fan-in requires specific handle)
   ✅ [Node A] --> (in-0)[Node B]
   ```

### Validation Logic
The `isValidEdgeConnection` function in `edgeValidation.ts` performs these checks:
- Validates source and target are different nodes
- Checks fan-in constraints for target nodes
- Prevents duplicate edges with same endpoints and handles
- Ensures proper handle targeting for fan-in nodes

## Edge Ordering

### Ordered Edges
Edges are ordered by their position in the target node's input list:

**Data Structure**:
```typescript
interface IndexedOrder {
    bySourceTarget: Map<string, number>  // "sourceId-targetId" -> order
    byTarget: Map<string, Edge[]>        // targetId -> ordered edges
}
```

**Ordering Rules**:
1. Edges are sorted by their position in the target's input list
2. First connection gets order 1, second gets order 2, etc.
3. Order is used for:
   - Visual rendering (z-index)
   - Execution priority (when multiple inputs available)
   - Template variable indexing (`${1}`, `${2}`, etc.)

**Example**:
```
Target Node B receives:
- Edge from Node A: order 1 → ${1}
- Edge from Node C: order 2 → ${2}
- Edge from Node D: order 3 → ${3}
```

### Execution Priority
When a node has multiple inputs, the order affects:
- **Template Variables**: `${1}` refers to the first input (order 1)
- **Execution Flow**: In parallel execution, lower order may execute first
- **Data Flow**: Inputs are processed in order

## Connection Workflow

### Creating Connections
1. **Drag from Source**: Click and drag from a source handle (bottom of node)
2. **Drop on Target**: Release on a target handle (top of node)
3. **Validation**: System validates the connection
4. **Edge Creation**: If valid, edge is created and added to graph

### Modifying Connections
1. **Delete**: Select edge and press Delete/Backspace
2. **Reconnect**: Drag from one handle to another
3. **Update**: Edges update automatically when nodes are moved

### Connection States
- **Active**: Connected and participating in execution
- **Inactive**: Node is disabled (`active: false`)
- **Pending**: Node is waiting for input
- **Executing**: Data flowing through connection

## Data Flow Through Connections

### Output Propagation
When a node executes successfully:
1. Output is captured from the node's execution
2. Output is sent to all connected target nodes
3. Target nodes receive output via their input handles
4. Outputs are indexed by connection order

### Input Processing
Target nodes process inputs based on configuration:
- **Template Variables**: `${1}`, `${2}`, etc. reference inputs by order
- **Environment Variables**: In CLI scripts, inputs map to `INPUT_1`, `INPUT_2`, etc.
- **Stdin**: Can consume all parent outputs or specific ones
- **Structured Data**: Supports any text output from previous nodes

### Example Data Flow
```
[CLI: git diff] --(output)--> (in-0)[LLM: Generate Message] --(output)--> (in-0)[CLI: git commit]
```

1. `git diff` executes and produces diff output
2. Output flows to LLM node as `${1}`
3. LLM processes diff and generates commit message
4. Message flows to commit CLI as `${1}`
5. Commit command executes with message

## Connection Patterns

### Linear Flow
Simple sequential execution:
```
[A] → [B] → [C] → [D]
```

### Branching
Conditional execution based on If/Else:
```
[A] → [If/Else] → [B] (true)
                    [C] (false)
```

### Merging
Multiple inputs converging (fan-in):
```
[A] → [Merge]
[B] → [Merge] → [C]
[D] → [Merge]
```

### Looping
Iterative execution:
```
[A] → [Loop Start] → [B] → [C] → [Loop End] → [D]
         ↑_____________________________|
```

### Override Pattern
Dynamic loop iterations:
```
[Input: 5] --(iterations-override)--> [Loop Start]
```

## Connection Troubleshooting

### Common Issues

#### Connection Rejected
**Symptom**: Edge doesn't appear when dropping
**Causes**:
- Self-loop attempted
- Duplicate edge already exists
- Fan-in handle already occupied
- Invalid target handle for fan-in node

**Solution**: Check validation rules and use correct handles

#### Wrong Handle Selected
**Symptom**: Connection doesn't work as expected
**Causes**:
- Connecting to body instead of handle
- Using wrong handle ID (e.g., `in-0` vs `in-1`)
- Connecting to disabled handle

**Solution**: Hover over handles to see tooltips, use correct handle IDs

#### Data Not Flowing
**Symptom**: Node doesn't receive expected input
**Causes**:
- Edge order incorrect (wrong `${n}` mapping)
- Parent node failed or didn't execute
- Node is inactive (`active: false`)
- Template variable syntax incorrect

**Solution**: Check node execution status and template variable syntax

#### Execution Order Wrong
**Symptom**: Nodes execute in unexpected order
**Causes**:
- Edge ordering not respected
- Parallel execution conflicts
- Loop structure issues

**Solution**: Review edge ordering and loop configuration

### Debugging Connections

#### Visual Inspection
1. **Check Edge Visibility**: Ensure edges are visible in graph
2. **Verify Handles**: Hover over handles to see connection IDs
3. **Review Order**: Check edge order numbers (if displayed)

#### Execution Logs
1. **Node Status**: Check if nodes executed successfully
2. **Output Values**: Verify outputs were generated
3. **Input Reception**: Confirm target nodes received inputs

#### Edge Validation
1. **Run Validation**: Use edge validation function to check rules
2. **Check Handles**: Verify handle IDs match expected pattern
3. **Review Configuration**: Ensure nodes support the connection type

## Best Practices

### Connection Design
1. **Clear Flow**: Design workflows with logical data flow
2. **Avoid Cycles**: Be careful with loops to prevent infinite cycles
3. **Use Meaningful Names**: Name nodes clearly to understand connections
4. **Document Complex Flows**: Add comments or notes for complex connections

### Handle Selection
1. **Use Standard Handles**: Prefer `source`/`target` for simple nodes
2. **Respect Fan-In Order**: Connect to rightmost free handle
3. **Use Special Handles**: Use `iterations-override` for dynamic loops
4. **Check Handle Availability**: Verify handles are enabled before connecting

### Edge Ordering
1. **Plan Order**: Think about input order before connecting
2. **Use Consistent Order**: Keep similar patterns consistent
3. **Document Order**: Note which input maps to which `${n}` variable
4. **Test Data Flow**: Verify template variables work as expected

### Error Prevention
1. **Validate Early**: Check connections before execution
2. **Test Incrementally**: Build and test workflows step by step
3. **Use Preview Nodes**: Add preview nodes to debug data flow
4. **Check Node Status**: Ensure all nodes are active before execution

## Configuration Examples

### Basic Connection
```typescript
{
  id: "edge-1",
  source: "node-a-id",
  target: "node-b-id",
  sourceHandle: "source",
  targetHandle: "target",
  data: { edgeStyle: "bezier" }
}
```

### Fan-In Connection
```typescript
{
  id: "edge-1",
  source: "node-a-id",
  target: "node-b-id",
  sourceHandle: "source",
  targetHandle: "in-0",  // First input
  data: { edgeStyle: "bezier" }
}
```

### If/Else Branch
```typescript
// True branch
{
  id: "edge-true",
  source: "if-else-id",
  target: "node-a-id",
  sourceHandle: "true",
  targetHandle: "target",
  data: { edgeStyle: "bezier" }
}

// False branch
{
  id: "edge-false",
  source: "if-else-id",
  target: "node-b-id",
  sourceHandle: "false",
  targetHandle: "target",
  data: { edgeStyle: "bezier" }
}
```

### Loop Override
```typescript
{
  id: "edge-override",
  source: "input-id",
  target: "loop-start-id",
  sourceHandle: "source",
  targetHandle: "iterations-override",
  data: { edgeStyle: "bezier" }
}
```

## Related Topics

- [Workflow Design](workflow-design.md) - Learn about designing effective workflows
- [Node Types](nodes/index.md) - Understand available node types and their connection patterns
- [Execution Model](../getting-started/architecture.md) - Learn how connections affect execution
- [Variables & State](variables-state.md) - Understand how data flows through connections
