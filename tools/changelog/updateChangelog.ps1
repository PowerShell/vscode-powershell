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
    $FromFork = 'rjmholt',

    [Parameter()]
    [string]
    $ChangelogName = 'CHANGELOG.md',

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
        'Issue-Enhancement' = '✨'
        'Issue-Bug' = '🐛'
    }
    NoThanks = @(
        'rjmholt'
        'TylerLeonhardt'
        'daxian-dbw'
        'SteveL-MSFT'
        'PaulHigin'
    )
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

    $changelogLines = Get-Content -Path $Path
    $newContent = ($changelogLines[0..1] -join "`n`n") + $NewSection + ($changelogLines[2..$changelogLines.Length] -join "`n")
    Set-Content -Encoding utf8NoBOM -Value $newContent -Path $Path
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

UpdateChangelogFile -NewSection $newChangelogSection -Path "$repoLocation/$ChangelogName"

Submit-GitChanges -RepositoryLocation $repoLocation -File $GalleryFileName -Branch $branchName -Message "Update CHANGELOG for $ReleaseName"

$prParams = @{
    Organization = $TargetFork
    Repository = $Repository
    Branch = $branchName
    Title = "Update CHANGELOG for $ReleaseName"
    GitHubToken = $GitHubToken
    FromOrg = $FromFork
}
New-GitHubPR @prParams
