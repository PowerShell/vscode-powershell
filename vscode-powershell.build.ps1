# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

#requires -modules @{ ModuleName = "InvokeBuild"; ModuleVersion = "5.0.0" }

using namespace Microsoft.PowerShell.Commands
using namespace System.Management.Automation

param(
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Debug',

    [string]$PSESBuildScriptPath,

    [ValidateNotNullOrEmpty()]
    [string]$RequirementsManifest = $(Join-Path $PSScriptRoot 'requirements.psd1'),

    [ValidateNotNullOrEmpty()]
    [string]$RequiredNodeVersion = $RequirementsManifest.Node,

    [ValidateNotNullOrEmpty()]
    [Microsoft.PowerShell.Commands.ModuleSpecification]$RequiredModules = $RequirementsManifest.Node,

    [ValidateNotNullOrEmpty()]
    [Version]$RequiredPowerShellVersion = $RequirementsManifest.Pwsh,

    [Switch]$InstallPrerequisites
)
$SCRIPT:ErrorActionPreference = 'Stop'


#region Prerequisites

task Prerequisites {
    # We want all prereqs to run so we can tell the user everything they are missing, rather than them having to fix/check/fix/check/etc.
    [ErrorRecord[]]$preRequisiteIssues = & {
        Assert-Pwsh $RequiredPowerShellVersion -ErrorAction Continue
        Assert-NodeVersion $RequiredNodeVersion -ErrorAction Continue
        Assert-Module $RequiredModules -ErrorAction Continue
    } 2>&1

    if ($preRequisiteIssues) {
        $ErrorActionPreference = 'Continue'
        Write-Warning 'The following prerequisites are not met. Please install them before continuing. Setup guidance can be found here: https://github.com/PowerShell/vscode-powershell/blob/main/docs/development.md'
        $preRequisiteIssues | ForEach-Object { Write-Error $_ }
    }
    # We dont need to test for vscode anymore because we download it dynamically during the build.

}

function Assert-Pwsh ([string]$RequiredPowerShellVersion) {
    try {
        [Version]$pwshVersion = (Get-Command -Name pwsh -CommandType Application).Version
    } catch {
        if ($InstallPrerequisites) {
            throw [NotImplementedException]'Automatic installation of Pwsh is not yet supported.'
        }
        Write-Error "PowerShell (pwsh) not found on your system. Please install PowerShell $RequiredPowerShellVersion or higher and ensure it is available in your `$env:PATH environment variable"
        return
    }
    if ($pwshVersion -lt $RequiredPowerShellVersion) {
        if ($InstallPrerequisites) {
            throw [NotImplementedException]'Automatic installation of Pwsh is not yet supported.'
        }
        Write-Error "PowerShell version $pwshVersion is not or no longer supported. Please install PowerShell $RequiredPowerShellVersion or higher"
        return
    }
    Write-Debug "PREREQUISITE: Detected supported PowerShell version $psVersion at or above minimum $RequiredPowerShellVersion"
}

function Assert-NodeVersion ($RequiredNodeVersion) {
    [version]$nodeVersion = (& node -v).Substring(1)
    if ($nodeVersion -lt $RequiredNodeVersion) {
        if ($InstallPrerequisites) {
            throw [NotImplementedException]'Automatic installation of Node.js is not yet supported.'
        }
        Write-Error "Node.js version $nodeVersion is not supported. Please install Node.js $RequiredNodeVersion or higher"
        return
    }
    Write-Debug "PREREQUISITE: Detected supported Node.js version $nodeVersion at or above minimum $RequiredNodeVersion"
}

function Assert-Module ([ModuleSpecification[]]$RequiredModules) {
    foreach ($moduleSpec in $RequiredModules) {
        $moduleMatch = Get-Module -ListAvailable -FullyQualifiedName $moduleSpec |
            Sort-Object Version -Descending |
            Select-Object -First 1

        if (-not $moduleMatch) {
            if ($InstallPrerequisites) {
                $otherPowershell = if ($PSVersionTable.PSVersion -lt '6.0.0') {
                    'pwsh'
                } else {
                    'powershell'
                }
                Write-Verbose "PREREQUISITE: Installing Missing Module $($moduleSpec.Name) $($moduleSpec.Version)"
                $installModuleParams = @{
                    Name            = $moduleSpec.Name
                    RequiredVersion = $moduleSpec.Version
                    Force           = $true
                    Scope           = 'CurrentUser'
                }
                Install-Module @installModuleParams

                # We could do a symbolic link or point both instances to the same PSModulePath but there are some potential risks so we go slow in the name of safety.
                Write-Verbose "PREREQUISITE: Installing Missing Module $($moduleSpec.Name) $($moduleSpec.Version) ($otherPowerShell)"
                & $otherPowershell -noprofile -c "Install-Module -Name $($moduleSpec.Name) -RequiredVersion $($moduleSpec.Version) -Force -Scope CurrentUser -ErrorAction Stop"
            }
            Write-Error "Module $($moduleSpec.Name) $($moduleSpec.Version) is not installed. Please install it."
            return
        }

        Write-Debug "PREREQUISITE: Detected supported module $($moduleMatch.Name) $($moduleMatch.Version) at or above minimum $($moduleSpec.Version)"
    }
}

#endregion Prerequisites

function Get-PSESBuildScriptPath {
    $psesRepoPath = if ($PSESBuildScriptPath) {
        $PSESBuildScriptPath
    } else {
        Join-Path $PSScriptRoot '../PowerShellEditorServices/'
    }
    # NOTE: The ErrorActionPreference for both Invoke-Build and Azure DevOps
    # scripts is Stop, but we want to continue and return false here.
    try {
        Resolve-Path "$psesRepoPath/PowerShellEditorServices.build.ps1"
    } catch {
        Write-Warning "Could not find PowerShellEditorServices build script at $psesRepoPath. Skipping PSES build."
        return $false
    }
}

#region Setup tasks

task RestoreNodeModules -If { !(Test-Path ./node_modules) } {
    Write-Host "`n### Restoring vscode-powershell dependencies`n" -ForegroundColor Green
    # When in a CI build use the --loglevel=error parameter so that
    # package install warnings don't cause PowerShell to throw up
    if ($env:TF_BUILD) {
        Invoke-BuildExec { & npm ci --loglevel=error }
    } else {
        Invoke-BuildExec { & npm install }
    }
}

task RestoreEditorServices -If (Get-PSESBuildScriptPath) {
    switch ($Configuration) {
        'Debug' {
            # When debugging, we always rebuild PSES and ensure its symlinked so
            # that developers always have the latest local bits.
            if ((Get-Item ./modules -ErrorAction SilentlyContinue).LinkType -ne 'SymbolicLink') {
                Write-Host "`n### Creating symbolic link to PSES" -ForegroundColor Green
                Remove-BuildItem ./modules
                New-Item -ItemType SymbolicLink -Path ./modules -Target "$(Split-Path (Get-PSESBuildScriptPath))/module"
            }

            Write-Host "`n### Building PSES`n" -ForegroundColor Green
            Invoke-Build -File (Get-PSESBuildScriptPath) -Task Build -Configuration $Configuration
        }
        'Release' {
            # When releasing, we ensure the bits are not symlinked but copied,
            # and only if they don't already exist.
            if ((Get-Item ./modules -ErrorAction SilentlyContinue).LinkType -eq 'SymbolicLink') {
                Write-Host "`n### Deleting PSES symbolic link" -ForegroundColor Green
                Remove-BuildItem ./modules
            }

            if (!(Test-Path ./modules)) {
                # We only build if it hasn't been built at all.
                if (!(Test-Path "$(Split-Path (Get-PSESBuildScriptPath))/module/PowerShellEditorServices/bin")) {
                    Write-Host "`n### Building PSES`n" -ForegroundColor Green
                    Invoke-Build -File (Get-PSESBuildScriptPath) -Task Build -Configuration $Configuration
                }

                Write-Host "`n### Copying PSES`n" -ForegroundColor Green
                Copy-Item -Recurse -Force "$(Split-Path (Get-PSESBuildScriptPath))/module" ./modules
            }
        }
    }
}

task Restore RestoreEditorServices, RestoreNodeModules

#endregion
#region Clean tasks

task CleanExtension {
    Write-Host "`n### Cleaning vscode-powershell`n" -ForegroundColor Green
    Remove-BuildItem ./modules, ./out, ./node_modules, *.vsix
}

task CleanEditorServices -If (Get-PSESBuildScriptPath) {
    Write-Host "`n### Cleaning PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build -File (Get-PSESBuildScriptPath) -Task Clean
}

#endregion
#region Build tasks

task Build Prerequisites, Restore, {
    Write-Host "`n### Building vscode-powershell`n" -ForegroundColor Green
    Assert-Build (Test-Path ./modules/PowerShellEditorServices/bin) 'Extension requires PSES'

    Write-Host "`n### Linting TypeScript`n" -ForegroundColor Green
    Invoke-BuildExec { & npm run lint }

    # TODO: When supported we should use `esbuild` for the tests too. Although
    # we now use `esbuild` to transpile, bundle, and minify the extension, we
    # still use `tsc` to transpile everything in `src` and `test` because the VS
    # Code test runner expects individual files (and globs them at runtime).
    # Unfortunately `esbuild` doesn't support emitting 1:1 files (yet).
    # https://github.com/evanw/esbuild/issues/944
    switch ($Configuration) {
        'Debug' { Invoke-BuildExec { & npm run build -- --sourcemap } }
        'Release' { Invoke-BuildExec { & npm run build -- --minify } }
    }
}

#endregion
#region Test tasks

task TestExtension {
    Write-Host "`n### Running extension tests" -ForegroundColor Green
    Invoke-BuildExec { & npm run test }
    # Reset the state of files modified by tests
    Invoke-BuildExec { git checkout package.json test/TestEnvironment.code-workspace }
}

task TestEditorServices -If (Get-PSESBuildScriptPath) {
    Write-Host "`n### Testing PowerShellEditorServices`n" -ForegroundColor Green
    Invoke-Build -File (Get-PSESBuildScriptPath) -Task Test -Configuration $Configuration
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
    Assert-Build ((Get-Item ./modules).LinkType -ne 'SymbolicLink') 'Packaging requires a copy of PSES, not a symlink!'
    if (Test-IsPreRelease) {
        Write-Host "`n### This is a pre-release!`n" -ForegroundColor Green
        Invoke-BuildExec { & npm run package -- --pre-release }
    } else {
        Invoke-BuildExec { & npm run package }
    }
}

#endregion


# High Level Tasks
task Bootstrap Prerequisites
task Clean CleanExtension, CleanEditorServices
task Test Prerequisites, Build, TestExtension #We dont test PSES unless explicitly requested, it should have already been tested in PSES build
task . Prerequisites, Build, Test, Package
