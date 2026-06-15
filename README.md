# NebulaFlow Workflow Editor (VS Code Extension)

A VS Code extension for visually designing and running developer workflows. Build graphs using node types (CLI, LLM, control-flow, preview, variables), execute them inside VS Code, and persist workflows/custom nodes per workspace.

![UI Screenshot](assets/screenshot.png)

## Project Focus: LLM Node

The LLM node runs via the pi coding-agent SDK (`@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`). The editor builds prompts from upstream node outputs and executes them with pi's `PiAgent` API.

- SDK integration: NebulaFlow integrates pi SDK via the `PiIntegration` module (`workflow/PiIntegration/`), replacing the previous Amp SDK.
- Auth: Set `AMP_API_KEY` (legacy fallback) or the pi SDK's API key environment variable so the LLM node can execute.

### Workspace LLM configuration (`.nebulaflow/settings.json`)

- NebulaFlow can pass pi SDK settings via a workspace-local JSON file at `.nebulaflow/settings.json` in the first workspace folder.
- The file should contain a `nebulaflow.settings` object that maps to pi SDK settings keys.

Example:

```jsonc
{
  "nebulaflow": {
    "settings": {
      "internal.primaryModel": "openrouter/xiaomi/mimo-v2-flash:free"
    }
  }
}
```

- `internal.primaryModel` provides a workspace-wide default model for LLM nodes.
- `openrouter.models` can be used to specify per-model configuration including `provider` for routing, `maxOutputTokens`, `contextWindow`, `isReasoning`, and `reasoning_effort`:

```jsonc
{
  "nebulaflow": {
    "settings": {
      "openrouter.models": [
        {
          "model": "openrouter/z-ai/glm-4.7-flash",
          "provider": "z-ai",
          "maxOutputTokens": 131000,
          "contextWindow": 200000,
          "temperature": 0.5
        },
        {
          "model": "openrouter/openai/gpt-5.2-codex",
          "provider": "openai",
          "isReasoning": true,
          "reasoning_effort": "medium",
          "maxOutputTokens": 128000,
          "contextWindow": 400000
        }
      ]
    }
  }
}
```
- Per-node model selection in the Property Editor (Model combobox) always wins over the workspace default. If a node has no model, NebulaFlow falls back to `nebulaflow.settings["internal.primaryModel"]`, and if that is unset it falls back to pi's built-in default.
- The Model combobox is populated from pi's `listPiModels()` API and includes any OpenRouter models defined in `openrouter.models` settings.

- **Category Label Display**: User-facing category names map to improved labels in the sidebar node palette ([WorkflowSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/sidebar/WorkflowSidebar.tsx#L44-L50)):
  - `llm` → `Agents`
  - `text-format` → `Text`
  - Unmapped categories pass through unchanged

## Features

### LLM Node and Chat Continuation

- LLM nodes run via the pi coding-agent SDK (`@earendil-works/pi-agent-core`), building prompts from upstream node outputs and executing them inside a thread via pi's `PiAgent` API so later runs can reuse the same conversation.
- When an LLM node has an active `threadID`, the Right Sidebar shows a small chat panel that lets you send follow-up messages to that node; replies append to the existing assistant history and stream back into the Playbox, while drafts are scoped to the current execution run and cleared on workflow reset.
- pi tools (`read`, `bash`, `edit`, `write`, `ls`, `find`, `grep`) are available to LLM nodes via the `PiIntegration` module.

### Shell Node (CLI)

- Switch between Command (one-liner) and Script (multiline via stdin) in the Property Editor.
- Script mode preserves newlines; no here-docs or temp files needed.
- Stdin source can be set to parents-all, parent-index, or literal; optionally strip code fences and normalize CRLF.
- Env mapping exposes parent outputs as INPUT_1…N or custom names; use stdin for large payloads.
- Shell/flags: bash/sh/zsh (`set -e`, `set -u`, `set -o pipefail`), pwsh (`-NoProfile`, `-NonInteractive`, optional `-ExecutionPolicy Bypass`).
- Safety: Command mode uses denylist/sanitization by default (Safe). Script mode uses stdin semantics. Advanced disables sanitization (use approvals during authoring).
- Execution: Script mode uses spawn (buffered) by default; Command mode can use spawn (buffered) via a toggle. Output is aggregated and truncated when too large.
- Approvals: When enabled, the Right Sidebar shows an editable script/command and a structured summary (Mode, Shell, Safety, Stdin, Flags) before you approve.

### Visual Workflow Editor

- Node types: CLI, LLM, Preview, Text Input, Loop Start/End, Accumulator, Variable, If/Else, Subflow, Subflow Input/Output
- Custom Nodes to store recurring node tasks into reusable units
- Support Sub-Flows to group nodes into reusable units
- Web-only deployment target via WebSocket bridge server for standalone browser use
- Mobile-responsive layout for small-screen and non-VSCode environments
- Graph execution with ordered edges, token counting for previews, and abortion support
- Shell node enhancements:
  - Script mode (multiline) via in-memory stdin (no temp files)
  - Stdin sources (none, parents-all, parent-index, literal) with strip-fences and CRLF normalize
  - Env mapping (expose parents as INPUT_1…N, custom names, static env)
  - Shell selection and strict flags (bash/sh/zsh set -e/-u/pipefail; pwsh NoProfile/NonInteractive/ExecutionPolicy)
  - Spawn toggle for command mode; script mode uses spawn (buffered) by default
  - Structured approval preview (Mode, Shell, Safety, Stdin, Flags)
- Workspace persistence:
  - Workflows: `.nebulaflow/workflows/*.json`
  - Custom nodes: `.nebulaflow/nodes/*.json`
- Security protections:
  - Dangerous CLI prefixes blocked in command mode (e.g., `rm`, `sudo`, `chown`, etc.)
  - Command sanitization and abort handling; approvals available; Advanced mode disables sanitization

## Requirements

- VS Code ≥ 1.90.0
- Node.js ≥ 18 and npm ≥ 9
- macOS, Linux, or Windows

## Quick Start (Development)

1) Install dependencies

```bash
git clone https://github.com/PriNova/nebulaflow
cd nebulaflow
```

npm install
```

2) Build once (webview + extension)

```bash
npm run build
```

3) Launch the extension in VS Code

- Open this folder in VS Code
- Run and Debug: "Launch Extension (Desktop)" (F5)
  - This uses the `dev: start-webview-watch` task to watch webview assets

4) Open the editor UI

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
- Lint/Format (ESLint):
  - Check: `npm run check`
  - Lint: `npm run lint`
  - Auto-fix: `npm run lint:fix`

## Electron Build (Standalone App)

NebulaFlow can also be built as a standalone Electron application.

### Development

Run the Electron app in development mode (with hot reload for the webview):

```bash
npm run start:electron
```

### Building

To build the Electron main process:

```bash
npm run build:electron
```

### Packaging

To package the application for distribution (creates an executable in `dist/release`):

**Linux (AppImage):**
```bash
npm run pack:electron -- --linux
```

**Windows (Zip):**
```bash
npm run zip:win
```
(This builds an unpacked win32-x64 application and zips it, bypassing the need for Wine on Linux)

**macOS (DMG):**
```bash
npm run pack:electron -- --mac
```

## Scripts

```jsonc
{
  "build:webview": "vite build --config workflow/Web/vite.config.mts",
  "watch:webview": "vite build --watch --config workflow/Web/vite.config.mts --mode development",
  "build:ext": "node scripts/bundle-ext.mjs",
  "watch:ext": "node scripts/bundle-ext.mjs --watch",
  "watch": "node scripts/dev-watch.mjs",
  "typecheck": "tsc -p . && tsc -p workflow/Web/tsconfig.json",
  "check": "npm run typecheck && npm run lint",
  "lint": "eslint .",
  "lint:fix": "eslint --fix .",
  "build": "npm run typecheck && npm run build:webview && npm run build:ext",
  "package:vsix": "npm run build && rm -f dist/${npm_package_name}-${npm_package_version}.vsix && vsce package --out dist/${npm_package_name}-${npm_package_version}.vsix"
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
│  │  └ components/
│  │     ├ sidebar/              # Left/Right sidebars, PropertyEditor, actions
│  │     ├ graph/                 # Custom edge component, edge paths, validation
│  │     ├ nodes/                 # Node UI components (LLM, CLI, etc.)
│  │     ├ modals/               # Help, confirm delete, text editor, markdown preview
│  │     ├ shared/               # Reusable UI (Markdown, copy button, run buttons, logo)
│  │     └ subflows/             # Sub-flow UI components
│  ├ Application/                # Extension-side app layer (messaging, lifecycle)
│  │  └ messaging/               # Message handling and routing
│  ├ Core/                       # Pure types, models, validation
│  │  └ validation/              # Schema validation helpers
│  ├ DataAccess/                 # I/O adapters (FS, shell)
│  │  ├ fs.ts                    # Save/load workflows and custom nodes
│  │  └ shell.ts                 # Shell exec with abort/sanitization
│  ├ WorkflowExecution/          # Graph execution engine
│  │  ├ Application/             # Execution orchestration
│  │  ├ Core/                    # Execution logic (engine, graph sorting)
│  │  └ Shared/                  # Execution utilities
│  ├ WorkflowPersistence/        # Workspace persistence
│  ├ PiIntegration/              # pi coding-agent SDK integration (models, tools, images)
│  ├ LLMIntegration/             # LLM node SDK integration (legacy)
│  ├ Library/                    # Custom nodes library
│  ├ Subflows/                   # Sub-flow management
│  └ Shared/                     # Shared infrastructure
│     ├ Host/                    # Host services (VSCode, Electron, WebSocket bridge)
│     ├ Infrastructure/          # Base infrastructure
│     └ LLM/                     # Shared LLM utilities
├ web/                          # Browser-only deployment target
├ server/                       # WebSocket bridge server for web target
├ electron/                     # Electron standalone desktop app
```

## Architecture

This repo follows a vertical slice style within the `workflow/` directory:

- **Web (UI)**: webview UI, user-initiated actions, and protocol mirror
  - Web slices under `workflow/Web/components/`:
    - `sidebar/` (left/right sidebars, PropertyEditor, actions)
    - `graph/` (custom edges, edge paths, edge validation)
    - `nodes/` (node UI components for LLM, CLI, control-flow, etc.)
    - `modals/` (help, confirm delete, text editor, markdown preview)
    - `shared/` (reusable UI: Markdown, copy button, run buttons, spinning logo)
    - `subflows/` (sub-flow UI components)
  - Path aliases for slices are defined in [tsconfig.json](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/tsconfig.json#L16-L23) and [vite.config.mts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/vite.config.mts#L9-L17): `@graph/*`, `@sidebar/*`, `@modals/*`, `@nodes/*`, `@shared/*`.
- **Application**: request/message handling, command orchestration, and lifecycle management
- **Core**: pure types/models and validation helpers
- **DataAccess**: file system and shell adapters for persistence and process execution (script mode + spawn/streaming)
- **WorkflowExecution**: graph execution engine with node runners for each node type
- **WorkflowPersistence**: workspace persistence layer
- **LLMIntegration**: LLM node SDK integration and workspace configuration
- **Library**: custom nodes library management
- **Subflows**: sub-flow management
- **Shared**: shared infrastructure (Host, Infrastructure, LLM utilities)

Execution flow:

1. User opens the editor and edits a graph in the webview
2. Webview posts messages (save, load, execute, token count) to the extension
3. Extension validates, persists, and executes nodes in a safe order and in parallel if possible
4. Status/results stream back to the webview for display

## Persistence

- Workflows are JSON files saved under `.nebulaflow/workflows/` (versioned `1.x`)
- Custom nodes are JSON files saved under `.nebulaflow/nodes/`
- Subflows are JSON files saved under `.nebulaflow/subflows/`
- The extension prompts for save/load locations scoped to the workspace

## Security

- CLI nodes:
  - Command mode (one-liners): disallowed prefixes and sanitization are applied; optional approval.
  - Script mode (multiline via stdin): runs via spawn; denylist is not applied, but approvals still work and strict flags are available.
  - Advanced mode: disables sanitization; use with approval during authoring. In non-interactive environments, disable approvals.
- Errors are surfaced via VS Code notifications; execution halts on errors/abort

## Troubleshooting

- LLM node error "API key is not set":
  - Set the pi SDK API key environment variable before launching, or use the legacy `AMP_API_KEY` fallback.
- Webview assets don't load:
  - Run `npm run build` or start the Run and Debug configuration (which starts the watcher)
- Type errors:
  - Run `npm run typecheck` and address diagnostics
- Lint/format issues:
  - Run `npm run check` or `npm run lint:fix`

## Contributing

- TypeScript strict mode; extension uses CommonJS; webview uses ESM + React
- Formatting and linting via ESLint (`npm run check`, `npm run lint:fix`)
- Keep core helpers pure; put side-effects at the boundaries (webview/application/data access)
- Prefer explicit type imports and small functions
- Node.js built-in imports must use the `node:` protocol (e.g., `import * as fs from 'node:fs'`)

## License

[MIT License](LICENSE)
