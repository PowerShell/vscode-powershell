# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",
    [string]$EditorServicesRepoPath = $null
)

#Requires -Modules @{ ModuleName = "InvokeBuild"; ModuleVersion = "3.0.0" }

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
    if ($env:CI -or $env:TF_BUILD) {
        Invoke-BuildExec { & npm ci --loglevel=error --ignore-scripts }
    } else {
        Invoke-BuildExec { & npm install }
    }
}

task RestoreEditorServices -If (Get-EditorServicesPath) {
    switch ($Configuration) {
        "Debug" {
            # When debugging, we always rebuild PSES and ensure its symlinked so
            # that developers always have the latest local bits.
            if ((Get-Item ./modules -ErrorAction SilentlyContinue).LinkType -ne "SymbolicLink") {
                Write-Host "`n### Creating symbolic link to PSES" -ForegroundColor Green
                Remove-BuildItem ./modules
                New-Item -ItemType SymbolicLink -Path ./modules -Target "$(Split-Path (Get-EditorServicesPath))/module"
            }

            Write-Host "`n### Building PSES`n" -ForegroundColor Green
            Invoke-Build Build (Get-EditorServicesPath) -Configuration $Configuration
        }
        "Release" {
            # When releasing, we ensure the bits are not symlinked but copied,
            # and only if they don't already exist.
            if ((Get-Item ./modules -ErrorAction SilentlyContinue).LinkType -eq "SymbolicLink") {
                Write-Host "`n### Deleting PSES symbolic link" -ForegroundColor Green
                Remove-BuildItem ./modules
            }

            if (!(Test-Path ./modules)) {
                # We only build if it hasn't been built at all.
                if (!(Test-Path "$(Split-Path (Get-EditorServicesPath))/module/PowerShellEditorServices/bin")) {
                    Write-Host "`n### Building PSES`n" -ForegroundColor Green
                    Invoke-Build Build (Get-EditorServicesPath) -Configuration $Configuration
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
    Remove-BuildItem ./modules, ./out, ./node_modules, *.vsix
}

task CleanEditorServices -If (Get-EditorServicesPath) {
    Write-Host "`n### Cleaning PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build Clean (Get-EditorServicesPath)
}

#endregion
#region Build tasks

task Build Restore, {
    Write-Host "`n### Building vscode-powershell`n" -ForegroundColor Green
    Assert-Build (Test-Path ./modules/PowerShellEditorServices/bin) "Extension requires PSES"

    Write-Host "`n### Linting TypeScript`n" -ForegroundColor Green
    Invoke-BuildExec { & npm run lint }

    # TODO: When supported we should use `esbuild` for the tests too. Although
    # we now use `esbuild` to transpile, bundle, and minify the extension, we
    # still use `tsc` to transpile everything in `src` and `test` because the VS
    # Code test runner expects individual files (and globs them at runtime).
    # Unfortunately `esbuild` doesn't support emitting 1:1 files (yet).
    # https://github.com/evanw/esbuild/issues/944
    switch ($Configuration) {
        "Debug" { Invoke-BuildExec { & npm run build } }
        "Release" { Invoke-BuildExec { & npm run build -- --minify } }
    }
}

#endregion
#region Test tasks

task Test Build, {
    Write-Host "`n### Running extension tests" -ForegroundColor Green
    Invoke-BuildExec { & npm run test }
    # Reset the state of files modified by tests
    Invoke-BuildExec { git checkout package.json test/TestEnvironment.code-workspace }
}

task TestEditorServices -If (Get-EditorServicesPath) {
    Write-Host "`n### Testing PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build Test (Get-EditorServicesPath)
}

#endregion
#region Package tasks

task Package Build, {
    # Sanity check our changelog version versus package.json (which lacks pre-release label)
    Import-Module $PSScriptRoot/tools/VersionTools.psm1
    $version = Get-Version -RepositoryName vscode-powershell
    $packageVersion = Get-MajorMinorPatch -Version $version
    $packageJson = Get-Content -Raw $PSScriptRoot/package.json | ConvertFrom-Json
    Assert-Build ($packageJson.version -eq $packageVersion)

    Write-Host "`n### Packaging powershell-$packageVersion.vsix`n" -ForegroundColor Green

    # Packaging requires a copy of the modules folder, not a symbolic link. But
    # we might have built in Debug configuration, not Release, and still want to
    # package it. So delete the symlink and copy what we just built.
    if ((Get-Item ./modules -ErrorAction SilentlyContinue).LinkType -eq "SymbolicLink") {
        Write-Host "`n### PSES is a symbolic link, replacing with copy!" -ForegroundColor Green
        Remove-BuildItem ./modules
        Copy-Item -Recurse -Force "$(Split-Path (Get-EditorServicesPath))/module" ./modules
    }

    if (Test-IsPreRelease) {
        Write-Host "`n### This is a pre-release!`n" -ForegroundColor Green
        Invoke-BuildExec { & npm run package -- --pre-release }
    } else {
        Invoke-BuildExec { & npm run package }
    }
}

#endregion

task . Build, Test, Package
