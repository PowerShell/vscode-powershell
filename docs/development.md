# Development Instructions for the PowerShell Extension

## Development Setup

1. Clone [vscode-powershell][] and [PowerShellEditorServices][] as siblings — PSES must be at
   `../PowerShellEditorServices` relative to this repo.
1. Follow the [PSES development instructions][pses-dev] and build it first.
1. Install [Node.js][] 22.x or higher.
1. Open `pwsh-extension-dev.code-workspace` in [Visual Studio Code][] for recommended extensions and tasks.
1. Optionally run `git config blame.ignoreRevsFile .git-blame-ignore-revs` to ignore formatting commits.

[vscode-powershell]: https://github.com/PowerShell/vscode-powershell
[PowerShellEditorServices]: https://github.com/PowerShell/PowerShellEditorServices
[pses-dev]: https://github.com/PowerShell/PowerShellEditorServices#development
[Node.js]: https://nodejs.org/en/download/package-manager
[Visual Studio Code]: https://code.visualstudio.com

## Tracking Upstream Dependencies

The `engines.vscode` field in `package.json` declares the minimum VS Code version we support.
When it is updated:

1. Update `@types/vscode` to match (use `~` not `^` — patch updates only, not minor)
2. Check that VS Code version's `package.json` for its [`electron`][] dependency — the
   [Electron][] major version determines which [Node.js][] is bundled, which is the runtime
   the extension actually runs on
3. Update `@types/node` major to match that Node.js version (exact version need not match, but
   major should)
4. Update the Node.js version in CI (GitHub Actions) and OneBranch (Azure DevOps) pipelines,
   and developer machines to match

[`electron`]: https://github.com/microsoft/vscode/blob/release/1.114/package.json
[Electron]: https://releases.electronjs.org/release/v39.8.3
[Node.js]: https://nodejs.org/en/blog/release/v22.22.1

## Building the Code

From VS Code run the build and test tasks, or from PowerShell:

```powershell
Invoke-Build Build
Invoke-Build Test
```

See `vscode-powershell.build.ps1` for all available targets.

## Launching the Extension

Build first, then use one of the provided `Launch Extension` debug configurations:

- **Launch Extension** — uses your personal profile
- **Temp Profile** — resets on every launch; useful for "out of the box" testing
- **Isolated Profile** — persistent debug profile for preserving test settings

All configurations support automatic extension host restart on source changes.
[Hot Reload](https://devblogs.microsoft.com/dotnet/introducing-net-hot-reload/) is also
enabled for PowerShell Editor Services.

> [!WARNING]
> If the extension host restarts, the PSES debugger attachment is lost. Either restart the
> full debug session, or rebuild PSES and run `Attach to Editor Services` manually.
> Use `powershell.developer.editorServicesWaitForDebugger` to ensure full attachment before
> startup continues.

## Contributing Snippets

See [snippet requirements](community_snippets.md#contributing).

## Creating a Release

Azure DevOps access (Microsoft employees only) is required for signing and publishing.

The Git remote `origin` = GitHub, `ado` = the internal Azure DevOps mirror.

```powershell
cd ./PowerShellEditorServices
git checkout -B release
./tools/updateVersion.ps1 -Version "4.0.0" -Changes "Major release!"
# Amend changelog as necessary
git push --force-with-lease origin
# Open, approve, and merge PR on GitHub

cd ../vscode-powershell
git checkout -B release
./tools/updateVersion.ps1 -Version "2024.4.0" -Changes "Major release!"
# Amend changelog as necessary
git push --force-with-lease origin
# Open, approve, and merge PR on GitHub

# After both PRs are merged:
cd ../PowerShellEditorServices
git checkout main
git pull
git push ado HEAD:upstream
cd ../vscode-powershell
git checkout main
git pull
git push ado HEAD:upstream
# Download and test assets from draft GitHub Releases
# Publish releases, ensuring tag is at release commit in `main`
# Permit pipeline to publish to marketplace
```

When rolling from pre-release to release, do **not** update the PSES version — only the
extension needs a new release. The `release` branch is ephemeral and deleted after each release.
The ADO repo is a superset of GitHub — it includes our commits plus signed PR merge commits,
which is why the ADO push must happen after the PR is merged to `main`.

### Versioning

The extension uses `vYYYY.X.Z` (not SemVer). Releases are based on completed work, not a
schedule. Git tags mark releases; GitHub Releases (drafted by the release pipeline) create the tags.

**Even minor** = release, **odd minor** = pre-release. A release's minor version is `n-1` of
its previewing pre-release (e.g. pre-release `v2024.1.0-preview` previews release `v2024.0.0`).
This keeps the marketplace [pre-release][] option always visible (odd > even by version sort).

- The `v` prefix is used in Git tags and the changelog (e.g. `v2024.0.0`), but **not** in
  `package.json`'s `version` field (e.g. `2024.0.0`). The `updateVersion.ps1` `-Version`
  parameter also takes no `v` prefix.
- Append `-preview` to the version in the changelog and Git tag, but **not** in `package.json`
- The `preview` field in `package.json` is always `false`, even for pre-releases — the
  marketplace derives its state from the latest release inclusive of pre-releases, so setting
  it `true` caused the extension to permanently appear as a preview extension
- Multiple pre-releases increment the patch: `v2024.1.0-preview`, `v2024.1.1-preview`, etc.
- PSES must not change version between a pre-release and its subsequent release
- Hotfix releases skip the pre-release step and build off the last release's Git tag

PSES uses standard SemVer (`vX.Y.Z`), realistically it's Pride Versioning.

[pre-release]: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#prerelease-extensions
