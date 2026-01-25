# Development Guide

This guide covers setting up the development environment, building the project, and contributing to NebulaFlow. For architectural details, see [Technical Architecture](architecture.md).

## Prerequisites

- **VS Code** ≥ 1.90.0 (for extension development and debugging)
- **Node.js** ≥ 18 and **npm** ≥ 9 (see [Node.js downloads](https://nodejs.org/))
- **Git** (for cloning the repository)
- **Bash** or **PowerShell** (for running scripts)

## Repository Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/PriNova/nebulaflow.git
   cd nebulaflow
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

   This installs both runtime dependencies and dev dependencies (TypeScript, Biome, Vite, etc.).

## Environment Variables

The extension requires API keys for LLM nodes. Set these in your shell before launching VS Code:

```bash
export AMP_API_KEY="your-amp-key"
export OPENROUTER_API_KEY="your-openrouter-key"
```

Alternatively, add them to a `.env` file in the project root (ignored by Git). The extension reads these at runtime.

### SDK Vendoring

The Amp SDK is vendored as a tarball in `vendor/amp-sdk/amp-sdk.tgz` and referenced as a file dependency in `package.json`. No external linking is required; `npm install` will copy the SDK into `node_modules/@prinova/amp-sdk`. The build process bundles the SDK directly into the extension.

## Build System

NebulaFlow consists of two main parts:

1. **Webview** (React + React Flow) – built with Vite
2. **Extension** (VS Code extension host) – bundled with esbuild

### One‑Shot Build

Build both parts and run type checking:

```bash
npm run build
```

This executes:
- `npm run typecheck` – TypeScript validation
- `npm run build:webview` – Vite bundles the React app into `dist/webviews/`
- `npm run build:ext` – esbuild bundles the extension + SDK into `dist/extension.js`

### Partial Builds

- **Webview only**: `npm run build:webview`
- **Extension only**: `npm run build:ext`
- **Electron app**: `npm run build:electron` (builds the main process)

### Watch Modes

- **Webview watch** (hot reload): `npm run watch:webview`
- **Extension watch**: `npm run watch:ext` (requires VS Code reload)
- **Combined watch** (webview + extension): `npm run watch` (runs webview watcher; extension changes need reload)

### Packaging

Create a VSIX package for distribution:

```bash
npm run package:vsix
```

The `.vsix` file appears in `dist/`.

## Development Workflow

### Launching the Extension

1. Open the project folder in VS Code.
2. Press **F5** (or run the **Launch Extension (Desktop)** debug configuration).
3. This starts the webview watcher and launches a new VS Code window with the extension loaded.
4. In the new window, run the command: **NebulaFlow: Open Workflow Editor**.

If you see a missing webview assets error, run `npm run build` or ensure the watcher is running.

### Type Checking

Run TypeScript type checking for both extension and webview:

```bash
npm run typecheck
```

### Linting & Formatting

NebulaFlow uses **Biome** for linting and formatting.

- **Check**: `npm run check` (typecheck + lint)
- **Lint only**: `npm run lint`
- **Auto‑fix**: `npm run biome` (also aliased as `npm run format`)

### Debugging

- **Extension debugging**: Use the VS Code debugger (F5). Set breakpoints in `src/extension.ts` or `workflow/` files.
- **Webview debugging**: Open the webview developer tools (Help → Toggle Developer Tools in the VS Code window).
- **Environment variables**: Ensure `AMP_API_KEY` and `OPENROUTER_API_KEY` are set before launching the extension host.
- **Optional environment variables**: `NEBULAFLOW_SHELL_MAX_OUTPUT` (max shell output chars), `NEBULAFLOW_DEBUG_LLM` (enable LLM debug logging), `NEBULAFLOW_FILTER_PAUSE_SEEDS` (filter pause seeds).

### Testing

Currently, there are no automated unit tests. Manual testing is performed by creating workflows with various node types and verifying execution, streaming, approvals, and pause/resume.

**Manual test checklist**:
- [ ] LLM node streams output and respects thread continuation
- [ ] CLI node executes with approval, script mode, and safety levels
- [ ] If/Else node routes correctly based on condition
- [ ] Loop node iterates and updates loop variable
- [ ] Variable node sets and retrieves values
- [ ] Accumulator node concatenates outputs
- [ ] Preview node displays data
- [ ] Subflow node executes saved workflow

### Adding New Node Types

To add a new node type:

1. **Define the node schema** in `workflow/Core/models.ts` (add a new `NodeType` and its data interface).
2. **Create a UI component** in `workflow/Web/components/nodes/` (follow the pattern of existing nodes).
3. **Register the UI component** in `workflow/Web/components/nodes/Nodes.tsx`:
   - Add the new `NodeType` to the enum (must match the one defined in models.ts).
   - Add the component to the `nodeTypes` mapping.
   - Add a display label to `nodeTypeDisplayLabel` mapping.
4. **Implement the node runner**:
   - Create a new file in `workflow/WorkflowExecution/Application/node-runners/` (e.g., `run-my-node.ts`) that exports an async execution function.
   - Alternatively, for simple nodes you can add the runner inline in `ExecuteWorkflow.ts` (see `runAccumulator` and `runVariable`).
5. **Register the node in the dispatcher**:
   - Add a new property to `NodeImplementations` in `workflow/WorkflowExecution/Application/handlers/NodeDispatch.ts`.
   - Add a case for the new `NodeType` in the `routeNodeExecution` switch.
6. **Hook the runner into execution**:
   - In `workflow/WorkflowExecution/Application/handlers/ExecuteWorkflow.ts` (and `ExecuteSingleNode.ts` for single-node mode), add the runner to the callbacks object passed to `routeNodeExecution`.
7. **Update the node palette** in `workflow/Web/components/sidebar/WorkflowSidebar.tsx` (add to the appropriate category).
8. **Update documentation** in `docs/user-guide/nodes/index.md` and `docs/api-reference/node-types.md`.

## Code Organization

NebulaFlow follows a **Vertical Slice Architecture** (VSA). Key slices:

- **Web** (`workflow/Web/`): React UI, React Flow graph, node components, sidebars.
- **Application** (`workflow/Application/`): Message handling, command orchestration, lifecycle.
- **Core** (`workflow/Core/`): Pure types, models, validation.
- **DataAccess** (`workflow/DataAccess/`): File system and shell adapters.
- **WorkflowExecution** (`workflow/WorkflowExecution/`): Graph execution engine, node runners.
- **LLMIntegration** (`workflow/LLMIntegration/`): SDK integration, workspace configuration.
- **Shared** (`workflow/Shared/`): Generic primitives (Host, Infrastructure).

For details, see [Technical Architecture](architecture.md#codebase-organization-vertical-slice-architecture-vs).

## Contributing

### Pull Request Process

1. Fork the repository and create a feature branch.
2. Ensure your changes pass type checking and linting: `npm run check`.
3. Update documentation if you add or modify features.
4. Submit a pull request with a clear description.

### Code Style

- **TypeScript**: Strict mode enabled; prefer explicit type imports.
- **Functions**: Keep them small and pure; side effects at boundaries.
- **Imports**: Use `node:` protocol for Node.js built‑ins.
- **Naming**: `lowerCamelCase` for variables/functions, `PascalCase` for components/types.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/). Example:

```
feat(llm-node): add support for custom model parameters
```

## CI/CD

NebulaFlow uses GitHub Actions for continuous integration.

- **Build workflow** (`.github/workflows/build.yml`):
  - Runs on pushes to `main` and `dev` branches.
  - Executes `npm run check` (typecheck + lint).
  - Builds and packages the extension (`npm run package:vsix`).
  - Uploads build artifacts.
  - Creates a GitHub release when a tag is pushed.

- **Deploy docs workflow** (`.github/workflows/deploy-docs.yml`):
  - Deploys documentation to GitHub Pages when docs change.

You can run the same steps locally to verify your changes.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Amp SDK not available** | The SDK is vendored; ensure `vendor/amp-sdk/amp-sdk.tgz` exists. |
| **AMP_API_KEY is not set** | Set the environment variable before launching VS Code. |
| **Webview assets don’t load** | Run `npm run build` or start the webview watcher (`npm run watch:webview`). |
| **Type errors** | Run `npm run typecheck` and fix diagnostics. |
| **Lint/format issues** | Run `npm run check` or `npm run biome`. |
| **Extension fails to load** | Check VS Code version ≥ 1.90.0; reload the window. |
| **CLI node approval not showing** | Ensure the node’s `needsUserApproval` flag is true; check webview console for errors. |

## Next Steps

- Read [Technical Architecture](architecture.md) for deep implementation details.
- Explore the [Protocol](../../workflow/Core/Contracts/Protocol.ts) for extension‑webview communication.
- Check the [Node Types](../../workflow/Core/models.ts) to understand existing nodes.
- Look at the [Execution Handler](../../workflow/WorkflowExecution/Application/handlers/ExecuteWorkflow.ts) to see how workflows are executed.
