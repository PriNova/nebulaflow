# NebulaFlow Workflow Editor (VS Code Extension)

A VS Code extension for visually designing and running developer workflows. Build graphs using node types (CLI, LLM, control-flow, preview, variables), execute them inside VS Code, and persist workflows/custom nodes per workspace.

- Extension entry point: `src/extension.ts`
- Webview app: `workflow/Web/` (React + Vite) outputs to `dist/webviews`
- Workflow runtime and messaging live under `workflow/Application` and `workflow/Core`
- Persistence and shell execution adapters live under `workflow/DataAccess`

## Project Focus: LLM Node

The LLM node now runs via the Amp SDK. The workflow editor is a visual wrapper around the SDK: it builds prompts from upstream node outputs and executes them with the SDK. Builds auto-sync the SDK via a prebuild step; set `AMP_API_KEY` to use the LLM node. To force-link manually: `npm i /home/prinova/CodeProjects/upstreamAmp/sdk`.

## Recent Changes (v0.1.5)

- **Sidebar Resizing Improvements**:
  - Handle thickness standardized to 4px (left and right resize handles); identical styling on both sides
  - Right sidebar grows unbounded (`maxWidth` undefined); left sidebar retains a 600px max-width
  - New center-aware clamp: a minimum 8px gap between handles is enforced during drag using `sidebarResizing.ts` options `{ minCenterGap, getCenterWidth }`
  - Resize handlers retain cursor styling and proper hit areas

## Previous Changes (v0.1.4)

- **UI/UX Refinement**: Property Editor section in the sidebar now displays as a static header (consistent with category headers) rather than a collapsible accordion. The section always shows the PropertyEditor when a node is selected, or prompts "Select a node to edit its properties" when none is selected. This simplification removes collapsibility while maintaining visual consistency and reduces component re-render pressure.

## Features

- Visual workflow editor with @xyflow/react
- Node types: CLI, LLM, Preview, Text Input, Loop Start/End, Accumulator, Variable, If/Else
- Graph execution with ordered edges, token counting for previews, and abortion support
- Runtime approvals for CLI nodes (approve/modify commands before run)
- Workspace persistence:
- Workflows: `.nebulaflow/workflows/*.json`
- Custom nodes: `.nebulaflow/nodes/*.json`
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

2) SDK sync (automatic)

Builds auto-sync the upstream SDK via a prebuild step; no manual linking required. To force-link manually:

```bash
npm i /home/prinova/CodeProjects/upstreamAmp/sdk
```

3) Build once (webview + extension)

```bash
npm run build
```

4) Launch the extension in VS Code

- Open this folder in VS Code
- Run and Debug: "Launch Extension (Desktop)"
  - This uses the `dev: start-webview-watch` task to watch webview assets

5) Open the editor UI

- In the Extension Development Host window, run the command: "NebulaFlow: Open Workflow Editor"

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
  "sync:sdk": "pnpm -C /home/prinova/CodeProjects/upstreamAmp/sdk build && npm i /home/prinova/CodeProjects/upstreamAmp/sdk",
  "prebuild": "npm run -s sync:sdk",
  "build:webview": "vite build --config workflow/Web/vite.config.mts",
  "watch:webview": "vite build --watch --config workflow/Web/vite.config.mts --mode development",
  "prebuild:ext": "npm run -s sync:sdk",
  "build:ext": "node scripts/bundle-ext.mjs",
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

- Workflows are JSON files saved under `.nebulaflow/workflows/` (versioned `1.x`)
- Custom nodes are JSON files saved under `.nebulaflow/nodes/`
- The extension prompts for save/load locations scoped to the workspace

## Security

- CLI nodes:
  - Disallowed command prefixes (non-exhaustive): `rm`, `chmod`, `shutdown`, `sudo`, `chown`, `kill`, `reboot`, `poweroff`, `systemctl`, etc.
  - Commands are sanitized before execution and can be aborted
  - Optional user approval gate before running commands
- Errors are surfaced via VS Code notifications; execution halts on errors/abort

## Troubleshooting

- LLM node error "Amp SDK not available":
  - Builds auto-sync the SDK; run `npm run build` to trigger the prebuild. If needed, force-link with `npm i /home/prinova/CodeProjects/upstreamAmp/sdk && npm run build`
- LLM node error "AMP_API_KEY is not set":
  - Set the environment variable before launching: `export AMP_API_KEY=<your-key>` or add to `.env`
- Webview assets don't load:
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
