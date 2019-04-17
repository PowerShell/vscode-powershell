#
# Copyright (c) Microsoft. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#

param(
    [string]$EditorServicesRepoPath = $null
)

#Requires -Modules @{ModuleName="InvokeBuild";ModuleVersion="3.0.0"}

task GetExtensionData -Before Package {

    $script:PackageJson = Get-Content -Raw $PSScriptRoot/package.json | ConvertFrom-Json
    $updateVersion = $false
    $script:ExtensionVersion = `
        if ($env:VSTS_BUILD) {
            $updateVersion = $true
            $env:VSTS_BUILD_VERSION
        }
        else {
            $script:PackageJson.version
        }

    if ($updateVersion) {
        exec { & npm version $script:ExtensionVersion --no-git-tag-version --allow-same-version }
        $script:PackageJson.version = $script:ExtensionVersion
    }

    $script:ExtensionName = $script:PackageJson.name
    Write-Host "`n### Extension Version: $script:ExtensionVersion Extension Name: $script:ExtensionName`n" -ForegroundColor Green
}

task ResolveEditorServicesPath -Before CleanEditorServices, BuildEditorServices, Package {

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

task Restore RestoreNodeModules -Before Build -If { -not (Test-Path "$PSScriptRoot/node_modules") }

task RestoreNodeModules {

    Write-Host "`n### Restoring vscode-powershell dependencies`n" -ForegroundColor Green

    # When in a CI build use the --loglevel=error parameter so that
    # package install warnings don't cause PowerShell to throw up
    $logLevelParam = if ($env:TF_BUILD) { "--loglevel=error" } else { "" }
    exec { & npm install $logLevelParam }
}

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

task BuildAll BuildEditorServices, Build

task Test Build, {
    if (!$global:IsLinux) {
        Write-Host "`n### Running extension tests" -ForegroundColor Green
        exec { & npm run test }
    }
    else {
        Write-Host "`n### Skipping extension tests on Linux platform" -ForegroundColor Yellow
    }
}

task CheckPreview -If { $script:ExtensionName -like "*Preview*" } `
    UpdateReadme, UpdatePackageJson

task UpdateReadme {
    $newReadmeTop = '# PowerShell Language Support for Visual Studio Code

> ## ATTENTION: This is the PREVIEW version of the PowerShell extension for VSCode which contains features that are being evaluated for stable. It works with PowerShell 5.1 and up.
> ### If you are looking for the stable version, please [go here](https://marketplace.visualstudio.com/items?itemName=ms-vscode.PowerShell) or install the extension called "PowerShell" (not "PowerShell Preview")
> ## NOTE: If you have both stable (aka "PowerShell") and preview (aka "PowerShell Preview") installed, you MUST [DISABLE](https://code.visualstudio.com/docs/editor/extension-gallery#_disable-an-extension) one of them for the best performance. Docs on how to disable an extension can be found [here](https://code.visualstudio.com/docs/editor/extension-gallery#_disable-an-extension)'
    $readmePath = (Join-Path $PSScriptRoot README.md)

    $readmeContent = Get-Content -Path $readmePath
    if (!($readmeContent -match "This is the PREVIEW version of the PowerShell extension")) {
        $readmeContent[0] = $newReadmeTop
        $readmeContent > $readmePath
    }
}

task UpdatePackageJson {
    $script:PackageJson.name = "powershell-preview"
    $script:PackageJson.displayName = "PowerShell Preview"
    $script:PackageJson.description = "(Preview) Develop PowerShell scripts in Visual Studio Code!"
    $script:PackageJson.preview = $true
    $script:ExtensionName = $script:PackageJson.name
    Set-Content -Path $PSScriptRoot/package.json ($script:PackageJson | ConvertTo-Json -Depth 100)
}

task Package {

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
    Move-Item -Force .\$($script:ExtensionName)-$($script:ExtensionVersion).vsix .\PowerShell-insiders.vsix
}

task UploadArtifacts {
    if ($env:TF_BUILD) {
         # SYSTEM_PHASENAME is the Job name.
        Copy-Item -Path PowerShell-insiders.vsix `
            -Destination "$env:BUILD_ARTIFACTSTAGINGDIRECTORY/$script:ExtensionName-$script:ExtensionVersion-$env:SYSTEM_PHASENAME.vsix"
    }
}

# The default task is to run the entire CI build
task . GetExtensionData, CleanAll, BuildAll, Test, CheckPreview, Package, UploadArtifacts
