# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

param(
    [string]$EditorServicesRepoPath = $null
)

#Requires -Modules @{ModuleName="InvokeBuild";ModuleVersion="3.0.0"}

# Grab package.json data which is used throughout the build.
$script:PackageJson = Get-Content -Raw $PSScriptRoot/package.json | ConvertFrom-Json
$script:IsPreviewExtension = $script:PackageJson.name -like "*preview*" -or $script:PackageJson.displayName -like "*preview*"
Write-Host "`n### Extension Version: $($script:PackageJson.version) Extension Name: $($script:PackageJson.name)`n" -ForegroundColor Green

function Get-EditorServicesPath {
    $psesRepoPath = if ($EditorServicesRepoPath) {
        $EditorServicesRepoPath
    } else {
        "$PSScriptRoot/../PowerShellEditorServices/"
    }
    # NOTE: The ErrorActionPreference for both Invoke-Build and Azure DevOps
    # scripts is Stop, but we want to continue and return false here.
    return Resolve-Path "$psesRepoPath/PowerShellEditorServices.build.ps1" -ErrorAction Continue
}

task Restore -If { !(Test-Path "$PSScriptRoot/node_modules") } {
    Write-Host "`n### Restoring vscode-powershell dependencies`n" -ForegroundColor Green
    # When in a CI build use the --loglevel=error parameter so that
    # package install warnings don't cause PowerShell to throw up
    if ($env:TF_BUILD) {
        exec { & npm ci --loglevel=error }
    } else {
        exec { & npm install }
    }
}


#region Clean tasks

task Clean {
    Write-Host "`n### Cleaning vscode-powershell`n" -ForegroundColor Green
    Remove-Item ./modules -Recurse -Force -ErrorAction Ignore
    Remove-Item ./out -Recurse -Force -ErrorAction Ignore
    Remove-Item ./node_modules -Recurse -Force -ErrorAction Ignore
}

task CleanEditorServices -If (Get-EditorServicesPath) {
    Write-Host "`n### Cleaning PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build Clean (Get-EditorServicesPath)
}

#endregion
#region Build tasks

task BuildEditorServices -If (Get-EditorServicesPath) {
    Write-Host "`n### Building PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build Build (Get-EditorServicesPath)
}

task LinkEditorServices -If (Get-EditorServicesPath) BuildEditorServices, {
    Write-Host "`n### For developer use only! Creating symbolic link to PSES" -ForegroundColor Green
    Remove-Item ./modules -Recurse -Force -ErrorAction Ignore
    New-Item -ItemType SymbolicLink -Path ./modules -Target "$(Split-Path (Get-EditorServicesPath))/module"
}

task CopyEditorServices -If { !(Test-Path ./modules) -and (Get-EditorServicesPath) } BuildEditorServices, {
    Write-Host "`n### Copying PSES" -ForegroundColor Green
    Copy-Item -Recurse -Force "$(Split-Path (Get-EditorServicesPath))/module" ./modules
}

task Build CopyEditorServices, Restore, {
    Write-Host "`n### Building vscode-powershell" -ForegroundColor Green
    # TODO: TSLint is deprecated and we need to switch to ESLint.
    # https://github.com/PowerShell/vscode-powershell/pull/3331
    exec { & npm run lint }

    # TODO: When supported we should use `esbuild` for the tests too. Although
    # we now use `esbuild` to transpile, bundle, and minify the extension, we
    # still use `tsc` to transpile everything in `src` and `test` because the VS
    # Code test runner expects individual files (and globs them at runtime).
    # Unfortunately `esbuild` doesn't support emitting 1:1 files (yet).
    # https://github.com/evanw/esbuild/issues/944
    exec { & npm run build }
}

#endregion
#region Test tasks

task Test -If (!($env:TF_BUILD -and $global:IsLinux)) Build, {
    Write-Host "`n### Running extension tests" -ForegroundColor Green
    exec { & npm run test }
}

task TestEditorServices -If (Get-EditorServicesPath) {
    Write-Host "`n### Testing PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build Test (Get-EditorServicesPath)
}

#endregion

#region Package tasks

task UpdateReadme -If { $script:IsPreviewExtension } {
    # Add the preview text
    $newReadmeTop = '# PowerShell Language Support for Visual Studio Code

> ## ATTENTION: This is the PREVIEW version of the PowerShell extension for VSCode which contains features that are being evaluated for stable. It works with PowerShell 5.1 and up.
> ### If you are looking for the stable version, please [go here](https://marketplace.visualstudio.com/items?itemName=ms-vscode.PowerShell) or install the extension called "PowerShell" (not "PowerShell Preview")
> ## NOTE: If you have both stable (aka "PowerShell") and preview (aka "PowerShell Preview") installed, you MUST [DISABLE](https://code.visualstudio.com/docs/editor/extension-gallery#_disable-an-extension) one of them for the best performance. Docs on how to disable an extension can be found [here](https://code.visualstudio.com/docs/editor/extension-gallery#_disable-an-extension)'
    $readmePath = (Join-Path $PSScriptRoot README.md)

    $readmeContent = Get-Content -Path $readmePath
    if (!($readmeContent -match "This is the PREVIEW version of the PowerShell extension")) {
        $readmeContent[0] = $newReadmeTop
        $readmeContent | Set-Content $readmePath -Encoding utf8
    }
}

task Package UpdateReadme, Build, {
    assert (Test-Path ./modules/PowerShellEditorServices)
    assert ((Get-Item ./modules).LinkType -ne "SymbolicLink") "Packaging requires a copy of PSES, not a symlink!"

    Write-Host "`n### Packaging $($script:PackageJson.name)-$($script:PackageJson.version).vsix`n" -ForegroundColor Green
    exec { & npm run package }
}

#endregion

task . Build, Test, Package
