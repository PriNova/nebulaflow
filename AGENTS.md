# AGENTS – Amp Editor Quick Guide

- Build: `npm run build` (webview + extension). Parts: `webview/vite.config.mts`, `tsconfig.json`.
- Webview only: `npm run build:webview`. Extension only: `npm run build:ext`.
- Webview watch: `npm run watch:webview`.
- Typecheck: `npm run typecheck` (TS 5.x; extends `@sourcegraph/tsconfig`).
- Lint: Biome configured (no ESLint/Prettier). `npm run lint` or `npm run check` (typecheck + Biome). Auto-fix with `npm run biome`.
- Format: `npm run format` (Biome).
- Tests: not configured. Single-test N/A. If added (e.g., Vitest), run: `npx vitest run path -t "name"`.

- Extension entry: `src/extension.ts` (registers `ampEditor.openWorkflow`, hosts webview, handles protocol).
- Protocol (ext side): `src/protocol/WorkflowProtocol.ts` (node/edge types, message contracts).
- Engine (ext side): `src/engine/{executor,fs,node-sorting,shell,utils}.ts` (graph execution, IO, sorting, shell exec).
- Webview app: React + @xyflow/react under `webview/` via Vite; entry `workflow/workflow.html` + `workflow/index.tsx`.
- Nodes/graph: `webview/workflow/components/nodes/Nodes.tsx` (NodeType, default workflow, nodeTypes).
- Webview protocol mirror: `webview/workflow/services/WorkflowProtocol.ts`.
- Persistence: workflows `.sourcegraph/workflows/*.json`, custom nodes `.sourcegraph/nodes/*.json`.
- Security: blocked CLI prefixes in `src/engine/executor.ts` and shell sanitization + abort support.

- TS config: strict; ES2022; CJS for extension; `jsx: react-jsx`; extends `@sourcegraph/tsconfig`. `noUnusedLocals` is currently disabled to avoid breaking the build; enable it once unused locals are cleaned up. Webview builds via Vite React plugin.
- Imports: extension uses `import * as vscode` + Node builtins; webview uses ESM React TS; prefer explicit type imports.
- Naming: lowerCamelCase vars/fns; PascalCase components/types; enums like `NodeType`.
- Errors: show user via `vscode.window.showErrorMessage`; avoid unhandled rejections; return sanitized strings.
- Formatting: Biome formats code; run `npm run format`. Keep functions small/pure in core helpers; side-effects at boundaries (webview/engine).
- Editor rules: none found (.cursor, .cursorrules, CLAUDE.md, .windsurfrules, .clinerules, .goosehints, Copilot instructions).
- VS Code: engines `>=1.90.0`; main `dist/extension.js`; webview output `dist/webviews`. Run: `npm i && npm run build`, launch in VS Code.
