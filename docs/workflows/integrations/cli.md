# CLI Integration

## Overview

CLI nodes in NebulaFlow execute shell commands and scripts via Node.js `child_process`. This guide covers configuration, usage, and best practices for CLI integration.

## CLI Node Configuration

### Basic Configuration

```typescript
interface CLINode {
    type: NodeType.CLI
    data: {
        title: string
        content: string  // Command to execute
        active: boolean
        mode?: 'command' | 'script'
        shell?: 'bash' | 'sh' | 'zsh' | 'pwsh' | 'cmd'
        safetyLevel?: 'safe' | 'advanced'
        streamOutput?: boolean
        stdin?: {
            source?: 'none' | 'parents-all' | 'parent-index' | 'literal'
            parentIndex?: number
            literal?: string
            stripCodeFences?: boolean
            normalizeCRLF?: boolean
        }
        env?: {
            exposeParents?: boolean
            names?: string[]
            static?: Record<string, string>
        }
        flags?: {
            exitOnError?: boolean
            unsetVars?: boolean
            pipefail?: boolean
            noProfile?: boolean
            nonInteractive?: boolean
            executionPolicyBypass?: boolean
        }
    }
}
```

### Example Configurations

#### Basic Command

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Git Status',
        content: 'git status',
        active: true,
        mode: 'command',
        shell: 'bash',
        streamOutput: true
    }
}
```

#### Command with Input

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Process File',
        content: 'cat ${1} | grep "error"',
        active: true,
        mode: 'command',
        stdin: {
            source: 'parent-index',
            parentIndex: 0
        }
    }
}
```

#### Script Execution

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Run Script',
        content: '#!/bin/bash\necho "Hello from script"\nls -la',
        active: true,
        mode: 'script',
        shell: 'bash'
    }
}
```

#### Command with Environment Variables

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Build with Env',
        content: 'npm run build',
        active: true,
        env: {
            static: {
                NODE_ENV: 'production',
                API_KEY: '${apiKey}'
            },
            exposeParents: true,
            names: ['PATH', 'HOME']
        }
    }
}
```

#### Safe Command (Requires Approval)

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Delete Files',
        content: 'rm -rf /tmp/temp-*',
        active: true,
        safetyLevel: 'safe',
        needsUserApproval: true
    }
}
```

#### Advanced Command (Bypasses Approval)

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'System Cleanup',
        content: 'sudo apt-get autoremove -y',
        active: true,
        safetyLevel: 'advanced',
        flags: {
            executionPolicyBypass: true
        },
        dangerouslyAllowAll: true
    }
}
```

## Command Modes

### Command Mode

**Default mode** - Execute a single command:

```typescript
{
    data: {
        mode: 'command',
        content: 'git status'
    }
}
```

**Use when:**
- Running single commands
- Simple operations
- Quick tasks

### Script Mode

Execute multi-line scripts:

```typescript
{
    data: {
        mode: 'script',
        content: `#!/bin/bash
echo "Starting build..."
npm install
npm run build
echo "Build complete!"`
    }
}
```

**Use when:**
- Multi-step operations
- Complex logic
- Reusable scripts

## Shell Selection

### Available Shells

| Shell | Platform | Use Case |
|-------|----------|----------|
| `bash` | Linux/macOS | Default, feature-rich |
| `sh` | Unix | Minimal, portable |
| `zsh` | Linux/macOS | Advanced features |
| `pwsh` | Windows | PowerShell Core |
| `cmd` | Windows | Legacy Windows |

### Configuration

```typescript
{
    data: {
        shell: 'bash'  // Choose based on platform
    }
}
```

### Platform Detection

**Best practice:** Use platform-appropriate shell:

```typescript
// For cross-platform workflows
{
    data: {
        shell: process.platform === 'win32' ? 'cmd' : 'bash'
    }
}
```

## Input Handling

### Input Sources

#### None (Default)

No stdin input:

```typescript
{
    data: {
        stdin: {
            source: 'none'
        }
    }
}
```

#### Parent Index

Input from specific parent node:

```typescript
{
    data: {
        stdin: {
            source: 'parent-index',
            parentIndex: 0  // First parent
        }
    }
}
```

#### Parents All

Input from all parent nodes:

```typescript
{
    data: {
        stdin: {
            source: 'parents-all'
        }
    }
}
```

#### Literal

Static input string:

```typescript
{
    data: {
        stdin: {
            source: 'literal',
            literal: 'Hello, World!'
        }
    }
}
```

### Input Processing Options

#### Strip Code Fences

Remove markdown code fences:

```typescript
{
    data: {
        stdin: {
            source: 'parent-index',
            parentIndex: 0,
            stripCodeFences: true
        }
    }
}
```

#### Normalize CRLF

Convert Windows line endings:

```typescript
{
    data: {
        stdin: {
            source: 'parent-index',
            parentIndex: 0,
            normalizeCRLF: true
        }
    }
}
```

## Environment Variables

### Static Variables

Define variables directly:

```typescript
{
    data: {
        env: {
            static: {
                NODE_ENV: 'production',
                API_KEY: '${apiKey}',
                PATH: '/usr/local/bin:${PATH}'
            }
        }
    }
}
```

### Parent Variables

Inherit variables from parent nodes:

```typescript
{
    data: {
        env: {
            exposeParents: true
        }
    }
}
```

### Named Variables

Select specific environment variables:

```typescript
{
    data: {
        env: {
            names: ['PATH', 'HOME', 'USER']
        }
    }
}
```

### Variable Substitution

Use template variables in commands:

```typescript
{
    data: {
        content: 'echo "Hello ${userName}"',
        env: {
            static: {
                userName: '${user.name}'
            }
        }
    }
}
```

## Execution Flags

### Exit on Error

Stop execution on command failure:

```typescript
{
    data: {
        flags: {
            exitOnError: true
        }
    }
}
```

### Unset Variables

Clear inherited variables:

```typescript
{
    data: {
        flags: {
            unsetVars: true
        }
    }
}
```

### Pipefail

Fail if any command in pipe fails:

```typescript
{
    data: {
        flags: {
            pipefail: true
        }
    }
}
```

### No Profile

Skip shell profile loading:

```typescript
{
    data: {
        flags: {
            noProfile: true
        }
    }
}
```

### Non-Interactive

Run in non-interactive mode:

```typescript
{
    data: {
        flags: {
            nonInteractive: true
        }
    }
}
```

### Execution Policy Bypass

Bypass safety checks (use with caution):

```typescript
{
    data: {
        flags: {
            executionPolicyBypass: true
        },
        dangerouslyAllowAll: true
    }
}
```

## Safety Levels

### Safe Mode (Default)

**Features:**
- Requires approval for dangerous commands
- Validates command syntax
- Limits execution time
- Restricts file system access

**Use when:**
- Running user-provided commands
- Production environments
- Security-critical operations

**Example:**
```typescript
{
    data: {
        safetyLevel: 'safe',
        needsUserApproval: true
    }
}
```

### Advanced Mode

**Features:**
- Bypasses some safety checks
- Allows dangerous commands
- Requires explicit bypass flag

**Use when:**
- Trusted environments
- System administration
- Development workflows

**Example:**
```typescript
{
    data: {
        safetyLevel: 'advanced',
        flags: {
            executionPolicyBypass: true
        },
        dangerouslyAllowAll: true
    }
}
```

## Approval System

### How It Works

1. **Pending** - Node status: `pending_approval`
2. **Prompt** - User sees approval dialog
3. **Decision** - Approve or reject
4. **Execution** - Approved nodes execute

### Approval Dialog

The dialog shows:
- Command to execute
- Safety level
- Potential risks
- Approval/reject buttons

### Bypassing Approval

**Warning:** Only use in trusted environments.

```typescript
{
    data: {
        dangerouslyAllowAll: true,
        flags: {
            executionPolicyBypass: true
        }
    }
}
```

## Output Streaming

### Streaming Output

Enable real-time output streaming:

```typescript
{
    data: {
        streamOutput: true
    }
}
```

### Output Events

Streaming output is sent via events:

```typescript
{
    type: 'node_output_chunk',
    data: {
        nodeId: 'cli-node-1',
        chunk: 'Building project...\n',
        stream: 'stdout'
    }
}
```

### Output Streams

**stdout:** Standard output
```typescript
{ stream: 'stdout' }
```

**stderr:** Error output
```typescript
{ stream: 'stderr' }
```

## Common Use Cases

### File Operations

#### List Files

```typescript
{
    data: {
        title: 'List Files',
        content: 'ls -la',
        streamOutput: true
    }
}
```

#### Copy Files

```typescript
{
    data: {
        title: 'Copy Files',
        content: 'cp -r ${source} ${destination}',
        env: {
            static: {
                source: '${sourcePath}',
                destination: '${destPath}'
            }
        }
    }
}
```

#### Search Files

```typescript
{
    data: {
        title: 'Search Files',
        content: 'find . -name "*.js" -type f',
        streamOutput: true
    }
}
```

### Git Operations

#### Status

```typescript
{
    data: {
        title: 'Git Status',
        content: 'git status',
        streamOutput: true
    }
}
```

#### Commit

```typescript
{
    data: {
        title: 'Git Commit',
        content: 'git commit -m "${message}"',
        env: {
            static: {
                message: '${commitMessage}'
            }
        }
    }
}
```

#### Push

```typescript
{
    data: {
        title: 'Git Push',
        content: 'git push origin ${branch}',
        env: {
            static: {
                branch: '${gitBranch}'
            }
        }
    }
}
```

### Build Operations

#### npm Install

```typescript
{
    data: {
        title: 'Install Dependencies',
        content: 'npm install',
        streamOutput: true
    }
}
```

#### Build

```typescript
{
    data: {
        title: 'Build Project',
        content: 'npm run build',
        env: {
            static: {
                NODE_ENV: 'production'
            }
        },
        streamOutput: true
    }
}
```

#### Test

```typescript
{
    data: {
        title: 'Run Tests',
        content: 'npm test',
        streamOutput: true
    }
}
```

### System Operations

#### System Info

```typescript
{
    data: {
        title: 'System Info',
        content: 'uname -a && free -h && df -h',
        streamOutput: true
    }
}
```

#### Process Management

```typescript
{
    data: {
        title: 'List Processes',
        content: 'ps aux | grep node',
        streamOutput: true
    }
}
```

#### Disk Usage

```typescript
{
    data: {
        title: 'Disk Usage',
        content: 'du -sh * | sort -hr',
        streamOutput: true
    }
}
```

### API Integration

#### Fetch Data

```typescript
{
    data: {
        title: 'Fetch API Data',
        content: 'curl https://api.example.com/data',
        streamOutput: true
    }
}
```

#### POST Data

```typescript
{
    data: {
        title: 'Send Data',
        content: 'curl -X POST -H "Content-Type: application/json" -d \'${data}\' https://api.example.com/data',
        stdin: {
            source: 'parent-index',
            parentIndex: 0
        }
    }
}
```

#### With Authentication

```typescript
{
    data: {
        title: 'Authenticated Request',
        content: 'curl -H "Authorization: Bearer ${apiKey}" https://api.example.com/protected',
        env: {
            static: {
                apiKey: '${apiKey}'
            }
        }
    }
}
```

## Integration Patterns

### Pattern 1: Sequential Commands

```
CLI Node A (command 1)
    └── CLI Node B (command 2)
    └── CLI Node C (command 3)
```

**Example:**
```
npm install
    └── npm run build
    └── npm test
```

### Pattern 2: Parallel Commands

```
CLI Node A ──┐
CLI Node B ──┤ → CLI Node D
CLI Node C ──┘
```

**Example:**
```
Build A ──┐
Build B ──┤ → Deploy
Build C ──┘
```

### Pattern 3: Command with Input

```
Text Node (input)
    └── CLI Node (process input)
    └── Preview Node (result)
```

**Example:**
```
"File path: /path/to/file.txt"
    └── cat ${1}
    └── Display content
```

### Pattern 4: Conditional Commands

```
IF Node (condition)
    ├── True: CLI (command A)
    └── False: CLI (command B)
```

**Example:**
```
IF file exists
    ├── True: cat file.txt
    └── False: echo "File not found"
```

### Pattern 5: Loop Commands

```
Loop Start (iterations=5)
    └── CLI Node (process item ${i})
Loop End
```

**Example:**
```
Loop Start (i=0 to 4)
    └── process item ${i}
Loop End
```

## Performance Optimization

### Command Efficiency

1. **Use appropriate shell** - bash for speed, sh for compatibility
2. **Minimize I/O** - Reduce file operations
3. **Use built-ins** - Prefer shell built-ins over external commands
4. **Parallel execution** - Use workflow parallelism

### Output Handling

1. **Stream output** - For long-running commands
2. **Filter output** - Use grep, jq, etc.
3. **Limit output** - Use head, tail, etc.
4. **Parse efficiently** - Use appropriate tools

### Resource Management

1. **Set timeouts** - Prevent hanging processes
2. **Limit concurrency** - Use workflow settings
3. **Monitor resources** - Track CPU/memory usage
4. **Clean up** - Remove temporary files

## Security Considerations

### Command Injection

**Never directly interpolate user input:**

```typescript
// Bad: Direct interpolation
content: "echo ${userInput}"  // Risk of injection

// Good: Use stdin
stdin: {
    source: 'parent-index',
    parentIndex: 0
}
content: "cat"
```

### Dangerous Commands

**Avoid or require approval:**
- `rm -rf /`
- `sudo`
- `format`
- `shutdown`

### File System Access

**Restrict access:**
```typescript
{
    data: {
        flags: {
            executionPolicyBypass: false
        },
        disabledTools: ['filesystem']
    }
}
```

### Environment Security

**Don't expose sensitive variables:**
```typescript
// Bad: Exposing all variables
env: { exposeParents: true }

// Good: Selective exposure
env: {
    names: ['PATH', 'HOME']
}
```

## Troubleshooting

### Common Issues

#### "Command not found"

**Cause:** Command not in PATH

**Solution:**
```typescript
{
    data: {
        content: "/full/path/to/command",
        env: { exposeParents: true }
    }
}
```

#### "Permission denied"

**Cause:** Insufficient permissions

**Solution:**
```typescript
{
    data: {
        content: "chmod +x script.sh && ./script.sh",
        flags: { executionPolicyBypass: true }
    }
}
```

#### "Process timeout"

**Cause:** Command taking too long

**Solution:**
```typescript
{
    data: {
        content: "long-running-command",
        flags: { exitOnError: true }
    }
}
```

#### "Exit code non-zero"

**Cause:** Command failed

**Solution:**
```typescript
{
    data: {
        flags: { exitOnError: true }
    }
}
```

### Debugging Tips

**Enable streaming:**
```typescript
{
    data: {
        streamOutput: true
    }
}
```

**Check exit codes:**
```typescript
// CLI nodes return exit code in result
// Check for non-zero exit codes
```

**Log execution:**
```typescript
{
    data: {
        title: 'Debug Command',
        content: 'set -x && your-command',
        streamOutput: true
    }
}
```

## Best Practices

### General

1. **Use approval system** - For dangerous commands
2. **Validate commands** - Test in safe environment first
3. **Stream output** - For long-running commands
4. **Handle errors** - Check exit codes
5. **Use stdin carefully** - Avoid command injection
6. **Set timeouts** - Prevent hanging processes
7. **Log execution** - Debug issues

### Command Design

1. **Keep commands simple** - One command per node
2. **Use full paths** - Avoid PATH issues
3. **Quote variables** - Prevent word splitting
4. **Use built-ins** - When possible
5. **Test commands** - Verify before workflow

### Security

1. **Never trust input** - Validate all inputs
2. **Use safe mode** - For user-provided commands
3. **Restrict file access** - Use appropriate permissions
4. **Monitor execution** - Log all commands
5. **Use approval** - For dangerous operations

### Performance

1. **Use appropriate shell** - Match to platform
2. **Minimize I/O** - Reduce file operations
3. **Parallel execution** - Use workflow parallelism
4. **Stream output** - For long-running commands
5. **Limit output** - Use head/tail/grep

## Advanced Configuration

### Custom Shell Configuration

```typescript
{
    data: {
        content: 'source ~/.bashrc && your-command',
        shell: 'bash',
        flags: {
            noProfile: false  // Load profile
        }
    }
}
```

### Timeout Configuration

```typescript
{
    data: {
        content: 'long-running-command',
        flags: {
            exitOnError: true  // Fail on timeout
        }
    }
}
```

### Resource Limits

```typescript
{
    data: {
        content: 'resource-intensive-command',
        env: {
            static: {
                NODE_OPTIONS: '--max-old-space-size=4096'
            }
        }
    }
}
```

### Parallel Execution

```typescript
// Use workflow parallelism
// Set concurrency limits in workflow settings
{
    data: {
        content: 'build-command',
        streamOutput: true
    }
}
```

## Related Documentation

- [Node Types Reference](../../api-reference/node-types.md) - CLI node details
- [Protocol Reference](../../api-reference/protocol.md) - Message protocol
- [Events Reference](../../api-reference/events.md) - Event system
- [Integrations Overview](../integrations.md) - All integrations
- [Advanced Workflows](../advanced.md) - Advanced patterns
