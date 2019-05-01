# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

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

function GetDescriptionFromChangelog
{
    param(
        [Parameter(Mandatory)]
        [string]
        $ChangelogPath
    )

    $lines = Get-Content -Path $ChangelogPath
    $sb = [System.Text.StringBuilder]::new($lines[2])
    for ($i = 3; -not $lines[$i].StartsWith('## '); $i++)
    {
        $null = $sb.Append("`n").Append($lines[$i])
    }

    return $sb.ToString()
}

$tag = "v$Version"

$releaseParams = @{
    Organization = $TargetFork
    Repository = $Repository
    Tag = $tag
    ReleaseName = $tag
    Branch = "release/$Version"
    AssetPath = $AssetPath
    Prerelease = [bool]($Version.PreReleaseLabel)
    Description = GetDescriptionFromChangelog -ChangelogPath $ChangelogPath
    GitHubToken = $GitHubToken
}
Publish-GitHubRelease @releaseParams
