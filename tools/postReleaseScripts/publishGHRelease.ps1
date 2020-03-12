# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

#requires -Version 6.0

<#
.EXAMPLE
./publishGHRelease.ps1 -ReleaseTag v2020.3.0-preview -Branch release/preview/2020.3.0 -GitHubToken $ghTok -Repository 'vscode-PowerShell' -ChangelogPath "../../CHANGELOG.md" -AssetPath ../../PowerShell-Preview-2020.3.0.vsix,../../scripts/Install-VSCode.ps1

.EXAMPLE
./publishGHRelease.ps1 -ReleaseTag v2020.3.0-preview -Branch release/preview/2020.3.0 -GitHubToken $ghTok -Repository 'PowerShellEditorServices' -ChangelogPath "../../../PowerShellEditorServices/CHANGELOG.md" -AssetPath ../../../PowerShellEditorServices/PowerShellEditorServices.zip

.EXAMPLE
./publishGHRelease.ps1 -ReleaseTag v2020.4.0 -Branch release/stable/2020.3.0 -Stable -GitHubToken $ghTok -Repository 'PowerShellEditorServices' -ChangelogPath "../../../PowerShellEditorServices/CHANGELOG.md" -AssetPath ../../../PowerShellEditorServices/PowerShellEditorServices.zip
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [Alias("Tag")]
    [string]
    $ReleaseTag,

    [Parameter(Mandatory)]
    [Alias("Branch")]
    [string]
    $BranchName,

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
    $AssetPath,

    [switch]
    $Stable
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

$releaseParams = @{
    Organization = $TargetFork
    Repository = $Repository
    Tag = $ReleaseTag
    ReleaseName = $ReleaseTag
    Branch = $BranchName
    AssetPath = $AssetPath
    Prerelease = -not $Stable
    Description = GetDescriptionFromChangelog -ChangelogPath $ChangelogPath
    GitHubToken = $GitHubToken
    Draft = $true
}
Publish-GitHubRelease @releaseParams
