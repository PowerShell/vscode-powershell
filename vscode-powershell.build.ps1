#
# Copyright (c) Microsoft. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#

param(
    [string]$EditorServicesRepoPath = $null
)

#Requires -Modules @{ModuleName="InvokeBuild";ModuleVersion="3.0.0"}

# Grab package.json data which is used throughout the build.
$script:PackageJson = Get-Content -Raw $PSScriptRoot/package.json | ConvertFrom-Json
Write-Host "`n### Extension Version: $($script:PackageJson.version) Extension Name: $($script:PackageJson.name)`n" -ForegroundColor Green

#region Utility tasks

task ResolveEditorServicesPath -Before CleanEditorServices, BuildEditorServices, TestEditorServices, Package {

    $script:psesRepoPath = `
        if ($EditorServicesRepoPath) {
            $EditorServicesRepoPath
        }
        else {
            "$PSScriptRoot/../PowerShellEditorServices/"
        }

    if (!(Test-Path $script:psesRepoPath)) {
        # Clear the path so that it won't be used
        Write-Warning "`nThe PowerShellEditorServices repo cannot be found at path $script:psesRepoPath`n"
        $script:psesRepoPath = $null
    }
    else {
        $script:psesRepoPath = Resolve-Path $script:psesRepoPath
        $script:psesBuildScriptPath = Resolve-Path "$script:psesRepoPath/PowerShellEditorServices.build.ps1"
    }
}

task UploadArtifacts {
    if ($env:TF_BUILD) {
        # SYSTEM_PHASENAME is the Job name.
        Copy-Item -Path PowerShell-insiders.vsix `
            -Destination "$env:BUILD_ARTIFACTSTAGINGDIRECTORY/$($script:PackageJson.name)-$($script:PackageJson.version)-$env:SYSTEM_PHASENAME.vsix"
    }
}

#endregion
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

task CleanEditorServices {
    if ($script:psesBuildScriptPath) {
        Write-Host "`n### Cleaning PowerShellEditorServices`n" -ForegroundColor Green
        Invoke-Build Clean $script:psesBuildScriptPath
    }
}

task CleanAll CleanEditorServices, Clean

#endregion
#region Build tasks

task Build Restore, {
    Write-Host "`n### Building vscode-powershell" -ForegroundColor Green
    exec { & npm run compile }
}

task BuildEditorServices {
    # If the PSES codebase is co-located, build it first
    if ($script:psesBuildScriptPath) {
        Write-Host "`n### Building PowerShellEditorServices`n" -ForegroundColor Green
        Invoke-Build Build $script:psesBuildScriptPath
    }
}

task BuildAll BuildEditorServices, Build

#endregion
#region Test tasks

task Test Build, {
    if (!$global:IsLinux) {
        Write-Host "`n### Running extension tests" -ForegroundColor Green
        exec { & npm run test }
    }
    else {
        Write-Warning "Skipping extension tests on Linux platform because vscode does not support it."
    }
}

task TestEditorServices {
    if ($script:psesBuildScriptPath) {
        Write-Host "`n### Testing PowerShellEditorServices`n" -ForegroundColor Green
        Invoke-Build Test $script:psesBuildScriptPath
    }
}

task TestAll TestEditorServices, Test

#endregion

#region Package tasks

task UpdateReadme -If { $script:PackageJson.version -like "*preview*" } {
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

task UpdatePackageJson {
    if ($script:PackageJson.version -like "*preview*") {
        $script:PackageJson.name = "powershell-preview"
        $script:PackageJson.displayName = "PowerShell Preview"
        $script:PackageJson.description = "(Preview) Develop PowerShell scripts in Visual Studio Code!"
        $script:PackageJson.preview = $true
    } else {
        $script:PackageJson.name = "powershell"
        $script:PackageJson.displayName = "PowerShell"
        $script:PackageJson.description = "Develop PowerShell scripts in Visual Studio Code!"
        $script:PackageJson.preview = $false
    }

    $revision = if ($env:VSTS_BUILD_VERSION) { $env:VSTS_BUILD_VERSION } else { 9999 }
    $script:PackageJson.version = "$(Get-Date -Format 'yyyy.M').$revision"

    Set-Content -Path $PSScriptRoot/package.json ($script:PackageJson | ConvertTo-Json -Depth 100) -Encoding utf8
}

task Package UpdateReadme, UpdatePackageJson, {

    if ($script:psesBuildScriptPath) {
        Write-Host "`n### Copying PowerShellEditorServices module files" -ForegroundColor Green
        Copy-Item -Recurse -Force ..\PowerShellEditorServices\module\* .\modules
    } elseif (Test-Path .\PowerShellEditorServices) {
        Write-Host "`n### Moving PowerShellEditorServices module files" -ForegroundColor Green
        Move-Item -Force .\PowerShellEditorServices\* .\modules
        Remove-Item -Force .\PowerShellEditorServices
    } else {
        throw "Unable to find PowerShell EditorServices"
    }

    Write-Host "`n### Packaging PowerShell-insiders.vsix`n" -ForegroundColor Green
    exec { & node ./node_modules/vsce/out/vsce package }

    # Change the package to have a static name for automation purposes
    Move-Item -Force .\$($script:PackageJson.name)-$($script:PackageJson.version).vsix .\PowerShell-insiders.vsix
}

#endregion

# The set of tasks for a release
task Release Clean, Build, Test, Package
# The default task is to run the entire CI build
task . CleanAll, BuildAll, Test, Package, UploadArtifacts
