# LLM Nodes (Agent Nodes)

LLM (Large Language Model) nodes, also called **Agent nodes**, allow you to interact with AI models like GPT-5.1, Claude, or other language models within your workflows. These nodes support streaming output, tool usage, image attachments, and chat history.

## Configuration

### Model Selection
- **Model**: Choose from available models (e.g., `openai/gpt-5.1`, `anthropic/claude-3-opus`). The model list is loaded from the Amp SDK and OpenRouter.
- **Default Model**: If no model is selected, the default is `openai/gpt-5.1` (GPT-5.1).
- **Model Resolution**: The selected model ID is normalized via the Amp SDK's `resolveModel` function. If resolution fails, the raw ID is used.

### Prompt (Content)
- **Prompt**: The main user prompt that is sent to the LLM. This is the `content` field of the node.
- **Template Variables**: Use `${1}`, `${2}` etc. for positional inputs from parent nodes. The prompt is processed with `replaceIndexedInputs` using outputs from connected nodes.
- **Empty Prompt**: If the prompt is empty after processing, the node will throw an error.

### System Prompt Override
- **Optional**: You can override the default system prompt for this node.
- **Default**: If not set, the Amp SDK's default system prompt is used.
- **Editing**: Click "Edit system prompt..." to open a text editor.

### Reasoning Effort
- **Values**: `minimal`, `low`, `medium`, `high`
- **Default**: `medium`
- **Effect**: Controls the amount of reasoning the model performs. Higher effort may produce more thorough responses but uses more tokens.

### Tools (Builtin Tools)
- **Tool Selection**: You can enable or disable specific builtin tools (e.g., Bash, Read, Edit, Grep, etc.).
- **Default**: All tools are enabled by default.
- **Disabling**: Tools can be disabled individually or all at once. Disabled tools are not available to the LLM for that node.
- **Important**: The `Bash` tool must be enabled for the `dangerouslyAllowAll` option to work.

### Dangerously Allow All
- **Purpose**: Allows the LLM to execute any command without user approval (e.g., Bash commands).
- **Requirement**: The `Bash` tool must be enabled.
- **Safety**: When enabled, the node will automatically approve tool calls that would otherwise require approval. Use with extreme caution.

### Timeout
- **Default**: 300 seconds (5 minutes)
- **Setting**: You can set a custom timeout in seconds. `0` means no timeout.
- **Behavior**: If the LLM request exceeds the timeout, it will be aborted.

### Image Attachments
- **Supported**: You can attach images (files or URLs) that will be sent along with the prompt.
- **Usage**: Useful for multimodal models that accept image inputs.
- **Adding**: Provide a file path (relative to workspace root) or a URL.

## Input/Output

### Inputs
- **Previous Node Output**: The output from connected parent nodes is used as context.
- **Positional Inputs**: Use `${1}`, `${2}` etc. in the prompt to reference inputs by order.
- **Structured Data**: Supports any text output from previous nodes.

### Outputs
- **Generated Text**: The final text response from the LLM (excluding tool calls and thinking blocks).
- **Streaming**: The node streams assistant content (text, thinking, tool use, tool results) in real-time to the webview.
- **Thread ID**: For chat interactions, a thread ID is maintained to preserve conversation history.
- **Token Usage**: Token counts are not directly exposed but can be calculated via the `calculate_tokens` command.

## Variable Usage

### Template Variables
Use positional inputs in the prompt:

```plaintext
Analyze the following data: ${1}
Provide a summary in ${2} sentences.
```

### Context Variables
Access workflow context (not yet implemented in the current version).

### Node References
Reference previous node outputs by order:
- `${1}`: Output from the first connected parent node
- `${2}`: Output from the second connected parent node
- `${n}`: Output from the n-th connected parent node

## Examples

### Basic Text Generation
```
You are a helpful assistant. Write a welcome message for new users.
```

### Data Transformation
```
Convert the following data to JSON format:
${1}
```

### Code Generation
```
You are a code assistant. Write a Python function to ${1}.
```

### Analysis
```
Analyze the following data and provide insights:
${1}
```

## Best Practices

### Prompt Engineering
1. **Be Specific**: Clear, detailed prompts yield better results.
2. **Provide Examples**: Include examples when possible.
3. **Use Delimiters**: Separate different parts of your prompt.
4. **Specify Format**: Request specific output formats (e.g., JSON, Markdown).
5. **Set Constraints**: Define length and style requirements.

### Error Handling
1. **Validate Input**: Check data before sending to LLM.
2. **Handle Failures**: Use condition nodes to detect errors.
3. **Retry Logic**: Implement retries for transient failures.
4. **Timeouts**: Set appropriate timeout values.

### Performance
1. **Batch Prompts**: Combine related queries when possible.
2. **Cache Results**: Store frequently used responses.
3. **Use Smaller Models**: For simple tasks, use faster models.
4. **Optimize Tokens**: Be concise to reduce costs.

### Security
1. **Never Send Secrets**: Don't include API keys or passwords.
2. **Sanitize Input**: Clean user data before processing.
3. **Rate Limiting**: Prevent abuse with rate limits.
4. **Audit Logging**: Log all LLM interactions.

## Common Patterns

### Chain of Thought
```
Start → LLM (Reasoning) → LLM (Refinement) → End
```

### Data Extraction
```
Input → LLM (Extract) → Transform → End
```

### Content Generation
```
Prompt → LLM (Generate) → Validate → LLM (Edit) → End
```

### Analysis Pipeline
```
Data → LLM (Analyze) → Condition → LLM (Report) → End
```

## Troubleshooting

### Model Not Available
- Check API key configuration (`AMP_API_KEY` environment variable).
- Verify model name spelling.
- Ensure the model is supported by the Amp SDK or OpenRouter.
- Check API rate limits.

### Poor Output Quality
- Adjust reasoning effort (lower for consistency).
- Improve prompt clarity.
- Add examples to prompt.
- Use system prompt for constraints.

### High Token Usage
- Reduce reasoning effort.
- Use more concise prompts.
- Implement summarization.
- Cache repeated queries.

### Timeout Errors
- Increase timeout setting.
- Check network connectivity.
- Verify API endpoint.
- Consider model response time.

### Amp SDK Not Available
- Ensure the Amp SDK is installed (`@prinova/amp-sdk`).
- The extension bundles the SDK; if missing, run `npm install` in the extension directory.

### AMP_API_KEY Not Set
- Set the `AMP_API_KEY` environment variable before launching VS Code.
- The LLM node requires this key to authenticate with the Amp service.

## Integration with Other Nodes

### Before LLM
- **CLI Node**: Fetch external data.
- **Condition Node**: Validate input.
- **Variable Node**: Provide dynamic values.

### After LLM
- **Condition Node**: Validate output.
- **CLI Node**: Use generated content.
- **Loop Node**: Process multiple items.
- **Subflow Node**: Delegate to a subflow.

## Configuration Example

```yaml
llm_node:
  title: "My Agent"
  model: "openai/gpt-5.1"
  content: "Analyze the following data: ${1}"
  systemPromptTemplate: "You are a data analyst."
  reasoningEffort: "medium"
  disabledTools: ["Bash"]  # Disable Bash tool
  dangerouslyAllowAll: false
  timeoutSec: 300
  attachments:
    - kind: "image"
      source: "file"
      path: "screenshots/error.png"
```

## Next Steps

- [CLI Nodes](cli-nodes.md) - Learn about shell command execution
- [Workflow Design](../workflow-design.md) - Design effective workflows
- [API Reference](../../api-reference/node-types.md) - Complete node specifications
