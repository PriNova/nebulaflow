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

## Step 3: Clear the Default Workflow (Optional)

1. The workflow editor opens with a default workflow (Git Diff → Generate Commit Message → Git Commit)
2. To start fresh, click the **Clear** button (trash icon) in the sidebar actions bar
3. Confirm the deletion to remove all nodes
4. The canvas will be empty

## Step 4: Add Nodes

1. The left sidebar contains the Library with node categories (Agent, Text, Shell, Preview, Conditionals, Loops, Subflows)
2. Drag an **Agent** node (LLM) onto the canvas
3. Drag a **Shell** node (CLI) onto the canvas

## Step 5: Connect Nodes

1. Click the **Agent** node and drag to the **Shell** node
2. Your workflow should look like:
```
Agent → Shell
```

## Step 6: Configure Nodes

### Agent Node (LLM)
1. Click the Agent node
2. In the property editor:
   - Select a model (e.g., "gpt-4o")
   - Enter a prompt: "Generate a simple greeting"
   - (Optional) Adjust reasoning effort (minimal, low, medium, high)
   - (Optional) Set a system prompt override
3. You can also double-click the node body to edit the prompt directly

### Shell Node (CLI)
1. Click the Shell node
2. In the property editor:
   - Ensure Mode is set to "command"
   - Enter the command: `echo Hello World!`
   - (Optional) Configure shell, stdin, environment, safety, and approval settings
3. You can also double-click the node body to edit the command directly

## Step 7: Execute the Workflow

1. Click the **Run** button (play icon) in the sidebar actions bar
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
