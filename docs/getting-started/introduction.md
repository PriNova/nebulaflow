# Introduction to NebulaFlow

## What is NebulaFlow?

NebulaFlow is a VS Code extension that enables you to design and run LLM+CLI workflows as visual node graphs. It provides an intuitive webview interface where you can connect nodes representing different operations and execute them in sequence.

## Key Features

- **Visual Workflow Design**: Drag and drop nodes to create complex workflows
- **LLM Integration**: Connect to LLM nodes for intelligent processing using Amp SDK and OpenRouter SDK
- **CLI Execution**: Run shell commands as part of your workflow
- **Conditional Logic**: Add decision points and branching logic with If/Else nodes
- **Loop Support**: Create iterative workflows for repetitive tasks with Loop Start and Loop End nodes
- **Real-time Execution**: Monitor workflow execution with streaming events
- **Approval System**: Control when sensitive operations run (CLI nodes require approval)
- **Subflows**: Create reusable workflow components
- **Variables & Accumulators**: Store and manipulate data across workflow execution

## Use Cases

- **Content Generation**: Chain LLM calls for complex content creation
- **Data Processing**: Combine CLI tools with LLM analysis
- **Automation**: Automate repetitive development tasks
- **Testing**: Create automated test workflows
- **CI/CD Integration**: Integrate with your existing development pipeline

## Architecture

NebulaFlow consists of two main components:

1. **VS Code Extension**: Runs in VS Code, manages the webview interface and workflow execution
2. **Webview UI**: React-based interface using React Flow for visual graph editing

The extension uses the Amp SDK and OpenRouter SDK for LLM operations and executes CLI commands through the Node.js child_process API. Execution is orchestrated in the extension with streaming output, approval system, and real-time event handling.

## Available Nodes

NebulaFlow provides the following node types:

### Agent Nodes
- **LLM Node**: Interact with Large Language Models (requires AMP_API_KEY)

### Shell Nodes
- **CLI Node**: Execute shell commands (requires approval for execution)

### Text Nodes
- **Text Node**: Input text data (formerly "Input Node")
- **Accumulator Node**: Accumulate text across multiple inputs
- **Variable Node**: Store and reference variables

### Logic Nodes
- **If/Else Node**: Branch workflow based on conditions
- **Loop Start Node**: Begin a loop iteration
- **Loop End Node**: End a loop iteration

### Preview Node
- **Preview Node**: Display data for debugging

### Subflow Nodes
- **Subflow Node**: Embed a reusable subflow
- **Subflow Input Node**: Define input ports for subflows
- **Subflow Output Node**: Define output ports for subflows

## Execution Model

NebulaFlow workflows execute with the following characteristics:

- **Streaming Output**: Real-time streaming of LLM responses and CLI output
- **Approval System**: CLI nodes require user approval before execution
- **Parallel Execution**: Nodes execute in parallel when dependencies are satisfied
- **Pause/Resume**: Workflows can be paused and resumed from any node
- **Error Handling**: Graceful error handling with detailed error messages

## Getting Started

To get started with NebulaFlow:

1. Install the extension from the VS Code marketplace
2. Open the NebulaFlow panel (View → NebulaFlow)
3. Create a new workflow or open an existing one
4. Add nodes from the sidebar palette
5. Connect nodes to define the execution flow
6. Execute the workflow and monitor the results

For detailed installation instructions, see [Installation](installation.md).

## Next Steps

- [Installation Guide](installation.md) - Install and configure NebulaFlow
- [Quick Start](quick-start.md) - Build your first workflow
- [User Guide](../user-guide/workflow-design.md) - Learn about workflow design patterns
