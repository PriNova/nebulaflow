# Build Guide

This guide covers the build system, build scripts, and packaging process for NebulaFlow.

## Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9 (see [Node.js downloads](https://nodejs.org/))
- **VS Code** ≥ 1.90.0 (for extension development and debugging)
- **Git** (for cloning the repository)

## Build Architecture

NebulaFlow is a VS Code extension with a React webview interface. The build process consists of three main components:

1. **TypeScript Type Checking** - Validates all TypeScript code
2. **Webview Build** - Bundles the React application (React Flow UI)
3. **Extension Build** - Bundles the VS Code extension host code
4. **Electron Build** - Builds the Electron application (optional)

## Build Scripts

### Full Build

Build everything with type checking:

```bash
npm run build
```

This executes in order:
1. `npm run typecheck` - TypeScript validation for all components
2. `npm run build:webview` - Vite bundles React app into `dist/webviews/`
3. `npm run build:ext` - esbuild bundles extension + SDK into `dist/src/extension.js`

### Partial Builds

Build specific components:

```bash
# Webview only (React UI)
npm run build:webview

# Extension only (VS Code extension host)
npm run build:ext

# Electron app (main process)
npm run build:electron
```

### Watch Modes (Development)

Watch for changes and rebuild automatically:

```bash
# Webview watch (hot reload)
npm run watch:webview

# Extension watch (requires VS Code reload)
npm run watch:ext

# Combined watch (webview + extension)
npm run watch
```

**Note**: The combined watch (`npm run watch`) runs the webview watcher. Extension changes require a VS Code window reload.

### Type Checking

Run TypeScript type checking for all components:

```bash
npm run typecheck
```

This validates:
- Extension code (`src/`, `workflow/`)
- Webview code (`workflow/Web/`)
- Electron code (`electron/`)

### Linting & Formatting

NebulaFlow uses **Biome** for linting and formatting:

```bash
# Check (typecheck + lint)
npm run check

# Lint only
npm run lint

# Auto-fix (also aliased as `npm run format`)
npm run biome
```

### Packaging

Create a VSIX package for distribution:

```bash
npm run package:vsix
```

This creates a `.vsix` file in the `dist/` directory.

### Electron Packaging

Build and package the Electron application:

```bash
# Build Electron app
npm run pack:electron

# Build Windows installer
npm run pack:win

# Create Windows zip
npm run zip:win
```

## Build Configuration

### TypeScript Configuration

- **Main tsconfig** (`tsconfig.json`): Extends `@sourcegraph/tsconfig`, targets ES2022, Node16 module system
- **Electron tsconfig** (`electron/tsconfig.json`): Extends main config, outputs to `dist/electron/`
- **Webview tsconfig** (`workflow/Web/tsconfig.json`): Vite-managed, React JSX support

### Webview Build (Vite)

- **Entry**: `workflow/Web/workflow.html`
- **Output**: `dist/webviews/`
- **Bundler**: Vite with React plugin
- **Aliases**: `@graph`, `@sidebar`, `@modals`, `@nodes`, `@shared`
- **Development**: Source maps enabled, no minification
- **Production**: Minified, no source maps

### Extension Build (esbuild)

- **Entry**: `src/extension.ts`
- **Output**: `dist/src/extension.js`
- **Platform**: Node.js
- **Format**: CommonJS (CJS)
- **Target**: Node 20
- **External**: vscode (provided by VS Code runtime)

### Electron Build

- **Main process**: `electron/main/`
- **Preload**: `electron/preload/`
- **Output**: `dist/electron/`
- **Packaging**: electron-builder (AppImage for Linux, DMG for macOS, NSIS for Windows)

## Build Output Structure

```
dist/
├── src/                    # Extension bundle (extension.js)
├── webviews/              # Webview assets (HTML, JS, CSS)
├── electron/              # Electron app bundles
└── release/               # Packaged Electron apps (AppImage, DMG, NSIS)
```

## Development Workflow

### Initial Setup

1. Clone and install dependencies:
   ```bash
   git clone https://github.com/PriNova/nebulaflow.git
   cd nebulaflow
   npm install
   ```

2. Set environment variables:
   ```bash
   export AMP_API_KEY="your-amp-key"
   export OPENROUTER_API_KEY="your-openrouter-key"
   ```

3. Build the project:
   ```bash
   npm run build
   ```

### Development Mode

1. Start the watch mode:
   ```bash
   npm run watch
   ```

2. Open the project in VS Code.

3. Press **F5** to launch the extension in debug mode.

4. In the new VS Code window, run the command: **NebulaFlow: Open Workflow Editor**.

### Troubleshooting Build Issues

| Issue | Solution |
|-------|----------|
| **Webview assets don't load** | Run `npm run build` or start the webview watcher (`npm run watch:webview`). |
| **Type errors** | Run `npm run typecheck` and fix diagnostics. |
| **Lint/format issues** | Run `npm run check` or `npm run biome`. |
| **Extension fails to load** | Check VS Code version ≥ 1.90.0; reload the window. |
| **Amp SDK not available** | The SDK is vendored; ensure `vendor/amp-sdk/amp-sdk.tgz` exists. |
| **AMP_API_KEY is not set** | Set the environment variable before launching VS Code. |
| **Build hangs** | Kill any hanging processes and restart the build. |

## CI/CD Build Process

NebulaFlow uses GitHub Actions for continuous integration. The build workflow (`.github/workflows/build.yml`) runs:

1. **Type checking** (`npm run typecheck`)
2. **Linting** (`npm run lint`)
3. **Build and packaging** (`npm run package:vsix`)
4. **Upload artifacts** (VSIX file and build logs)
5. **Create release** (when a tag is pushed)

You can run the same steps locally to verify your changes before pushing.

## Build Performance Tips

- **Incremental builds**: Use watch modes (`npm run watch`) for faster development iteration.
- **Skip type checking**: For quick webview changes, use `npm run build:webview` directly.
- **Clean build**: If you encounter strange issues, run `npm run build` to ensure a clean build.
- **Cache**: TypeScript and Vite caches are stored in `node_modules/.cache/`. Delete this folder if caches become corrupted.

## Build Dependencies

### Runtime Dependencies

- `@prinova/amp-sdk`: Amp SDK (vendored)
- `@xyflow/react`: React Flow for graph visualization
- `react`, `react-dom`: UI framework
- Various UI components (Radix UI, lucide-react, etc.)

### Build Dependencies

- `typescript`: TypeScript compiler
- `esbuild`: Extension bundler
- `vite`: Webview bundler
- `@biomejs/biome`: Linting and formatting
- `electron`, `electron-builder`: Electron packaging

## Next Steps

- Read [Development Guide](development.md) for setting up the development environment.
- Explore the [Technical Architecture](architecture.md) for implementation details.
- Check the [Testing Guide](testing.md) for testing strategies.
