# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",
    [string]$EditorServicesRepoPath = $null
)

#Requires -Modules @{ModuleName="InvokeBuild";ModuleVersion="3.0.0"}

# Grab package.json data which is used throughout the build.
$script:PackageJson = Get-Content -Raw $PSScriptRoot/package.json | ConvertFrom-Json
$script:IsPreviewExtension = $script:PackageJson.name -like "*preview*" -or $script:PackageJson.displayName -like "*preview*"
Write-Host "`n### Extension: $($script:PackageJson.name)-$($script:PackageJson.version)`n" -ForegroundColor Green

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

#region Setup tasks

task RestoreNodeModules -If { !(Test-Path ./node_modules) } {
    Write-Host "`n### Restoring vscode-powershell dependencies`n" -ForegroundColor Green
    # When in a CI build use the --loglevel=error parameter so that
    # package install warnings don't cause PowerShell to throw up
    if ($env:TF_BUILD) {
        exec { & npm ci --loglevel=error }
    } else {
        exec { & npm install }
    }
}

task RestoreEditorServices -If (Get-EditorServicesPath) {
    switch ($Configuration) {
        "Debug" {
            # When debugging, we always rebuild PSES and ensure its symlinked so
            # that developers always have the latest local bits.
            if ((Get-Item ./modules -ErrorAction SilentlyContinue).LinkType -ne "SymbolicLink") {
                Write-Host "`n### Creating symbolic link to PSES" -ForegroundColor Green
                remove ./modules
                New-Item -ItemType SymbolicLink -Path ./modules -Target "$(Split-Path (Get-EditorServicesPath))/module"
            }

            Write-Host "`n### Building PSES`n" -ForegroundColor Green
            Invoke-Build Build (Get-EditorServicesPath)
        }
        "Release" {
            # When releasing, we ensure the bits are not symlinked but copied,
            # and only if they don't already exist.
            if ((Get-Item ./modules -ErrorAction SilentlyContinue).LinkType -eq "SymbolicLink") {
                Write-Host "`n### Deleting PSES symbolic link" -ForegroundColor Green
                remove ./modules
            }

            if (!(Test-Path ./modules)) {
                # We only build if it hasn't been built at all.
                if (!(Test-Path "$(Split-Path (Get-EditorServicesPath))/module/PowerShellEditorServices/bin")) {
                    Write-Host "`n### Building PSES`n" -ForegroundColor Green
                    Invoke-Build Build (Get-EditorServicesPath)
                }

                Write-Host "`n### Copying PSES`n" -ForegroundColor Green
                Copy-Item -Recurse -Force "$(Split-Path (Get-EditorServicesPath))/module" ./modules
            }
        }
    }
}

task Restore RestoreEditorServices, RestoreNodeModules

#endregion
#region Clean tasks

task Clean {
    Write-Host "`n### Cleaning vscode-powershell`n" -ForegroundColor Green
    remove ./modules, ./out, ./node_modules, *.vsix
}

task CleanEditorServices -If (Get-EditorServicesPath) {
    Write-Host "`n### Cleaning PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build Clean (Get-EditorServicesPath)
}

#endregion
#region Build tasks

task Build Restore, {
    Write-Host "`n### Building vscode-powershell`n" -ForegroundColor Green
    assert (Test-Path ./modules/PowerShellEditorServices/bin) "Extension requires PSES"

    # TODO: TSLint is deprecated and we need to switch to ESLint.
    # https://github.com/PowerShell/vscode-powershell/pull/3331
    exec { & npm run lint }

    # TODO: When supported we should use `esbuild` for the tests too. Although
    # we now use `esbuild` to transpile, bundle, and minify the extension, we
    # still use `tsc` to transpile everything in `src` and `test` because the VS
    # Code test runner expects individual files (and globs them at runtime).
    # Unfortunately `esbuild` doesn't support emitting 1:1 files (yet).
    # https://github.com/evanw/esbuild/issues/944
    switch ($Configuration) {
        "Debug" { exec { & npm run build -- --sourcemap } }
        "Release" { exec { & npm run build -- --minify } }
    }
}

#endregion
#region Test tasks

task Test -If (!($env:TF_BUILD -and $global:IsLinux)) Build, {
    Write-Host "`n### Running extension tests" -ForegroundColor Green
    exec { & npm run test }
    # Reset the state of files modified by tests
    exec { git checkout package.json test/.vscode/settings.json}
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
    Write-Host "`n### Packaging $($script:PackageJson.name)-$($script:PackageJson.version).vsix`n" -ForegroundColor Green
    assert ((Get-Item ./modules).LinkType -ne "SymbolicLink") "Packaging requires a copy of PSES, not a symlink!"
    exec { & npm run package }
}

#endregion

task . Build, Test, Package
