# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",
    [string]$EditorServicesRepoPath = $null
)

#Requires -Modules @{ ModuleName = "InvokeBuild"; ModuleVersion = "5.0.0" }

function Get-EditorServicesPath {
    $psesRepoPath = if ($EditorServicesRepoPath) {
        $EditorServicesRepoPath
    } else {
        "$PSScriptRoot/../PowerShellEditorServices/"
    }
    # NOTE: The ErrorActionPreference for both Invoke-Build and Azure DevOps
    # scripts is Stop, but we want to continue and return false here.
    return Resolve-Path "$psesRepoPath/PowerShellEditorServices.build.ps1" -ErrorAction SilentlyContinue
}

#region Setup tasks

task RestoreNode -If { !(Test-Path ./node_modules/esbuild) } {
    Write-Build DarkGreen "Restoring build dependencies"
    Invoke-BuildExec { & npm ci --omit=optional }
}

task RestoreNodeOptional -If { !(Test-Path ./node_modules/eslint) } {
    Write-Build DarkMagenta "Restoring build, test, and lint dependencies"
    Invoke-BuildExec { & npm ci --include=optional }
}

task RestoreEditorServices -If (Get-EditorServicesPath) {
    switch ($Configuration) {
        "Debug" {
            # When debugging, we always rebuild PSES and ensure its symlinked so
            # that developers always have the latest local bits.
            if ((Get-Item ./modules -ErrorAction SilentlyContinue).LinkType -ne "SymbolicLink") {
                Write-Build DarkMagenta "Creating symbolic link to PSES"
                Remove-BuildItem ./modules
                New-Item -ItemType SymbolicLink -Path ./modules -Target "$(Split-Path (Get-EditorServicesPath))/module"
            }

            Write-Build DarkGreen "Building PSES"
            Invoke-Build Build (Get-EditorServicesPath) -Configuration $Configuration
        }
        "Release" {
            # When releasing, we ensure the bits are not symlinked but copied,
            # and only if they don't already exist.
            if ((Get-Item ./modules -ErrorAction SilentlyContinue).LinkType -eq "SymbolicLink") {
                Write-Build DarkRed "Deleting PSES symbolic link"
                Remove-BuildItem ./modules
            }

            if (!(Test-Path ./modules)) {
                # We only build if it hasn't been built at all.
                if (!(Test-Path "$(Split-Path (Get-EditorServicesPath))/module/PowerShellEditorServices/bin")) {
                    Write-Build DarkGreen "Building PSES"
                    Invoke-Build Build (Get-EditorServicesPath) -Configuration $Configuration
                }

                Write-Build DarkGreen "Copying PSES"
                Copy-Item -Recurse -Force "$(Split-Path (Get-EditorServicesPath))/module" ./modules
            }
        }
    }
}

#endregion
#region Clean tasks

task Clean {
    Write-Build DarkMagenta "Cleaning vscode-powershell"
    Remove-BuildItem *.js, *.js.map, ./dist, ./modules, ./node_modules, ./out
}

task CleanEditorServices -If (Get-EditorServicesPath) {
    Write-Build DarkMagenta "Cleaning PSES"
    Invoke-Build Clean (Get-EditorServicesPath)
}

#endregion
#region Build tasks
task Lint RestoreNodeOptional, {
    Write-Build DarkMagenta "Linting TypeScript"
    Invoke-BuildExec { & npm run lint }
}

task Build RestoreEditorServices, RestoreNode, {
    Write-Build DarkGreen "Building vscode-powershell"
    Assert-Build (Test-Path ./modules/PowerShellEditorServices/bin) "Extension requires PSES"

    # TODO: When supported we should use `esbuild` for the tests too. Although
    # we now use `esbuild` to transpile, bundle, and minify the extension, we
    # still use `tsc` to transpile everything in `src` and `test` because the VS
    # Code test runner expects individual files (and globs them at runtime).
    # Unfortunately `esbuild` doesn't support emitting 1:1 files (yet).
    # https://github.com/evanw/esbuild/issues/944
    switch ($Configuration) {
        "Debug" { Invoke-BuildExec { & npm run compile } }
        "Release" { Invoke-BuildExec { & npm run compile -- --minify } }
    }
}

#endregion
#region Test tasks

task Test Lint, Build, {
    Write-Build DarkMagenta "Running extension tests"
    Invoke-BuildExec { & npm run test }
    # Reset the state of files modified by tests
    Invoke-BuildExec { git checkout package.json test/TestEnvironment.code-workspace }
}

task TestEditorServices -If (Get-EditorServicesPath) {
    Write-Build DarkMagenta "Testing PSES"
    Invoke-Build Test (Get-EditorServicesPath)
}

#endregion
#region Package tasks

task Package {
    [semver]$version = $((Get-Content -Raw -Path package.json | ConvertFrom-Json).version)
    Write-Build DarkGreen "Packaging powershell-$version.vsix"
    Remove-BuildItem ./out
    New-Item -ItemType Directory -Force out | Out-Null

    Assert-Build (Test-Path ./dist/extension.js) "Extension must be built!"

    # Packaging requires a copy of the modules folder, not a symbolic link. But
    # we might have built in Debug configuration, not Release, and still want to
    # package it. So delete the symlink and copy what we just built.
    if ((Get-Item ./modules -ErrorAction SilentlyContinue).LinkType -eq "SymbolicLink") {
        Write-Build DarkRed "PSES is a symbolic link, replacing with copy!"
        Remove-BuildItem ./modules
        Copy-Item -Recurse -Force "$(Split-Path (Get-EditorServicesPath))/module" ./modules
    }

    if ($version.Minor % 2 -ne 0) {
        Write-Build DarkRed "This is a pre-release!"
        Invoke-BuildExec { & npm run package -- --pre-release }
    } else {
        Invoke-BuildExec { & npm run package }
    }
}

#endregion

task . Test, Package
