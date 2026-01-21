# NebulaFlow Documentation

Welcome to the NebulaFlow documentation! This is the main entry point for all documentation related to the NebulaFlow VS Code extension.

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

## Protocol

The extension and webview communicate using a custom workflow message protocol defined in `workflow/Core/Contracts/Protocol.ts`. Message types include:

- **Commands**: `execute_workflow`, `abort_workflow`, `pause_workflow`, `node_approved`, `node_rejected`
- **Events**: `execution_started`, `execution_completed`, `node_execution_status`, `node_output_chunk`, `node_assistant_content`
- **Data Transfer**: `workflow_loaded`, `workflow_saved`, `provide_custom_nodes`

## Configuration

### Environment Variables

- **AMP_API_KEY**: Required for LLM node execution (Amp SDK)
- **OPENROUTER_API_KEY**: Optional for OpenRouter SDK integration

### VS Code Settings

- `nebulaFlow.storageScope`: Choose between user or workspace storage
- `nebulaFlow.globalStoragePath`: Custom storage path

### Workflow Settings

- Model selection (via Amp SDK or OpenRouter)
- Node-specific configurations (prompts, commands, conditions, etc.)

## Documentation Structure

### Getting Started
- [Introduction](getting-started/introduction.md) - Overview of NebulaFlow
- [Architecture](getting-started/architecture.md) - How NebulaFlow works
- [Quick Start](getting-started/quick-start.md) - Build your first workflow in 5 minutes
- [Installation](getting-started/installation.md) - Install the extension
- [Configuration](getting-started/configuration.md) - Set up environment variables and settings
- [First Workflow](getting-started/first-workflow.md) - Step-by-step tutorial

### User Guide
- [Workflow Design](user-guide/workflow-design.md) - Design patterns and best practices
- [Node Types](user-guide/nodes/index.md) - Complete node reference
- [LLM Nodes](user-guide/nodes/llm-nodes.md) - LLM node configuration details
- [CLI Nodes](user-guide/nodes/cli-nodes.md) - Shell command execution
- [Condition Nodes](user-guide/nodes/condition-nodes.md) - Branching logic
- [Loop Nodes](user-guide/nodes/loop-nodes.md) - Iterative processing
- [Connections](user-guide/connections.md) - Linking nodes together
- [Variables & State](user-guide/variables-state.md) - Storing and referencing data
- [Execution & Debugging](user-guide/execution-debugging.md) - Running and troubleshooting workflows

### API Reference
- [Extension API](api-reference/extension.md) - VS Code extension interface
- [Protocol Contracts](api-reference/protocol.md) - Message types between extension and webview
- [Node Types](api-reference/node-types.md) - Node specifications
- [Event System](api-reference/events.md) - Execution events

### Workflow Examples
- [Basic Workflows](workflows/basic.md) - Simple workflow examples
- [Advanced Workflows](workflows/advanced.md) - Complex patterns
- [Integrations](workflows/integrations/index.md) - Connecting external services
  - [LLM Integration](workflows/integrations/llm.md)
  - [CLI Integration](workflows/integrations/cli.md)
  - [External APIs](workflows/integrations/apis.md)

### Technical
- [Architecture Details](technical/architecture.md) - Deep dive into the system
- [Development Setup](technical/development.md) - Setting up for development
- [Testing](technical/testing.md) - How to test NebulaFlow
- [Build Process](technical/build.md) - Building the extension
- [Deployment](technical/deployment.md) - Releasing new versions

### Contributing
- [Guidelines](contributing/guidelines.md) - How to contribute
- [Workflow](contributing/workflow.md) - Development workflow
- [Code Style](contributing/code-style.md) - Coding conventions
- [Pull Requests](contributing/pull-requests.md) - Submitting changes

### Resources
- [FAQ](resources/faq.md) - Frequently asked questions
- [Troubleshooting](resources/troubleshooting.md) - Common errors and solutions
- [Glossary](resources/glossary.md) - Definitions of key terms

## Quick Links

- [GitHub Repository](https://github.com/PriNova/nebulaflow)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=PriNova.nebulaflow)
- [Amp SDK Documentation](https://github.com/PriNova/amp-sdk)
- [React Flow Documentation](https://reactflow.dev/)

## Getting Help

### Documentation Issues
If you find issues in the documentation, please open an issue on GitHub.

### Technical Support
For technical support and questions:
1. Check the [FAQ](resources/faq.md)
2. Review the [Troubleshooting](resources/troubleshooting.md)
3. Open an issue on GitHub

### Community
Join our community for discussions, tips, and best practices.

## Contributing to Documentation

We welcome contributions to the documentation! See [Contributing Guidelines](contributing/guidelines.md) for details.

### Documentation Style Guide
- Use clear, concise language
- Include code examples where appropriate
- Link to related topics
- Keep documentation up to date with code changes

### Adding New Documentation
1. Create a new markdown file in the appropriate directory
2. Update the navigation in `mkdocs.yml`
3. Update the Table of Contents
4. Submit a pull request

## Building Documentation Locally

### Prerequisites
- Python 3.11+
- pip
- Git

### Installation
```bash
# Install MkDocs and plugins
pip install mkdocs mkdocs-material mkdocs-video pymdown-extensions

# Clone the repository
git clone https://github.com/PriNova/nebulaflow.git
cd nebulaflow

# Build the documentation
mkdocs build

# Serve locally
mkdocs serve
```

The documentation will be available at `http://127.0.0.1:8000`.

### Using GitHub Actions
The documentation is automatically deployed to GitHub Pages when changes are pushed to the `main` branch. See `.github/workflows/deploy-docs.yml` for the deployment workflow.

## Versioning

Documentation is versioned alongside the code. See the [Changelog](../CHANGELOG.md) for version history.

## License

Documentation is licensed under the same license as the NebulaFlow project. See [LICENSE](../LICENSE) for details.

---

*Last Updated: 2026-01-21*
