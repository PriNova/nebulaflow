# Your First Workflow

This guide walks you through running and understanding your first NebulaFlow workflow. We'll use the default workflow that comes with the extension, which demonstrates a practical use case: generating a Git commit message from a diff.

## Prerequisites

- NebulaFlow extension installed (see [Installation](installation.md))
- A Git repository with some uncommitted changes (optional, but recommended to see the workflow in action)
- Amp API key set in your environment variables (for LLM functionality)

## Step 1: Open the Workflow Editor

1. Open VS Code
2. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS)
3. Type `NebulaFlow: Open Workflow` and select **Open Workflow Editor**
4. The workflow editor panel opens on the right side of VS Code

## Step 2: Examine the Default Workflow

The editor loads with a pre‑configured workflow. It consists of three nodes connected in sequence:

```
Git Diff (CLI) → Generate Commit Message (LLM) → Git Commit (CLI)
```

### Node 1: Git Diff (CLI Node)

- **Type**: Shell Node (`NodeType.CLI`)
- **Purpose**: Runs `git diff` to capture changes in your repository
- **Configuration**:
  - Mode: `command`
  - Command: `git diff`
  - Safety level: `safe` (requires approval)
  - Shell: `bash` (or your default shell)
- **Output**: The diff text is passed to the next node

### Node 2: Generate Commit Message (LLM Node)

- **Type**: Agent Node (`NodeType.LLM`)
- **Purpose**: Uses an LLM to generate a commit message from the diff
- **Configuration**:
  - Model: Default Amp model (e.g., `gpt-4o`)
  - Prompt: `Generate a commit message for the following git diff: ${1}`
  - Reasoning effort: `medium`
- **Output**: The generated commit message text

### Node 3: Git Commit (CLI Node)

- **Type**: Shell Node (`NodeType.CLI`)
- **Purpose**: Runs `git commit` with the generated message
- **Configuration**:
  - Mode: `command`
  - Command: `git commit -m "${1}"`
  - Safety level: `safe` (requires approval)
  - Shell: `bash`
- **Output**: Git commit output

## Step 3: Run the Workflow

1. Click the **Run** button (play icon) in the sidebar actions bar
2. The execution starts, and you'll see real‑time updates in the execution log

### Approval Prompts

Because both CLI nodes are set to `safe` mode, you'll be prompted to approve each command:

1. **First prompt**: `git diff`
   - Review the command
   - Click **Approve** to execute, or **Reject** to cancel
2. **Second prompt**: `git commit -m "<generated message>"`
   - Review the command and the generated message
   - Click **Approve** to commit, or **Reject** to cancel

### Streaming Output

- The LLM node streams its response token‑by‑token
- The CLI nodes stream stdout/stderr line‑by‑line
- You can watch the execution flow in real time

## Step 4: Inspect Results

After execution completes:

1. Click on each node to see its **Result** tab in the property editor
2. **Git Diff**: Shows the diff output
3. **Generate Commit Message**: Shows the generated commit message
4. **Git Commit**: Shows the git commit output (e.g., `[main abc123] ...`)

You can also view the execution log in the sidebar to see the sequence of events.

## Step 5: Modify the Workflow

Let's customize the workflow to understand how it works.

### Change the LLM Prompt

1. Click the **Generate Commit Message** node
2. In the property editor, change the prompt to:
   ```
   Write a concise commit message for the following changes:
   ${1}
   ```
3. Re‑run the workflow to see how the output changes

### Add a Preview Node

1. Drag a **Preview** node from the Library (under **Preview** category)
2. Connect the **Git Diff** node to the **Preview** node
3. Connect the **Preview** node to the **Generate Commit Message** node
4. Now the diff will be displayed in the execution panel before being sent to the LLM

### Replace the Commit Command

1. Click the **Git Commit** node
2. Change the command to `git commit --amend --no-edit`
3. This will amend the previous commit instead of creating a new one
4. **Note**: Be careful with destructive commands; consider changing the safety level to `advanced` only if you understand the risks

## Step 6: Save Your Workflow

1. Click the **Save** button (floppy disk icon) in the sidebar actions bar
2. Choose a location to save the workflow file (`.nflow` extension)
3. The workflow is now saved and can be loaded later via **Load Workflow**

## Step 7: Clear and Start Fresh (Optional)

If you want to create your own workflow from scratch:

1. Click the **Clear** button (trash icon) in the sidebar actions bar
2. Confirm deletion
3. The canvas is now empty
4. Drag nodes from the Library and connect them as needed

## What You've Learned

- How to open the NebulaFlow workflow editor
- Understanding the default workflow and its nodes
- Running a workflow with approval prompts
- Inspecting node results and execution logs
- Modifying a workflow by changing node configurations
- Adding new nodes and connecting them
- Saving your workflow for later use

## Next Steps

Now that you've run your first workflow, explore more advanced features:

- **Create a Loop**: Use Loop Start and Loop End nodes to iterate over data
- **Use Variables**: Store and reference values across nodes
- **Build a Subflow**: Create reusable workflow components
- **Integrate APIs**: Use CLI nodes to call external services
- **Debug Workflows**: Use Preview nodes and execution logs

For more detailed guides, see:

- [User Guide: Workflow Design](../user-guide/workflow-design.md)
- [User Guide: Nodes](../user-guide/nodes/index.md)
- [Workflows: Advanced Patterns](../workflows/advanced.md)

## Troubleshooting

### Workflow doesn't start

- Ensure the extension is activated (check VS Code status bar)
- Verify you have a Git repository open if using the default workflow
- Check the VS Code output panel for errors

### LLM node fails

- Verify `AMP_API_KEY` is set in your environment
- Check the model selection in the node configuration
- Look for error messages in the execution log

### CLI node fails

- Ensure the command exists on your system
- Check that you have the necessary permissions
- Verify the shell configuration matches your environment

### Approval prompts don't appear

- Check the node's safety level (`safe` requires approval, `advanced` does not)
- Ensure the node is not set to `bypass` mode
- Look for any error messages in the execution log

## Summary

You've successfully run and modified your first NebulaFlow workflow. The default workflow demonstrates a practical use case: automating Git commit message generation. By understanding each node's role and configuration, you're ready to build your own workflows for any task that combines LLM reasoning with CLI execution.
