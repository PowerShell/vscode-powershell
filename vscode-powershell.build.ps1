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
    return Resolve-Path "$psesRepoPath/PowerShellEditorServices.build.ps1"
}

#region Restore tasks

task Restore RestoreNodeModules -If { -not (Test-Path "$PSScriptRoot/node_modules") }

task RestoreNodeModules {

    Write-Host "`n### Restoring vscode-powershell dependencies`n" -ForegroundColor Green

    # When in a CI build use the --loglevel=error parameter so that
    # package install warnings don't cause PowerShell to throw up
    $logLevelParam = if ($env:TF_BUILD) { "--loglevel=error" } else { "" }
    exec { & npm install $logLevelParam }
}

#endregion
#region Clean tasks

task Clean {
    Write-Host "`n### Cleaning vscode-powershell`n" -ForegroundColor Green
    Remove-Item .\modules\* -Exclude "README.md" -Recurse -Force -ErrorAction Ignore
    Remove-Item .\out -Recurse -Force -ErrorAction Ignore
    Remove-Item -Force -Recurse node_modules -ErrorAction Ignore
}

task CleanEditorServices -If (Get-EditorServicesPath) {
    Write-Host "`n### Cleaning PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build Clean (Get-EditorServicesPath)
}

task CleanAll CleanEditorServices, Clean

#endregion
#region Build tasks

task Build Restore, {
    Write-Host "`n### Building vscode-powershell" -ForegroundColor Green
    exec { & npm run compile }
}

task BuildEditorServices -If (Get-EditorServicesPath) {
    Write-Host "`n### Building PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build Build (Get-EditorServicesPath)
}

task BuildAll BuildEditorServices, Build

#endregion
#region Test tasks

task Test Build, {
    if ($env:TF_BUILD -and $global:IsLinux) {
        Write-Warning "Skipping extension tests in Linux CI because vscode does not support it."
        return
    }
    Write-Host "`n### Running extension tests" -ForegroundColor Green
    exec { & npm run test }
}

task TestEditorServices -If (Get-EditorServicesPath) {
    Write-Host "`n### Testing PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build Test (Get-EditorServicesPath)
}

task TestAll TestEditorServices, Test

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

task Package UpdateReadme, {
    if (Get-EditorServicesPath -or $env:TF_BUILD) {
        Write-Host "`n### Copying PowerShellEditorServices module files" -ForegroundColor Green
        Copy-Item -Recurse -Force ..\PowerShellEditorServices\module\* .\modules
    } else {
        throw "Unable to find PowerShell EditorServices"
    }

    $packageName = "$($script:PackageJson.name)-$($script:PackageJson.version).vsix"
    Write-Host "`n### Packaging $packageName`n" -ForegroundColor Green
    exec { & node ./node_modules/vsce/out/vsce package --no-gitHubIssueLinking }

    if ($env:TF_BUILD) {
        $artifactsPath = "$env:BUILD_ARTIFACTSTAGINGDIRECTORY/vscode-powershell/"
        "./$packageName", "./scripts/Install-VSCode.ps1" | ForEach-Object {
            Copy-Item -Verbose -Recurse $_ $artifactsPath
        }
    }
}

#endregion

# The set of tasks for a release
task Release Clean, Build, Package
# The default task is to run the entire CI build
task . CleanAll, BuildAll, Test, Package
