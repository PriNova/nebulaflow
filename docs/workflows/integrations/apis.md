# External API Integration

## Overview

NebulaFlow enables seamless integration with external APIs through **CLI nodes** using tools like `curl`, `wget`, or custom scripts. This guide covers connecting to REST, GraphQL, and webhook endpoints, handling authentication, managing errors, and optimizing performance.

**Key capabilities:**
- **REST APIs** - Full HTTP method support (GET, POST, PUT, DELETE, etc.)
- **GraphQL APIs** - Query execution via POST requests
- **Webhook processing** - Receive and process HTTP callbacks
- **Authentication** - API keys, Bearer tokens, OAuth (via scripts)
- **Error handling** - Retry logic, rate limit detection, status code validation

## CLI Node as API Client

All API interactions are performed using **CLI nodes** that execute HTTP requests via `curl` or similar command-line tools.

### Basic CLI Node Configuration

```typescript
interface CLINode {
    type: NodeType.CLI
    data: {
        title: string
        content: string  // Command to execute (e.g., curl)
        mode?: 'command' | 'script'
        shell?: 'bash' | 'sh' | 'zsh' | 'pwsh' | 'cmd'
        safetyLevel?: 'safe' | 'advanced'
        streamOutput?: boolean
        stdin?: { ... }
        env?: { ... }
        flags?: { ... }
    }
}
```

**Important:** For API calls, set `safetyLevel: 'advanced'` only if you trust the API endpoint and need to bypass approval for automated workflows.

## REST API Integration

### GET Request

Fetch data from a REST endpoint:

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Fetch User Data',
        content: 'curl https://api.example.com/users',
        streamOutput: true,
        safetyLevel: 'advanced',
        flags: { executionPolicyBypass: true }
    }
}
```

### POST Request with JSON

Send JSON data to an API:

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Create Resource',
        content: 'curl -X POST -H "Content-Type: application/json" -d \'${1}\' https://api.example.com/resources',
        stdin: {
            source: 'parent-index',
            parentIndex: 0
        },
        streamOutput: true
    }
}
```

### PUT / DELETE Requests

```typescript
// PUT
{
    type: NodeType.CLI,
    data: {
        title: 'Update Resource',
        content: 'curl -X PUT -H "Content-Type: application/json" -d \'${1}\' https://api.example.com/resources/${id}',
        env: {
            static: {
                id: '${resourceId}'
            }
        }
    }
}

// DELETE
{
    type: NodeType.CLI,
    data: {
        title: 'Delete Resource',
        content: 'curl -X DELETE https://api.example.com/resources/${id}',
        env: {
            static: {
                id: '${resourceId}'
            }
        }
    }
}
```

### Query Parameters

Use template variables for dynamic query parameters:

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Search API',
        content: 'curl "https://api.example.com/search?q=${query}&limit=${limit}"',
        env: {
            static: {
                query: '${searchTerm}',
                limit: '10'
            }
        }
    }
}
```

## GraphQL API Integration

### Basic Query

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'GraphQL Query',
        content: 'curl -X POST -H "Content-Type: application/json" -d \'{"query": "${1}"}\' https://api.example.com/graphql',
        stdin: {
            source: 'parent-index',
            parentIndex: 0
        },
        streamOutput: true
    }
}
```

### Query with Variables

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'GraphQL with Variables',
        content: 'curl -X POST -H "Content-Type: application/json" -d \'{"query": "${query}", "variables": ${variables}}\' https://api.example.com/graphql',
        stdin: {
            source: 'parent-index',
            parentIndex: 0
        }
    }
}
```

**Input example (from previous node):**
```json
{
    "query": "query GetUser($id: ID!) { user(id: $id) { name email } }",
    "variables": { "id": "123" }
}
```

## Authentication

### API Key in Header

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Authenticated Request',
        content: 'curl -H "X-API-Key: ${apiKey}" https://api.example.com/protected',
        env: {
            static: {
                apiKey: '${apiKey}'  // Reference Variable node or environment
            }
        }
    }
}
```

### Bearer Token

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Bearer Token Auth',
        content: 'curl -H "Authorization: Bearer ${token}" https://api.example.com/protected',
        env: {
            static: {
                token: '${bearerToken}'
            }
        }
    }
}
```

### Basic Auth

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Basic Auth',
        content: 'curl -u "${username}:${password}" https://api.example.com/protected',
        env: {
            static: {
                username: '${apiUser}',
                password: '${apiPass}'
            }
        }
    }
}
```

### OAuth 2.0 (Client Credentials)

For OAuth, you may need a separate script to obtain tokens:

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'OAuth Token Fetch',
        content: 'node /path/to/oauth-token.js',
        mode: 'script',
        env: {
            static: {
                CLIENT_ID: '${clientId}',
                CLIENT_SECRET: '${clientSecret}'
            }
        }
    }
}
```

**Example Node.js script (`oauth-token.js`):**
```javascript
const axios = require('axios');
async function getToken() {
    const response = await axios.post('https://auth.example.com/oauth/token', {
        grant_type: 'client_credentials',
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET
    });
    console.log(response.data.access_token);
}
getToken();
```

## Webhook Processing

### Receiving Webhooks

Webhooks are typically processed via a CLI node that runs a script to handle incoming HTTP requests. Since NebulaFlow runs locally, you may need to expose a public endpoint using a tunnel service (e.g., ngrok).

**Example webhook processor script:**
```javascript
// webhook-processor.js
const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
    const data = req.body;
    // Process data, maybe write to a file or output to stdout
    console.log(JSON.stringify(data));
    res.sendStatus(200);
});

app.listen(3000, () => console.log('Webhook listener on port 3000'));
```

**CLI Node to run the script:**
```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Webhook Listener',
        content: 'node /path/to/webhook-processor.js',
        mode: 'script',
        streamOutput: true,
        safetyLevel: 'advanced',
        flags: { executionPolicyBypass: true }
    }
}
```

**Note:** For production, consider using a cloud function or webhook relay service.

## Error Handling & Resilience

### Check HTTP Status Codes

`curl` returns exit code 0 even for HTTP errors (4xx, 5xx). Use `--fail` to make curl return non-zero on HTTP errors:

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'API with Error Handling',
        content: 'curl --fail --silent --show-error https://api.example.com/data',
        streamOutput: true
    }
}
```

### Retry Logic

Implement retries using a wrapper script:

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'API with Retries',
        content: 'node /path/to/retry-curl.js',
        mode: 'script',
        env: {
            static: {
                URL: 'https://api.example.com/data',
                RETRIES: '3'
            }
        }
    }
}
```

**Retry script (`retry-curl.js`):**
```javascript
const { execSync } = require('child_process');
const url = process.env.URL;
const maxRetries = parseInt(process.env.RETRIES || '3');

for (let i = 0; i < maxRetries; i++) {
    try {
        const output = execSync(`curl --fail --silent ${url}`, { encoding: 'utf8' });
        console.log(output);
        process.exit(0);
    } catch (error) {
        if (i === maxRetries - 1) {
            console.error('All retries failed:', error.message);
            process.exit(1);
        }
        console.warn(`Retry ${i + 1}/${maxRetries}...`);
    }
}
```

### Rate Limit Handling

Add delays between requests using `sleep`:

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Rate Limited API',
        content: 'curl https://api.example.com/data && sleep 1',
        streamOutput: true
    }
}
```

## Response Parsing

### JSON Parsing with `jq`

Install `jq` on your system, then parse JSON responses:

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Extract Field',
        content: 'curl -s https://api.example.com/data | jq .id',
        streamOutput: true
    }
}
```

### Using Node.js for Complex Parsing

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Parse JSON with Node',
        content: 'curl -s https://api.example.com/data | node /path/to/parser.js',
        mode: 'command',
        streamOutput: true
    }
}
```

**Parser script (`parser.js`):**
```javascript
const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(data.id);
```

## Environment Variables & Secrets

### Storing API Keys

**Never hardcode secrets in workflows.** Use environment variables or Variable nodes:

```bash
# Set environment variable
export API_KEY="your_api_key_here"
```

**Reference in CLI node:**
```typescript
{
    type: NodeType.CLI,
    data: {
        content: 'curl -H "X-API-Key: ${API_KEY}" https://api.example.com/data',
        env: {
            static: {
                API_KEY: '${API_KEY}'  // References environment variable
            }
        }
    }
}
```

### Using Variable Nodes

Create a Variable node with `variableName: 'apiKey'` and `initialValue: 'your_key'`. Then reference `${apiKey}` in the CLI node.

## Security Considerations

### Command Injection Prevention

**Never directly interpolate user input into command strings.** Use stdin for data:

```typescript
// Good: Use stdin
stdin: {
    source: 'parent-index',
    parentIndex: 0
}
content: 'curl -X POST -H "Content-Type: application/json" -d @- https://api.example.com/data'

// Bad: Direct interpolation (vulnerable to injection)
content: `curl -X POST -d '${userInput}' https://api.example.com/data`
```

### HTTPS Only

Always use HTTPS endpoints to prevent man-in-the-middle attacks.

### Approval System

For sensitive operations (e.g., deleting data), keep `safetyLevel: 'safe'` and `needsUserApproval: true` to require manual approval.

## Performance Optimization

### Parallel API Calls

Use workflow parallelism to call multiple APIs simultaneously:

```
Start
├── CLI Node A (API 1)
├── CLI Node B (API 2)
├── CLI Node C (API 3)
└── Accumulator Node (collect results)
```

### Caching

Cache API responses using Variable nodes or file system:

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Cached API Call',
        content: 'if [ -f /tmp/cache.json ]; then cat /tmp/cache.json; else curl -s https://api.example.com/data | tee /tmp/cache.json; fi',
        streamOutput: true
    }
}
```

### Connection Reuse

`curl` creates a new connection per request. For high-frequency calls, consider using a persistent HTTP client (Node.js script with `axios`).

## Integration Patterns

### Pattern 1: Fetch → Process → Send

```
CLI (GET) → LLM (Analyze) → CLI (POST)
```

**Example:** Fetch GitHub repo data, analyze with LLM, post insights to Slack.

### Pattern 2: Conditional API Calls

```
IF Node (check condition)
├── True: CLI (API A)
└── False: CLI (API B)
```

### Pattern 3: Loop Over API Pagination

```
Loop Start (iterations = pages)
├── CLI (GET page ${i})
├── Accumulator (collect items)
Loop End
```

## Troubleshooting

### Common Issues

#### "curl: command not found"

**Cause:** `curl` not installed or not in PATH.

**Solution:**
- Install curl: `sudo apt-get install curl` (Linux) or `brew install curl` (macOS)
- Use full path: `/usr/bin/curl`

#### "SSL certificate problem"

**Cause:** Self-signed certificate or missing CA bundle.

**Solution:**
```bash
# Ignore SSL verification (not recommended for production)
curl -k https://api.example.com/data

# Or provide CA bundle
curl --cacert /path/to/ca-bundle.crt https://api.example.com/data
```

#### "Connection refused"

**Cause:** API endpoint unreachable.

**Solution:**
1. Check network connectivity
2. Verify URL and port
3. Check firewall rules

#### "Authentication failed"

**Cause:** Invalid API key or token.

**Solution:**
1. Verify API key in environment
2. Check token expiration
3. Validate authentication headers

#### "Rate limit exceeded"

**Cause:** Too many requests.

**Solution:**
1. Add delays between requests
2. Implement exponential backoff
3. Check API rate limit headers

### Debugging Tips

1. **Enable verbose output:** Add `-v` flag to curl
2. **Log requests:** Write request details to a file
3. **Check exit codes:** Use `--fail` to detect HTTP errors
4. **Inspect headers:** Use `-i` flag to see response headers

## Best Practices

### General

1. **Use environment variables** for secrets
2. **Validate responses** - Check status codes and data structure
3. **Handle errors gracefully** - Implement retry logic
4. **Log requests** - For debugging and audit trails
5. **Use HTTPS** - Always encrypt traffic
6. **Respect rate limits** - Add delays when needed

### CLI Node Configuration

1. **Set appropriate safety level** - Use `advanced` only for trusted APIs
2. **Stream output** - For long-running requests
3. **Use stdin for data** - Avoid command injection
4. **Set timeouts** - Prevent hanging processes

### API Design Considerations

1. **Idempotency** - Use POST for create, PUT for update
2. **Pagination** - Handle large datasets with page parameters
3. **Caching** - Reduce redundant calls
4. **Error codes** - Follow HTTP status code conventions

## Advanced Topics

### Custom HTTP Clients

For complex HTTP needs (e.g., HTTP/2, custom headers, cookies), write a Node.js script:

```typescript
{
    type: NodeType.CLI,
    data: {
        title: 'Custom HTTP Client',
        content: 'node /path/to/custom-client.js',
        mode: 'script',
        env: {
            static: {
                API_URL: 'https://api.example.com',
                API_KEY: '${apiKey}'
            }
        }
    }
}
```

### WebSocket Connections

WebSocket connections require persistent processes. Consider using a separate service that bridges WebSocket to stdout.

### GraphQL Subscriptions

Similar to WebSockets, subscriptions need a persistent connection. Use a script that listens to GraphQL subscription events and outputs to stdout.

## Related Documentation

- [CLI Node Reference](../../user-guide/nodes/cli-nodes.md) - Detailed CLI node configuration
- [LLM Integration](llm.md) - Combine API data with LLM processing
- [Workflow Examples](../basic.md) - Practical workflow patterns
- [Protocol Reference](../../api-reference/protocol.md) - Message protocol for execution
- [Events Reference](../../api-reference/events.md) - Event system for streaming output
- [Extension API Reference](../../api-reference/extension.md) - Extension API details
