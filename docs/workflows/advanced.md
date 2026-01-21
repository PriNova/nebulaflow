# Advanced Workflows

## Overview

Advanced workflows in NebulaFlow leverage sophisticated execution patterns to handle complex scenarios. This guide covers subflows, loops, parallel execution, conditional branching, and hybrid execution models.

## Subflows

### What are Subflows?

Subflows are reusable workflow components that encapsulate a graph of nodes. They function like functions in programming - you define them once and reuse them multiple times.

### Creating Subflows

#### Method 1: From Selection

1. **Select nodes** in the workflow canvas
2. **Right-click** and choose "Create Subflow from Selection"
3. **Configure ports** - The system automatically creates input/output ports
4. **Save** the subflow with a name and version

#### Method 2: Manual Creation

1. **Add Subflow Input nodes** to define input ports
2. **Add Subflow Output nodes** to define output ports
3. **Build your workflow** inside the subflow
4. **Save** the subflow definition

### Subflow Structure

```
Subflow Definition
├── Inputs (SubflowInput nodes)
│   ├── port1: string
│   ├── port2: number
│   └── ...
├── Internal Graph
│   ├── Node A
│   ├── Node B
│   └── Node C
└── Outputs (SubflowOutput nodes)
    ├── result1: string
    └── result2: number
```

### Using Subflows

1. **Add a Subflow node** to your main workflow
2. **Select the subflow** from the available subflows list
3. **Connect inputs** - Connect your data to the subflow's input ports
4. **Use outputs** - Connect the subflow's output ports to downstream nodes

### Subflow Ports

#### Input Ports

- **Created automatically** when you create a subflow from selection
- **Can be reordered** via the Subflow Outputs Editor
- **Support fan-in** - Multiple nodes can connect to a single input port

#### Output Ports

- **Created automatically** when you create a subflow from selection
- **Can be renamed and reordered** via the Subflow Outputs Editor
- **Support fan-out** - A single output port can connect to multiple nodes

### Subflow Execution

Subflows execute as a unit:

1. **Input data** is passed to the subflow's input ports
2. **Internal nodes** execute in topological order
3. **Output data** is collected from output ports
4. **Results** are passed to downstream nodes

### Subflow State Management

Subflows maintain their own execution state:

```typescript
interface SubflowDefinitionDTO {
    id: string
    title: string
    version: string
    inputs: SubflowPortDTO[]
    outputs: SubflowPortDTO[]
    graph: SubflowGraphDTO
}
```

### Subflow Best Practices

1. **Keep subflows focused** - Each subflow should have a single responsibility
2. **Use descriptive names** - Include version numbers for tracking
3. **Document inputs/outputs** - Use clear port names
4. **Test subflows independently** - Verify behavior before embedding
5. **Version control** - Store subflows in version control

## Loops

### Loop Nodes

NebulaFlow provides two loop nodes:

- **Loop Start Node** (`NodeType.LOOP_START`) - Begins a loop iteration
- **Loop End Node** (`NodeType.LOOP_END`) - Ends a loop iteration

### Loop Configuration

#### Loop Start Node Properties

```typescript
interface LoopStartNode {
    type: NodeType.LOOP_START
    data: {
        iterations: number
        loopVariable: string
        overrideIterations?: boolean
        loopMode?: 'fixed' | 'while-variable-not-empty'
        collectionVariable?: string
        maxSafeIterations?: number
    }
}
```

**Properties:**
- `iterations`: Number of iterations to run (for fixed mode)
- `loopVariable`: Variable name for the current iteration
- `overrideIterations`: Allow runtime override of iteration count
- `loopMode`: Execution mode
  - `'fixed'`: Run for a fixed number of iterations
  - `'while-variable-not-empty'`: Run while a variable is not empty
- `collectionVariable`: Variable containing collection to iterate over (for while mode)
- `maxSafeIterations`: Safety limit to prevent infinite loops

### Loop Execution Modes

#### Fixed Iteration Mode

Runs a fixed number of times:

```
Loop Start (iterations=5, loopVariable='i')
    └── Body nodes
Loop End
```

**Example:**
- iterations: 5
- loopVariable: 'i'
- Body executes 5 times with i = 0, 1, 2, 3, 4

#### While Variable Not Empty Mode

Runs while a variable is not empty:

```
Loop Start (loopMode='while-variable-not-empty', collectionVariable='items')
    └── Body nodes
Loop End
```

**Example:**
- collectionVariable: 'items'
- Body executes until 'items' becomes empty

### Loop Variables

Loop variables are accessible within the loop body using `${loopVariable}` syntax:

```
Loop Start (loopVariable='i')
    └── LLM Node: "Process item ${i}"
Loop End
```

### Loop Safety

#### Maximum Safe Iterations

To prevent infinite loops, you can set a maximum iteration limit:

```typescript
{
    iterations: 100,
    maxSafeIterations: 1000  // Safety limit
}
```

#### Override Iterations

Allow runtime override of iteration count:

```typescript
{
    iterations: 10,
    overrideIterations: true  // Can be overridden at runtime
}
```

### Loop Execution Flow

1. **Loop Start** initializes loop state
2. **Loop body** executes for each iteration
3. **Loop variables** are updated each iteration
4. **Loop End** signals iteration completion
5. **Loop Start** checks if more iterations needed

### Loop Best Practices

1. **Set reasonable iteration limits** - Avoid infinite loops
2. **Use descriptive loop variables** - Makes debugging easier
3. **Test with small iterations first** - Verify behavior before scaling
4. **Monitor token usage** - Loops can accumulate costs quickly
5. **Consider subflows for complex loops** - Keep loops focused

## Parallel Execution

### Execution Engine

NebulaFlow uses a **parallel execution engine** that:

1. **Analyzes the graph** to identify parallel execution paths
2. **Computes parallel steps** using Kahn's algorithm
3. **Executes nodes in waves** respecting dependencies
4. **Respects per-node-type limits** to prevent resource exhaustion

### Kahn's Algorithm

The execution engine uses **Kahn's algorithm** for topological sorting:

```
1. Compute in-degree for each node
2. Queue nodes with zero in-degree
3. Process queue:
   - Execute node
   - Decrease in-degree of neighbors
   - Add nodes with zero in-degree to queue
4. Repeat until all nodes processed
```

### Parallel Steps

Nodes are grouped into **parallel steps** (waves):

```
Step 0: [Node A, Node B]  (no dependencies)
Step 1: [Node C, Node D]  (depend on A and B)
Step 2: [Node E]          (depends on C and D)
```

Nodes within the same step can execute in parallel.

### Concurrency Limits

#### Global Concurrency

Limit total concurrent nodes:

```typescript
const options = {
    concurrency: 10  // Max 10 nodes at once
}
```

#### Per-Type Concurrency

Limit concurrent nodes by type:

```typescript
const options = {
    perType: {
        [NodeType.LLM]: 8,    // Max 8 LLM nodes
        [NodeType.CLI]: 8,    // Max 8 CLI nodes
        [NodeType.LLM]: 4,    // Max 4 LLM nodes (override)
    }
}
```

**Default limits:**
- LLM nodes: 8 concurrent
- CLI nodes: 8 concurrent

### Error Policies

#### Fail-Fast (Default)

Cancels all in-flight tasks on first error:

```typescript
const options = {
    onError: 'fail-fast'
}
```

**Use when:** Errors should stop the entire workflow

#### Continue-Subgraph

Continues other subgraphs on error:

```typescript
const options = {
    onError: 'continue-subgraph'
}
```

**Use when:** Independent branches should continue on error

### Branch Subgraphs

The engine identifies **branch subgraphs** for conditional execution:

```
IF Node
├── True Branch: [Node A, Node B]
└── False Branch: [Node C, Node D]
```

Each branch can execute independently once the IF condition is evaluated.

### Parallel Analysis

The engine performs **parallel analysis** to:

1. **Identify parallel steps** - Group nodes that can run together
2. **Detect cycles** - Handle cyclic dependencies gracefully
3. **Optimize execution** - Minimize total execution time

### Hybrid Execution

For workflows with **loops**, NebulaFlow uses **hybrid execution**:

1. **Parallel execution** for non-loop nodes
2. **Sequential execution** for loop bodies
3. **Combined approach** for optimal performance

### Parallel Execution Flow

```
1. Analyze graph structure
2. Compute parallel steps
3. Execute step 0 (parallel)
4. Wait for step 0 completion
5. Execute step 1 (parallel)
6. Repeat until complete
```

### Parallel Best Practices

1. **Design for parallelism** - Minimize dependencies between nodes
2. **Use appropriate concurrency limits** - Balance speed and resource usage
3. **Monitor execution** - Watch for bottlenecks
4. **Test with different limits** - Find optimal configuration
5. **Consider error policies** - Choose based on workflow criticality

## Conditional Branching

### If/Else Nodes

The **If/Else Node** (`NodeType.IF_ELSE`) enables conditional execution:

```
IF Node
├── True Path → [Node A, Node B]
└── False Path → [Node C, Node D]
```

### Condition Evaluation

The If/Else node evaluates the **input value** as a boolean:

- **Truthy values**: Execute true path
- **Falsy values**: Execute false path

### Branch Execution

Once the condition is evaluated:

1. **True path** nodes are enabled
2. **False path** nodes are disabled
3. **Execution continues** along the active path

### Conditional Best Practices

1. **Keep conditions simple** - Complex logic should be in LLM nodes
2. **Document branch logic** - Use clear node titles
3. **Test both paths** - Verify both true and false scenarios
4. **Consider subflows** - For complex conditional logic

## Fan-in and Fan-out

### Fan-in (Multiple Inputs)

Nodes can accept **multiple inputs**:

```
Node A ──┐
Node B ──┤ → Node D
Node C ──┘
```

**Supported by:**
- LLM nodes
- CLI nodes
- Preview nodes
- Accumulator nodes
- Text nodes

### Fan-out (Multiple Outputs)

Nodes can produce **multiple outputs**:

```
Node A ──┐
          ├→ Node C
Node B ──┘
```

**Supported by:**
- Subflow nodes (multiple output ports)
- If/Else nodes (true/false branches)

### Fan-in Implementation

The engine tracks **input edge counts** and **completion status**:

1. **Wait for all inputs** - Node executes when all inputs are ready
2. **Combine inputs** - Concatenate or process multiple inputs
3. **Execute node** - Process combined data

### Fan-out Implementation

The engine tracks **output distribution**:

1. **Execute node** - Produce output
2. **Distribute output** - Send to all connected nodes
3. **Track dependencies** - Ensure downstream nodes wait for all inputs

## Hybrid Execution Models

### Sequential vs Parallel

NebulaFlow supports both execution models:

**Sequential:**
- Simple, predictable execution
- Lower resource usage
- Easier debugging

**Parallel:**
- Faster execution
- Better resource utilization
- More complex scheduling

### Hybrid Approach

For complex workflows, NebulaFlow uses a **hybrid approach**:

1. **Parallel execution** for independent nodes
2. **Sequential execution** for dependent nodes
3. **Loop handling** with special scheduling

### Loop-Parallel Hybrid

For workflows with loops:

```
Parallel Step 0: [Node A, Node B]
Parallel Step 1: [Loop Start]
Sequential Step 2: [Loop Body - iterations]
Parallel Step 3: [Loop End, Node C]
```

### Execution Modes

#### Mode 1: Pure Parallel

For workflows **without loops**:

```typescript
executeWorkflowParallel(nodes, edges, callbacks, {
    concurrency: 10,
    perType: { [NodeType.LLM]: 8, [NodeType.CLI]: 8 }
})
```

#### Mode 2: Hybrid with Loops

For workflows **with loops**:

```typescript
executeWorkflowParallel(nodes, edges, callbacks, {
    concurrency: 10,
    perType: { [NodeType.LLM]: 8, [NodeType.CLI]: 8 }
})
// Automatically detects loops and uses hybrid execution
```

#### Mode 3: Sequential Fallback

For workflows **with unsupported nodes**:

```typescript
// Falls back to sequential execution
// Triggered by NEBULAFLOW_DISABLE_HYBRID_PARALLEL env var
```

### Performance Optimization

#### Concurrency Tuning

```typescript
// Conservative (safe)
const conservative = {
    concurrency: 5,
    perType: { [NodeType.LLM]: 3, [NodeType.CLI]: 3 }
}

// Aggressive (fast)
const aggressive = {
    concurrency: 20,
    perType: { [NodeType.LLM]: 10, [NodeType.CLI]: 10 }
}

// Balanced (recommended)
const balanced = {
    concurrency: 10,
    perType: { [NodeType.LLM]: 8, [NodeType.CLI]: 8 }
}
```

#### Error Policy Selection

```typescript
// Critical workflow (fail-fast)
const critical = {
    onError: 'fail-fast'
}

// Non-critical workflow (continue on error)
const nonCritical = {
    onError: 'continue-subgraph'
}
```

## Advanced Patterns

### Pattern 1: Parallel Processing

**Use case:** Process multiple items independently

```
Input Node (items)
    └── Loop Start (iterations=items.length)
        └── LLM Node (process item)
    └── Loop End
    └── Accumulator Node (collect results)
```

### Pattern 2: Conditional Parallel

**Use case:** Different processing paths based on condition

```
Input Node
    └── IF Node (condition)
        ├── True: [LLM A, CLI B] (parallel)
        └── False: [LLM C, CLI D] (parallel)
    └── Preview Node (combine results)
```

### Pattern 3: Subflow Reuse

**Use case:** Reusable processing logic

```
Main Workflow
    └── Subflow Node (Data Processor v1)
        ├── Input: Raw Data
        └── Output: Processed Data
    └── Subflow Node (Data Processor v1)  // Reuse same subflow
        ├── Input: More Data
        └── Output: More Processed Data
```

### Pattern 4: Hybrid Loop-Parallel

**Use case:** Parallel processing within loops

```
Loop Start (iterations=10)
    └── Parallel Step: [LLM A, CLI B]  // Process in parallel
Loop End
    └── Accumulator (collect all results)
```

## Configuration

### Environment Variables

#### Parallel Execution

```bash
# Disable hybrid parallel execution (fallback to sequential)
export NEBULAFLOW_DISABLE_HYBRID_PARALLEL=1

# Set default concurrency
export NEBULAFLOW_DEFAULT_CONCURRENCY=10

# Set per-type limits
export NEBULAFLOW_LLM_CONCURRENCY=8
export NEBULAFLOW_CLI_CONCURRENCY=8
```

#### Loop Safety

```bash
# Set maximum safe iterations (default: 1000)
export NEBULAFLOW_MAX_ITERATIONS=1000

# Enable loop iteration override
export NEBULAFLOW_ALLOW_ITERATION_OVERRIDE=1
```

### Runtime Configuration

#### Execution Options

```typescript
interface ParallelOptions {
    concurrency?: number
    perType?: Partial<Record<NodeType, number>>
    onError?: 'fail-fast' | 'continue-subgraph'
    seeds?: {
        outputs?: Record<string, string>
        decisions?: Record<string, 'true' | 'false'>
        variables?: Record<string, string>
    }
    pause?: { isPaused: () => boolean }
}
```

#### Loop Configuration

```typescript
interface LoopConfig {
    iterations: number
    loopVariable: string
    overrideIterations?: boolean
    loopMode?: 'fixed' | 'while-variable-not-empty'
    collectionVariable?: string
    maxSafeIterations?: number
}
```

## Monitoring and Debugging

### Execution Logs

Monitor execution with detailed logs:

```typescript
// Extension logs show:
// - Parallel step computation
// - Node execution status
// - Error handling
// - Loop iteration tracking
```

### Performance Metrics

Track execution metrics:

1. **Total execution time** - Overall workflow duration
2. **Parallel efficiency** - Speedup from parallel execution
3. **Resource usage** - Concurrent node counts
4. **Loop iterations** - Total iterations executed

### Debugging Tips

#### Parallel Issues

**Problem:** Nodes not executing in parallel
- **Check:** Dependencies between nodes
- **Solution:** Remove unnecessary dependencies

**Problem:** Too many concurrent nodes
- **Check:** Concurrency limits
- **Solution:** Adjust per-type limits

#### Loop Issues

**Problem:** Infinite loop
- **Check:** Loop condition and max iterations
- **Solution:** Set maxSafeIterations

**Problem:** Loop variable not accessible
- **Check:** Variable name syntax
- **Solution:** Use `${loopVariable}` syntax

#### Subflow Issues

**Problem:** Subflow not found
- **Check:** Subflow ID and version
- **Solution:** Refresh subflow list

**Problem:** Port connection issues
- **Check:** Port names and directions
- **Solution:** Verify input/output port matching

## Performance Considerations

### Parallel Execution Benefits

**Speedup potential:**
- Independent nodes: 2-10x faster
- Branching workflows: 1.5-3x faster
- With loops: 1.2-2x faster (hybrid)

**Resource usage:**
- CPU: Higher with parallel execution
- Memory: Higher with parallel execution
- Network: Similar to sequential

### Loop Performance

**Fixed iterations:**
- Linear scaling with iteration count
- Consider batch processing for large counts

**While loops:**
- Variable-dependent execution time
- Monitor for infinite loops

### Subflow Performance

**Reusable subflows:**
- No performance overhead
- Encourages modular design
- Easier to optimize

### Optimization Strategies

1. **Minimize dependencies** - Enable more parallelism
2. **Batch similar operations** - Reduce overhead
3. **Use appropriate concurrency** - Balance speed and resources
4. **Monitor and adjust** - Tune based on actual usage

## Troubleshooting

### Common Issues

#### Issue 1: Nodes Execute Sequentially

**Symptoms:** Workflow runs slower than expected

**Causes:**
- Too many dependencies
- Concurrency limits too low
- Loop nodes present

**Solutions:**
- Review node dependencies
- Increase concurrency limits
- Check for loop nodes

#### Issue 2: Infinite Loop

**Symptoms:** Workflow never completes

**Causes:**
- Loop condition never false
- Missing Loop End node
- Max iterations too high

**Solutions:**
- Verify loop condition
- Ensure Loop End exists
- Set maxSafeIterations

#### Issue 3: Subflow Not Found

**Symptoms:** Subflow node shows error

**Causes:**
- Subflow deleted
- Version mismatch
- Storage scope issue

**Solutions:**
- Refresh subflow list
- Check subflow ID
- Verify storage scope

#### Issue 4: Port Connection Failed

**Symptoms:** Cannot connect nodes to subflow

**Causes:**
- Port name mismatch
- Wrong port direction
- Port count mismatch

**Solutions:**
- Check port names
- Verify input/output directions
- Update port count

### Error Messages

#### "Unsupported node types for v1 parallel scheduler"

**Meaning:** Loop nodes present in workflow

**Action:** Workflow will use hybrid execution automatically

#### "Maximum iterations exceeded"

**Meaning:** Loop hit safety limit

**Action:** Review loop logic or increase maxSafeIterations

#### "Subflow not found"

**Meaning:** Subflow ID invalid or deleted

**Action:** Refresh subflow list or recreate subflow

## Best Practices

### Design Principles

1. **Start simple** - Add complexity incrementally
2. **Modular design** - Use subflows for reusable logic
3. **Clear dependencies** - Minimize unnecessary connections
4. **Test thoroughly** - Verify each component independently

### Performance Guidelines

1. **Profile first** - Identify bottlenecks before optimizing
2. **Use parallelism wisely** - Not all workflows benefit
3. **Monitor resource usage** - Adjust limits based on capacity
4. **Consider batch operations** - For large data sets

### Safety Guidelines

1. **Set iteration limits** - Prevent infinite loops
2. **Use fail-fast for critical workflows** - Stop on first error
3. **Test error scenarios** - Verify error handling
4. **Document assumptions** - Make workflow intent clear

### Maintenance Guidelines

1. **Version subflows** - Track changes over time
2. **Document workflows** - Explain design decisions
3. **Regular testing** - Catch regressions early
4. **Performance monitoring** - Track execution metrics

## Related Documentation

- [Node Types Reference](../api-reference/node-types.md) - Detailed node type documentation
- [Protocol Reference](../api-reference/protocol.md) - Message protocol for execution
- [Events Reference](../api-reference/events.md) - Event system documentation
- [Extension API Reference](../api-reference/extension.md) - Extension API details
