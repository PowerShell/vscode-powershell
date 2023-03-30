# Development Instructions for the PowerShell Extension

## Development Setup

You'll need to clone two repositories and set up your development environment
to before you can proceed.

1. [Fork and clone][fork] the [vscode-powershell repository](https://github.com/PowerShell/vscode-powershell)

2. [Fork and clone][fork] the [PowerShell Editor Services (PSES) repository](https://github.com/PowerShell/PowerShellEditorServices)
   > The `vscode-powershell` folder and the `PowerShellEditorServices` folder should be next to each other on the file
   > system. Code in `vscode-powershell` looks for PSES at `../PowerShellEditorServices` if you're building locally so
   > PSES must be in that location.

3. Follow the [development instructions](https://github.com/PowerShell/PowerShellEditorServices#development) for
   PowerShell Editor Services. **You will need to complete this step before proceeding**.

4. Install the latest [Visual Studio Code Insiders release](https://code.visualstudio.com/insiders)
   > You can also use the [standard Visual Studio Code release](https://code.visualstudio.com/). Both will work, but
   > using VSCode Insiders means the extension can be developed ready for new features and changes in the next VSCode
   > release.

5. Install [Node.js](https://nodejs.org/en/) 16.x or higher.

[fork]: https://help.github.com/articles/fork-a-repo/

### Building the Code

#### From Visual Studio Code

> Press <kbd>Ctrl</kbd>+<kbd>P</kbd> and type `task build`

This will compile the TypeScript files in the project to JavaScript files.

#### From a PowerShell prompt

```powershell
Invoke-Build Build
```

As a developer, you may want to use `Invoke-Build LinkEditorServices` to setup a symbolic
link to its modules instead of copying the files. This will mean the built extension will
always have the latest version of your PowerShell Editor Services build, but this cannot
be used to package the extension into a VSIX. So it is a manual step.

### Launching the extension

#### From Visual Studio Code

> To debug the extension, press <kbd>F5</kbd>.  To run the extension without debugging, press
> <kbd>Ctrl</kbd>+<kbd>F5</kbd> or <kbd>Cmd</kbd>+<kbd>F5</kbd> on macOS.

#### From a command prompt

```cmd
code --extensionDevelopmentPath="c:\path\to\vscode-powershell" .
```

## Contributing Snippets

For more information on contributing snippets please read our
[snippet requirements](https://github.com/PowerShell/vscode-powershell/blob/main/docs/community_snippets.md#contributing).

## Creating a Release

These are the current steps for creating a release for both the editor services
and the extension. ADO access is restricted to Microsoft employees and is used
to sign and validate the produced binaries before publishing on behalf of
Microsoft. The comments are manual steps.

```powershell
Import-Module ./tools/ReleaseTools.psm1
New-ReleaseBundle -PsesVersion <version> -VsceVersion <version>
# Amend changelog as necessary
# Push release branches to ADO
# Download and test assets
# Check telemetry for stability before releasing
# Publish draft releases and merge (don't squash!) branches
# Permit vscode-extension pipeline to publish to marketplace
```

If rolling from pre-release to stable, use:

```powershell
New-Release -RepositoryName vscode-powershell -Version <version>
```

This is because we do not change the version of PowerShell Editor Services between a
pre-release and the subsequent stable release, so we only need to release the extension.

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

For the VS Code PowerShell Extension, our version follows `vYYYY.M.X`, that is:
current year, current month, and patch version (not day). This is not semantic
versioning because of issues with how the VS Code marketplace and extension
hosting API itself uses our version number. This scheme _does not_ mean we
release on a chronological schedule: we release based on completed work. If the
month has changed over since the last release, the patch version resets to 0.
Each subsequent release that month increments the patch version.

Before releasing a stable version we should almost always first release a preview of the
same code, which is a _pre-release_. The exception to this is hotfix releases where we
need to push _only_ bug fixes out as soon as possible, and these should be built off the
last release's codebase (found from the Git tag). The pre-release is uploaded to the
marketplace using the `--pre-release` flag given to `vsce` (the CLI tool used to do so).
The previous separate "PowerShell Preview" extension has been deprecated in favor of using
the marketplace's support for [pre-releases][] on the stable and now one-and-only
extension.

Because the marketplace does not actually understand Semantic Versioning pre-release tags
(the `-preview` suffix), the patch numbers need to increment continuously, but we append
`-preview` to _our_ version in the changelog and Git tags. When multiple pre-releases are
needed, the patch version is incremented (again because the marketplace ignores the
pre-release tag, we can't do `-alpha`, `-beta` etc.). Since migrating to a single
extension, the stable release has to increment one more after the last pre-release. So the
stable version may jump a few patch versions in between releases. Furthermore, the
`preview` field in the extension's manifest (the `package.json` file) is _always_ `false`,
even for pre-releases, because the marketplace takes the information from the latest
release inclusive of pre-releases, hence it was causing the one-and-only extension to look
like it was in preview. This is also why the icon no longer changes to the PowerShell
Preview icon for pre-releases. When they support pre-releases better (ideally that means
supporting the pre-release tags in full) we can revisit this.

[pre-releases]: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#prerelease-extensions

For example, the date is May 7, 2022. The last release was in April, and its version was
`v2022.4.3`. Some significant work has been completed and we want to release the
extension. First we create a pre-release with version `v2022.5.0-preview` (the patch reset
to 0 because the month changed, and `-preview` was appended). After publishing, some
issues were identified and we decided we needed a second pre-release. Its version is
`v2022.5.1-preview`. User feedback indicates that pre-release is working well, so to
create a stable release we use the same code (but with an updated changelog etc.) and use
version `v2022.5.2`, the _first_ stable release for May (as `v2022.5.0` was skipped due to
those identified issues in the pre-release). All of these releases may consume the same or
different version of PowerShell Editor Services, say `v3.2.4`. It may update between
pre-release versions or stable versions, but must not change between a pre-release and the
subsequent stable release, as they should use the same code which includes dependencies.
