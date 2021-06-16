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
Update-Version -RepositoryName PowerShellEditorServices
Update-Version -RepositoryName vscode-powershell
# Push branches to GitHub and ADO
# Open PRs for review
# Download and test assets (assert correct PSES is included)
# Rename VSIX correctly
New-DraftRelease -RepositoryName PowerShellEditorServices
New-DraftRelease -RepositoryName vscode-powershell
# Point releases to branches for automatic tagging
# Upload PowerShellEditorServices.zip (for other extensions)
# Upload VSIX and Install-VSCode.ps1
# Publish draft releases and merge (don't squash!) branches
vsce publish --packagePath ./PowerShell-<version>.vsix
# Update Install-VSCode.ps1 on gallery
Publish-Script -Path ./Install-VSCode.ps1 -NuGetApiKey (Get-Secret "PowerShell Gallery API Key" -AsPlainText)
```

### Pending Improvements

* `Update-Changelog` should verify the version is in the correct format
* `Update-Changelog` could be faster by not downloading _every_ PR
* `Update-Changelog` should use exactly two emoji and in the right order
* `Update-Version` could be run by `Update-Changelog`
* `New-DraftRelease` could automatically set the tag pointers and upload the binaries
* The build should emit an appropriately named VSIX instead of us manually renaming it
* A `Publish-Binaries` function could be written to push the binaries out
