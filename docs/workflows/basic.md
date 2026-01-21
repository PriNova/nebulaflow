# Basic Workflow Examples

This guide provides simple workflow examples to help you understand the core concepts of NebulaFlow.

## Example 1: Simple Greeting Workflow

### Goal
Generate a greeting message using an LLM and display it.

### Workflow Structure
```
Start → LLM Node → CLI Node (Shell) → End
```

### Step-by-Step Setup

1. **Add Start Node**
   - Drag from palette to canvas
   - No configuration needed

2. **Add LLM Node**
   - Drag from palette
   - Configure:
     - Model: `openai/gpt-4o` (or any available model)
     - System Prompt: "You are a friendly assistant."
     - User Prompt: "Generate a warm greeting for a new user."
     - Temperature: 0.7

3. **Add CLI Node**
   - Drag from palette
   - Configure:
     - Content: `echo "${1}"` (the full command line; `${1}` refers to the first parent output)
     - (Optional) Mode: command (default)
     - (Optional) Shell: bash (default)

4. **Add End Node**
   - Drag from palette
   - No configuration needed

5. **Connect Nodes**
   - Connect Start → LLM
   - Connect LLM → CLI
   - Connect CLI → End

### Execution
Click the Run button. The LLM will generate a greeting, and the CLI node will print it.

## Example 2: File Processing Workflow

### Goal
Read a file, process it with an LLM, and save the result.

### Workflow Structure
```
Start → CLI (Read) → LLM (Process) → CLI (Write) → End
```

### Step-by-Step Setup

1. **Start Node** - Default

2. **CLI Node (Read)**
   - Content: `cat input.txt` (the full command line)
   - (Optional) Mode: command (default)
   - (Optional) Shell: bash (default)

3. **LLM Node**
   - Model: `openai/gpt-4o` (or any available model)
   - System Prompt: "You are a text processor. Summarize the following text concisely."
   - User Prompt: `${1}` (the output from CLI Read)
   - Temperature: 0.5

4. **CLI Node (Write)**
   - Content: `echo "${1}" > summary.txt` (where `${1}` is the LLM output)
   - (Optional) Mode: command (default)
   - (Optional) Shell: bash (default)

5. **End Node** - Default

### Execution
The workflow reads a file, generates a summary, and saves it to a new file.

## Example 3: Conditional Processing

### Goal
Process data differently based on its content.

### Workflow Structure
```
Start → LLM (Analyze) → If/Else → [True] LLM (Process A)
                                   → [False] LLM (Process B)
                                    → End
```

### Step-by-Step Setup

1. **Start Node** - Default

2. **LLM Node (Analyze)**
- Model: `openai/gpt-4o` (or any available model)
- System Prompt: "Analyze the following text and determine if it's positive or negative."
- User Prompt: `${1}` (the output from Start Node)
- Temperature: 0.3

3. **If/Else Node**
- Content: `${1} == "positive"` (where `${1}` is the output from LLM Analyze)
- True Branch: Connect to LLM Node A
- False Branch: Connect to LLM Node B

4. **LLM Node A (Positive)**
- System Prompt: "Generate an encouraging response."
- User Prompt: `${1}` (the output from LLM Analyze)

5. **LLM Node B (Negative)**
- System Prompt: "Generate a supportive response."
- User Prompt: `${1}` (the output from LLM Analyze)

6. **End Node** - Default

### Execution
The workflow analyzes input text and routes it to different processing paths based on sentiment.

## Example 4: Looping Workflow

### Goal
Process multiple items in a list.

### Workflow Structure
```
Start → Loop Start → LLM (Process) → CLI (Save) → Loop End → End
```

### Step-by-Step Setup

1. **Start Node**
- Output: (optional) can be used to override iteration count
- Example: `3` (if using override)

2. **Loop Start Node**
- Iterations: `3` (fixed number of iterations)
- Loop Variable: `i` (available as `${i}` in loop body)
- Loop Mode: `fixed`
   - (Optional) Override iterations: connect a parent node to the special input port

3. **LLM Node**
- System Prompt: "Generate a greeting for iteration ${i}."
   - User Prompt: `Iteration ${i}` (or any content)
   - Temperature: 0.7

4. **CLI Node**
   - Content: `echo "${1}" >> results.txt` (where `${1}` is the LLM output)
   - (Optional) Mode: command (default)

5. **Loop End Node**
   - No configuration needed

6. **End Node** - Default

### Execution
The workflow runs the loop body 3 times, each time using the iteration index `${i}`. The LLM generates a greeting, and the CLI appends it to a file.

## Example 5: API Integration

### Goal
Fetch data from an API and process it.

### Workflow Structure
```
Start → CLI (Fetch) → LLM (Analyze) → CLI (Send) → End
```

### Step-by-Step Setup

1. **Start Node** - Default

2. **CLI Node (Fetch)**
   - Content: `curl https://api.example.com/data`
   - (Optional) Mode: command (default)

3. **LLM Node**
   - System Prompt: "Analyze the following JSON data and extract the main insights."
   - User Prompt: `${1}` (the output from CLI Fetch)
   - Temperature: 0.5

4. **CLI Node (Send)**
   - Content: `curl -X POST -H "Content-Type: application/json" -d '${1}' https://api.example.com/insights`
   - (Optional) Mode: command (default)
   - (Optional) Shell: bash (default)

5. **End Node** - Default

### Execution
The workflow fetches data, analyzes it with an LLM, and sends the insights to another API using a CLI node with curl.

## Common Patterns

### Sequential Processing
```
A → B → C → D
```
Simple linear flow where each node processes the output of the previous one.

### Branching
```
A → B → C
    ↘ D → E
```
Conditional branching based on node output.

### Parallel Execution
```
A → B → C
A → D → E
```
Multiple paths from the same node (requires careful data handling).

### Looping
```
A → Loop Start → B → C → Loop End
```
Repeating operations on multiple items.

## Best Practices

### Start Simple
- Begin with 2-3 nodes
- Test each node individually
- Add complexity gradually

### Test Incrementally
- Run the workflow after each node addition
- Check intermediate outputs
- Use Preview nodes for debugging

### Handle Errors
- Add condition nodes for error checking
- Use try-catch patterns where possible
- Log errors for troubleshooting

### Optimize Performance
- Batch operations when possible
- Use appropriate delays
- Cache results when reused

## Next Steps

- [Advanced Workflows](advanced.md) - More complex patterns
- [Integration Examples](integrations/index.md) - External service integration
- [Node Types](../user-guide/nodes/index.md) - Detailed node documentation
