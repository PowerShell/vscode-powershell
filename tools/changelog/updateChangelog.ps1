# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

#requires -Version 6.0

using module ..\GitHubTools.psm1
using module ..\ChangelogTools.psm1

param(
    [Parameter(Mandatory)]
    [string]
    $GitHubToken,

    [Parameter(Mandatory)]
    [string]
    $ReleaseName,

    [Parameter(Mandatory)]
    [string]
    $SinceRef,

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

    $changelogLines = Get-Content -Path $Path
    $newContent = ($changelogLines[0..1] -join "`n`n") + $NewSection + ($changelogLines[2..$changelogLines.Length] -join "`n")
    Set-Content -Encoding utf8NoBOM -Value $newContent -Path $Path
}

#region Configuration

$vscodeRepoName = 'vscode-PowerShell'
$psesRepoName = 'PowerShellEditorServices'

$dateFormat = 'dddd, MMMM dd yyyy'

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

$psesChangelogSection = Get-GitCommit -SinceRef $SinceRef -UntilRef $UntilRef -GitHubToken $GitHubToken -RepositoryPath $PsesRepositoryPath |
    Get-ChangeInfoFromCommit -GitHubToken $GitHubToken |
    Skip-IgnoredChange @ignore |
    New-ChangelogEntry @clEntryParams |
    New-ChangelogSection @clSectionParams -Preamble "#### [$psesRepoName](https://github.com/$Organization/$psesRepoName)"

$cloneLocation = Join-Path ([System.IO.Path]::GetTempPath()) "${psesRepoName}_changelogupdate"

$cloneParams = @{
    OriginRemote = "https://github.com/$TargetFork/$psesRepoName"
    Destination = $cloneLocation
    CheckoutBranch = $branchName
    Clobber = $true
}
Copy-GitRepository @cloneParams

UpdateChangelogFile -NewSection $psesChangelogSection -Path "$cloneLocation/$ChangelogName"

Submit-GitChanges -RepositoryLocation $cloneLocation -File $GalleryFileName -Branch $branchName -Message "Update CHANGELOG for $ReleaseName"

#endregion

#region vscode-PowerShell Changelog

$psesChangelogPostamble = ($psesChangelogSection -split "`n")
$psesChangelogPostamble = $psesChangelogPostamble[2..$psesChangelogPostamble.Length]
$psesChangelogPostamble = $psesChangelogPostamble -join "`n"

$psextChangelogSection = Get-GitCommit -SinceRef $SinceRef -UntilRef $UntilRef -GitHubToken $GitHubToken -RepositoryPath $PSExtensionRepositoryPath |
    Get-ChangeInfoFromCommit -GitHubToken $GitHubToken |
    Skip-IgnoredChange @ignore |
    New-ChangelogEntry @clEntryParams |
    New-ChangelogSection @clSectionParams -Preamble "#### [$vscodeRepoName](https://github.com/$Organization/$vscodeRepoName)" -Postamble $psesChangelogPostamble

$cloneLocation = Join-Path ([System.IO.Path]::GetTempPath()) "${vscodeRepoName}_changelogupdate"

$cloneParams = @{
    OriginRemote = "https://github.com/$TargetFork/$vscodeRepoName"
    Destination = $cloneLocation
    CheckoutBranch = $branchName
    Clobber = $true
}
Copy-GitRepository @cloneParams

UpdateChangelogFile -NewSection $psextChangelogSection -Path "$cloneLocation/$ChangelogName"

Submit-GitChanges -RepositoryLocation $cloneLocation -File $GalleryFileName -Branch $branchName -Message "Update CHANGELOG for $ReleaseName"

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
New-GitHubPR @prParams

# vscode-PowerShell PR
$prParams = @{
    Organization = $TargetFork
    Repository = $vscodeRepoName
    Branch = $branchName
    Title = "Update CHANGELOG for $ReleaseName"
    GitHubToken = $GitHubToken
    FromOrg = $FromFork
}
New-GitHubPR @prParams

#endregion PRs
