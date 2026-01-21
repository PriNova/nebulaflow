# Troubleshooting

This guide covers common errors and solutions when using NebulaFlow. If you encounter an issue not listed here, please [open an issue on GitHub](https://github.com/PriNova/nebulaflow/issues) or check the [FAQ](faq.md).

## Table of Contents

- [Common Errors](#common-errors)
- [Environment Setup](#environment-setup)
- [LLM Nodes](#llm-nodes)
- [CLI Nodes](#cli-nodes)
- [Workflow Execution](#workflow-execution)
- [Webview & Extension](#webview--extension)
- [Performance & Token Usage](#performance--token-usage)
- [Getting Help](#getting-help)

## Common Errors

### "Amp SDK not available"

**Symptom**: Error message "Amp SDK not available" when executing an LLM node.

**Cause**: The Amp SDK is not properly linked or missing from the extension's dependencies.

**Solution**:
1. **If installed from source**: Run `npm install` in the extension directory (`/home/prinova/CodeProjects/nebulaflow`) to ensure dependencies are installed.
2. **If building from source**: Run `npm run build` to bundle the SDK.
3. **If using a pre‑built extension**: Ensure the `.vsix` file is complete; try reinstalling the extension from the marketplace.
4. **Verify SDK location**: Check that `node_modules/@prinova/amp-sdk` exists. If missing, run `npm install /home/prinova/CodeProjects/upstreamAmp/sdk`.

### "AMP_API_KEY is not set"

**Symptom**: Error message "AMP_API_KEY is not set" when executing an LLM node.

**Cause**: The environment variable for the Amp SDK is not set in the VS Code process environment.

**Solution**:
1. Set the `AMP_API_KEY` environment variable in your shell before launching VS Code:
   ```bash
   export AMP_API_KEY="your-api-key-here"
   ```
2. **Restart VS Code** after setting the variable (environment changes are not picked up automatically).
3. **Using a `.env` file**: Create a `.env` file in your workspace root with `AMP_API_KEY=your-api-key-here`. Ensure the workspace folder is open.
4. **Check variable scope**: If you use a terminal profile or shell configuration (`.bashrc`, `.zshrc`), make sure the variable is exported.

### "CLI Node execution failed"

**Symptom**: CLI node fails with an error message like "CLI Node execution failed: ...".

**Cause**: Command not found, permission issues, or safety sanitization blocking the command.

**Solution**:
1. **Verify command exists**: Ensure the command is in your system's `PATH`.
2. **Check shell configuration**: The node uses the shell specified in its properties (default: `bash` on Linux/macOS, `pwsh` on Windows). Ensure the shell is installed and configured correctly.
3. **Safety level**: In command mode, the `safe` safety level uses a denylist. If your command is blocked, switch to `advanced` safety level (use with caution).
4. **Script mode**: If using script mode, verify stdin source settings and that the script is valid for the chosen shell.
5. **File permissions**: On Linux/macOS, ensure the script file has execute permissions (`chmod +x script.sh`).

### "LLM Node requires a non-empty prompt"

**Symptom**: LLM node fails with this error.

**Cause**: The node's content (prompt) is empty, or all inputs are empty.

**Solution**:
1. **Check node content**: Open the node's property editor and ensure there is text in the "Prompt" field.
2. **Check inputs**: If the prompt uses template variables (e.g., `${1}`), ensure the parent node produces non‑empty output.
3. **Use a Text node**: If you need static text, add a Text node before the LLM node.

### "Workflow Error: ..."

**Symptom**: A generic workflow error appears during execution.

**Cause**: An unexpected error occurred in a node (e.g., attachment loading failure, network error, invalid configuration).

**Solution**:
1. **Check the error message**: The error details are shown in the VS Code error notification.
2. **Identify the failing node**: Look at the execution status in the webview; the node will be highlighted with an error border.
3. **Inspect node configuration**: Open the node's property editor and verify all settings.
4. **Use Preview nodes**: Add Preview nodes before and after the suspected node to inspect data flow.
5. **Enable debug logging**: Set `NEBULAFLOW_DEBUG_LLM=1` (for LLM nodes) or `NEBULAFLOW_DEBUG=1` for general debugging.

### "Resume failed: node not found"

**Symptom**: Trying to resume a paused workflow fails with this message.

**Cause**: The node ID stored in the pause state does not exist in the current workflow graph (e.g., after editing the workflow).

**Solution**:
1. **Restart the workflow**: Execute the workflow from the beginning instead of resuming.
2. **Check node IDs**: If you modified the workflow, ensure you haven't deleted or changed the node that was paused.
3. **Clear pause state**: Currently, there is no UI to clear pause state; restarting the workflow is the only option.

## Environment Setup

### Extension fails to activate

**Symptom**: The NebulaFlow extension does not appear in the Extensions view or fails to load.

**Solution**:
1. **VS Code version**: Ensure you are using VS Code ≥ 1.90.0 (check Help → About).
2. **Extension logs**: Open the Output panel (View → Output) and select "NebulaFlow" from the dropdown to see activation logs.
3. **Reload window**: Try Developer: Reload Window (Ctrl+Shift+P → "Developer: Reload Window").
4. **Reinstall extension**: Uninstall and reinstall from the marketplace.

### Webview won't load (blank canvas)

**Symptom**: Opening the workflow editor shows a blank canvas or an error.

**Solution**:
1. **Build webview assets**: If you installed from source, run `npm run build:webview` or `npm run build`.
2. **Check webview files**: Verify `dist/webviews/workflow.html` exists.
3. **Developer Tools**: Open VS Code Developer Tools (Help → Toggle Developer Tools) and check the Console for errors.
4. **Extension reload**: Reload the window (Ctrl+Shift+P → "Developer: Reload Window").

### LLM node fails with model errors

**Symptom**: LLM node returns an error about model not available or invalid API key.

**Solution**:
1. **Verify API key**: Ensure `AMP_API_KEY` is set correctly (see above).
2. **Check model name**: Verify the selected model is supported by the Amp SDK or OpenRouter.
3. **OpenRouter configuration**: For OpenRouter models, ensure `OPENROUTER_API_KEY` is set or configured in `.nebulaflow/settings.json`.
4. **API rate limits**: Wait a few minutes and try again; check the provider's rate limits.

### CLI node fails to execute commands

**Symptom**: Shell command exits with error or is blocked.

**Solution**:
1. **Command exists**: Verify the command is in your system's PATH.
2. **Shell configuration**: Check that the shell (bash, zsh, pwsh, etc.) is correctly installed and configured.
3. **Safety settings**: In command mode, the `safe` safety level uses a denylist. If your command is blocked, switch to `advanced` safety level (use with caution).
4. **Approval required**: If the node is set to require approval, you must approve it in the VS Code notification.
5. **Script mode**: For script mode, verify stdin source settings and that the script is valid for the chosen shell.

### Permission denied on Linux/macOS

**Symptom**: CLI node fails with "Permission denied" error.

**Solution**:
1. **File permissions**: Ensure the script file has execute permissions (`chmod +x script.sh`).
2. **User permissions**: Verify your user has permission to execute the command.
3. **Safety level**: Use `safe` safety level for command mode to avoid sanitization issues.

### Extension not appearing in Extensions view

**Symptom**: NebulaFlow does not appear in the Extensions marketplace.

**Solution**:
1. **Refresh Extensions view**: Click the refresh icon in the Extensions view.
2. **Network connection**: Ensure you have internet access.
3. **VS Code version**: Update VS Code to the latest version.
4. **Install from VSIX**: Download the `.vsix` file from GitHub releases and install manually (Extensions → ... → Install from VSIX).

## LLM Nodes

### Model not available

**Symptom**: LLM node fails because the selected model is not available.

**Solution**:
1. **Check API key**: Ensure `AMP_API_KEY` is set correctly.
2. **Verify model name**: Spelling must match exactly (case‑sensitive). Check the Amp SDK or OpenRouter documentation for supported models.
3. **API rate limits**: Wait and retry; some providers have rate limits.
4. **Network connectivity**: Ensure you can reach the API endpoint.

### Poor output quality

**Symptom**: LLM responses are inconsistent or not as expected.

**Solution**:
1. **Adjust reasoning effort**: Lower the reasoning effort (e.g., `minimal` or `low`) for more consistent output.
2. **Improve prompt clarity**: Be explicit about the desired output format and constraints.
3. **Add examples**: Include examples in the prompt or system prompt.
4. **Use system prompt**: Define the role and constraints in the system prompt template.

### High token usage

**Symptom**: LLM nodes consume many tokens, increasing cost.

**Solution**:
1. **Reduce reasoning effort**: Lower the reasoning effort setting.
2. **Use concise prompts**: Remove unnecessary text from prompts.
3. **Implement summarization**: Use a summarization step before sending large inputs.
4. **Cache repeated queries**: Use Variable nodes to store and reuse results.

### Timeout errors

**Symptom**: LLM node times out after the configured timeout (default 300 seconds).

**Solution**:
1. **Increase timeout**: Set a higher `timeoutSec` in the node properties.
2. **Check network connectivity**: Ensure your internet connection is stable.
3. **Verify API endpoint**: The Amp SDK or OpenRouter endpoint should be reachable.
4. **Consider model response time**: Some models are slower; choose a faster model if possible.

### Amp SDK not available (LLM node)

**Symptom**: Error "Amp SDK not available" specifically for LLM nodes.

**Solution**:
1. **Install SDK**: Run `npm install /home/prinova/CodeProjects/upstreamAmp/sdk` in the extension directory.
2. **Restart VS Code**: After installation, reload the window.
3. **Check node_modules**: Verify `node_modules/@prinova/amp-sdk` exists.

### AMP_API_KEY not set (LLM node)

**Symptom**: Error "AMP_API_KEY is not set" for LLM nodes.

**Solution**:
1. Set the environment variable before launching VS Code.
2. Restart VS Code after setting the variable.
3. Use a `.env` file in your workspace root.

## CLI Nodes

### Command not found

**Symptom**: CLI node fails because the command is not in PATH.

**Solution**:
1. **Check PATH**: Run `which <command>` in a terminal to verify.
2. **Use absolute path**: Provide the full path to the executable in the node content.
3. **Shell configuration**: Ensure the shell used by the node has the correct PATH.

### Safety sanitization blocking valid commands

**Symptom**: Command is blocked by the denylist in `safe` safety level.

**Solution**:
1. **Switch to advanced safety**: In node properties, set `safetyLevel` to `advanced`. **Warning**: This disables sanitization; only use with trusted commands.
2. **Modify command**: If possible, rewrite the command to avoid blocked patterns (e.g., use `ls` instead of `rm`).

### Script mode issues

**Symptom**: Script fails to execute or produce output.

**Solution**:
1. **Verify stdin source**: Check the `stdin` configuration (parents‑all, parent‑index, literal).
2. **Check shell compatibility**: Ensure the script is compatible with the selected shell (bash, pwsh, etc.).
3. **Strip code fences**: If your input contains Markdown code fences, enable `stripCodeFences`.
4. **Normalize CRLF**: If mixing Windows/Unix line endings, enable `normalizeCRLF`.

### Approval required but not prompted

**Symptom**: CLI node is set to require approval, but no prompt appears.

**Solution**:
1. **Check notification settings**: Ensure VS Code notifications are enabled.
2. **Check execution status**: The node may be waiting for approval; look for a notification in the VS Code notification center.
3. **Restart VS Code**: Sometimes notifications get stuck; restart VS Code.

## Workflow Execution

### Workflow doesn't execute

**Symptom**: Clicking "Execute" does nothing.

**Solution**:
1. **Check API keys**: Ensure `AMP_API_KEY` is set (for LLM nodes).
2. **Verify connections**: All nodes must have proper connections (edges) from their dependencies.
3. **Node validation**: Check each node's configuration for errors (highlighted in red).
4. **Start node**: Ensure there is at least one node with no incoming edges (a start node).

### Node stuck in "pending" state

**Symptom**: Node never starts executing.

**Solution**:
1. **Check dependencies**: Ensure all parent nodes have completed successfully.
2. **Circular dependencies**: Verify there are no cycles in the workflow graph (except loops).
3. **Node disabled**: Check if the node is disabled (node settings).
4. **Parallel execution**: Some nodes may be waiting for parallel branches; add Preview nodes to inspect.

### Workflow execution hangs

**Symptom**: Workflow stops responding or never completes.

**Solution**:
1. **Check for infinite loops**: Ensure Loop Start/Loop End nodes have proper termination conditions.
2. **LLM timeout**: Increase timeout for LLM nodes.
3. **CLI command hanging**: Ensure CLI commands are non‑interactive or use appropriate flags.
4. **Approval waiting**: If a node is waiting for approval, approve it in the VS Code notification.

### Subflow not working

**Symptom**: Subflow node fails or doesn't execute.

**Solution**:
1. **Subflow saved**: Ensure the subflow is saved and has valid input/output nodes.
2. **Subflow ID**: Verify the subflow ID matches the one referenced in the Subflow Node.
3. **Port mappings**: Check that input/output port connections are correct.
4. **Open subflow**: Double‑click the subflow node to edit and debug internally.

### Pause/resume issues

**Symptom**: Pausing a workflow doesn't work or resuming fails.

**Solution**:
1. **Pause button**: Click the Pause button in the execution toolbar.
2. **Resume button**: Click Resume to continue from the paused node.
3. **Node not found**: If resuming fails with "node not found", restart the workflow from the beginning.
4. **Clear state**: Currently, there is no UI to clear pause state; restarting is the only option.

## Webview & Extension

### Webview shows blank canvas

**Symptom**: The workflow editor is empty.

**Solution**:
1. **Build webview assets**: Run `npm run build:webview` or `npm run build`.
2. **Check console errors**: Open VS Code Developer Tools (Help → Toggle Developer Tools) and look for errors.
3. **Reload window**: Developer: Reload Window (Ctrl+Shift+P).
4. **Reinstall extension**: If problems persist, uninstall and reinstall the extension.

### Node errors not displayed

**Symptom**: Node fails but no error border or message appears.

**Solution**:
1. **Check VS Code notifications**: Errors may appear as VS Code notifications.
2. **Enable debug logging**: Set `NEBULAFLOW_DEBUG=1` environment variable.
3. **Check execution logs**: Look at the Output panel for NebulaFlow logs.
4. **Refresh webview**: Reload the window.

### Property editor not updating

**Symptom**: Changing node properties doesn't reflect in the editor.

**Solution**:
1. **Select node**: Click the node to open its property editor.
2. **Refresh**: Click elsewhere and reselect the node.
3. **Reload window**: Developer: Reload Window.

### Extension crashes or becomes unresponsive

**Symptom**: VS Code becomes slow or the extension stops working.

**Solution**:
1. **Check VS Code logs**: Help → Toggle Developer Tools → Console.
2. **Disable other extensions**: Temporarily disable other extensions to rule out conflicts.
3. **Update VS Code**: Ensure you are using the latest stable version.
4. **File an issue**: Provide steps to reproduce on GitHub.

## Performance & Token Usage

### Workflow execution is slow

**Symptom**: Workflow takes longer than expected.

**Solution**:
1. **Parallel execution**: NebulaFlow runs nodes in parallel when possible; ensure your workflow graph allows parallelism.
2. **LLM model choice**: Use faster models (e.g., smaller models) for quick responses.
3. **Reduce LLM calls**: Combine multiple LLM nodes into one where possible.
4. **CLI command efficiency**: Optimize shell commands for speed.

### High token usage

**Symptom**: LLM nodes consume many tokens, increasing cost.

**Solution**:
1. **Reduce reasoning effort**: Lower the reasoning effort setting.
2. **Use concise prompts**: Remove unnecessary text from prompts.
3. **Implement summarization**: Add a summarization step before sending large inputs.
4. **Cache repeated queries**: Use Variable nodes to store and reuse results.

### Memory usage high

**Symptom**: VS Code or extension uses excessive memory.

**Solution**:
1. **Close unused workflows**: Close workflow editor tabs when not in use.
2. **Restart VS Code**: Periodically restart VS Code to clear memory.
3. **Check for memory leaks**: If reproducible, file an issue with steps.

## Getting Help

If you cannot resolve your issue with this guide:

1. **Check the FAQ**: See [FAQ](faq.md) for additional questions.
2. **Review documentation**: Browse the [User Guide](../user-guide/workflow-design.md) and [API Reference](../api-reference/extension.md).
3. **GitHub Issues**: Search existing issues on [GitHub](https://github.com/PriNova/nebulaflow/issues) and open a new one if needed.
4. **Community**: Join the community discussions on GitHub or Discord (link in README).

---

*Last Updated: 2026-01-21*
