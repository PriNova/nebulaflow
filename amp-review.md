## High-level summary
A single file, `README.md`, has been added.  
The README introduces the “Amp Workflow Editor” VS Code extension, outlines its architecture, scripts, development workflow, security measures, and troubleshooting steps. No source‐code logic changed.

## Tour of changes
Because the only touched file is `README.md`, begin the review at the very top of that file and read straight through. The first section (“Amp Workflow Editor (VS Code Extension)”) already establishes the project scope and links to key source files; understanding those links will contextualise every later section.

## File-level review

### `README.md`
What changed  
• Entire file added (≈160 lines).  
• Provides quick-start, project structure, architecture, persistence, security, troubleshooting, and contributing guidelines.

Review

Correctness & clarity
1. Broken / fragile line links  
   – Markdown links such as  
     `workflow/Application/handlers/ExecuteWorkflow.ts#L88-L95`  
     will only work in GitHub/GitLab after commit **if the file already exists at those exact line numbers**. Any refactor-induced line shift will silently break the link. Consider linking to permanent anchors (e.g. permalink with commit SHA) or removing the line fragment.

2. “VS Code ≥ 1.90.0”  
   – VS Code 1.90 has not been released at the time of writing (current stable is 1.87). If 1.90+ APIs are not actually required, downgrade the version requirement (e.g. 1.85). Otherwise add a note that Insiders is needed.

3. Shell security wording  
   – The list of “Dangerous CLI prefixes” is said to be “non-exhaustive” yet the README might be read as exhaustive. Explicitly state that additional validation occurs in code and the list is illustrative only.

4. Scripts block  
   – The JSON snippet shows `"biome": "biome check --apply --error-on-warnings ."`. Because `.`, not `"."`, is passed, Biome will recurse through `node_modules`. Recommend `.` but with an `--ignore-path .gitignore` or similar or restrict to `src` + `workflow`.

5. Watch webview  
   – `vite build --watch` performs a production build on every change; typical dev flow is `vite dev` or `vite serve`. If intentional (because VS Code webviews can’t consume dev server), add one‐sentence rationale.

6. Typo / wording  
   – “Keep core helpers pure; put side-effects at the boundaries” – good, but add a short pointer to the folder that owns side-effects (Application/DataAccess) to avoid drift.  
   – “TBD” license: until finalised, many companies treat this as “all rights reserved”. If open source is intended, add a short note (“licence choice pending final approval”).

7. Missing badges  
   – Optional nicety: add CI, VS Code Marketplace, npm, and license badges at the top.

Inefficiencies  
No performance concerns—this is documentation only.

Security vulnerabilities  
No direct code; however, caution readers that shell sanitisation lives in code, not the README, and thus they must still audit `workflow/DataAccess/shell.ts`.

Other suggestions
• Provide a one-line “Install from Marketplace” instruction for end users.  
• Add a “Testing” script (`npm run test`) placeholder even if tests aren’t yet present.  
• Under “Persistence”, clarify whether versioning beyond `1.x` will add migration steps.  
• Under “Quick Start”, step 3 implicitly relies on the `preLaunchTask` defined in `.vscode/launch.json`; mention that explicitly so non-VS Code IDEs know what to run.

Overall this is a strong, detailed README. Addressing the small accuracy and maintenance issues above will reduce future confusion.