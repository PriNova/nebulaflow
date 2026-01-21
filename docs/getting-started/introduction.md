# Introduction to NebulaFlow

## What is NebulaFlow?

NebulaFlow is a VS Code extension that enables you to design and run LLM+CLI workflows as visual node graphs. It provides an intuitive webview interface where you can connect nodes representing different operations and execute them in sequence.

## Key Features

- **Visual Workflow Design**: Drag and drop nodes to create complex workflows
- **LLM Integration**: Connect to LLM nodes for intelligent processing
- **CLI Execution**: Run shell commands as part of your workflow
- **Conditional Logic**: Add decision points and branching logic
- **Loop Support**: Create iterative workflows for repetitive tasks
- **Real-time Execution**: Monitor workflow execution with streaming events
- **Approval System**: Control when sensitive operations run

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

The extension uses the Amp SDK and OpenRouter SDK for LLM operations and executes CLI commands through the Node.js child_process API.

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
