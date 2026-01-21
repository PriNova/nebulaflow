# Basic Workflow Examples

This guide provides simple workflow examples to help you understand the core concepts of NebulaFlow.

## Example 1: Simple Greeting Workflow

### Goal
Generate a greeting message using an LLM and display it.

### Workflow Structure
```
Start → LLM Node → CLI Node → End
```

### Step-by-Step Setup

1. **Add Start Node**
   - Drag from palette to canvas
   - No configuration needed

2. **Add LLM Node**
   - Drag from palette
   - Configure:
     - Model: gpt-4o
     - System Prompt: "You are a friendly assistant."
     - User Prompt: "Generate a warm greeting for a new user."
     - Temperature: 0.7

3. **Add CLI Node**
   - Drag from palette
   - Configure:
     - Command: `echo`
     - Arguments: `{{llmNode.output}}`

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
   - Command: `cat`
   - Arguments: `input.txt`
   - Working Directory: `./`

3. **LLM Node**
   - Model: gpt-4o
   - System Prompt: "You are a text processor. Summarize the following text concisely."
   - User Prompt: `{{cliRead.output}}`
   - Temperature: 0.5

4. **CLI Node (Write)**
   - Command: `echo`
   - Arguments: `{{llmNode.output}} > summary.txt`
   - Working Directory: `./`

5. **End Node** - Default

### Execution
The workflow reads a file, generates a summary, and saves it to a new file.

## Example 3: Conditional Processing

### Goal
Process data differently based on its content.

### Workflow Structure
```
Start → LLM (Analyze) → Condition → [True] LLM (Process A)
                                   → [False] LLM (Process B)
                                    → End
```

### Step-by-Step Setup

1. **Start Node** - Default

2. **LLM Node (Analyze)**
   - Model: gpt-4o
   - System Prompt: "Analyze the following text and determine if it's positive or negative."
   - User Prompt: `{{startNode.output}}`
   - Temperature: 0.3

3. **Condition Node**
   - Condition: `{{llmAnalyze.output}} == "positive"`
   - True Branch: Connect to LLM Node A
   - False Branch: Connect to LLM Node B

4. **LLM Node A (Positive)**
   - System Prompt: "Generate an encouraging response."
   - User Prompt: `{{llmAnalyze.output}}`

5. **LLM Node B (Negative)**
   - System Prompt: "Generate a supportive response."
   - User Prompt: `{{llmAnalyze.output}}`

6. **End Node** - Default

### Execution
The workflow analyzes input text and routes it to different processing paths based on sentiment.

## Example 4: Looping Workflow

### Goal
Process multiple items in a list.

### Workflow Structure
```
Start → Loop → LLM (Process) → CLI (Save) → Loop End → End
```

### Step-by-Step Setup

1. **Start Node**
   - Output: Array of items to process
   - Example: `["item1", "item2", "item3"]`

2. **Loop Node**
   - Type: Foreach
   - Input: `{{startNode.output}}`
   - Delay: 1 second (to avoid rate limits)

3. **LLM Node**
   - System Prompt: "Process this item and extract key information."
   - User Prompt: `{{loopNode.currentItem}}`

4. **CLI Node**
   - Command: `echo`
   - Arguments: `{{llmNode.output}} >> results.txt`

5. **End Node** - Default

### Execution
The workflow processes each item in the list sequentially, saving results to a file.

## Example 5: API Integration

### Goal
Fetch data from an API and process it.

### Workflow Structure
```
Start → CLI (Fetch) → LLM (Analyze) → API (Send) → End
```

### Step-by-Step Setup

1. **Start Node** - Default

2. **CLI Node (Fetch)**
   - Command: `curl`
   - Arguments: `https://api.example.com/data`

3. **LLM Node**
   - System Prompt: "Analyze the following JSON data and extract the main insights."
   - User Prompt: `{{cliFetch.output}}`
   - Temperature: 0.5

4. **API Node**
   - Endpoint: `https://api.example.com/insights`
   - Method: POST
   - Body: `{{llmNode.output}}`
   - Headers: `Content-Type: application/json`

5. **End Node** - Default

### Execution
The workflow fetches data, analyzes it with an LLM, and sends the insights to another API.

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
A → Loop → B → C → Loop End
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
- Use log nodes for debugging

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
