# Code Style

NebulaFlow follows a strict TypeScript style guide. Please adhere to the following:

## TypeScript

- **Strict mode** is enabled. Ensure your code compiles without errors.
- **Explicit type imports**: Prefer `import type { Foo } from './bar'` when only types are used.
- **Node.js built-ins**: Always use the `node:` protocol (e.g., `import * as fs from 'node:fs'`).
- **Functions**: Keep them small and pure. Side effects should be isolated at boundaries (webview/engine).
- **Naming**:
  - Variables & functions: `lowerCamelCase`
  - Components & types: `PascalCase`
  - Enums: `PascalCase` (e.g., `NodeType`)
- **Imports**: Group external imports first, then internal imports. Sort alphabetically.

## Linting & Formatting

We use **Biome** for linting and formatting.

- Run checks: `npm run check` (typecheck + lint)
- Auto‑fix: `npm run biome` (also aliased as `npm run format`)

### Biome Configuration

The project uses the following Biome rules (see `biome.jsonc`):

- **Organize imports**: Enabled.
- **Linting**: Enabled with recommended rules.
- **Style rules**:
  - `useNodejsImportProtocol`: error (enforces `node:` protocol)
  - `useImportType`: error (enforces type imports)
  - `useExportType`: error (enforces type exports)
- **Correctness**: `noUnusedImports`: error.
- **Complexity**: `noUselessTernary`: error.
- **Formatter**:
  - Indent style: spaces, width 4
  - Line width: 105
- **JavaScript formatter**:
  - Semicolons: as needed
  - Quote style: single quotes
  - Arrow parentheses: as needed
  - Trailing commas: ES5

## Architecture

NebulaFlow uses a **Vertical Slice Architecture** (VSA). Key slices:

- `workflow/Web/` – React UI, React Flow graph, node components, sidebars.
- `workflow/Application/` – Message handling, command orchestration, lifecycle.
- `workflow/Core/` – Pure types, models, validation.
- `workflow/DataAccess/` – File system and shell adapters.
- `workflow/WorkflowExecution/` – Graph execution engine, node runners.
- `workflow/LLMIntegration/` – SDK integration, workspace configuration.
- `workflow/Shared/` – Generic primitives (Host, Infrastructure).

**Rule**: Keep related code together. Avoid creating global utilities unless used by 3+ unrelated slices.

## Additional Guidelines

- **No global state**: Prefer passing data explicitly.
- **Immutability**: Do not mutate objects passed into functions.
- **Error handling**: Use typed errors where possible; avoid `any`.
- **Comments**: Explain "why" rather than "what". Use JSDoc for public APIs.
- **Testing**: Write co‑located unit tests (`.spec.ts`) for pure logic. Manual testing for UI/integration.

## Editor Configuration

The project includes VS Code settings in `.vscode/`. Recommended extensions:

- **Biome** (official)
- **TypeScript Import Sorter** (optional)

Ensure your editor respects the project's `.editorconfig` (if present) and Biome settings.

## Pre‑commit Hooks

The repository uses `husky` and `lint‑staged` (if configured) to run checks before commits. If not, run `npm run check` manually before pushing.

---

*Last Updated: 2026-01-21*
