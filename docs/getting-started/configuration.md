# Configuration

This guide covers how to configure NebulaFlow for your environment, workspace, and individual workflows. Configuration includes environment variables, VS Code settings, workspace-specific settings, and node-level settings.

## Pi Authentication and Models

NebulaFlow uses pi's standard model runtime and configuration files.

### Credentials

Configure credentials using one of these pi-supported methods:

1. Run pi and use `/login` to store an API key or OAuth credential.
2. Store credentials in `~/.pi/agent/auth.json`.
3. Set the selected provider's environment variable, such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENROUTER_API_KEY`.

Do not store credentials in workflow files, `.nebulaflow/`, or source-controlled settings.

### Model Configuration

| Purpose | Location |
|---|---|
| Global defaults | `~/.pi/agent/settings.json` |
| Project overrides | `<workspace>/.pi/settings.json` |
| Credentials | `~/.pi/agent/auth.json` |
| Custom providers and models | `~/.pi/agent/models.json` |
| Cached dynamic catalogs | `~/.pi/agent/models-store.json` |

Example global or project pi settings:

```json
{
  "defaultProvider": "openai",
  "defaultModel": "gpt-5.1"
}
```

### Model Selection Priority

1. Model selected on the LLM node.
2. Authenticated project/global pi default.
3. Authenticated built-in fallback.

The Model combobox shows models currently available through pi `ModelRuntime`. Define custom providers and models in pi's `models.json` rather than NebulaFlow workspace settings.

## NebulaFlow Environment Variables

- **`PI_OFFLINE`**: Disables the background pi model-catalog network refresh.
- **`NEBULAFLOW_DISABLE_HYBRID_PARALLEL`**: Disables hybrid parallel execution when truthy.
- **`NEBULAFLOW_FILTER_PAUSE_SEEDS`**: Filters pause seeds in supported resume scenarios when truthy.
- **`NEBULAFLOW_SHELL_MAX_OUTPUT`**: Maximum shell-output characters to capture; default `1000000`.

## VS Code Settings

NebulaFlow provides VS Code configuration options through the Settings UI or `.vscode/settings.json`.

### `nebulaFlow.storageScope`

- **Type**: `string`
- **Enum**: `["workspace", "user"]`
- **Default**: `user`
- **Description**: Where NebulaFlow stores workflows and custom nodes.
  - `user`: Global storage in your user folder.
  - `workspace`: Storage in the current workspace under `.nebulaflow/`.

### `nebulaFlow.globalStoragePath`

- **Type**: `string`
- **Default**: `""`
- **Description**: Optional absolute path for user-scope NebulaFlow storage.

```json
{
  "nebulaFlow.storageScope": "workspace",
  "nebulaFlow.globalStoragePath": "/path/to/custom/storage"
}
```

## Node Configuration

Each node type has specific configuration options. These are set in the Property Editor when a node is selected.

### LLM Node

- **Model**: Select a model from the dropdown (populated from SDK and workspace settings).
- **Prompt**: The user prompt (can be templated with `{{input}}` placeholders).
- **System Prompt**: Optional system prompt template.
- **Reasoning Effort**: `minimal`, `low`, `medium`, `high` (default: `medium`).
- **Attachments**: Attach images (file path or URL) for vision models.
- **Disabled Tools**: Array of tool names to disable (e.g., `["bash"]`).
- **Dangerously Allow All**: Auto-approve all tool calls (bypasses approval system).
- **Timeout (seconds)**: Request timeout (0 = no timeout, default: 300 seconds).
- **Thread ID**: For chat continuation (if a previous LLM node produced a thread ID).

### CLI Node

- **Mode**: `command` (one-liner) or `script` (multiline via stdin).
- **Command/Script**: The shell command or script to execute.
- **Shell**: Select shell (`bash`, `sh`, `zsh`, `pwsh`, etc.). Defaults to system shell.
- **Stdin Source**: For script mode: `none`, `parents-all`, `parent-index`, `literal`.
- **Strip Code Fences**: Remove markdown code fences from stdin.
- **Normalize CRLF**: Convert Windows line endings to Unix.
- **Environment Mapping**: Expose parent outputs as environment variables (`INPUT_1`, `INPUT_2`, or custom names).
- **Safety**: `safe` (sanitization) or `advanced` (no sanitization). Default: `safe`.
- **Approval**: Require approval before execution (default: enabled for `safe` mode).
- **Spawn (buffered)**: Use spawn instead of exec for command mode (default: false).

### Text Node

- **Content**: Text content to pass to downstream nodes.
- **Title**: Optional label for the node.

### Variable Node

- **Variable Name**: Name of the variable to store.
- **Initial Value**: Template string (can reference inputs).

### Accumulator Node

- **Variable Name**: Name of the accumulator variable.
- **Initial Value**: Starting value.

### If/Else Node

- **Condition**: JavaScript expression that evaluates to truthy/falsy.
- **True Path**: Edge to follow when condition is true.
- **False Path**: Edge to follow when condition is false.

### Loop Start Node

- **Iterations**: Number of iterations (or expression for dynamic count).
- **Loop Variable**: Variable name for iteration index.
- **Loop Mode**: `fixed` or `while`.

### Loop End Node

- No configuration (paired with Loop Start).

### Preview Node

- No configuration (displays input data).

### Subflow Node

- **Subflow ID**: Select a saved subflow.
- **Input/Output Ports**: Configure port counts.

## Approval System

CLI nodes (and LLM tool calls) can require approval before execution. This is controlled by the **Safety** and **Approval** settings.

- **Safe Mode**: Sanitization applied; approval can be enabled or disabled.
- **Advanced Mode**: No sanitization; approval is recommended for security.

When approval is required, the Right Sidebar shows a preview of the command/script and a structured summary (Mode, Shell, Safety, Stdin, Flags). You can approve or reject.

## Storage and Persistence

- **Workflows**: Saved as JSON files under `.nebulaflow/workflows/` (versioned `1.x`).
- **Custom Nodes**: Saved as JSON files under `.nebulaflow/nodes/`.
- **Subflows**: Saved as JSON files under `.nebulaflow/subflows/`.

The storage location is determined by `nebulaFlow.storageScope` and `nebulaFlow.globalStoragePath`.

## Troubleshooting Configuration

### "No authenticated pi model is available" error

- Ensure the environment variable is set before launching VS Code.
- If using a `.env` file, verify it's in the correct workspace folder and contains the variable.

### LLM node fails with model errors

- Verify pi authentication for the selected provider.
- Check that the selected model is available in your Amp account.
- For OpenRouter models, authenticate OpenRouter through pi `/login`, `auth.json`, or `OPENROUTER_API_KEY`.

### CLI node fails to execute commands

- Ensure the command exists in your system's PATH.
- Check that the shell configuration is correct (bash, zsh, pwsh, etc.).
- For script mode, verify stdin source is set correctly.
- Review safety settings: command mode uses sanitization by default.

### Workflow not saving/loading

- Check `nebulaFlow.storageScope` setting.
- Verify workspace folder is open (if using workspace storage).
- Ensure write permissions for the storage directory.

## Next Steps

- [Quick Start](quick-start.md) - Build your first workflow
- [User Guide](../user-guide/workflow-design.md) - Learn about workflow design patterns
- [Node Reference](../user-guide/nodes/index.md) - Detailed node documentation
