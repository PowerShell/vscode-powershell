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
    $Repository = 'vscode-powershell',

    [Parameter()]
    [string]
    $TargetFork = $Organization,

    [Parameter()]
    [string]
    $FromForm = 'rjmholt',

    [Parameter()]
    [string]
    $Preamble = "#### [$Repository](https://github.com/$Organization/$Repository)",

    [Parameter()]
    [string]
    $Postamble,

    [Parameter()]
    [string]
    $RepositoryPath
)

$dateFormat = 'dddd, MMMM dd yyyy'

$ignore = @{
    Users = 'dependabot[bot]'
    Labels = @{
        Commit = 'Ignore'
    }
}

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

$clEntryParams = @{
    Organization = $Organization
    Repository = $Repository
    EntryCategories = $categories
    DefaultCategory = @{
        Name = $defaultCategory
        Issue = $categories[$defaultCategory].Issue
    }
    TagLabels = @{
        'Issue-Enhancement' = 'Feature'
        'Issue-Bug' = 'BugFix'
    }
    NoThanks = @(
        'rjmholt'
        'TylerLeonhardt'
        'daxian-dbw'
        'SteveL-MSFT'
        'PaulHigin'
    )
}

$clSectionParams = @{
    Categories = $categories.Keys
    DefaultCategory = $defaultCategory
    ReleaseName = $ReleaseName
    Preamble = $Preamble
    Postamble = $Postamble
    DateFormat = $dateFormat
}

$newChangelogSection = Get-GitCommit -SinceRef $SinceRef -UntilRef $UntilRef -GitHubToken $GitHubToken -RepositoryPath $RepositoryPath |
    Get-ChangeInfoFromCommit -GitHubToken $GitHubToken |
    Skip-IgnoredChanges -IgnoreUser $ignore.Users -IgnoreCommitLabel $ignore.Labels.Commit |
    New-ChangelogEntry @clEntryParams |
    New-ChangelogSection @clSectionParams

$repoLocation = Join-Path ([System.IO.Path]::GetTempPath()) "${Repository}_changelogupdate"
$branchName = "changelog-$ReleaseName"

$cloneParams = @{
    OriginRemote = "https://github.com/$TargetFork/$Repository"
    Destination = $repoLocation
    CheckoutBranch = $branchName
    Clobber = $true
}
Copy-GitRepository @cloneParams

#UpdateGalleryFile -ExtensionVersion $ExtensionVersion -GalleryFilePath "$repoLocation/$GalleryFileName"

Submit-GitChanges -RepositoryLocation $repoLocation -File $GalleryFileName -Branch $branchName -Message "Update PS extension to v$ExtensionVersion"

$prParams = @{
    Organization = $TargetFork
    Repository = $Repository
    Branch = $branchName
    Title = "Update CHANGELOG for $ReleaseName"
    GitHubToken = $GitHubToken
    FromOrg = 'rjmholt'
}
New-GitHubPR @prParams
