# Development Instructions for the PowerShell Extension

## Development Setup

1. [Fork and clone][fork] the [vscode-powershell repository](https://github.com/PowerShell/vscode-powershell).

2. [Fork and clone][fork] the [PowerShell Editor Services (PSES) repository](https://github.com/PowerShell/PowerShellEditorServices).
   > The `vscode-powershell` folder and the `PowerShellEditorServices` folder should be next to each other on the file
   > system. Code in `vscode-powershell` looks for PSES at `../PowerShellEditorServices` if you're building locally so
   > PSES must be in that location.

3. Follow the [development instructions](https://github.com/PowerShell/PowerShellEditorServices#development) for
   PowerShell Editor Services. **You will need to complete this step before proceeding**.

4. Install [Node.js](https://nodejs.org/en/) 18.x or higher.

5. Install [Visual Studio Code](https://code.visualstudio.com).
   Open the multi-root workspace file in this repo, `extension-dev.code-workspace`.
   > This has a set of recommended extensions to install and provides tasks.
   > The ESLint formatter will require you to install ESLint globally, using `npm install -g eslint`.
   > Otherwise VS Code will erroneously complain that it isn't able to use it to format TypeScript files.

[fork]: https://help.github.com/articles/fork-a-repo/

## Tracking Upstream Dependencies

As a VS Code extension, we first rely on the `engine` field of `package.json` to
state the lowest version of VS Code we support.

When our `engine` field is updated the development dependency `@types/vscode`
must be updated to match. Note that it uses `~` (not `^`) so as to accept new
patches with `npm update` but not new minor versions. Then we check that version
of VS Code's own `package.json` file for their [`electron`][] dependency. The
major version of [Electron][] will tell us which [Node.js][] is included, which
dictates which version of Node.js the extension is eventually run with. This
lets us finally update our `@types/node` development dependency to match, our
developer machines if necessary, the CI and OneBranch pipeline tasks, and the
`.tsconfig` file. Note that the version of `@types/node` will not necessarily
exactly match the version of Node.js, but the major version should.

[`electron`]: https://github.com/microsoft/vscode/blob/138f619c86f1199955d53b4166bef66ef252935c/package.json#L156
[Electron]: https://releases.electronjs.org/release/v32.2.6
[Node.js]: https://nodejs.org/en/download/package-manager

### Building the Code

#### From Visual Studio Code

Press <kbd>Ctrl+P</kbd> and type `task build`. Explore the other provided tasks for helpful commands.

#### From a PowerShell prompt

```powershell
Invoke-Build Build
```

Explore the `vscode-powershell.build.ps1` file for other build targets.

### Launching the extension
First, ensure you have completed a build as instructed above, as the launch templates do not check some prerequisites for performance reasons.

To debug the extension use one of the provided `Launch Extension` debug configurations.
1. `Launch Extension`: Launches the debugger using your personal profile settings.
2. `Temp Profile`: Launches VS Code with a temp profile that resets on every launch. Useful for "out of the box" environment testing.
3. `Isolated Profile`: Launches the debugger with a persistent debug profile specific to the extension, so you can preserve some settings or test certain prerequisites.

All three templates use pre-launch tasks to build the code, and support automatic restart of the extension host on changes to the Extension source code. [Hot Reload](https://devblogs.microsoft.com/dotnet/introducing-net-hot-reload/) is also enabled for PowerShell Editor Services.

> [!WARNING]
> There is a current limitation that, if you restart the extension/extension host or it is restarted due to a extension code change, the editor services attachment will be disconnected due to the PSES terminal being terminated, and you will either need to restart the debug session completely, or do a manual build of PSES and run the `Attach to Editor Services` debug launch manually.

Try the `powershell.developer.editorServicesWaitForDebugger` setting to ensure that you are fully attached before the extension startup process continues.

## Contributing Snippets

For more information on contributing snippets please read our
[snippet requirements](https://github.com/PowerShell/vscode-powershell/blob/main/docs/community_snippets.md#contributing).

## Creating a Release

These are the current steps for creating a release for both the editor services
and the extension. Azure DevOps access is restricted to Microsoft employees and
is used to sign and validate the produced binaries before publishing on behalf
of Microsoft. Assume `origin` is GitHub and `ado` is Azure DevOps.

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
cd ../PowerShellEditorServices
git checkout main
git pull
git push ado HEAD:release
cd ../vscode-powershell
git checkout main
git pull
git push ado HEAD:release
# Download and test assets from draft GitHub Releases
# Publish releases, ensuring tag is at release commit in `main`
# Permit pipeline to publish to marketplace
```

If rolling from pre-release to release, do not change the version of PowerShell
Editor Services between a pre-release and the subsequent release! We only
need to release the extension.

The Azure DevOps pipelines have to build off a PR merged to `main` for _reasons_,
hence that repo is a superset including all our commits plus signed PR merge commits.

### Versioning

For both our repositories we use Git tags in the form `vX.Y.Z` to mark the releases in the
codebase. We use the GitHub Release feature to create these tags. The ephemeral branch
`release` is used in the process of creating a release for each repository, primarily for
the Pull Requests and for Azure DevOps triggers. Once the release PRs are merged, the
branch is deleted until used again to prepare the next release. This branch _does not_
mark any specific release, that is the point of the tags.

For PowerShellEditor Services, we simply follow semantic versioning, e.g.
`vX.Y.Z`. We do not release previews frequently because this dependency is not
generally used directly: it's a library consumed by other projects which
themselves use pre-releases for beta testing.

For the VS Code PowerShell Extension, our version follows `vYYYY.X.Z`, that is: current
year, minor version, and patch version. This is not semantic versioning because of issues
with how the VS Code marketplace and extension hosting API itself uses our version number.
We do not release on a chronological schedule: we release based on completed work. For
historical reasons we are stuck with the major version being year.

Before releasing a stable version (a _release_) we should almost always first release a
preview of the same code, which is a _pre-release_. The exception to this is hotfix
releases where we need to push _only_ bug fixes out as soon as possible, and these should
be built off the last release's codebase (found from the Git tag). The pre-release is
uploaded to the marketplace using the `--pre-release` flag given to `vsce` (the CLI tool
used to do so). The previous separate "PowerShell Preview" extension has been deprecated
in favor of using the marketplace's support for [pre-releases][] on the one-and-only
extension.

Because the marketplace does not actually understand Semantic Versioning pre-release tags
(the `-preview` suffix), the patch numbers need to increment continuously, but we append
`-preview` to _our_ version in the changelog and Git tags. When multiple pre-releases are
needed, the patch version is incremented (again because the marketplace ignores the
pre-release tag, we can't do `-alpha`, `-beta` etc.). The `preview` field in
the extension's manifest (the `package.json` file) is _always_ `false`, even for
pre-releases, because the marketplace takes the information from the latest release
inclusive of pre-releases, hence it was causing the one-and-only extension to look like it
was in preview. This is also why the icon no longer changes to the PowerShell Preview icon
for pre-releases. When they support pre-releases better (ideally that means supporting the
pre-release tags in full) we can revisit this.

Furthermore, for releases, the minor version must be _even_ (like 0, 2, etc.) and for
pre-releases it must be _odd_ (like 1, 3, etc.), and an upcoming release's version must be
`n-1` of the pre-release which previews it. That is, release `v2024.0.0` is previewed in
the pre-release `v2024.1.0-preview`. This scheme is designed such that the "newest" (by version)
release is always a pre-release, so that the VS Code marketplace _always_ shows a
pre-release option. When we previously did this the other way around (incrementing the
release as `n+1` to the pre-release), every time we released, the pre-release option
(dropdown) in the marketplace would unfortunately disappear.

[pre-releases]: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#prerelease-extensions

For example, the date is August 23, 2023. The last release was in June, and its version
was `v2023.6.0`. Some significant work has been completed and we want to release the
extension, so the next release will be `v2023.8.0` (the minor version is `n+2` because it
must remain even, it only coincidentally matches the month). That means first we create a
pre-release with version `v2023.9.0-preview` (the minor version is `n+1` of the upcoming
release, and `-preview` was appended). After publishing, some issues were identified and
we decided we needed a second pre-release. Its version is `v2023.9.1-preview`. User
feedback hopefully indicates that the pre-release is working well, so to create a release
we will use the same code (but with an updated changelog etc.) and use version
`v2023.8.0`, the _next_ release since `v2023.6.0`. The version of PowerShell Editor
Services may update between pre-releases or releases, but must not change between a
pre-release and its subsequent release, as they should use the same code (which includes
dependencies).
