# Amp Workflow Editor (VS Code Extension)

A VS Code extension for visually designing and running developer workflows. Build graphs using node types (CLI, LLM, control-flow, preview, variables), execute them inside VS Code, and persist workflows/custom nodes per workspace.

- Extension entry point: `src/extension.ts`
- Webview app: `workflow/Web/` (React + Vite) outputs to `dist/webviews`
- Workflow runtime and messaging live under `workflow/Application` and `workflow/Core`
- Persistence and shell execution adapters live under `workflow/DataAccess`

## Project Focus: LLM Node (AI Node for Model Reference)

This project primarily focuses on the LLM node. In the current state, the LLM node serves as an AI node for model reference and UI configuration rather than executing model inference. Execution for LLM nodes is intentionally stubbed (see "LLM unavailable" handling in [ExecuteWorkflow.ts](workflow/Application/handlers/ExecuteWorkflow.ts#L88-L95)); the shared `Model` type used for reference is defined in [Protocol.ts](workflow/Core/Contracts/Protocol.ts#L4-L6).

## Features

- Visual workflow editor with @xyflow/react
- Node types: CLI, LLM, Preview, Text Input, Search Context, Cody Output, Loop Start/End, Accumulator, Variable, If/Else
- Graph execution with ordered edges, token counting for previews, and abortion support
- Runtime approvals for CLI nodes (approve/modify commands before run)
- Workspace persistence:
  - Workflows: `.sourcegraph/workflows/*.json`
  - Custom nodes: `.sourcegraph/nodes/*.json`
- Security protections:
  - Dangerous CLI prefixes blocked (e.g., `rm`, `sudo`, `chown`, etc.)
  - Command sanitization and abort handling

## Requirements

- VS Code ≥ 1.90.0
- Node.js ≥ 18 and npm ≥ 9
- macOS, Linux, or Windows

## Quick Start (Development)

1) Install dependencies

```bash
npm install
```

2) Build once (webview + extension)

```bash
npm run build
```

3) Launch the extension in VS Code

- Open this folder in VS Code
- Run and Debug: "Launch Extension (Desktop)"
  - This uses the `dev: start-webview-watch` task to watch webview assets

4) Open the editor UI

- In the Extension Development Host window, run the command: "Amp: Open Workflow Editor"

If you see a message about missing webview assets, run `npm run build` or start the watcher via the launch config and try again.

## Development Workflow

- One-shot builds:
  - Webview only: `npm run build:webview`
  - Extension only: `npm run build:ext`
- Watch webview (used by the VS Code launch config):
  - `npm run watch:webview`
- Typecheck (extension + webview types):
  - `npm run typecheck`
- Lint/Format (Biome):
  - Check: `npm run check`
  - Lint: `npm run lint`
  - Auto-fix: `npm run biome` (also aliased as `npm run format`)

## Scripts

```jsonc
{
  "build:webview": "vite build --config workflow/Web/vite.config.mts",
  "watch:webview": "vite build --watch --config workflow/Web/vite.config.mts --mode development",
  "build:ext": "tsc -p .",
  "typecheck": "tsc -p . && tsc -p workflow/Web/tsconfig.json",
  "biome": "biome check --apply --error-on-warnings .",
  "format": "npm run biome",
  "check": "npm run -s typecheck && npm run -s biome",
  "lint": "npm run biome",
  "build": "npm run -s typecheck && npm run -s build:webview && npm run -s build:ext"
}
```

## Project Structure

```
├ src/
│  └ extension.ts                # Registers command, hosts the webview
├ workflow/
│  ├ Web/                        # React webview app (Vite) → dist/webviews
│  │  ├ workflow.html            # Webview HTML entry
│  │  ├ index.tsx / WorkflowApp.tsx
│  │  └ vite.config.mts
│  ├ Application/                # Extension-side app layer (messaging, handlers)
│  │  ├ register.ts              # VS Code command + webview lifecycle
│  │  └ handlers/ExecuteWorkflow.ts
│  ├ Core/                       # Pure types, models, engine helpers
│  │  ├ models.ts                # Node types, DTOs (re-exports Protocol)
│  │  └ Contracts/Protocol.ts    # Webview ⇄ Extension message contracts
│  ├ DataAccess/                 # I/O adapters (FS, shell)
│  │  ├ fs.ts                    # Save/load workflows and custom nodes
│  │  └ shell.ts                 # Shell exec with abort/sanitization
│  └ ExternalServices/           # Third-party integrations (placeholder)
├ dist/                          # Build outputs (extension JS + webview assets)
├ .vscode/
│  ├ launch.json                 # Launch extension (desktop/web)
│  └ tasks.json                  # Dev tasks (webview watch, builds)
```

## Architecture

This repo follows a vertical slice style within the `workflow/` directory:

- Web (UI): webview UI, user-initiated actions, and protocol mirror
- Application: request/message handling, command orchestration
- Core: pure types/models and execution helpers (graph sorting, node execution glue)
- DataAccess: file system and shell adapters for persistence and process execution

Execution flow:

1. User opens the editor and edits a graph in the webview
2. Webview posts messages (save, load, execute, token count) to the extension
3. Extension validates, persists, and executes nodes in a safe order
4. Status/results stream back to the webview for display

## Persistence

- Workflows are JSON files saved under `.sourcegraph/workflows/` (versioned `1.x`)
- Custom nodes are JSON files saved under `.sourcegraph/nodes/`
- The extension prompts for save/load locations scoped to the workspace

## Security

- CLI nodes:
  - Disallowed command prefixes (non-exhaustive): `rm`, `chmod`, `shutdown`, `sudo`, `chown`, `kill`, `reboot`, `poweroff`, `systemctl`, etc.
  - Commands are sanitized before execution and can be aborted
  - Optional user approval gate before running commands
- Errors are surfaced via VS Code notifications; execution halts on errors/abort

## Troubleshooting

- Webview assets don’t load:
  - Run `npm run build` or start the Run and Debug configuration (which starts the watcher)
- Type errors:
  - Run `npm run typecheck` and address diagnostics
- Lint/format issues:
  - Run `npm run check` or `npm run biome`

## Contributing

- TypeScript strict mode; extension uses CommonJS; webview uses ESM + React
- Formatting and linting via Biome (`npm run check`, `npm run biome`)
- Keep core helpers pure; put side-effects at the boundaries (webview/application/data access)
- Prefer explicit type imports and small functions

## License

TBD
