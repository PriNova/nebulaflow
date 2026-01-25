# Integrations Overview

## Overview

NebulaFlow provides powerful integration capabilities to connect with external services, APIs, and LLM providers. This guide covers the available integrations and how to configure them.

## Available Integrations

### 1. LLM Integration

Connect to Large Language Models for intelligent processing:

- **Amp SDK** - Primary LLM provider
- **OpenRouter SDK** - Alternative LLM provider with multiple models

**Use cases:**
- Natural language processing
- Code generation
- Text analysis
- Conversation agents

### 2. CLI Integration

Execute shell commands and scripts:

- **Shell execution** - Run commands via Node.js child_process
- **Script execution** - Execute shell scripts
- **Environment management** - Control environment variables

**Use cases:**
- File operations
- System commands
- Build automation
- DevOps tasks

### 3. API Integration

Connect to external APIs:

- **REST APIs** - HTTP requests via CLI
- **GraphQL APIs** - Query execution
- **Custom endpoints** - Any HTTP-based service

**Use cases:**
- Data fetching
- Webhook processing
- Service orchestration
- Third-party integrations

## LLM Integration

### Amp SDK

The **Amp SDK** is the primary LLM provider for NebulaFlow.

#### Configuration

**Environment Variable:**
```bash
export AMP_API_KEY="your_amp_api_key_here"
```

**Workspace Settings:**
Create `.nebulaflow/settings.json` in your workspace root:

```json
{
  "nebulaflow": {
    "settings": {
      "amp.dangerouslyAllowAll": true,
      "amp.experimental.commandApproval.enabled": false,
      "amp.commands.allowlist": ["*"],
      "amp.commands.strict": false,
      "internal.primaryModel": "openrouter/anthropic/claude-3-5-sonnet"
    }
  }
}
```

#### Amp SDK Settings

The Amp SDK supports various settings that can be configured:

| Setting | Type | Description |
|---------|------|-------------|
| `amp.dangerouslyAllowAll` | boolean | Bypass safety checks (use with caution) |
| `amp.experimental.commandApproval.enabled` | boolean | Enable command approval workflow |
| `amp.commands.allowlist` | string[] | List of allowed commands (["*"] for all) |
| `amp.commands.strict` | boolean | Strict command validation |
| `internal.primaryModel` | string | Default model ID |
| `openrouter.models` | array | OpenRouter model configurations |

#### Model Configuration

You can configure multiple models in your workspace settings:

```json
{
  "nebulaflow": {
    "settings": {
      "openrouter.models": [
        {
          "model": "openrouter/anthropic/claude-3-5-sonnet",
          "provider": "anthropic",
          "maxOutputTokens": 4096,
          "contextWindow": 200000
        },
        {
          "model": "openrouter/openai/gpt-5.2-codex",
          "provider": "openai",
          "maxOutputTokens": 8192,
          "contextWindow": 128000
        }
      ]
    }
  }
}
```

#### Using LLM Nodes

1. **Add an LLM node** to your workflow
2. **Select a model** from the available models list
3. **Configure the prompt** using template variables
4. **Connect inputs** from upstream nodes
5. **Execute** the workflow

**Example:**
```
Text Node (input: "What is 2+2?")
    └── LLM Node (model: gpt-4, prompt: "Calculate: ${1}")
    └── Preview Node (display result)
```

### OpenRouter SDK

**OpenRouter SDK** provides access to multiple LLM providers through a single API.

#### Configuration

**Environment Variable:**
```bash
export OPENROUTER_API_KEY="your_openrouter_api_key_here"
```

**Workspace Settings:**
```json
{
  "nebulaflow": {
    "settings": {
      "openrouter.key": "sk-or-...",
      "openrouter.models": [
        {
          "model": "openrouter/anthropic/claude-3-5-sonnet",
          "provider": "anthropic"
        }
      ]
    }
  }
}
```

#### Supported Models

OpenRouter supports models from various providers:

- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus
- **OpenAI**: GPT-4, GPT-4o, GPT-4o mini
- **Google**: Gemini Pro, Gemini Ultra
- **Meta**: Llama 3
- **And many more**

#### Model Selection

Models are loaded automatically when you request them:

1. **Amp SDK models** - Loaded from the Amp SDK
2. **OpenRouter models** - Loaded from workspace settings
3. **Custom models** - Added via configuration

**Example model IDs:**
- `openrouter/anthropic/claude-3-5-sonnet`
- `openrouter/openai/gpt-4o`
- `openrouter/google/gemini-pro`

### LLM Node Configuration

#### Basic Configuration

```typescript
interface LLMNode {
    type: NodeType.LLM
    data: {
        title: string
        content: string  // Prompt template
        model: { id: string; title?: string }
        reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
        systemPromptTemplate?: string
        disabledTools?: string[]
        timeoutSec?: number
        dangerouslyAllowAll?: boolean
        attachments?: AttachmentRef[]
    }
}
```

#### Advanced Configuration

```typescript
{
    type: NodeType.LLM,
    data: {
        title: 'Code Review Agent',
        content: 'Review the following code: ${1}',
        model: { id: 'openrouter/anthropic/claude-3-5-sonnet' },
        reasoningEffort: 'high',
        systemPromptTemplate: 'You are a senior code reviewer.',
        disabledTools: ['bash', 'filesystem'],
        timeoutSec: 300,
        dangerouslyAllowAll: false,
        attachments: [
            {
                id: 'image1',
                kind: 'image',
                source: 'file',
                path: '/path/to/diagram.png'
            }
        ]
    }
}
```

#### Prompt Templates

Use template variables to reference upstream node outputs:

```
# Basic variable reference
"Process this: ${1}"

# Multiple variables
"Analyze ${1} and summarize: ${2}"

# Named variables (if using Variable nodes)
"User query: ${userQuery}"
```

#### Tool Calling

LLM nodes support tool/function calling:

```typescript
// Tools are automatically resolved via Amp SDK
// Disabled tools prevent certain capabilities
disabledTools: ['bash', 'filesystem']
```

#### Reasoning Effort

Control the reasoning effort level:

- **minimal** - Fast, less thorough
- **low** - Quick analysis
- **medium** - Balanced (default)
- **high** - Deep analysis, more tokens

#### Attachments

Support for image attachments:

```typescript
attachments: [
    {
        id: 'image1',
        kind: 'image',
        source: 'file',
        path: '/path/to/image.png',
        altText: 'Diagram showing workflow'
    }
]
```

### LLM Integration Best Practices

1. **Set AMP_API_KEY** - Required for execution
2. **Choose appropriate models** - Balance cost vs capability
3. **Use reasoning effort** - Optimize for your use case
4. **Test with small prompts** - Verify behavior before scaling
5. **Monitor token usage** - Track costs
6. **Use system prompts** - Guide model behavior
7. **Handle errors gracefully** - LLM calls can fail

## CLI Integration

### Shell Execution

CLI nodes execute shell commands via Node.js `child_process`.

#### Configuration

```typescript
interface CLINode {
    type: NodeType.CLI
    data: {
        title: string
        content: string  // Command to execute
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

#### Basic CLI Node

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Git Status',
        content: 'git status',
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
        mode: 'script',
        shell: 'bash'
    }
}
```

#### Environment Variables

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Build with Env',
        content: 'npm run build',
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

#### Safety Levels

**Safe Mode (default):**
- Requires approval for dangerous commands
- Validates command syntax
- Limits execution time

**Advanced Mode:**
- Bypasses some safety checks
- Requires `executionPolicyBypass: true`
- Use with caution

#### Approval System

CLI nodes require approval by default:

1. **Pending** - Node status: `pending_approval`
2. **Prompt** - User sees approval dialog
3. **Decision** - Approve or reject
4. **Execution** - Approved nodes execute

**Bypass approval:**
```typescript
{
    data: {
        dangerouslyAllowAll: true,
        flags: { executionPolicyBypass: true }
    }
}
```

### CLI Integration Best Practices

1. **Use approval system** - For dangerous commands
2. **Validate commands** - Test in safe environment first
3. **Stream output** - For long-running commands
4. **Handle errors** - Check exit codes
5. **Use stdin carefully** - Avoid command injection
6. **Set timeouts** - Prevent hanging processes
7. **Log execution** - Debug issues

## API Integration

### REST APIs

Connect to REST APIs using CLI nodes with `curl` or similar tools.

#### Basic GET Request

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Fetch Data',
        content: 'curl https://api.example.com/data',
        streamOutput: true
    }
}
```

#### POST Request with JSON

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Send Data',
        content: 'curl -X POST -H "Content-Type: application/json" -d \'${1}\' https://api.example.com/data',
        stdin: {
            source: 'parent-index',
            parentIndex: 0
        }
    }
}
```

#### API with Authentication

```typescript
{
    type: NodeType.CLI,
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

### GraphQL APIs

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'GraphQL Query',
        content: 'curl -X POST -H "Content-Type: application/json" -d \'{"query": "${1}"}\' https://api.example.com/graphql',
        stdin: {
            source: 'parent-index',
            parentIndex: 0
        }
    }
}
```

### Webhook Processing

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Process Webhook',
        content: 'node /path/to/webhook-processor.js',
        mode: 'script',
        stdin: {
            source: 'parent-index',
            parentIndex: 0
        }
    }
}
```

### API Integration Best Practices

1. **Use environment variables** - For API keys and secrets
2. **Handle rate limits** - Add delays if needed
3. **Validate responses** - Check status codes
4. **Parse JSON** - Use `jq` or Node.js scripts
5. **Handle errors** - Check for API errors
6. **Log requests** - Debug integration issues
7. **Use HTTPS** - Secure API communication

## Workspace Configuration

### Settings File

Configure workspace-specific settings in `.nebulaflow/settings.json`:

```json
{
  "nebulaflow": {
    "settings": {
      "amp.dangerouslyAllowAll": false,
      "amp.experimental.commandApproval.enabled": true,
      "amp.commands.allowlist": ["git", "npm", "node"],
      "amp.commands.strict": true,
      "internal.primaryModel": "openrouter/anthropic/claude-3-5-sonnet",
      "openrouter.key": "sk-or-...",
      "openrouter.models": [
        {
          "model": "openrouter/anthropic/claude-3-5-sonnet",
          "provider": "anthropic",
          "maxOutputTokens": 4096,
          "contextWindow": 200000
        },
        {
          "model": "openrouter/openai/gpt-5.2-codex",
          "provider": "openai",
          "maxOutputTokens": 8192,
          "contextWindow": 128000
        }
      ]
    }
  }
}
```

### Settings Keys

| Key | Type | Description |
|-----|------|-------------|
| `amp.dangerouslyAllowAll` | boolean | Bypass Amp safety checks |
| `amp.experimental.commandApproval.enabled` | boolean | Enable command approval |
| `amp.commands.allowlist` | string[] | Allowed commands (["*"] for all) |
| `amp.commands.strict` | boolean | Strict command validation |
| `internal.primaryModel` | string | Default model ID |
| `openrouter.key` | string | OpenRouter API key |
| `openrouter.models` | array | OpenRouter model configurations |

### Environment Variables

#### Required Variables

```bash
# Amp SDK (Required for LLM nodes)
export AMP_API_KEY="your_amp_api_key_here"

# OpenRouter SDK (Optional)
export OPENROUTER_API_KEY="your_openrouter_api_key_here"
```

#### Optional Variables

```bash
# Disable hybrid parallel execution
export NEBULAFLOW_DISABLE_HYBRID_PARALLEL=1

# Set default concurrency
export NEBULAFLOW_DEFAULT_CONCURRENCY=10

# Set per-type limits
export NEBULAFLOW_LLM_CONCURRENCY=8
export NEBULAFLOW_CLI_CONCURRENCY=8

# Set maximum safe iterations
export NEBULAFLOW_MAX_ITERATIONS=1000
```

## Integration Patterns

### Pattern 1: LLM + CLI

**Use case:** Generate and execute commands

```
Text Node (user request)
    └── LLM Node (generate command)
    └── CLI Node (execute command)
    └── Preview Node (display result)
```

**Example:**
```
"List all JavaScript files"
    └── LLM: "Generate find command: ${1}"
    └── CLI: "find . -name \"*.js\""
    └── Preview: Display results
```

### Pattern 2: API + LLM

**Use case:** Fetch data and process with LLM

```
CLI Node (fetch API data)
    └── LLM Node (analyze data)
    └── Preview Node (display insights)
```

**Example:**
```
CLI: "curl https://api.github.com/repos/owner/repo"
    └── LLM: "Summarize this repository: ${1}"
    └── Preview: Display summary
```

### Pattern 3: Multi-Provider LLM

**Use case:** Compare responses from different models

```
Text Node (query)
    ├── LLM Node (Model A)
    ├── LLM Node (Model B)
    └── Accumulator Node (collect responses)
```

### Pattern 4: Conditional API Calls

**Use case:** Call API based on condition

```
Text Node (input)
    └── IF Node (check condition)
        ├── True: CLI (call API A)
        └── False: CLI (call API B)
    └── Preview Node (display result)
```

## Security Considerations

### API Keys

**Never commit API keys to version control:**

```bash
# Good: Use environment variables
export AMP_API_KEY="your_key"

# Bad: Hardcoding in workflows
# content: "curl -H \"Authorization: Bearer sk-...\""
```

### Command Injection

**Validate and sanitize inputs:**

```typescript
// Good: Use stdin for data
stdin: {
    source: 'parent-index',
    parentIndex: 0
}

// Bad: Direct string interpolation
content: "echo ${userInput}"  // Risk of injection
```

### Approval System

**Use approval for dangerous operations:**

```typescript
// Safe: Requires approval
data: {
    content: "rm -rf /path/to/dir",
    needsUserApproval: true
}

// Dangerous: Bypasses approval
data: {
    content: "rm -rf /path/to/dir",
    dangerouslyAllowAll: true
}
```

### Environment Variables

**Secure handling of secrets:**

```typescript
// Good: Use environment variables
env: {
    static: {
        API_KEY: '${apiKey}'
    }
}

// Bad: Hardcoded secrets
env: {
    static: {
        API_KEY: 'sk-...'
    }
}
```

## Troubleshooting

### LLM Integration Issues

#### "Amp SDK not available"

**Cause:** SDK not properly linked

**Solution:**
```bash
npm i /home/prinova/CodeProjects/upstreamAmp/sdk
```

#### "AMP_API_KEY is not set"

**Cause:** Environment variable missing

**Solution:**
```bash
export AMP_API_KEY="your_key"
```

#### "Model not found"

**Cause:** Model ID incorrect or not available

**Solution:**
1. Check available models in UI
2. Verify model ID in workspace settings
3. Ensure API key is valid

### CLI Integration Issues

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

### API Integration Issues

#### "Connection refused"

**Cause:** API endpoint unreachable

**Solution:**
1. Check network connectivity
2. Verify API endpoint URL
3. Check firewall rules

#### "Authentication failed"

**Cause:** Invalid API key or token

**Solution:**
1. Verify API key in environment
2. Check token expiration
3. Validate authentication headers

#### "Rate limit exceeded"

**Cause:** Too many requests

**Solution:**
1. Add delays between requests
2. Implement retry logic
3. Check API rate limits

## Performance Optimization

### LLM Performance

1. **Choose appropriate model** - Balance cost vs capability
2. **Use reasoning effort** - Optimize token usage
3. **Cache responses** - Avoid redundant calls
4. **Batch requests** - When possible

### CLI Performance

1. **Stream output** - For long-running commands
2. **Use appropriate shell** - bash for speed, sh for compatibility
3. **Minimize I/O** - Reduce file operations
4. **Parallel execution** - Use workflow parallelism

### API Performance

1. **Use efficient endpoints** - Choose appropriate API versions
2. **Implement caching** - Cache API responses
3. **Batch requests** - When API supports it
4. **Handle rate limits** - Implement retry logic

## Best Practices

### General Integration Best Practices

1. **Use environment variables** - For secrets and configuration
2. **Implement error handling** - Check for failures
3. **Log integration steps** - Debug issues
4. **Test integrations** - Verify behavior in isolation
5. **Document integrations** - Explain configuration
6. **Monitor usage** - Track API calls and costs
7. **Use approval system** - For dangerous operations

### LLM Integration Best Practices

1. **Set AMP_API_KEY** - Required for execution
2. **Choose appropriate models** - Balance cost vs capability
3. **Use reasoning effort** - Optimize for your use case
4. **Test with small prompts** - Verify behavior before scaling
5. **Monitor token usage** - Track costs
6. **Use system prompts** - Guide model behavior
7. **Handle errors gracefully** - LLM calls can fail

### CLI Integration Best Practices

1. **Use approval system** - For dangerous commands
2. **Validate commands** - Test in safe environment first
3. **Stream output** - For long-running commands
4. **Handle errors** - Check exit codes
5. **Use stdin carefully** - Avoid command injection
6. **Set timeouts** - Prevent hanging processes
7. **Log execution** - Debug issues

### API Integration Best Practices

1. **Use environment variables** - For API keys and secrets
2. **Handle rate limits** - Add delays if needed
3. **Validate responses** - Check status codes
4. **Parse JSON** - Use `jq` or Node.js scripts
5. **Handle errors** - Check for API errors
6. **Log requests** - Debug integration issues
7. **Use HTTPS** - Secure API communication

## Related Documentation

- [Node Types Reference](../api-reference/node-types.md) - Detailed node type documentation
- [Protocol Reference](../api-reference/protocol.md) - Message protocol for execution
- [Events Reference](../api-reference/events.md) - Event system documentation
- [Extension API Reference](../api-reference/extension.md) - Extension API details
- [Advanced Workflows](../workflows/advanced.md) - Advanced workflow patterns
