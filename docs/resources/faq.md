# Frequently Asked Questions (FAQ)

## General

### What is NebulaFlow?
NebulaFlow is a VS Code extension that lets you design and run LLM+CLI workflows as visual node graphs. It provides an intuitive webview interface where you can connect nodes representing different operations and execute them in sequence.

### What are the main features?
- **Visual Workflow Design**: Drag and drop nodes to create complex workflows
- **LLM Integration**: Connect to LLM nodes for intelligent processing using Amp SDK and OpenRouter SDK
- **CLI Execution**: Run shell commands as part of your workflow
- **Conditional Logic**: Add decision points and branching logic with If/Else nodes
- **Loop Support**: Create iterative workflows for repetitive tasks with Loop Start and Loop End nodes
- **Real-time Execution**: Monitor workflow execution with streaming events
- **Approval System**: Control when sensitive operations run (CLI nodes require approval)
- **Subflows**: Create reusable workflow components
- **Variables & Accumulators**: Store and manipulate data across workflow execution

### Is NebulaFlow free?
Yes, NebulaFlow is open-source and free to use. However, you may incur costs from LLM providers (Amp SDK, OpenRouter) depending on your usage.

## Installation & Setup

### How do I install NebulaFlow?
1. Open VS Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X on macOS)
3. Search for **"NebulaFlow"** in the marketplace
4. Click **Install** on the extension published by **prinova**
5. Reload VS Code if prompted

See the [Installation Guide](../getting-started/installation.md) for detailed instructions.

### What are the system requirements?
- **VS Code** version 1.90.0 or later
- **Node.js** version 18 or later (required for the extension host)
- **npm** version 9 or later (comes with Node.js)
- **Operating System**: macOS, Linux, or Windows

### How do I set up API keys for LLM nodes?
NebulaFlow supports two LLM providers:

1. **Amp SDK** (default):
   - Set the `AMP_API_KEY` environment variable in your terminal or shell configuration
   - Example: `export AMP_API_KEY="your-api-key-here"`

2. **OpenRouter SDK** (optional):
   - Set the `OPENROUTER_API_KEY` environment variable
   - Example: `export OPENROUTER_API_KEY="your-api-key-here"`

**Important**: Environment variables must be set before launching VS Code, or you must restart VS Code after setting them.

### Where do I get an Amp API key?
Visit the [Amp SDK documentation](https://github.com/PriNova/amp-sdk) for instructions on obtaining an API key.

### Where do I get an OpenRouter API key?
Visit the [OpenRouter website](https://openrouter.ai/) to sign up and obtain an API key.

## Using NebulaFlow

### How do I create my first workflow?
1. Open the NebulaFlow editor by running the command **"NebulaFlow: Open Workflow Editor"** (Ctrl+Shift+P or Cmd+Shift+P)
2. Drag nodes from the sidebar onto the canvas
3. Connect nodes by dragging from one node's output handle to another node's input handle
4. Configure node properties in the property editor
5. Click the **Execute** button to run the workflow

See the [Quick Start Guide](../getting-started/quick-start.md) for a step-by-step tutorial.

### What nodes are available?
NebulaFlow provides the following node types:

**Agent Nodes:**
- **LLM Node**: Interact with Large Language Models (requires AMP_API_KEY)

**Shell Nodes:**
- **CLI Node**: Execute shell commands (requires approval for execution)

**Text Nodes:**
- **Text Node**: Input text data (formerly "Input Node")
- **Accumulator Node**: Accumulate text across multiple inputs
- **Variable Node**: Store and reference variables

**Logic Nodes:**
- **If/Else Node**: Branch workflow based on conditions
- **Loop Start Node**: Begin a loop iteration
- **Loop End Node**: End a loop iteration

**Preview Node:**
- **Preview Node**: Display data for debugging

**Subflow Nodes:**
- **Subflow Node**: Embed a reusable subflow
- **Subflow Input Node**: Define input ports for subflows
- **Subflow Output Node**: Define output ports for subflows

### How do I approve CLI nodes?
When a CLI node is about to execute, you'll see a notification in VS Code asking for approval. Click **"Approve"** to allow the command to run, or **"Reject"** to cancel it.

You can also configure CLI nodes to require approval every time by enabling the "Needs Approval" option in the node's properties.

### How do I create a subflow?
1. Right-click on the canvas and select **"Create Subflow"**
2. Add input and output nodes to define the subflow's interface
3. Design the subflow workflow inside the subflow editor
4. Save the subflow with a name and version
5. Use the **Subflow Node** to embed the subflow in your main workflow

### How do I pause and resume workflows?
During execution, you can pause a workflow by clicking the **Pause** button. The workflow will stop at the current node. To resume, click the **Resume** button and the workflow will continue from where it left off.

### How do I debug my workflows?
- Use the **Preview Node** to inspect intermediate values
- Check the **Execution & Debugging** panel for detailed logs
- Enable **Verbose Logging** in the workflow settings
- Use the **Variable Node** to store and inspect values at different points

### How do I use variables in my workflow?
1. Add a **Variable Node** to your workflow
2. Set the variable name and initial value
3. Reference the variable in other nodes using `${variableName}` syntax
4. The variable's value will be updated as the workflow executes

### How do I accumulate text across multiple nodes?
Use the **Accumulator Node** to combine text from multiple inputs. The accumulator will concatenate all incoming text with newlines.

## Troubleshooting

### "Amp SDK not available" error
This means the Amp SDK is not properly linked. Try:
1. Run `npm install /home/prinova/CodeProjects/upstreamAmp/sdk` in the extension directory
2. Restart VS Code
3. Check that the SDK is installed in `node_modules/@ampcode/sdk`

### "AMP_API_KEY is not set" error
The LLM node requires an API key. Set the environment variable:
```bash
export AMP_API_KEY="your-api-key-here"
```
Then restart VS Code.

### CLI commands not executing
- Ensure you have approved the CLI node execution
- Check that the command is valid for your operating system
- Verify that you have the necessary permissions to execute the command
- Check the terminal output for error messages

### Workflow execution hangs
- Check for infinite loops in your workflow
- Ensure all nodes have proper connections
- Verify that LLM nodes have valid API keys
- Check the execution logs for errors

### Webview not loading
- Restart VS Code
- Check the VS Code developer console for errors (Help > Toggle Developer Tools)
- Ensure you have Node.js 18+ installed
- Try reinstalling the extension

### Subflows not working
- Ensure the subflow is saved and has valid input/output nodes
- Check that the subflow ID matches the one referenced in the Subflow Node
- Verify that the subflow graph is properly connected

## Performance

### How can I improve workflow execution speed?
- Use parallel execution where possible (nodes execute in parallel when dependencies are satisfied)
- Limit the number of LLM calls (they can be slow and expensive)
- Use smaller models for faster responses
- Consider breaking large workflows into smaller subflows

### Why is my workflow using so many tokens?
LLM nodes consume tokens based on the input and output size. To reduce token usage:
- Use more specific prompts
- Limit the context provided to the LLM
- Use smaller models that are more token-efficient
- Review the token count displayed on each LLM node after execution

## Contributing

### How do I contribute to NebulaFlow?
1. Fork the repository on GitHub
2. Create a feature branch
3. Make your changes
4. Submit a pull request

See the [Contributing Guidelines](../contributing/guidelines.md) for detailed instructions.

### Where can I report bugs?
Please open an issue on the [GitHub repository](https://github.com/PriNova/nebulaflow/issues) with a clear description of the problem and steps to reproduce.

### How do I suggest new features?
Open a feature request issue on GitHub or join the community discussions.

## Getting Help

### Where can I get more help?
1. Check this FAQ
2. Review the [Troubleshooting Guide](../resources/troubleshooting.md)
3. Read the [Documentation](../README.md)
4. Join the community discussions on GitHub
5. Open an issue on GitHub for technical problems

### Is there a community or forum?
Join our community for discussions, tips, and best practices. Check the [README](../README.md) for community links.

## License & Privacy

### What license is NebulaFlow under?
NebulaFlow is licensed under the MIT License. See the [LICENSE](../../LICENSE) file for details.

### Does NebulaFlow collect my data?
NebulaFlow does not collect any personal data. All workflows and configurations are stored locally on your machine. API keys are stored in environment variables and are only used to communicate with LLM providers.

### Can I use NebulaFlow commercially?
Yes, the MIT License allows commercial use.

---

*Last Updated: 2026-01-21*
