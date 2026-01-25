# Deployment Guide

This guide covers deploying NebulaFlow as a VS Code extension and Electron application, including versioning, packaging, and distribution.

## Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- **VS Code** ≥ 1.90.0 (for extension development)
- **Git** (for version control)
- **VSCE** (VS Code Extension CLI) - installed via `npm install -g @vscode/vsce`
- **Electron Builder** (for Electron packaging) - installed via `npm install -g electron-builder`

## Deployment Targets

NebulaFlow can be deployed in two ways:

### 1. VS Code Extension (Primary)

The extension is published to the VS Code Marketplace for installation by users.

### 2. Electron Application (Alternative)

A standalone desktop application that bundles VS Code and NebulaFlow, available as:
- **AppImage** for Linux
- **DMG** for macOS
- **NSIS** installer for Windows

## Build & Package Process

### VS Code Extension Package

Create a `.vsix` file for distribution:

```bash
npm run package:vsix
```

This command:
1. Runs type checking (`npm run typecheck`)
2. Builds the webview (`npm run build:webview`)
3. Builds the extension (`npm run build:ext`)
4. Packages everything into `dist/nebulaflow-{version}.vsix`

**Output**: `dist/nebulaflow-0.2.14.vsix` (version matches `package.json`)

### Electron Application Package

Build platform-specific installers:

```bash
# Build Electron app (main process)
npm run build:electron

# Create platform packages
npm run pack:electron  # Uses electron-builder

# Platform-specific builds
npm run pack:win       # Windows NSIS installer
npm run zip:win        # Windows zip package
```

**Output**: `dist/release/` containing:
- `NebulaFlow-{version}.AppImage` (Linux)
- `NebulaFlow-{version}.dmg` (macOS)
- `NebulaFlow-{version}.exe` (Windows NSIS)

## Versioning Strategy

### Automatic Versioning

The version is defined in `package.json`:

```json
{
  "version": "0.2.14",
  "publisher": "prinova"
}
```

### Release Process

1. **Update version** in `package.json` (follow [Semantic Versioning](https://semver.org/)):
   - **Patch** (0.2.14 → 0.2.15): Bug fixes
   - **Minor** (0.2.14 → 0.3.0): New features (backward compatible)
   - **Major** (0.2.14 → 1.0.0): Breaking changes

2. **Create a Git tag**:
   ```bash
   git tag v0.2.14
   git push origin v0.2.14
   ```

3. **Build and package**:
   ```bash
   npm run package:vsix
   npm run pack:electron
   ```

4. **Create GitHub Release**:
   - Go to GitHub → Releases → Draft New Release
   - Use the tag `v0.2.14`
   - Upload the `.vsix` file and platform installers
   - Add release notes

## VS Code Marketplace Deployment

### Publishing to Marketplace

1. **Create a publisher account** at [Visual Studio Code Marketplace Publisher Portal](https://marketplace.visualstudio.com/manage/)

2. **Get a Personal Access Token**:
   - Go to [Azure DevOps](https://dev.azure.com/)
   - Create a new organization (or use existing)
   - Generate a PAT with "Marketplace" (Publish) scope

3. **Publish the extension**:
   ```bash
   vsce publish --pat <your-personal-access-token>
   ```

   Or publish a specific `.vsix` file:
   ```bash
   vsce publish --pat <your-personal-access-token> --vsix dist/nebulaflow-0.2.14.vsix
   ```

4. **Verify publication**:
   - Check the [Marketplace Publisher Portal](https://marketplace.visualstudio.com/manage/)
   - The extension will be available at: `https://marketplace.visualstudio.com/items?itemName=prinova.nebulaflow`

### Marketplace Configuration

The extension's marketplace metadata is controlled by:
- `package.json` fields: `name`, `displayName`, `description`, `version`, `publisher`
- `README.md` (displayed on marketplace page)
- `CHANGELOG.md` (version history)

**Important**: Update `README.md` before publishing to ensure accurate marketplace documentation.

## GitHub Actions CI/CD

### Build Workflow

The project includes a GitHub Actions workflow (`.github/workflows/build.yml`) that automatically:

1. **Triggers** on:
   - Pushes to `main` and `dev` branches
   - Pull requests
   - Tag pushes (e.g., `v*`)

2. **Runs**:
   ```bash
   npm run check          # Type check + lint
   npm run package:vsix   # Build and package extension
   ```

3. **Uploads artifacts**:
   - VSIX file
   - Build logs
   - Test results

4. **Creates GitHub Release** (when a tag is pushed):
   - Auto-generates release notes
   - Attaches build artifacts

### Manual CI/CD Trigger

You can manually trigger the workflow:
```bash
# Push a tag to trigger release
git tag v0.2.14
git push origin v0.2.14
```

## Distribution Channels

### Primary Distribution

1. **VS Code Marketplace** (Recommended)
   - Users install via VS Code Extensions view
   - Automatic updates
   - Professional distribution

2. **GitHub Releases**
   - Direct download of `.vsix` files
   - Platform-specific installers
   - Suitable for manual installation

### Alternative Distribution

3. **GitHub Packages** (Optional)
   - Store `.vsix` files as GitHub Packages
   - Private distribution for enterprise

4. **Manual Installation**
   - Users can install `.vsix` files directly:
     ```bash
     code --install-extension nebulaflow-0.2.14.vsix
     ```

## Deployment Checklist

### Before Release

- [ ] Run `npm run check` (typecheck + lint) - all errors fixed
- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Test extension in VS Code (F5 debug mode)
- [ ] Test Electron app builds (if applicable)
- [ ] Update `README.md` with current features
- [ ] Verify all documentation links are valid

### During Release

- [ ] Create Git tag: `git tag v{version}`
- [ ] Push tag: `git push origin v{version}`
- [ ] Build VSIX: `npm run package:vsix`
- [ ] Build Electron installers: `npm run pack:electron`
- [ ] Create GitHub Release with artifacts
- [ ] Publish to VS Code Marketplace

### After Release

- [ ] Verify marketplace listing is correct
- [ ] Test installation from marketplace
- [ ] Monitor GitHub Issues for bug reports
- [ ] Update documentation if needed

## Environment Variables for Deployment

### Required for LLM Nodes

These must be set in the user's environment, not during build:

```bash
export AMP_API_KEY="your-amp-key"
export OPENROUTER_API_KEY="your-openrouter-key"
```

### Optional Configuration

```bash
# Maximum shell output characters (default: 10000)
export NEBULAFLOW_SHELL_MAX_OUTPUT="50000"

# Enable LLM debug logging
export NEBULAFLOW_DEBUG_LLM="true"

# Filter pause seeds (for testing)
export NEBULAFLOW_FILTER_PAUSE_SEEDS="false"
```

## Troubleshooting Deployment

| Issue | Solution |
|-------|----------|
| **VSCE authentication failed** | Ensure PAT has "Marketplace (Publish)" scope and is not expired. |
| **Build fails with type errors** | Run `npm run typecheck` and fix all errors before packaging. |
| **Webview assets missing in VSIX** | Ensure `npm run build:webview` completed successfully. |
| **Electron build fails** | Check `electron-builder` configuration in `package.json`; verify platform tools (e.g., NSIS for Windows). |
| **Version mismatch** | Ensure `package.json` version matches the Git tag and release notes. |
| **Marketplace rejection** | Verify `README.md` has no broken links and `CHANGELOG.md` follows proper format. |
| **GitHub Actions fails** | Check workflow logs; ensure all dependencies are in `package.json`. |
| **Extension not activating** | Verify `main` field points to `dist/src/extension.js` and file exists. |

## Rollback Strategy

If a release causes issues:

1. **Immediate rollback**:
   - Unpublish from VS Code Marketplace (via Publisher Portal)
   - Remove GitHub Release
   - Revert Git tag

2. **Hotfix release**:
   - Create a new branch from the previous stable tag
   - Apply fixes
   - Bump patch version
   - Release as `v{major}.{minor}.{patch+1}`

3. **Communication**:
   - Update GitHub Issues
   - Post in relevant channels (Discord, etc.)
   - Update README if needed

## Next Steps

- Read [Build Guide](build.md) for build system details.
- Explore [Development Guide](development.md) for development workflow.
- Check [Technical Architecture](architecture.md) for implementation details.
- Review [Protocol](../../workflow/Core/Contracts/Protocol.ts) for extension-webview communication.
