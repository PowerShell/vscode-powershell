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

5. Install [Node.js](https://nodejs.org/en/) 10.x or higher.

[fork]: https://help.github.com/articles/fork-a-repo/

### Building the Code

#### From Visual Studio Code

> Press <kbd>Ctrl</kbd>+<kbd>P</kbd> and type `task build`

This will compile the TypeScript files in the project to JavaScript files.

#### From a PowerShell prompt

```powershell
Invoke-Build Build
```

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
[snippet requirements](https://github.com/PowerShell/vscode-powershell/blob/master/docs/community_snippets.md#contributing).

## Creating a Release

These are the current steps for creating a release for both the editor services
and the extension. ADO access is restricted to Microsoft employees and is used
to sign and validate the produced binaries before publishing on behalf of
Microsoft. The comments are manual steps.

```powershell
Import-Module ./tools/ReleaseTools.psm1
Update-Changelog -RepositoryName PowerShellEditorServices -Version <version>
Update-Changelog -RepositoryName vscode-powershell -Version <version>
# Amend changelog as necessary
# Download and test assets (assert correct PSES is included)
New-DraftRelease -RepositoryName PowerShellEditorServices -Assets "PowerShellEditorServices.zip"
New-DraftRelease -RepositoryName vscode-powershell -Assets "powershell-YYYY.M.X.vsix", "Install-VSCode.ps1"
# Check telemetry for stability before releasing
# Publish draft releases and merge (don't squash!) branches
# Permit release pipeline to publish assets
```

### Versioning

For both our repositories we use Git tags in the form `vX.Y.Z` to mark the
releases in the codebase. We use the GitHub Release feature to create these
tags. Branches are used in the process of creating a release, e.g.
`release/vX.Y.Z`, but are deleted after the release is completed (and merged
into `master`).

For PowerShellEditor Services, we simply follow semantic versioning, e.g.
`vX.Y.Z`. We do not release previews frequently because this dependency is not
generally used directly: it's a library consumed by other projects which
themselves use preview releases for beta testing.

For the VS Code PowerShell Extension, our version follows `vYYYY.M.X`, that is:
current year, current month, and patch version (not day). This is not semantic
versioning because of issues with how the VS Code marketplace and extension
hosting API itself uses our version number. This scheme _does not_ mean we
release on a chronological schedule: we release based on completed work. If the
month has changed over since the last release, the patch version resets to 0.
Each subsequent release that month increments the patch version.

Before releasing a "stable" release we should almost always first release a
"preview" of the same code. The exception to this is "hotfix" releases where we
need to push _only_ bug fixes out as soon as possible, and these should be built
off the last release's codebase (found from the Git tag). The preview release is
uploaded separately to the marketplace as the "PowerShell Preview" extension. It
should not significantly diverge from the stable release ("PowerShell"
extension), but is used for public beta testing. The preview version should
match the upcoming stable version, but with `-preview` appended.  When multiple
previews are needed, the patch version is incremented, and the last preview's
version is used for the stable release. (So the stable version may jump a few
patch versions in between releases.)

For example, the date is May 7, 2022. The last release was in April, and its
version was `v2022.4.3`. Some significant work has been completed and we want to
release the extension. First we create a preview release with version
`v2022.5.0-preview` (the patch reset to 0 because the month changed, and
`-preview` was appended). After publishing, some issues were identified and we
decided we needed a second preview release. Its version is `v2022.5.1-preview`.
User feedback indicates that preview is working well, so to create a stable
release we use the same code (but with an updated changelog etc.) and use
version `v2022.5.1`, the _first_ stable release for May (as `v2022.5.0` was
skipped due to those identified issues in the preview). All of these releases
may consume the same or different version of PowerShell Editor Services, say
`v3.2.4`. It may update between preview versions or stable versions (but should
not change between a preview and its associated stable release, as they should
use the same code which includes dependencies).

### Pending Improvements

* `Update-Changelog` should verify the version is in the correct format
* `Update-Changelog` could be faster by not downloading _every_ PR
