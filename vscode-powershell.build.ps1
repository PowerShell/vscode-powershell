#
# Copyright (c) Microsoft. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#

param(
    [string]$EditorServicesRepoPath = $null
)

#Requires -Modules @{ModuleName="InvokeBuild";ModuleVersion="3.0.0"}

$script:IsPullRequestBuild =
    $env:APPVEYOR_PULL_REQUEST_NUMBER -and
    $env:APPVEYOR_REPO_BRANCH -eq "develop"

task GetExtensionVersion -Before Package {

    $updateVersion = $false
    $script:ExtensionVersion = `
        if ($env:AppVeyor) {
            $updateVersion = $true
            $env:APPVEYOR_BUILD_VERSION
        }
        else {
            exec { & npm version | ConvertFrom-Json | ForEach-Object { $_.PowerShell } }
        }

    Write-Host "`n### Extension Version: $script:ExtensionVersion`n" -ForegroundColor Green

    if ($updateVersion) {
        exec { & npm version $script:ExtensionVersion --no-git-tag-version }
    }
}

task ResolveEditorServicesPath -Before CleanEditorServices, BuildEditorServices {

    $script:psesRepoPath = `
        if ($EditorServicesRepoPath) {
            $EditorServicesRepoPath
        }
        else {
            "$PSScriptRoot/../PowerShellEditorServices/"
        }

    if (!(Test-Path $script:psesRepoPath)) {
        # Clear the path so that it won't be used
        Write-Host "`n### WARNING: The PowerShellEditorServices repo cannot be found at path $script:psesRepoPath`n" -ForegroundColor Yellow
        $script:psesRepoPath = $null
    }
    else {
        $script:psesRepoPath = Resolve-Path $script:psesRepoPath
        $script:psesBuildScriptPath = Resolve-Path "$script:psesRepoPath/PowerShellEditorServices.build.ps1"
    }
}

task Restore RestoreNodeModules, RestorePowerShellModules -Before Build

task RestoreNodeModules -If { -not (Test-Path "$PSScriptRoot/node_modules") } {

    Write-Host "`n### Restoring vscode-powershell dependencies`n" -ForegroundColor Green

    # When in a CI build use the --loglevel=error parameter so that
    # package install warnings don't cause PowerShell to throw up
    $logLevelParam = if ($env:AppVeyor) { "--loglevel=error" } else { "" }
    exec { & npm install $logLevelParam }
}

task RestorePowerShellModules -If { -not (Test-Path "$PSScriptRoot/modules/Plaster") } {
    Save-Module -Name Plaster -Path "$PSScriptRoot/modules/"
    Save-Module -Name PSScriptAnalyzer -Path "$PSScriptRoot/modules/"
}

task Clean {
    Write-Host "`n### Cleaning vscode-powershell`n" -ForegroundColor Green
    Remove-Item .\out -Recurse -Force -ErrorAction Ignore
}

task CleanEditorServices {
    if ($script:psesBuildScriptPath) {
        Write-Host "`n### Cleaning PowerShellEditorServices`n" -ForegroundColor Green
        Invoke-Build Clean $script:psesBuildScriptPath
    }
}

task CleanAll CleanEditorServices, Clean

task Build {
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

task BuildAll BuildEditorServices, Build -Before Package

task Test Build, {
    if (!$global:IsLinux -and !$global:IsOSX) {
        Write-Host "`n### Running extension tests" -ForegroundColor Green
        exec { & npm run test }
    }
    else {
        Write-Host "`n### Skipping extension tests on non-Windows platform" -ForegroundColor Yellow
    }
}

task Package {

    if ($script:psesBuildScriptPath) {
        Write-Host "`n### Copying PowerShellEditorServices module files" -ForegroundColor Green
        Copy-Item -Recurse -Force ..\PowerShellEditorServices\module\PowerShellEditorServices .\modules
    }

    Write-Host "`n### Packaging PowerShell-insiders.vsix`n" -ForegroundColor Green
    exec { & node ./node_modules/vsce/out/vsce package }

    # Change the package to have a static name for automation purposes
    Move-Item .\PowerShell-$($script:ExtensionVersion).vsix .\PowerShell-insiders.vsix
}

task UploadArtifacts -If { $env:AppVeyor } {

    Push-AppveyorArtifact .\PowerShell-insiders.vsix
}

# The default task is to run the entire CI build
task . GetExtensionVersion, CleanAll, BuildAll, Test, Package, UploadArtifacts
