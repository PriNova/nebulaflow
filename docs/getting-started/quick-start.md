# Quick Start Guide

This guide will help you create your first NebulaFlow workflow in under 5 minutes.

## Prerequisites

- VS Code 1.90.0 or later
- NebulaFlow extension installed
- (Optional) Amp API key and OpenRouter API key for LLM functionality

## Step 1: Install the Extension

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "NebulaFlow"
4. Click Install

## Step 2: Open the NebulaFlow Panel

1. Open the Command Palette (Ctrl+Shift+P)
2. Type "NebulaFlow: Open Workflow"
3. Select "Open Workflow Editor"

## Step 3: Create a New Workflow

1. In the webview, click "New Workflow"
2. Give your workflow a name (e.g., "My First Workflow")
3. The empty canvas will appear

## Step 4: Add Nodes

1. Open the Sidebar (click the menu icon or press `Ctrl+Shift+B`)
2. Drag a **Start Node** onto the canvas
3. Drag an **LLM Node** onto the canvas
4. Drag a **CLI Node** onto the canvas
5. Drag an **End Node** onto the canvas

## Step 5: Connect Nodes

1. Click the **Start Node** and drag to the **LLM Node**
2. Click the **LLM Node** and drag to the **CLI Node**
3. Click the **CLI Node** and drag to the **End Node**

Your workflow should look like:
```
Start → LLM → CLI → End
```

## Step 6: Configure Nodes

### Start Node
- No configuration needed

### LLM Node
1. Click the LLM node
2. In the property editor:
   - Select a model (e.g., "gpt-4o")
   - Enter a prompt: "Generate a simple greeting"
   - Set temperature: 0.7

### CLI Node
1. Click the CLI node
2. In the property editor:
   - Command: `echo`
   - Arguments: `Hello World!`

### End Node
- No configuration needed

## Step 7: Execute the Workflow

1. Click the **Run** button (play icon) in the toolbar
2. Watch the execution flow through the nodes
3. View the output in the execution log

## Step 8: View Results

1. Check the execution panel for output
2. Click on individual nodes to see their results
3. The LLM node will show the generated greeting
4. The CLI node will show "Hello World!"

## Next Steps

Congratulations! You've created your first NebulaFlow workflow. Now explore:

- **Workflows**: Create more complex workflows with conditions and loops
- **Nodes**: Learn about different node types and their configurations
- **Integrations**: Connect to external APIs and services
- **Advanced Patterns**: Explore workflow design patterns for production use

## Troubleshooting

**Issue**: Workflow doesn't execute
- Check that all nodes are connected
- Verify node configurations are complete
- Look for error messages in the execution log

**Issue**: LLM node fails
- Ensure AMP_API_KEY is set in your environment
- Check that the selected model is available
- Verify the prompt is properly formatted

**Issue**: CLI node fails
- Check that the command exists on your system
- Verify command arguments are correct
- Ensure proper permissions for the command
