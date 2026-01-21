# LLM Nodes

LLM (Large Language Model) nodes allow you to interact with AI models like GPT-4, Claude, or other language models within your workflows.

## Configuration

### Model Selection
- **Model**: Choose from available models (gpt-4o, gpt-4-turbo, claude-3-opus, etc.)
- **Provider**: Select the AI provider (OpenAI, Anthropic, etc.)
- **API Key**: Configure in environment variables or workflow settings

### Prompt Configuration
- **System Prompt**: Instructions for the model's behavior
- **User Prompt**: The main input/query for the model
- **Temperature**: Controls creativity (0.0-2.0)
  - 0.0 = Deterministic
  - 0.7 = Balanced
  - 2.0 = Very creative
- **Max Tokens**: Limit response length
- **Top P**: Alternative to temperature for sampling

### Advanced Options
- **Stop Sequences**: Stop generation at specific tokens
- **Frequency Penalty**: Reduce repetition
- **Presence Penalty**: Encourage new topics
- **Response Format**: JSON, text, or structured output

## Input/Output

### Inputs
- Previous node output (context for the prompt)
- Can use variables: `{{nodeId.output}}`
- Supports structured data

### Outputs
- Generated text response
- Token usage statistics
- Response metadata
- Can be used by subsequent nodes

## Variable Usage

### Template Variables
Use variables in prompts to create dynamic content:

```plaintext
Hello {{nodeId.output.name}}, welcome to {{context.project}}!
```

### Context Variables
Access workflow context:
- `{{context.timestamp}}` - Current time
- `{{context.user}}` - Current user
- `{{context.workflow}}` - Workflow name

### Node References
Reference previous node outputs:
- `{{startNode.output}}` - Output from start node
- `{{cliNode.output.stdout}}` - CLI command output
- `{{conditionNode.output}}` - Condition result

## Examples

### Basic Text Generation
```
System: You are a helpful assistant.
User: Write a welcome message for new users.
```

### Data Transformation
```
System: Convert the following data to JSON format.
Input: {{dataNode.output}}
```

### Code Generation
```
System: You are a code assistant.
User: Write a Python function to {{requirement}}.
```

### Analysis
```
System: Analyze the following data and provide insights.
Input: {{analysisNode.output}}
```

## Best Practices

### Prompt Engineering
1. **Be Specific**: Clear, detailed prompts yield better results
2. **Provide Examples**: Include examples when possible
3. **Use Delimiters**: Separate different parts of your prompt
4. **Specify Format**: Request specific output formats
5. **Set Constraints**: Define length and style requirements

### Error Handling
1. **Validate Input**: Check data before sending to LLM
2. **Handle Failures**: Use condition nodes to detect errors
3. **Retry Logic**: Implement retries for transient failures
4. **Timeouts**: Set appropriate timeout values

### Performance
1. **Batch Prompts**: Combine related queries when possible
2. **Cache Results**: Store frequently used responses
3. **Use Smaller Models**: For simple tasks, use faster models
4. **Optimize Tokens**: Be concise to reduce costs

### Security
1. **Never Send Secrets**: Don't include API keys or passwords
2. **Sanitize Input**: Clean user data before processing
3. **Rate Limiting**: Prevent abuse with rate limits
4. **Audit Logging**: Log all LLM interactions

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
- Check API key configuration
- Verify model name spelling
- Ensure provider is configured
- Check API rate limits

### Poor Output Quality
- Adjust temperature (lower for consistency)
- Improve prompt clarity
- Add examples to prompt
- Use system prompt for constraints

### High Token Usage
- Reduce max tokens
- Use more concise prompts
- Implement summarization
- Cache repeated queries

### Timeout Errors
- Increase timeout setting
- Check network connectivity
- Verify API endpoint
- Consider model response time

## Integration with Other Nodes

### Before LLM
- **Transform Node**: Prepare data
- **CLI Node**: Fetch external data
- **Condition Node**: Validate input

### After LLM
- **Condition Node**: Validate output
- **Transform Node**: Process response
- **CLI Node**: Use generated content
- **API Node**: Send results elsewhere

## Configuration Example

```yaml
llm_node:
  model: "gpt-4o"
  provider: "openai"
  system_prompt: "You are a helpful assistant."
  user_prompt: "Generate a summary of: {{input}}"
  temperature: 0.7
  max_tokens: 500
  response_format: "text"
```

## Next Steps

- [CLI Nodes](cli-nodes.md) - Learn about shell command execution
- [Workflow Design](../workflow-design.md) - Design effective workflows
- [API Reference](../../api-reference/node-types.md) - Complete node specifications
