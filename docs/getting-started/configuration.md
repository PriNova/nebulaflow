# Configuration

This guide covers how to configure NebulaFlow for your environment, workspace, and individual workflows. Configuration includes environment variables, VS Code settings, workspace-specific settings, and node-level settings.

## Environment Variables

Environment variables are used for API keys and debugging flags. They can be set in your shell, in a `.env` file in your workspace root, or in your system environment.

### Required for LLM Nodes

- **`AMP_API_KEY`**: Required for the Amp SDK (LLM node execution). Set this to your Amp API key.
- **`OPENROUTER_API_KEY`**: Optional for OpenRouter SDK integration. Set this if you want to use OpenRouter models.

### Optional Debugging & Behavior Flags

- **`NEBULAFLOW_DEBUG_LLM`**: Set to `1` to enable verbose logging for LLM node execution (warns on errors reading workspace settings).
- **`NEBULAFLOW_DISABLE_HYBRID_PARALLEL`**: When truthy, disables hybrid parallel execution (affects looped graphs).
- **`NEBULAFLOW_FILTER_PAUSE_SEEDS`**: When truthy, filters pause seeds in certain resume scenarios.
- **`NEBULAFLOW_SHELL_MAX_OUTPUT`**: Maximum characters to capture from shell command output (default: `1000000`). Truncates output if exceeded.

### Setting Environment Variables

**Linux/macOS (temporary):**
```bash
export AMP_API_KEY="your_amp_api_key_here"
export OPENROUTER_API_KEY="your_openrouter_api_key_here"  # optional
```

**Linux/macOS (permanent):**
Add the lines to your shell profile file (e.g., `~/.bashrc`, `~/.zshrc`, `~/.profile`):
```bash
export AMP_API_KEY="your_amp_api_key_here"
export OPENROUTER_API_KEY="your_openrouter_api_key_here"
```

**Windows (PowerShell):**
```powershell
$env:AMP_API_KEY="your_amp_api_key_here"
$env:OPENROUTER_API_KEY="your_openrouter_api_key_here"
```

**Windows (Command Prompt):**
```cmd
set AMP_API_KEY=your_amp_api_key_here
set OPENROUTER_API_KEY=your_openrouter_api_key_here
```

**Note:** Environment variables set in a terminal session only apply to that session. For permanent changes, set them system-wide or use a `.env` file in your workspace (see below).

### Using a `.env` File

You can also place a `.env` file in your workspace root (or the first workspace folder). NebulaFlow will read environment variables from this file when the extension activates.

Create a file named `.env` in your workspace:
```
AMP_API_KEY=your_amp_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

## VS Code Settings

NebulaFlow provides VS Code configuration options that can be set in the Settings UI (Ctrl+, or Cmd+,) or in `.vscode/settings.json`.

### `nebulaFlow.storageScope`

- **Type**: `string`
- **Enum**: `["workspace", "user"]`
- **Default**: `user`
- **Description**: Where NebulaFlow stores workflows and custom nodes.
  - `user`: Global storage in your user folder (default).
  - `workspace`: Storage in the current workspace (`.nebulaflow/` directory).

### `nebulaFlow.globalStoragePath`

- **Type**: `string`
- **Default**: `""`
- **Description**: Absolute path for global storage. If empty, uses your home directory. Content is stored under `.nebulaflow/`.

### Example `.vscode/settings.json`

```json
{
  "nebulaFlow.storageScope": "workspace",
  "nebulaFlow.globalStoragePath": "/path/to/custom/storage"
}
```

## Workspace Configuration

You can configure LLM settings per workspace by creating a `.nebulaflow/settings.json` file in your workspace root. This file can contain Amp SDK settings, model configurations, and more.

### File Location

The file must be placed in the first workspace folder at `.nebulaflow/settings.json`.

### Structure

The file must contain a `nebulaflow.settings` object that maps directly to Amp SDK settings keys.

```json
{
  "nebulaflow": {
    "settings": {
      "openrouter.key": "sk-or-...",
      "internal.primaryModel": "openrouter/xiaomi/mimo-v2-flash:free"
    }
  }
}
```

### Common Settings Keys

- **`openrouter.key`**: OpenRouter API key (overrides `OPENROUTER_API_KEY` environment variable).
- **`internal.primaryModel`**: Workspace-wide default model for LLM nodes (used when a node has no model selected).
- **`openrouter.models`**: Array of model configurations for OpenRouter models (see example below).
- **`amp.dangerouslyAllowAll`**: Boolean to auto-approve all tool calls (use with caution).
- **`tools.disable`**: Array of tool names to disable (e.g., `["bash"]`).
- **`reasoning.effort`**: Default reasoning effort for LLM nodes (`minimal`, `low`, `medium`, `high`).

### Example: OpenRouter Models Configuration

```json
{
  "nebulaflow": {
    "settings": {
      "openrouter.models": [
        {
          "model": "openrouter/z-ai/glm-4.7-flash",
          "provider": "z-ai",
          "maxOutputTokens": 131000,
          "contextWindow": 200000,
          "temperature": 0.5
        },
        {
          "model": "openrouter/openai/gpt-5.2-codex",
          "provider": "openai",
          "isReasoning": true,
          "reasoning_effort": "medium",
          "maxOutputTokens": 128000,
          "contextWindow": 400000
        }
      ]
    }
  }
}
```

### Model Selection Priority

1. **Node-level model**: Selected in the Property Editor (Model combobox).
2. **Workspace default**: `internal.primaryModel` in `.nebulaflow/settings.json`.
3. **Built-in default**: `openai/gpt-5.1` (if neither of the above is set).

The Model combobox is populated from the Amp SDK `listModels()` API and also includes the configured workspace default and any OpenRouter models defined in `openrouter.models`.

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

### "AMP_API_KEY is not set" error

- Ensure the environment variable is set before launching VS Code.
- If using a `.env` file, verify it's in the correct workspace folder and contains the variable.

### LLM node fails with model errors

- Verify `AMP_API_KEY` is set correctly.
- Check that the selected model is available in your Amp account.
- For OpenRouter models, ensure `OPENROUTER_API_KEY` is set or configured in `.nebulaflow/settings.json`.

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
