# Copilot Instructions for vscode-powershell

This is the VS Code extension for PowerShell — an LSP client that communicates with
[PowerShellEditorServices][] (PSES), the LSP server. The extension manages the PSES process
lifecycle, provides UI features, and handles debugging.

[PowerShellEditorServices]: https://github.com/PowerShell/PowerShellEditorServices

## Build, Lint, and Test

```sh
npm install --include=optional  # Install all deps (lint/test tools are in optionalDependencies)
npm run compile                 # Build with esbuild (outputs to dist/)
npm run lint                    # ESLint (strict TypeScript-aware rules)
npm run format                  # Prettier check (with organize-imports plugin)
npm test                        # Integration tests via @vscode/test-cli
```

After any code change, always run `npm run compile`, `npm run lint`, and `npm run format`. Tests run inside a VS Code Insiders instance — there is no way to run a
single test from the command line. Tests live in `test/` mirroring `src/` structure and use
Mocha BDD (`describe`/`it`).

## Architecture

`activate()` in `src/extension.ts` creates the `Logger`, `SessionManager`, and two groups of
features:

1. **Standalone features** — commands that don't need the LSP client (e.g. `PesterTestsFeature`)
2. **LanguageClientConsumers** — features extending `LanguageClientConsumer` that depend on the
   LSP client and override `onLanguageClientSet()` to register their handlers

`SessionManager` (`src/session.ts`) owns the full lifecycle: finding a PowerShell executable
(`src/platform.ts`), spawning PSES (`src/process.ts`), connecting the `LanguageClient`, and
restarting on critical setting changes.

Each feature in `src/features/` exports one `vscode.Disposable` class. Custom LSP message
types are defined as `RequestType`/`NotificationType` constants in the same file.
`IPowerShellExtensionClient` in `src/features/ExternalApi.ts` is the public API for other
extensions.

### PSES and Cross-Repo Work

The `modules/` folder contains the PSES, PSReadLine, and PSScriptAnalyzer PowerShell modules. In development it is a
symlink to `../PowerShellEditorServices/module` — [PowerShellEditorServices][] must be
cloned as a sibling and built before `npm run compile` will succeed. For cross-repo work, use `pwsh-extension-dev.code-workspace`.

## Key Conventions

- **VS Code best practices**: Follow the [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines) and [UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview). Use VS Code's APIs idiomatically and prefer disposable patterns for lifecycle management.
- **Logging**: Use `ILogger` (not `console.log`). Tests use `TestLogger` from `test/utils.ts`.
- **Settings**: Defined in `package.json` under `contributes.configuration`, read via
  `vscode.workspace.getConfiguration("powershell")` at point of use. Helpers in `src/settings.ts`.
- **TypeScript**: Strict mode, ESNext, `verbatimModuleSyntax`. `explicit-function-return-type`
  enforced. Unused vars prefixed `_`. Formatting via Prettier with the `organize-imports`
  plugin. Use `import x = require("x")` for Node/VS Code built-ins.
- **File headers**: Every source file starts with `// Copyright (c) Microsoft Corporation.`
  and `// Licensed under the MIT License.`

## Pull Request Labels

Every pull request **must** be labeled before it is opened so it is triaged
correctly and lands in the right changelog section.

Each PR requires:

- **At least one `Area-*` label** describing the part of the codebase it touches
  (e.g. `Area-Debugging`, `Area-IntelliSense`, `Area-Workspaces`,
  `Area-Documentation`). This is used for triage and filtering.
- **Exactly one `Issue-*` label** describing the kind of change:
  - `Issue-Bug` — a bug fix.
  - `Issue-Enhancement` — a new feature or changed behavior.
  - `Issue-Performance` — a performance improvement.

The `Issue-*` label is not optional: GitHub's auto-generated release notes use it
to pick the changelog category. See [`.github/release.yml`](./release.yml) for the
authoritative mapping (`Issue-Enhancement` → "Enhancements & Features ✨",
`Issue-Bug` → "Squashed Bugs 🐛"). Any PR **without** an `Issue-*` label falls
through the `"*"` catch-all into "Other Changes 🙏" and is silently
miscategorized, so always set one correctly.

Additionally:

- Add the relevant **`OS-*` label** (`OS-Windows`, `OS-macOS`, `OS-Linux`) when a
  change is platform-specific.
- Use the **`Ignore`** label only for changes that should be excluded from the
  release notes entirely (e.g. pure CI, test, or docs chores the maintainers do
  not want in the changelog). `.github/release.yml` excludes this label from the
  changelog.

The full, authoritative set of labels drifts over time — do not hard-code it
here. List the current labels with `gh label list --repo PowerShell/vscode-powershell`
or the repo's [Labels page](https://github.com/PowerShell/vscode-powershell/labels)
and pick the closest matches.
