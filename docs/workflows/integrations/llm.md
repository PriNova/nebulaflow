# LLM Integration

## Overview

NebulaFlow integrates with Large Language Models (LLMs) via the **Amp SDK** and **OpenRouter SDK**. This guide covers configuration, usage, and best practices for LLM nodes.

## Providers

### Amp SDK (Primary)

The **Amp SDK** is the primary LLM provider for NebulaFlow.

**Features:**
- Native integration
- Tool calling support
- Conversation history
- Streaming responses
- Safety controls

**Requirements:**
- Amp API key
- Network access to Amp service

### OpenRouter SDK (Alternative)

**OpenRouter SDK** provides access to multiple LLM providers through a single API.

**Features:**
- Multiple model providers (Anthropic, OpenAI, Google, etc.)
- Unified API
- Model routing
- Cost optimization

**Requirements:**
- OpenRouter API key
- Network access to OpenRouter service

## Configuration

### Environment Variables

#### Amp SDK

```bash
export AMP_API_KEY="your_amp_api_key_here"
```

**Required:** Yes (for LLM nodes)

**How to get:**
1. Sign up at Amp service
2. Generate API key in dashboard
3. Add to your environment

#### OpenRouter SDK

```bash
export OPENROUTER_API_KEY="your_openrouter_api_key_here"
```

**Required:** No (optional)

**How to get:**
1. Sign up at OpenRouter
2. Generate API key
3. Add to your environment

### Workspace Settings

Create `.nebulaflow/settings.json` in your workspace root:

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

### Amp SDK Settings

The Amp SDK supports various settings that can be configured:

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `amp.dangerouslyAllowAll` | boolean | Bypass safety checks | `false` |
| `amp.experimental.commandApproval.enabled` | boolean | Enable command approval | `true` |
| `amp.commands.allowlist` | string[] | Allowed commands | `[]` |
| `amp.commands.strict` | boolean | Strict command validation | `true` |
| `internal.primaryModel` | string | Default model ID | - |
| `openrouter.models` | array | OpenRouter model configs | `[]` |

### OpenRouter Model Configuration

Configure OpenRouter models in workspace settings:

```json
{
  "nebulaflow": {
    "settings": {
      "openrouter.models": [
        {
          "model": "openrouter/anthropic/claude-3-5-sonnet",
          "provider": "anthropic",
          "maxOutputTokens": 4096,
          "contextWindow": 200000,
          "isReasoning": false,
          "reasoning_effort": "medium"
        },
        {
          "model": "openrouter/openai/gpt-5.2-codex",
          "provider": "openai",
          "maxOutputTokens": 8192,
          "contextWindow": 128000,
          "isReasoning": true,
          "reasoning_effort": "high"
        }
      ]
    }
  }
}
```

**Configuration options:**
- `model`: Full model ID
- `provider`: Provider name (for routing)
- `maxOutputTokens`: Maximum tokens to generate
- `contextWindow`: Context window size
- `isReasoning`: Whether model supports reasoning
- `reasoning_effort`: Default reasoning effort level

## LLM Node Configuration

### Basic Configuration

```typescript
interface LLMNode {
    type: NodeType.LLM
    data: {
        title: string
        content: string  // Prompt template
        active: boolean
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

### Example Configurations

#### Basic LLM Node

```typescript
{
    type: NodeType.LLM,
    data: {
        title: 'Simple Query',
        content: 'What is the capital of France?',
        active: true,
        model: { id: 'openrouter/anthropic/claude-3-5-sonnet' }
    }
}
```

#### LLM with Variable Input

```typescript
{
    type: NodeType.LLM,
    data: {
        title: 'Process User Input',
        content: 'Analyze the following text and provide a summary: ${1}',
        active: true,
        model: { id: 'openrouter/openai/gpt-4o' },
        reasoningEffort: 'medium'
    }
}
```

#### LLM with System Prompt

```typescript
{
    type: NodeType.LLM,
    data: {
        title: 'Code Review Agent',
        content: 'Review this code: ${1}',
        active: true,
        model: { id: 'openrouter/anthropic/claude-3-5-sonnet' },
        systemPromptTemplate: 'You are a senior software engineer with 10+ years of experience. Provide detailed, constructive feedback on code quality, security, and best practices.'
    }
}
```

#### LLM with Tool Restrictions

```typescript
{
    type: NodeType.LLM,
    data: {
        title: 'Safe Assistant',
        content: 'Answer this question: ${1}',
        active: true,
        model: { id: 'openrouter/anthropic/claude-3-5-sonnet' },
        disabledTools: ['bash', 'filesystem', 'network'],
        dangerouslyAllowAll: false
    }
}
```

#### LLM with Attachments

```typescript
{
    type: NodeType.LLM,
    data: {
        title: 'Image Analysis',
        content: 'Describe what you see in this image',
        active: true,
        model: { id: 'openrouter/openai/gpt-4o' },
        attachments: [
            {
                id: 'image1',
                kind: 'image',
                source: 'file',
                path: '/path/to/diagram.png',
                altText: 'Architecture diagram'
            }
        ]
    }
}
```

## Model Selection

### Available Models

Models are loaded from two sources:

1. **Amp SDK models** - Built-in models from Amp
2. **OpenRouter models** - Configured in workspace settings

### Viewing Available Models

1. **Open workflow editor**
2. **Add LLM node**
3. **Click model dropdown**
4. **Select from available models**

### Model ID Format

**Amp SDK models:**
- `gpt-4o`
- `gpt-4o-mini`
- `claude-3-5-sonnet`

**OpenRouter models:**
- `openrouter/anthropic/claude-3-5-sonnet`
- `openrouter/openai/gpt-4o`
- `openrouter/google/gemini-pro`

### Model Resolution

The selected model ID is normalized via the Amp SDK's `resolveModel` function. If resolution fails, the raw ID is used.

## Prompt Engineering

### Prompt Templates

Use template variables to reference upstream node outputs:

```
# Basic variable reference
"Process this: ${1}"

# Multiple variables
"Analyze ${1} and summarize: ${2}"

# Named variables (if using Variable nodes)
"User query: ${userQuery}"
```

### System Prompts

Set a system prompt to guide model behavior:

```typescript
{
    data: {
        systemPromptTemplate: 'You are a helpful assistant specialized in technical documentation.'
    }
}
```

### Best Practices

1. **Be specific** - Clear instructions yield better results
2. **Provide examples** - Show the model what you want
3. **Use variables** - Reference upstream data
4. **Set constraints** - Guide the model's behavior
5. **Test iteratively** - Refine prompts based on results

## Reasoning Effort

### What is Reasoning Effort?

Reasoning effort controls how much computational effort the model uses to generate responses.

### Levels

- **minimal** - Fast, less thorough
- **low** - Quick analysis
- **medium** - Balanced (default)
- **high** - Deep analysis, more tokens

### Configuration

```typescript
{
    data: {
        reasoningEffort: 'high'  // Use for complex tasks
    }
}
```

### When to Use Each Level

**minimal:**
- Simple factual questions
- Quick responses
- Low-cost operations

**low:**
- General queries
- Standard analysis
- Balanced performance

**medium:**
- Complex reasoning
- Detailed analysis
- Default for most tasks

**high:**
- Critical decisions
- Deep analysis
- Maximum accuracy

## Tool Calling

### What is Tool Calling?

Tool calling allows LLMs to invoke external functions or tools.

### Tool Name Resolution

Tools are automatically resolved via the Amp SDK:

```typescript
// Tools are normalized to official names
disabledTools: ['bash', 'filesystem']  // Normalized to official tool names
```

### Disabling Tools

Prevent certain capabilities:

```typescript
{
    data: {
        disabledTools: ['bash', 'filesystem', 'network']
    }
}
```

### Available Tools

**Common tools:**
- `bash` - Shell command execution
- `filesystem` - File system access
- `network` - Network requests
- `code_execution` - Code execution

## Attachments

### What are Attachments?

Attachments allow LLMs to process images and other media.

### Attachment Types

**Images:**
```typescript
{
    attachments: [
        {
            id: 'image1',
            kind: 'image',
            source: 'file',
            path: '/path/to/image.png',
            altText: 'Description of image'
        }
    ]
}
```

**URL-based images:**
```typescript
{
    attachments: [
        {
            id: 'image2',
            kind: 'image',
            source: 'url',
            url: 'https://example.com/image.png',
            altText: 'Description of image'
        }
    ]
}
```

### Using Attachments

1. **Add attachment** to LLM node configuration
2. **Reference in prompt** if needed
3. **Model processes** attachment automatically

## Conversation History

### What is Conversation History?

LLM nodes maintain conversation history for multi-turn interactions.

### How it Works

1. **Thread ID** is generated for each conversation
2. **History is stored** in workflow state
3. **Context is preserved** across multiple executions

### Using Conversation History

```typescript
// LLM node automatically maintains history
// No special configuration needed
```

### Thread Management

**Thread IDs are stored per node:**
- Unique thread per LLM node
- Persisted in workflow state
- Reused across executions

**Example workflow:**
```
LLM Node (Thread A) → LLM Node (Thread A) → LLM Node (Thread B)
```

## Execution Flow

### LLM Node Execution

1. **Input collection** - Gather inputs from upstream nodes
2. **Prompt building** - Construct prompt from template
3. **Model selection** - Choose model from configuration
4. **API call** - Send request to LLM provider
5. **Streaming response** - Receive tokens as they're generated
6. **Result collection** - Assemble complete response
7. **History update** - Store conversation context

### Streaming

LLM nodes stream responses in real-time:

```typescript
// Events received during execution
{
    type: 'node_assistant_content',
    data: {
        nodeId: 'llm-node-1',
        threadID: 'thread-abc-123',
        content: [
            { type: 'text', text: 'Hello' },
            { type: 'thinking', thinking: 'I need to respond...' }
        ]
    }
}
```

### Error Handling

**Common errors:**
- `AMP_API_KEY not set` - Set environment variable
- `Model not found` - Check model ID
- `Rate limit exceeded` - Wait and retry
- `Network error` - Check connectivity

## Performance Optimization

### Token Usage

**Monitor token counts:**
```typescript
// Token count events
{
    type: 'token_count',
    data: {
        count: 150,
        nodeId: 'llm-node-1'
    }
}
```

**Optimization tips:**
- Use appropriate reasoning effort
- Keep prompts concise
- Use system prompts to guide behavior
- Cache repeated queries

### Model Selection

**Choose the right model:**
- **Simple tasks** - Use smaller, faster models
- **Complex reasoning** - Use larger models with high reasoning effort
- **Cost-sensitive** - Use cheaper models when possible

### Caching

**Implement caching:**
- Cache repeated queries
- Store results in workflow state
- Use Variable nodes for reuse

## Security Considerations

### API Keys

**Never commit API keys:**
```bash
# Good: Environment variables
export AMP_API_KEY="your_key"

# Bad: Hardcoded in workflows
# content: "Use key: sk-..."
```

### Safety Controls

**Use Amp safety features:**
```typescript
{
    data: {
        dangerouslyAllowAll: false,  // Keep false for safety
        disabledTools: ['bash', 'filesystem']  // Disable dangerous tools
    }
}
```

### Data Privacy

**Be aware of:**
- What data is sent to LLM providers
- Provider data retention policies
- Compliance requirements

## Troubleshooting

### Common Issues

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
export AMP_API_KEY="your_amp_api_key_here"
```

#### "Model not found"

**Cause:** Model ID incorrect or not available

**Solution:**
1. Check available models in UI
2. Verify model ID in workspace settings
3. Ensure API key is valid

#### "Rate limit exceeded"

**Cause:** Too many API requests

**Solution:**
1. Wait and retry
2. Use different model
3. Implement retry logic

#### "Timeout"

**Cause:** Request taking too long

**Solution:**
1. Increase timeout setting
2. Use faster model
3. Simplify prompt

### Debugging Tips

**Enable debug logging:**
```typescript
// Extension logs show:
// - API requests
// - Model resolution
// - Error details
```

**Check events:**
- `node_assistant_content` - Streaming responses
- `token_count` - Token usage
- `node_execution_status` - Execution status

## Integration Patterns

### Pattern 1: Simple Query

```
Text Node (query)
    └── LLM Node (answer query)
    └── Preview Node (display result)
```

### Pattern 2: Multi-Step Processing

```
Text Node (input)
    └── LLM Node (analyze)
    └── LLM Node (summarize)
    └── Preview Node (final result)
```

### Pattern 3: Conditional Processing

```
Text Node (input)
    └── IF Node (check condition)
        ├── True: LLM Node (process A)
        └── False: LLM Node (process B)
    └── Preview Node (combine results)
```

### Pattern 4: Loop Processing

```
Loop Start (iterations=5)
    └── LLM Node (process item ${i})
Loop End
    └── Accumulator Node (collect results)
```

### Pattern 5: Multi-Model Comparison

```
Text Node (query)
    ├── LLM Node (Model A)
    ├── LLM Node (Model B)
    └── Accumulator Node (compare responses)
```

## Best Practices

### General

1. **Set AMP_API_KEY** - Required for execution
2. **Choose appropriate models** - Balance cost vs capability
3. **Use reasoning effort** - Optimize for your use case
4. **Test with small prompts** - Verify behavior before scaling
5. **Monitor token usage** - Track costs
6. **Use system prompts** - Guide model behavior
7. **Handle errors gracefully** - LLM calls can fail

### Prompt Design

1. **Be specific** - Clear instructions yield better results
2. **Provide examples** - Show the model what you want
3. **Use variables** - Reference upstream data
4. **Set constraints** - Guide the model's behavior
5. **Test iteratively** - Refine prompts based on results

### Security

1. **Use environment variables** - For API keys
2. **Enable safety controls** - Keep `dangerouslyAllowAll` false
3. **Disable dangerous tools** - Prevent unwanted capabilities
4. **Monitor data sent** - Be aware of privacy implications

### Performance

1. **Choose right model** - Match model to task complexity
2. **Use appropriate reasoning** - Balance speed and quality
3. **Implement caching** - Avoid redundant calls
4. **Monitor token usage** - Track and optimize costs

## Advanced Configuration

### Custom System Prompts

```typescript
{
    data: {
        systemPromptTemplate: `You are a specialized assistant with the following capabilities:
1. Code analysis and review
2. Documentation generation
3. Technical writing
4. Bug identification

Please provide detailed, actionable feedback.`
    }
}
```

### Timeout Configuration

```typescript
{
    data: {
        timeoutSec: 300  // 5 minutes
    }
}
```

### Safety Override (Use with Caution)

```typescript
{
    data: {
        dangerouslyAllowAll: true,  // Bypasses safety checks
        disabledTools: []  // Enable all tools
    }
}
```

**Warning:** Only use in trusted environments.

## Related Documentation

- [Node Types Reference](../../api-reference/node-types.md) - LLM node details
- [Protocol Reference](../../api-reference/protocol.md) - Message protocol
- [Events Reference](../../api-reference/events.md) - Event system
- [Integrations Overview](../integrations.md) - All integrations
- [Advanced Workflows](../advanced.md) - Advanced patterns
