Tino, here’s a focused code review of the amp-editor build system and configs, plus current (Oct 2025) best practices.

Strengths
- Clear build split and outputs:
  - Webview via Vite to `dist/webviews` in [vite.config.mts](file:///home/prinova/CodeProjects/amp-editor/webview/vite.config.mts#L5-L11).
  - Extension via tsc to `dist` in [tsconfig.json](file:///home/prinova/CodeProjects/amp-editor/tsconfig.json#L3-L7) with entry in [package.json](file:///home/prinova/CodeProjects/amp-editor/package.json#L9).
- Secure webview scaffolding:
  - CSP placeholder with `webview.cspSource` in [workflow.html](file:///home/prinova/CodeProjects/amp-editor/webview/workflow.html#L7-L10).
  - Local resource restriction to `dist` in [extension.ts](file:///home/prinova/CodeProjects/amp-editor/src/extension.ts#L21-L25).
  - Proper Vite base `./` and relative asset handling in [vite.config.mts](file:///home/prinova/CodeProjects/amp-editor/webview/vite.config.mts#L7).
- Simple, strict TS setup:
  - ES2022 target, strict mode, sourcemaps in [tsconfig.json](file:///home/prinova/CodeProjects/amp-editor/tsconfig.json#L3-L12).

Findings and Recommendations
- Extension bundling (performance and packaging):
  - Today you ship the extension as multiple JS files compiled by tsc (no bundler) per [scripts](file:///home/prinova/CodeProjects/amp-editor/package.json#L21-L25). Best practice is to bundle the extension (esbuild preferred) for faster cold start and smaller vsix, keeping `vscode` external and generating sourcemaps for dev. Add a `vscode:prepublish` script that bundles to `dist/extension.js`. Source: Bundling Extensions (official) [code.visualstudio.com](https://code.visualstudio.com/api/working-with-extensions/bundling-extension).
- ESM vs CommonJS (extension code):
  - Keep CommonJS for the extension (`"module": "commonjs"` in [tsconfig.json](file:///home/prinova/CodeProjects/amp-editor/tsconfig.json#L4)). VS Code extension host continues to load extensions as CommonJS; ESM is not recommended for extension entry in 2024–2025. Avoid `"type": "module"`. Sources: v1.93 notes and guidance [code.visualstudio.com/updates/v1_93](https://code.visualstudio.com/updates/v1_93), Web Extensions guide [code.visualstudio.com](https://code.visualstudio.com/api/extension-guides/web-extensions).
- Packaging pipeline (vsce and ignore list):
  - There’s no packaging step. Add `@vscode/vsce` and scripts like `"vscode:prepublish": "npm run build"`, `"package": "vsce package"`, and a `.vscodeignore` to exclude `src/`, `webview/`, raw TS, and dev-only artifacts, only shipping `dist/`, `README`, and metadata. Source: Publishing Extensions (official) [code.visualstudio.com](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).
- API typings dependency:
  - You have `vscode` as a devDependency in [package.json](file:///home/prinova/CodeProjects/amp-editor/package.json#L39). Current guidance is to remove the `vscode` npm package (deprecated) and use `@types/vscode` in devDependencies instead, while still importing `import * as vscode from 'vscode'` at runtime. Sources: Extension anatomy [code.visualstudio.com](https://code.visualstudio.com/api/get-started/extension-anatomy), deprecation note [github.com/microsoft/vscode-extension-vscode](https://github.com/microsoft/vscode-extension-vscode), official samples [github.com/microsoft/vscode-extension-samples](https://github.com/microsoft/vscode-extension-samples/tree/main/helloworld-sample).
- Webview CSP and resource handling:
  - Your CSP is strict and correct for externals (no inline scripts): [workflow.html](file:///home/prinova/CodeProjects/amp-editor/webview/workflow.html#L7-L10). If you ever need inline scripts/styles, prefer external files; only use nonces as a last resort. Keep `img-src ${cspSource} https: data:` and add `font-src` when needed. Sources: Webview security (official) [code.visualstudio.com](https://code.visualstudio.com/api/extension-guides/webview), Webview API reference [code.visualstudio.com](https://code.visualstudio.com/api/references/vscode-api#Webview).
  - `localResourceRoots` can be tightened from `dist` to the precise webview directory (`dist/webviews`) in [extension.ts](file:///home/prinova/CodeProjects/amp-editor/src/extension.ts#L21-L25) for least privilege.
  - Your path rewrite (`.replaceAll('./', ${asWebviewUri}/)`) in [extension.ts](file:///home/prinova/CodeProjects/amp-editor/src/extension.ts#L145-L153) is pragmatic and works with `base: './'`. If you later add multiple HTML entries, consider explicitly mapping each asset via `asWebviewUri` to avoid accidental rewrites.
- Dependency placement for webview libraries:
  - React/UI libs are in `dependencies` in [package.json](file:///home/prinova/CodeProjects/amp-editor/package.json#L26-L31), but since Vite produces static assets, they can live in `devDependencies` if you bundle them into the webview output (keeps vsix slim and avoids unused runtime node_modules). Validate packaging after the change. Source: Bundling Extensions (official) [code.visualstudio.com](https://code.visualstudio.com/api/working-with-extensions/bundling-extension).
- Dev experience (optional):
  - Consider `watch` scripts for extension (`tsc -w` or esbuild `--watch`) and a Vite dev mode for quicker loops. Not required, but helpful.
- Minor config tidy:
  - `jsx: react-jsx` in [tsconfig.json](file:///home/prinova/CodeProjects/amp-editor/tsconfig.json#L15) is unused by the extension (webview compiles separately via Vite). It’s harmless but could be removed from the root TS config if you prefer tighter settings.

File Pointers (for quick reference)
- [package.json](file:///home/prinova/CodeProjects/amp-editor/package.json#L6-L9) engines/main, [scripts](file:///home/prinova/CodeProjects/amp-editor/package.json#L21-L25), [devDependencies with vscode](file:///home/prinova/CodeProjects/amp-editor/package.json#L39).
- [tsconfig.json](file:///home/prinova/CodeProjects/amp-editor/tsconfig.json#L3-L7) CJS/ES2022/outDir, [jsx](file:///home/prinova/CodeProjects/amp-editor/tsconfig.json#L15).
- [webview/vite.config.mts](file:///home/prinova/CodeProjects/amp-editor/webview/vite.config.mts#L5-L11) base/outDir, [inputs](file:///home/prinova/CodeProjects/amp-editor/webview/vite.config.mts#L12-L16).
- [webview/workflow.html](file:///home/prinova/CodeProjects/amp-editor/webview/workflow.html#L7-L10) CSP, [script entry](file:///home/prinova/CodeProjects/amp-editor/webview/workflow.html#L14).
- [src/extension.ts](file:///home/prinova/CodeProjects/amp-editor/src/extension.ts#L21-L25) webview options, [asset rewrite](file:///home/prinova/CodeProjects/amp-editor/src/extension.ts#L145-L153).

Actionable Next Steps
- Add bundling and packaging:
  - esbuild: bundle `src/extension.ts` → `dist/extension.js` with `external: ['vscode']`, `platform: node`, `format: cjs`, `sourcemap: true` (dev), `minify` (prepublish).
  - Add `vscode:prepublish`, `package`, and `.vscodeignore`.
- Replace dev API dependency:
  - Remove `vscode` devDependency; add `@types/vscode` devDependency matching `engines.vscode`.
- Tighten webview sandbox:
  - Narrow `localResourceRoots` to `dist/webviews`.
  - Keep CSP strict; add `font-src` if fonts are used.

Sources
- Bundling extensions: https://code.visualstudio.com/api/working-with-extensions/bundling-extension
- Publishing extensions (vsce): https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- Webview guide and CSP: https://code.visualstudio.com/api/extension-guides/webview
- Webview API reference: https://code.visualstudio.com/api/references/vscode-api#Webview
- ESM vs CJS guidance: https://code.visualstudio.com/updates/v1_93
- Deprecated ‘vscode’ package: https://github.com/microsoft/vscode-extension-vscode
- Official samples: https://github.com/microsoft/vscode-extension-samples/tree/main/helloworld-sample

If you want, I can add an esbuild config and the packaging scripts, or swap `vscode` → `@types/vscode`.