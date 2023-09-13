# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

#requires -Version 7.0

using namespace System.Management.Automation

$ChangelogFile = "CHANGELOG.md"

<#
.SYNOPSIS
  Given the repository name, execute the script in its directory.
#>
function Use-Repository {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateSet("vscode-powershell", "PowerShellEditorServices")]
        [string]$RepositoryName,

        [Parameter(Mandatory)]
        [scriptblock]$Script
    )
    try {
        switch ($RepositoryName) {
            "vscode-powershell" {
                Push-Location -Path "$PSScriptRoot/../"
            }
            "PowerShellEditorServices" {
                Push-Location -Path "$PSScriptRoot/../../PowerShellEditorServices"
            }
        }
        & $Script
    } finally {
        Pop-Location
    }
}

<#
.SYNOPSIS
  Gets the unpublished content from the changelog.
.DESCRIPTION
  This is used so that we can manually touch-up the automatically updated
  changelog, and then bring its contents into the extension's changelog or
  the GitHub release. It just gets the first header's contents.
#>
function Get-FirstChangelog {
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryName
    )
    $Changelog = Use-Repository -RepositoryName $RepositoryName -Script {
        Get-Content -Path $ChangelogFile
    }
    # NOTE: The space after the header marker is important! Otherwise ### matches.
    $Header = $Changelog.Where({$_.StartsWith("## ")}, "First")
    $Changelog.Where(
        { $_ -eq $Header }, "SkipUntil"
    ).Where(
        { $_.StartsWith("## ") -and $_ -ne $Header }, "Until"
    )
}

<#
.SYNOPSIS
  Gets current version from changelog as `[semver]`.
#>
function Get-Version {
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryName
    )
    # NOTE: The first line should always be the header.
    $Changelog = (Get-FirstChangelog -RepositoryName $RepositoryName)[0]
    if ($Changelog -match '## v(?<version>\d+\.\d+\.\d+(-preview\.?\d*)?)') {
        return [semver]$Matches.version
    } else {
        Write-Error "Couldn't find version from changelog!"
    }
}

<#
.SYNOPSIS
  Gets the version as a semantic version string without the 'v' prefix or
  pre-release suffix.
#>
function Get-MajorMinorPatch {
    param(
        [Parameter(Mandatory)]
        [semver]$Version
    )
    return "$($Version.Major).$($Version.Minor).$($Version.Patch)"
}

<#
.SYNOPSIS
  Tests if this is a pre-release (specifically for the extension).
#>
function Test-IsPreRelease {
    $Version = Get-Version -RepositoryName vscode-powershell
    return [bool]$Version.PreReleaseLabel
}

<#
.SYNOPSIS
  Validates the given version string.
#>
function Test-VersionIsValid {
    param(
        [Parameter(Mandatory)]
        [ValidateSet("vscode-powershell", "PowerShellEditorServices")]
        [string]$RepositoryName,

        [Parameter(Mandatory)]
        [string]$Version
    )
    if (!$Version.StartsWith("v")) {
        throw "Version should start with 'v' prefix!"
    }

    $SemanticVersion = [semver]$Version.Substring(1)
    switch ($RepositoryName) {
        "vscode-powershell" {
            $Date = Get-Date
            if ($SemanticVersion.Major -ne $Date.Year) {
                throw "Major version should be the current year!"
            }
            if ($SemanticVersion.PreReleaseLabel) {
                if ($SemanticVersion.PreReleaseLabel -ne "preview") {
                    throw "Suffix should only be 'preview'!"
                }
                if ($SemanticVersion.Minor % 2 -eq 0) {
                    throw "Minor version must be odd for pre-release!"
                }
            } else {
                if ($SemanticVersion.Minor % 2 -ne 0) {
                    throw "Minor version must be even for pre-release!"
                }
            }
        }
        "PowerShellEditorServices" {
            if ($SemanticVersion.PreReleaseLabel) {
                if ($SemanticVersion.PreReleaseLabel -ne "preview") {
                    throw "Suffix should only be 'preview'!"
                }
            }
        }
    }
}
