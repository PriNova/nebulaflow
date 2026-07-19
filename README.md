# NebulaFlow Workflow Editor

NebulaFlow is a visual editor for designing and running developer workflows as node graphs. It supports VS Code, a standalone Electron desktop application, and a browser/WebSocket target.

![UI Screenshot](assets/screenshot.png)

> [!NOTE]
> **Electron beta ready:** The standalone desktop target is ready for beta testing. Windows packaging and the core editor, IPC, persistence, local execution, and pi model discovery flows have been validated. Beta status means it is suitable for testing and feedback, but it is not yet a stable production release.

## Project Focus: LLM Node

The LLM node runs via the pi coding-agent SDK (`@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`). The editor builds prompts from upstream node outputs and executes them with pi's `PiAgent` API.

- SDK integration: `workflow/PiIntegration/` owns one shared pi `ModelRuntime` for model discovery, provider authentication, custom models, and request routing.
- Authentication: use pi `/login`, `~/.pi/agent/auth.json`, or the selected provider's standard API-key environment variable.

### Pi model configuration

NebulaFlow uses pi's standard configuration stores:

- `~/.pi/agent/settings.json`: global `defaultProvider` and `defaultModel`.
- `<workspace>/.pi/settings.json`: project overrides for pi settings.
- `~/.pi/agent/auth.json`: API keys and OAuth credentials created by pi `/login`.
- `~/.pi/agent/models.json`: custom providers and models.
- `~/.pi/agent/models-store.json`: cached dynamic provider catalogs.

A model selected in the LLM node Property Editor takes priority. Without a node selection, NebulaFlow uses pi's project/global default when authenticated, then an authenticated built-in fallback. The Model combobox shows models available through the shared pi `ModelRuntime`.

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

- VS Code ≥ 1.90.0 for the extension target
- Node.js ≥ 22.19.0 and npm
- macOS, Linux, or Windows

## Quick Start (Development)

1) Install dependencies

```bash
git clone https://github.com/PriNova/nebulaflow
cd nebulaflow
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

## Electron Desktop App (Beta)

The Electron target runs NebulaFlow as a standalone desktop application without requiring VS Code. It uses the same workflow editor and execution runtime as the extension target.

Windows packaging is currently validated. Linux and macOS targets are configured, but should be tested on their native operating systems before distribution.

### Run from source

Install dependencies, build the webview and Electron main process, then start Electron:

```bash
npm install
npm run start:electron
```

`start:electron` performs the required webview and Electron builds before launching the app.

### Build without starting

```bash
npm run build:webview
npm run build:electron
```

Compiled Electron files are written under `dist/electron`, while shared renderer assets are written under `dist/webviews`.

### Create a Windows beta package

Run this command on Windows:

```bash
npm run pack:electron -- --win
```

Artifacts are created under `dist/release`:

- `dist/release/win-unpacked/NebulaFlow.exe` — unpacked application for direct smoke testing
- `dist/release/NebulaFlow Setup <version>.exe` — NSIS installer

### Create Linux or macOS packages

Run the appropriate command on the target operating system:

```bash
# Linux AppImage
npm run pack:electron -- --linux

# macOS DMG
npm run pack:electron -- --mac
```

Platform signing and installer requirements are environment-specific. Building on the target operating system is recommended.

### Validate an Electron beta build

Before distributing a beta package, run:

```bash
npm run check
npm run build
npm run build:web
npm run pack:electron -- --win
```

Then start `dist/release/win-unpacked/NebulaFlow.exe` and verify the editor, workflow storage, model discovery, and one local workflow operation.

## Scripts

Key scripts:

- `npm run build` — typecheck and build the VS Code extension and shared webview
- `npm run build:web` — build the standalone browser target
- `npm run start:electron` — build and start the Electron app from source
- `npm run build:electron` — compile the Electron main and preload processes
- `npm run pack:electron -- --win` — create the Windows unpacked app and installer
- `npm run pack:electron -- --linux` — create the Linux AppImage
- `npm run pack:electron -- --mac` — create the macOS DMG
- `npm run package:vsix` — build and package the VS Code extension
- `npm run check` — run TypeScript and ESLint checks

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

- LLM node reports that no authenticated model is available:
  - Run pi `/login`, configure `~/.pi/agent/auth.json`, or set the selected provider's API-key environment variable before launching NebulaFlow.
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
