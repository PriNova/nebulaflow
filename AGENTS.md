# AGENTS — NebulaFlow Contributor Guide

## Project Overview

- NebulaFlow is a visual editor for building and running LLM and CLI workflows as node graphs.
- Supported hosts share the same workflow UI and runtime:
  - VS Code extension
  - Electron desktop application (beta; Windows packaging validated)
  - Browser client connected to a local WebSocket bridge
- LLM nodes use the pi SDK packages `@earendil-works/pi-agent-core`, `@earendil-works/pi-ai`, and `@earendil-works/pi-coding-agent` through one shared pi `ModelRuntime`.

## Required Environment

- Node.js `>=22.19.0` and npm.
- VS Code `>=1.90.0` for extension development.
- Install dependencies with `npm install`.
- Provider credentials use pi's standard `~/.pi/agent/auth.json` store or provider-specific environment variables. Global and project model defaults come from pi `settings.json`; custom providers come from pi `models.json`.
- Never commit API keys or other secrets.

## Commands

- Full validation: `npm run check` (root, webview, and Electron TypeScript checks followed by ESLint).
- Full extension build: `npm run build`.
- Webview: `npm run build:webview` or `npm run watch:webview`.
- Extension bundle: `npm run build:ext` or `npm run watch:ext`.
- Combined development watcher: `npm run watch`.
- Lint: `npm run lint`; fix lint/format issues with `npm run lint:fix` or `npm run format`.
- Automated tests are currently unavailable. `package.json` declares `test:subflows`, but its referenced runner is absent; do not treat that script as validation until fixed.
- VSIX package: `npm run package:vsix`.
- Browser target: `npm run build:web` or `npm run start:web`.
- Electron target: `npm run start:electron`, `npm run build:electron`, or `npm run dev:electron`.
- Windows Electron package: `npm run pack:win`; zipped package: `npm run zip:win`.

Run `npm run check` after code changes. Run the smallest relevant build as well; use `npm run build` before packaging or broad integration changes.

## Architecture and Key Paths

- `src/extension.ts`: thin VS Code activation entry point.
- `workflow/Application/register.ts`: VS Code panel creation and application registration.
- `workflow/Application/workflow-session.ts`: message routing, session lifecycle, approvals, and cancellation.
- `workflow/Core/`: shared models, protocol contracts, guards, and validation.
- `workflow/DataAccess/`: filesystem persistence and shell execution adapters.
- `workflow/WorkflowExecution/`: graph scheduler, execution state, handlers, and per-node runners.
- `workflow/WorkflowExecution/Application/node-runners/run-llm.ts`: pi Agent execution, model selection, tools, streaming, approval, and timeout handling.
- `workflow/PiIntegration/`: pi model discovery, coding tools, and image helpers.
- `workflow/WorkflowPersistence/`, `workflow/Library/`, and `workflow/Subflows/`: persistence feature slices.
- `workflow/Shared/Host/`: host abstraction and VS Code adapter.
- `workflow/Web/`: shared React + `@xyflow/react` workflow editor built by Vite.
- `workflow/Web/services/Protocol.ts`: webview protocol boundary.
- `workflow/Web/components/nodes/Nodes.tsx`: node registry and defaults.
- `workflow/Web/components/sidebar/`: node palette, property editor, and sidebars.
- `electron/`: Electron main process, preload, and host adapter.
- `web/` and `server/`: standalone browser client and WebSocket bridge.

The codebase uses feature-oriented slices. Keep pure graph and transformation logic in `Core`; orchestration in `Application`; filesystem, shell, host, and SDK side effects at infrastructure boundaries.

## Build Outputs

- VS Code extension entry: `dist/src/extension.js`.
- Shared workflow webview: `dist/webviews/`.
- Browser application: `dist/web/`.
- Electron TypeScript output: `dist/electron/`.
- Packaged Electron artifacts: `dist/release/`.

Do not hand-edit generated files under `dist/`.

## Coding Conventions

- Write source code and documentation in English.
- TypeScript strict mode is enabled. Prefer precise types, type-only imports, and runtime validation at external boundaries.
- Avoid `any`; when SDK boundaries require it, keep the exception narrow and documented.
- Use the `node:` protocol for Node.js built-ins, for example `import * as fs from 'node:fs'`.
- Use `lowerCamelCase` for variables/functions and `PascalCase` for components/types.
- Keep functions small where practical. Keep core helpers pure and isolate side effects.
- Handle rejected promises and narrow caught errors before reading error properties.
- Surface host-facing failures through the host abstraction or VS Code notifications. Return sanitized error text; do not expose secrets.
- Follow existing ESLint rules in `eslint.config.mjs`. ESLint is the active linter; Biome is not the primary lint/format workflow.
- Avoid brittle documentation such as source line numbers and historical version-specific UI notes.

## UI and Protocol Changes

When adding or changing a node type, check all affected boundaries:

1. Shared model and DTO definitions in `workflow/Core/models.ts` and `workflow/Core/Contracts/Protocol.ts`.
2. Runtime guards/converters.
3. Node runner and dispatch in `workflow/WorkflowExecution/Application/`.
4. UI component and registry in `workflow/Web/components/nodes/`.
5. Property editor and palette entries under `workflow/Web/components/sidebar/`.
6. Persistence compatibility for existing workflow JSON.
7. User and API documentation under `docs/`.

Keep extension and webview protocol changes backward-compatible when practical. Validate untrusted WebSocket, persisted JSON, and webview payloads at their boundaries.

## Persistence and Security

- Storage scope is configurable as `user` or `workspace`; default is `user`.
- Storage lives beneath `.nebulaflow/`, including `workflows/`, `nodes/`, and `subflows/`.
- `nebulaFlow.globalStoragePath` can override the user-scope base directory.
- CLI safe mode applies command restrictions; advanced mode removes protections and must be treated as unsafe.
- Preserve approval and abort behavior when changing CLI or LLM execution.
- Do not log credentials, personal data, complete sensitive prompts, or unnecessarily large tool payloads.

## Development Workflow

- For VS Code debugging, use the `Launch Extension (Desktop)` configuration in `.vscode/launch.json`; it starts the webview watcher before F5 launch.
- For Electron changes, validate the shared webview plus Electron TypeScript build. Smoke-test packaged behavior when host integration is affected.
- For browser/bridge changes, run the bridge and browser client together with `npm run start:web`.
- For runtime-sensitive changes, verify behavior using streamed status/output, host logs, or a focused temporary diagnostic. Remove temporary diagnostics before delivery unless intentionally retained behind a debug flag.
- Check `git status --short` before finishing. Do not overwrite unrelated user changes.
