# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

#requires -Version 6.0

param(
    [Parameter(Mandatory)]
    [semver]
    $Version,

    [Parameter(Mandatory)]
    [string]
    $GitHubToken,

    [Parameter(Mandatory)]
    [string]
    $Repository,

    [Parameter()]
    [string]
    $TargetFork = 'PowerShell',

    [Parameter()]
    [string]
    $ChangelogPath = "$PSScriptRoot/../../CHANGELOG.md",

    [Parameter()]
    [string[]]
    $AssetPath
)

Import-Module "$PSScriptRoot/../GitHubTools.psm1" -Force

<#
.SYNOPSIS
Get the release description from the CHANGELOG
.DESCRIPTION
Gets the latest CHANGELOG entry from the CHANGELOG for use as the GitHub release description
.PARAMETER ChangelogPath
Path to the changelog file
#>
function GetDescriptionFromChangelog
{
    param(
        [Parameter(Mandatory)]
        [string]
        $ChangelogPath
    )

    $lines = Get-Content -Path $ChangelogPath
    # First two lines are the title and newline
    # Third looks like '## vX.Y.Z-releasetag'
    $sb = [System.Text.StringBuilder]::new($lines[2])
    # Read through until the next '## vX.Y.Z-releasetag' H2
    for ($i = 3; -not $lines[$i].StartsWith('## '); $i++)
    {
        $null = $sb.Append("`n").Append($lines[$i])
    }

    return $sb.ToString()
}

$tag = "v$Version"

$releaseParams = @{
    Draft = $true
    Organization = $TargetFork
    Repository = $Repository
    Tag = $tag
    ReleaseName = $tag
    AssetPath = $AssetPath
    Prerelease = [bool]($Version.PreReleaseLabel)
    Description = GetDescriptionFromChangelog -ChangelogPath $ChangelogPath
    GitHubToken = $GitHubToken
}
Publish-GitHubRelease @releaseParams
