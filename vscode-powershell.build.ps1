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
    if ($EditorServicesRepoPath) {
        Resolve-Path $EditorServicesRepoPath -ErrorAction Stop
    } else {
        Resolve-Path "$PSScriptRoot/../PowerShellEditorServices/" -ErrorAction Stop
    }
}

function Get-EditorServicesBuildScriptPath {
    return Resolve-Path (Join-Path (Get-EditorServicesPath) 'PowerShellEditorServices.build.ps1') -ErrorAction Stop
}
try {
    $editorServicesPath = Get-EditorServicesPath
    $editorServicesBuildScriptPath = Get-EditorServicesBuildScriptPath
} catch {
    throw 'Powershell Editor Services repo was not detected. Specify its path via the -EditorServicesRepoPath parameter or ensure it is available in the directory above {0}' -f $PSScriptRoot
}

$restoreCheckpoint = "$PSScriptRoot/node_modules/restored"
#This will run when node_modules is empty or when package.json is updated
Task Restore -Input $PSScriptRoot/package.json -Output { $RestoreCheckpoint } {
    $ErrorActionPreference = 'stop'
    Write-Host "`n### Restoring vscode-powershell dependencies`n" -ForegroundColor Green
    # When in a CI build use the --loglevel=error parameter so that
    # package install warnings don't cause PowerShell to throw up
    if ($env:TF_BUILD) {
        Exec { & npm ci --loglevel=error }
    } else {
        Exec { & npm install }
    }
    New-Item $restoreCheckpoint
}


#region Clean tasks
Task Clean {
    Write-Host "`n### Cleaning vscode-powershell`n" -ForegroundColor Green
    Remove-Item ./modules -Exclude 'README.md' -Recurse -Force -ErrorAction Ignore
    Remove-Item ./out -Recurse -Force -ErrorAction Ignore
    Remove-Item ./node_modules -Recurse -Force -ErrorAction Ignore
}

Task CleanEditorServices -If $editorServicesBuildScriptPath {
    Write-Host "`n### Cleaning PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build Clean $editorServicesBuildScriptPath
}

#endregion
#region Build tasks

Task BuildEditorServices -Input {
    Get-ChildItem (Join-Path $editorServicesPath 'src') |
        Get-ChildItem -Exclude 'bin', 'obj' |
        Get-ChildItem -File -Recurse |
        Where-Object Name -NotMatch 'BuildInfo.cs'
} -Output {
    #Some copied files preserve timestamps which breaks the incremental build process as the files are seen as "older" than the source
    #We use these files as a freshness indicator since they always gets updated on a build
    #TODO: More granular incremental build on PSES tasks
    Join-Path $editorServicesPath 'module/PowerShellEditorServices/bin/Core/Microsoft.PowerShell.EditorServices.Hosting.dll'
} -If $editorServicesBuildScriptPath {
    Write-Host "`n### Building PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build Build $editorServicesBuildScriptPath
}

#This will run when the editorservices module is empty or has been updated
$PSESModulePath = (Join-Path $editorServicesPath 'module')
Task CopyEditorServices -Partial -Input {
    $SCRIPT:PSESFiles = Get-ChildItem -File -Recurse $PSESModulePath
    $PSESFiles
} -Output {
    #Get the relative path. Resolve-Path -Relative requires you to be in the directory you want to be relative
    $modulesDir = Join-Path $PSScriptRoot 'modules'
    [string]$stripModulesDirRegex = '^' + [Regex]::Escape($PSESModulePath)
    ($SCRIPT:PSESFiles.fullname -replace $stripModulesDirRegex, '').foreach{ Join-Path $modulesDir $PSItem }
} -If {
    $editorServicesPath
} BuildEditorServices, {
    Write-Host "`n### Copying PowerShellEditorServices module files" -ForegroundColor Green
    Copy-Item $PSESModulePath/* -Recurse -Force -Destination (Join-Path $PSScriptRoot 'modules')
}

Task Build -Input {
    Get-ChildItem -File -Recurse (Join-Path $PSScriptRoot 'src')
} -Output {
    Join-Path $PSScriptRoot 'out/main.js'
    Get-ChildItem -File -Recurse (Join-Path $PSScriptRoot 'out')
} CopyEditorServices, Restore, {
    Write-Host "`n### Building vscode-powershell" -ForegroundColor Green
    # TODO: TSLint is deprecated and we need to switch to ESLint.
    # https://github.com/PowerShell/vscode-powershell/pull/3331
    Exec { & npm run lint }

    # TODO: When supported we should use `esbuild` for the tests too. Although
    # we now use `esbuild` to transpile, bundle, and minify the extension, we
    # still use `tsc` to transpile everything in `src` and `test` because the VS
    # Code test runner expects individual files (and globs them at runtime).
    # Unfortunately `esbuild` doesn't support emitting 1:1 files (yet).
    # https://github.com/evanw/esbuild/issues/944
    Exec { & npm run build }
}

#endregion
#region Test tasks

Task Test -If (!($env:TF_BUILD -and $global:IsLinux)) Build, {
    Write-Host "`n### Running extension tests" -ForegroundColor Green
    if ($ENV:TERM_PROGRAM -eq 'vscode') {
        Write-Warning 'E2E Tests cannot be performed from the CLI while vscode is running, please close vscode and run again or use the "Launch Extension Tests" launch config'
        return
    }
    Exec { & npm run test }
}

Task TestEditorServices -If $editorServicesBuildPath {
    Write-Host "`n### Testing PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build Test $editorServicesBuildPath
}

#endregion

#region Package tasks

Task UpdateReadme -If { $script:IsPreviewExtension } {
    # Add the preview text
    $newReadmeTop = '# PowerShell Language Support for Visual Studio Code

> ## ATTENTION: This is the PREVIEW version of the PowerShell extension for VSCode which contains features that are being evaluated for stable. It works with PowerShell 5.1 and up.
> ### If you are looking for the stable version, please [go here](https://marketplace.visualstudio.com/items?itemName=ms-vscode.PowerShell) or install the extension called "PowerShell" (not "PowerShell Preview")
> ## NOTE: If you have both stable (aka "PowerShell") and preview (aka "PowerShell Preview") installed, you MUST [DISABLE](https://code.visualstudio.com/docs/editor/extension-gallery#_disable-an-extension) one of them for the best performance. Docs on how to disable an extension can be found [here](https://code.visualstudio.com/docs/editor/extension-gallery#_disable-an-extension)'
    $readmePath = (Join-Path $PSScriptRoot README.md)

    $readmeContent = Get-Content -Path $readmePath
    if (!($readmeContent -match 'This is the PREVIEW version of the PowerShell extension')) {
        $readmeContent[0] = $newReadmeTop
        $readmeContent | Set-Content $readmePath -Encoding utf8
    }
}

Task Package -Input {
    Get-ChildItem $PSScriptRoot -Exclude '.vscode-test', 'logs', 'sessions', 'node_modules', '.git' |
        Get-ChildItem -Recurse -File
} -Output {
    $vsix = Get-ChildItem $PSScriptRoot/*.vsix
    if (-not $VSIX) {
        'No VSIX Created Yet'
    } else { $vsix }
} UpdateReadme, Build, {
    assert { Test-Path ./modules/PowerShellEditorServices }
    Write-Host "`n### Packaging $($script:PackageJson.name)-$($script:PackageJson.version).vsix`n" -ForegroundColor Green
    exec { & npm run package }
}

#endregion

task . Build, Test, Package
