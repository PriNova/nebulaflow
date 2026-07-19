# Installation

This guide covers how to install NebulaFlow, a VS Code extension for designing and running LLM+CLI workflows as visual node graphs.

## Prerequisites

Before installing NebulaFlow, ensure you have the following:

- **VS Code** version 1.90.0 or later
- **Node.js** version 18 or later (required for the extension host)
- **npm** version 9 or later (comes with Node.js)
- **Operating System**: macOS, Linux, or Windows

## Installation Methods

### Method 1: Install from VS Code Marketplace (Recommended)

1. Open VS Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X on macOS)
3. Search for **"NebulaFlow"** in the marketplace
4. Click **Install** on the extension published by **prinova**
5. Reload VS Code if prompted

After installation, you can open the NebulaFlow editor by running the command **"NebulaFlow: Open Workflow Editor"** (Ctrl+Shift+P or Cmd+Shift+P, then type the command).

### Method 2: Install from VSIX File

If you have a `.vsix` file (e.g., from a release or local build):

1. Open VS Code
2. Go to the Extensions view
3. Click the **...** menu in the top-right corner of the Extensions panel
4. Select **"Install from VSIX..."**
5. Navigate to the `.vsix` file and select it
6. Reload VS Code when prompted

### Method 3: Build from Source (Development)

If you want to contribute or run the latest development version:

1. Clone the repository:
   ```bash
   git clone https://github.com/PriNova/nebulaflow.git
   cd nebulaflow
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Launch the extension in VS Code:
   - Open the cloned folder in VS Code
   - Press **F5** to start the "Launch Extension (Desktop)" debug configuration
   - This will open a new VS Code window with the extension loaded

5. Open the NebulaFlow editor:
   - In the new window, run the command **"NebulaFlow: Open Workflow Editor"** (Ctrl+Shift+P)

For more details on development workflow, see [Development Setup](../technical/development.md).

## Configuration

NebulaFlow uses pi's standard model and credential stores:

- Run pi `/login`, use `~/.pi/agent/auth.json`, or set a provider-specific environment variable.
- Set global model defaults in `~/.pi/agent/settings.json`.
- Set project model-default overrides in `<workspace>/.pi/settings.json`.
- Define custom providers and models in `~/.pi/agent/models.json`.

Example pi settings:

```json
{
  "defaultProvider": "openai",
  "defaultModel": "gpt-5.1"
}
```

NebulaFlow storage remains configurable through `nebulaFlow.storageScope` and `nebulaFlow.globalStoragePath` in VS Code settings.

## Verification

After installation, verify that NebulaFlow is working:

1. Open VS Code
2. Run the command **"NebulaFlow: Open Workflow Editor"**
3. The webview should open with a default workflow (Git Diff → Generate Commit Message → Git Commit)
4. If you see a blank canvas or an error, check the troubleshooting section below

## Troubleshooting

### "pi SDK not available" error

**Cause:** The vendored pi SDK is not properly linked or missing.

**Solution:**
- Run `npm install` to ensure dependencies are installed
- If building from source, run `npm run build` to bundle the SDK
- If using a pre-built extension, ensure the `.vsix` file is complete

### "No authenticated pi model is available" error

**Cause:** The environment variable for the pi SDK is not set.

**Solution:**
- Configure pi `/login`, `auth.json`, or the selected provider environment variable as described in the Configuration section
- Restart VS Code after setting the variable
- If using a `.env` file, ensure it's in the correct workspace folder

### Webview assets don't load

**Cause:** The webview bundle hasn't been built or is outdated.

**Solution:**
- If you installed from source, run `npm run build` or `npm run build:webview`
- If you installed from the marketplace, try reloading the window (Ctrl+Shift+P → "Developer: Reload Window")
- Check the VS Code Developer Tools (Help → Toggle Developer Tools) for errors

### Extension fails to activate

**Cause:** VS Code extension host issues or incompatible VS Code version.

**Solution:**
- Ensure VS Code version is ≥ 1.90.0 (check Help → About)
- Check the extension logs in the Output panel (View → Output, select "NebulaFlow" from the dropdown)
- Try disabling and re-enabling the extension

### LLM node fails with model errors

**Cause:** Invalid API key or model selection.

**Solution:**
- Verify pi authentication for the selected provider
- Check that the selected model is available in your Amp account
- For OpenRouter models, authenticate OpenRouter through pi `/login`, `auth.json`, or `OPENROUTER_API_KEY`

### CLI node fails to execute commands

**Cause:** Permission issues or command not found.

**Solution:**
- Ensure the command exists in your system's PATH
- Check that the shell configuration is correct (bash, zsh, pwsh, etc.)
- For script mode, verify stdin source is set correctly
- Review safety settings: command mode uses sanitization by default

### Permission denied on Linux/macOS

**Cause:** The extension may need executable permissions for shell commands.

**Solution:**
- Ensure your user has permission to execute the commands
- Check file permissions of scripts you're trying to run
- Consider using the `safe` safety level for command mode

### Extension not appearing in Extensions view

**Cause:** VS Code marketplace sync delay or network issues.

**Solution:**
- Refresh the Extensions view (click the refresh icon)
- Check your internet connection
- Try installing from VSIX file instead

## Next Steps

Once installed and configured:

1. **Quick Start**: Follow the [Quick Start Guide](quick-start.md) to create your first workflow
2. **Configuration**: Learn about advanced configuration in [Configuration](configuration.md)
3. **First Workflow**: Build a complete workflow in [First Workflow](first-workflow.md)
4. **User Guide**: Explore the [User Guide](../user-guide/workflow-design.md) for workflow design patterns

## Getting Help

If you encounter issues not covered here:

- Check the [Troubleshooting](../resources/troubleshooting.md) resource
- Review the [FAQ](../resources/faq.md)
- Open an issue on [GitHub](https://github.com/PriNova/nebulaflow/issues)
- Join the community on [Discord](https://discord.gg/example) (link placeholder)
