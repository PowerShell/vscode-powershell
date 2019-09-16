# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

#requires -Version 6.0

using module ..\GitHubTools.psm1
using module ..\ChangelogTools.psm1

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]
    $GitHubToken,

    [Parameter(Mandatory)]
    [string]
    $SinceRef,

    [Parameter()]
    [version]
    $PSExtensionVersion,

    [Parameter()]
    [semver]
    $PsesVersion,

    [Parameter()]
    [string]
    $PSExtensionReleaseName,

    [Parameter()]
    [string]
    $PsesReleaseName,

    [Parameter()]
    [string]
    $UntilRef = 'HEAD',

    [Parameter()]
    [string]
    $Organization = 'PowerShell',

    [Parameter()]
    [string]
    $TargetFork = $Organization,

    [Parameter()]
    [string]
    $FromFork = 'rjmholt',

    [Parameter()]
    [string]
    $ChangelogName = 'CHANGELOG.md',

    [Parameter()]
    [string]
    $PSExtensionRepositoryPath = (Resolve-Path "$PSScriptRoot/../../"),

    [Parameter()]
    [string]
    $PsesRepositoryPath = (Resolve-Path "$PSExtensionRepositoryPath/../PowerShellEditorServices")
)

$PSExtensionRepositoryPath = $PSCmdlet.GetUnresolvedProviderPathFromPSPath($PSExtensionRepositoryPath)
$PsesRepositoryPath = $PSCmdlet.GetUnresolvedProviderPathFromPSPath($PsesRepositoryPath)

if (-not $PSExtensionVersion)
{
    $PSExtensionVersion = (Get-Content -Raw "$PSExtensionRepositoryPath/package.json" | ConvertFrom-Json).version
}

if (-not $PsesVersion)
{
    $psesProps = [xml](Get-Content -Raw "$PsesRepositoryPath/PowerShellEditorServices.Common.props")
    $psesVersionPrefix = $psesProps.Project.PropertyData.VersionPrefix
    $psesVersionSuffix = $psesProps.Project.PropertyData.VersionSuffix

    $PsesVersion = [semver]"$psesVersionPrefix-$psesVersionSuffix"
}

if (-not $PSExtensionReleaseName)
{
    $PSExtensionReleaseName = "v$PSExtensionVersion"
}

if (-not $PsesReleaseName)
{
    $PsesReleaseName = "v$PsesVersion"
}

function UpdateChangelogFile
{
    param(
        [Parameter(Mandatory)]
        [string]
        $NewSection,

        [Parameter(Mandatory)]
        [string]
        $Path
    )

    Write-Verbose "Writing new changelog section to '$Path'"

    $changelogLines = Get-Content -Path $Path
    $newContent = ($changelogLines[0..1] -join "`n`n") + $NewSection + ($changelogLines[2..$changelogLines.Length] -join "`n")
    Set-Content -Encoding utf8NoBOM -Value $newContent -Path $Path
}

#region Configuration

Write-Verbose "Configuring settings"

$vscodeRepoName = 'vscode-PowerShell'
$psesRepoName = 'PowerShellEditorServices'

$dateFormat = 'dddd, MMMM dd, yyyy'

$ignore = @{
    User = 'dependabot[bot]'
    CommitLabel = 'Ignore'
}

$noThanks = @(
    'rjmholt'
    'TylerLeonhardt'
    'daxian-dbw'
    'SteveL-MSFT'
    'PaulHigin'
)

$categories = [ordered]@{
    Debugging  = @{
        Issue = 'Area-Debugging'
    }
    CodeLens = @{
        Issue = 'Area-CodeLens'
    }
    'Script Analysis' = @{
        Issue = 'Area-Script Analysis'
    }
    Formatting = @{
        Issue = 'Area-Formatting'
    }
    'Integrated Console' = @{
        Issue = 'Area-Integrated Console','Area-PSReadLine'
    }
    Intellisense = @{
        Issue = 'Area-Intellisense'
    }
    General = @{
        Issue = 'Area-General'
    }
}

$defaultCategory = 'General'

$branchName = "changelog-$ReleaseName"

#endregion Configuration

#region PSES Changelog

$clEntryParams = @{
    EntryCategories = $categories
    DefaultCategory = $defaultCategory
    TagLabels = @{
        'Issue-Enhancement' = '✨'
        'Issue-Bug' = '🐛'
    }
    NoThanks = $noThanks
}

$clSectionParams = @{
    Categories = $categories.Keys
    DefaultCategory = $defaultCategory
    ReleaseName = $ReleaseName
    DateFormat = $dateFormat
}

Write-Verbose "Creating PSES changelog"

$psesChangelogSection = Get-GitCommit -SinceRef $SinceRef -UntilRef $UntilRef -GitHubToken $GitHubToken -RepositoryPath $PsesRepositoryPath -Verbose:$VerbosePreference |
    Get-ChangeInfoFromCommit -GitHubToken $GitHubToken -Verbose:$VerbosePreference |
    Skip-IgnoredChange @ignore -Verbose:$VerbosePreference |
    New-ChangelogEntry @clEntryParams -Verbose:$VerbosePreference |
    New-ChangelogSection @clSectionParams -Verbose:$VerbosePreference

Write-Host "PSES CHANGELOG:`n`n$psesChangelogSection`n`n"

$cloneLocation = Join-Path ([System.IO.Path]::GetTempPath()) "${psesRepoName}_changelogupdate"

$cloneParams = @{
    OriginRemote = "https://github.com/$FromFork/$psesRepoName"
    Destination = $cloneLocation
    CheckoutBranch = $branchName
    Clobber = $true
    Remotes = @{ 'upstream' = "https://github.com/$TargetFork/$vscodeRepoName" }
}
Copy-GitRepository @cloneParams -Verbose:$VerbosePreference

UpdateChangelogFile -NewSection $psesChangelogSection -Path "$cloneLocation/$ChangelogName"

Submit-GitChanges -RepositoryLocation $cloneLocation -File $GalleryFileName -Branch $branchName -Message "Update CHANGELOG for $ReleaseName" -Verbose:$VerbosePreference

#endregion

#region vscode-PowerShell Changelog
$psesChangelogPostamble = $psesChangelogSection -split "`n"
$psesChangelogPostamble = @("#### [$psesRepoName](https://github.com/$Organization/$psesRepoName)") + $psesChangelogPostamble[2..($psesChangelogPostamble.Length-3)]
$psesChangelogPostamble = $psesChangelogPostamble -join "`n"

$psextChangelogSection = Get-GitCommit -SinceRef $SinceRef -UntilRef $UntilRef -GitHubToken $GitHubToken -RepositoryPath $PSExtensionRepositoryPath -Verbose:$VerbosePreference |
    Get-ChangeInfoFromCommit -GitHubToken $GitHubToken -Verbose:$VerbosePreference |
    Skip-IgnoredChange @ignore -Verbose:$VerbosePreference |
    New-ChangelogEntry @clEntryParams -Verbose:$VerbosePreference |
    New-ChangelogSection @clSectionParams -Preamble "#### [$vscodeRepoName](https://github.com/$Organization/$vscodeRepoName)" -Postamble $psesChangelogPostamble -Verbose:$VerbosePreference

Write-Host "vscode-PowerShell CHANGELOG:`n`n$psextChangelogSection`n`n"

$cloneLocation = Join-Path ([System.IO.Path]::GetTempPath()) "${vscodeRepoName}_changelogupdate"

$cloneParams = @{
    OriginRemote = "https://github.com/$FromFork/$vscodeRepoName"
    Destination = $cloneLocation
    CheckoutBranch = $branchName
    Clobber = $true
    Remotes = @{ 'upstream' = "https://github.com/$TargetFork/$vscodeRepoName" }
    PullUpstream = $true
}
Copy-GitRepository @cloneParams -Verbose:$VerbosePreference

UpdateChangelogFile -NewSection $psextChangelogSection -Path "$cloneLocation/$ChangelogName"

Submit-GitChanges -RepositoryLocation $cloneLocation -File $GalleryFileName -Branch $branchName -Message "Update CHANGELOG for $ReleaseName" -Verbose:$VerbosePreference

#endregion vscode-PowerShell Changelog

#region PRs

# PSES PR
$prParams = @{
    Organization = $TargetFork
    Repository = $psesRepoName
    Branch = $branchName
    Title = "Update CHANGELOG for $ReleaseName"
    GitHubToken = $GitHubToken
    FromOrg = $FromFork
}
New-GitHubPR @prParams -Verbose:$VerbosePreference

# vscode-PowerShell PR
$prParams = @{
    Organization = $TargetFork
    Repository = $vscodeRepoName
    Branch = $branchName
    Title = "Update CHANGELOG for $ReleaseName"
    GitHubToken = $GitHubToken
    FromOrg = $FromFork
}
New-GitHubPR @prParams -Verbose:$VerbosePreference

#endregion PRs
