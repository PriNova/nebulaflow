# CLI Nodes (Shell Nodes)

CLI nodes, also called **Shell nodes**, allow you to execute shell commands and scripts within your workflows. These nodes support streaming output, user approval, safety levels, and advanced configuration for stdin, environment variables, and shell flags.

## Configuration

### Mode
- **Command**: Execute a single command line (default). The command is parsed by the shell and executed directly.
- **Script**: Execute a multi-line script. The script is passed to the selected shell as a script file or inline script.

### Command / Script Content
- **Content**: The command or script to execute. This is the `content` field of the node.
- **Template Variables**: Use `${1}`, `${2}` etc. for positional inputs from parent nodes. The content is processed with `replaceIndexedInputs` using outputs from connected nodes.
- **Empty Content**: If the content is empty after processing, the node will throw an error.

### Shell Selection
- **Supported Shells**: `bash`, `sh`, `zsh`, `pwsh`, `cmd`
- **Default**: `bash` on Unix-like systems, `pwsh` on Windows.
- **Effect**: Determines how the command/script is executed and which flags are available.

### Safety Level
- **Safe** (default): Applies a denylist of dangerous commands (e.g., `rm -rf /`, `sudo`, `dd`). Prevents accidental destructive operations.
- **Advanced**: Skips the denylist, allowing any command. Use with extreme caution.
- **Note**: Safety level does not affect script mode (scripts are always considered advanced).

### Stream Output
- **Spawn Mode**: When enabled, the command is executed as a separate process with output streamed in real-time.
- **Auto Spawn**: If the command is long (>200 characters) or contains pipes/redirection, spawn mode is automatically enabled for safety.
- **Streaming**: Output chunks are sent to the webview as they arrive, allowing live monitoring.

### Stdin Configuration (Script Mode)
- **Source**: Where input data comes from:
  - `none`: No stdin (default)
  - `parents-all`: Concatenate all parent outputs with newline separator
  - `parent-index`: Use output from a specific parent (by index)
  - `literal`: Use a custom literal string
- **Parent Index**: When source is `parent-index`, specify which parent (1-based).
- **Literal**: Custom stdin text (supports template variables).
- **Strip Code Fences**: Automatically remove Markdown code fences (```) from stdin.
- **Normalize CRLF**: Convert Windows line endings (`\r\n`) to Unix (`\n`).

### Environment Mapping (Script Mode)
- **Expose Parents**: Map parent outputs as environment variables:
  - Default: `INPUT_1`, `INPUT_2`, ... (one per parent)
  - Custom names: Provide comma-separated names (e.g., `SRC_FILE, DEST_DIR`)
- **Static Env**: Additional environment variables as JSON object (supports template variables).
- **Example**: `{ "FOO": "bar", "PATH": "${1}" }`

### Shell Flags
#### Bash/Sh/Zsh Flags
- **set -e**: Exit on error (`exitOnError`)
- **set -u**: Exit on undefined variable (`unsetVars`)
- **set -o pipefail**: Exit on any command failure in a pipeline (`pipefail`)

#### PowerShell Flags
- **-NoProfile**: Skip loading user profile (`noProfile`)
- **-NonInteractive**: Run non-interactively (`nonInteractive`)
- **-ExecutionPolicy Bypass**: Bypass execution policy restrictions (`executionPolicyBypass`)

### Approval & Safety
- **Require User Approval**: If enabled, the node will pause and ask for approval before execution. The user can modify the command before approving.
- **Abort on Error**: If enabled, the workflow will stop if the command fails (non-zero exit code).

## Input/Output

### Inputs
- **Previous Node Output**: The output from connected parent nodes is used as input data.
- **Positional Inputs**: Use `${1}`, `${2}` etc. in the command/script to reference inputs by order.
- **Structured Data**: Supports any text output from previous nodes.

### Outputs
- **Command Output**: The combined stdout and stderr (or script output).
- **Exit Code**: The exit code of the command (stored internally for conditional branching).
- **Streaming**: Output chunks are streamed in real-time to the webview.
- **Exit Code Metadata**: Available for conditional logic (e.g., `cliMetadata` in execution context).

## Variable Usage

### Template Variables
Use positional inputs in the command/script:

```bash
echo "Processing ${1} and ${2}"
```

### Environment Variables
In script mode, you can expose parent outputs as environment variables:

```bash
# With exposeParents enabled and names: SRC, DEST
cp "$SRC" "$DEST"
```

### Static Environment
Define static environment variables in JSON:

```json
{
  "DEBUG": "true",
  "LOG_LEVEL": "info"
}
```

## Examples

### Basic Command
```
echo "Hello, World!"
```

### Using Parent Output
```
echo "Received: ${1}"
```

### Script with Stdin
- Mode: Script
- Stdin Source: parents-all
- Script:
```bash
while read line; do
  echo "Line: $line"
done
```

### File Processing
```
cat input.txt | grep "error" | wc -l
```

### PowerShell Script
- Shell: pwsh
- Script:
```powershell
Get-ChildItem -Path ${1} | Select-Object Name, Length
```

### Safe Command with Approval
- Safety: Safe
- Require User Approval: true
- Content: `ls -la`

## Best Practices

### Security
1. **Use Safe Mode**: Keep safety level as "safe" unless absolutely necessary.
2. **Review Commands**: Enable user approval for any command that modifies files or systems.
3. **Avoid Dangerous Patterns**: Don't use `rm -rf`, `sudo`, `dd`, etc. in safe mode.
4. **Sanitize Inputs**: Validate and sanitize any user-provided data before using in commands.

### Error Handling
1. **Check Exit Codes**: Use condition nodes to check CLI exit codes.
2. **Abort on Error**: Enable for critical commands where failure should stop the workflow.
3. **Log Errors**: Capture stderr and log for debugging.
4. **Retry Logic**: Implement retries for transient failures (e.g., network commands).

### Performance
1. **Use Spawn for Long Commands**: Enable stream output for commands that produce large output.
2. **Batch Operations**: Combine multiple commands into a single script when possible.
3. **Avoid Unnecessary Pipes**: Each pipe adds overhead; consider using built-in shell features.
4. **Cache Results**: Store frequently used outputs in variables.

### Scripting Tips
1. **Use Explicit Shebang**: In script mode, you can include a shebang line (e.g., `#!/bin/bash`) for clarity.
2. **Quote Variables**: Always quote variables to handle spaces and special characters.
3. **Set Shell Flags**: Use `set -e -u -o pipefail` for robust scripts.
4. **Handle Windows Paths**: Use `pwsh` on Windows for better path handling.

## Troubleshooting

### Command Not Found
- Ensure the shell is installed and in PATH.
- Check the shell selection matches your system.
- Use absolute paths for executables.

### Permission Denied
- Check file permissions (`chmod`).
- Avoid using `sudo` in safe mode.
- Consider running the workflow with appropriate user permissions.

### Timeout Errors
- Increase timeout setting (if available).
- Use spawn mode for long-running commands.
- Check for infinite loops in scripts.

### Stdin Issues
- Verify stdin source configuration.
- Check that parent nodes produce output.
- Ensure template variables are correctly formatted.

### Environment Variables Not Set
- Confirm `exposeParents` is enabled.
- Check custom names match expected variables.
- Verify static env JSON is valid.

### Approval Not Working
- Ensure `needsUserApproval` is checked.
- Check that the node is not bypassed.
- Verify the workflow is not in "auto-run" mode.

### Shell Flags Not Applied
- Flags only apply to specific shells (bash vs pwsh).
- Ensure the selected shell matches the flag type.
- Check that the script mode is enabled for script flags.

### Exit Code Not Captured
- Exit codes are stored internally but not directly visible.
- Use condition nodes to check exit codes.
- Access via `cliMetadata` in execution context (advanced).

## Integration with Other Nodes

### Before CLI
- **LLM Node**: Generate commands dynamically.
- **Variable Node**: Provide dynamic arguments.
- **Condition Node**: Validate before execution.

### After CLI
- **Condition Node**: Check exit code or output.
- **LLM Node**: Process command output.
- **Loop Node**: Repeat command with different inputs.
- **Preview Node**: Inspect output for debugging.

### Common Patterns
- **Fetch → Process → Save**: CLI (curl) → LLM → CLI (write)
- **Data Extraction**: CLI (grep/sed) → LLM → CLI (format)
- **System Monitoring**: CLI (ps/top) → Condition → Alert

## Configuration Example

```yaml
cli_node:
  title: "File List"
  mode: "command"
  content: "ls -la ${1}"
  shell: "bash"
  safetyLevel: "safe"
  streamOutput: true
  needsUserApproval: false
  shouldAbort: true
  stdin:
    source: "none"
  env:
    exposeParents: false
    names: []
    static: {}
  flags:
    exitOnError: true
    unsetVars: true
    pipefail: false
```

## Next Steps

- [Condition Nodes](condition-nodes.md) - Learn about conditional branching
- [Loop Nodes](loop-nodes.md) - Understand iteration patterns
- [Workflow Design](../workflow-design.md) - Design effective workflows
- [Node Types Overview](index.md) - Complete node specifications
