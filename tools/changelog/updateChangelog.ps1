# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

#requires -Version 6.0

using module ..\GitHubTools.psm1
using module ..\ChangelogTools.psm1

<#
.EXAMPLE
.\updateChangelog.ps1 -GitHubToken $ghTok -PSExtensionSinceRef v2019.5.0 -PsesSinceRef v2.0.0-preview.4 -PSExtensionVersion 2019.9.0 -PsesVersion 2.0.0-preview.5 -PSExtensionUntilRef master -PsesUntilRef master -Verbose
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]
    $GitHubToken,

    [Parameter(Mandatory)]
    [string]
    $PSExtensionSinceRef,

    [Parameter(Mandatory)]
    [string]
    $PsesSinceRef,

    [Parameter()]
    [version]
    $PSExtensionVersion, # Default from package.json

    [Parameter()]
    [semver]
    $PsesVersion, # Default from PowerShellEditorServices.Common.props

    [Parameter()]
    [string]
    $PSExtensionReleaseName, # Default from $PSExtensionVersion

    [Parameter()]
    [string]
    $PsesReleaseName, # Default from $PsesVersion

    [Parameter()]
    [string]
    $PSExtensionUntilRef = 'HEAD',

    [Parameter()]
    [string]
    $PsesUntilRef = 'HEAD',

    [Parameter()]
    [string]
    $PSExtensionBaseBranch, # Default is master if HEAD, otherwise $PSExtensionSinceRef

    [Parameter()]
    [string]
    $PsesBaseBranch, # Default is master if HEAD, otherwise $PsesSinceRef

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

$packageJson = Get-Content -Raw "$PSExtensionRepositoryPath/package.json" | ConvertFrom-Json
$extensionName = $packageJson.name
if (-not $PSExtensionVersion)
{
    $PSExtensionVersion = $packageJson.version
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

if (-not $PSExtensionBaseBranch)
{
    $PSExtensionBaseBranch = if ($PSExtensionUntilRef -eq 'HEAD')
    {
        'master'
    }
    else
    {
        $PSExtensionUntilRef
    }
}

if (-not $PsesBaseBranch)
{
    $PsesBaseBranch = if ($PsesUntilRef -eq 'HEAD')
    {
        'master'
    }
    else
    {
        $PsesUntilRef
    }
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

$branchName = "changelog-$PSExtensionReleaseName"

#endregion Configuration

#region PSES Changelog

$psesGetCommitParams = @{
    SinceRef = $PsesSinceRef
    UntilRef = $PsesUntilRef
    GitHubToken = $GitHubToken
    RepositoryPath = $PsesRepositoryPath
    Verbose = $VerbosePreference
}

$clEntryParams = @{
    EntryCategories = $categories
    DefaultCategory = $defaultCategory
    TagLabels = @{
        'Issue-Enhancement' = '✨'
        'Issue-Bug' = '🐛'
        'Issue-Performance' = '⚡️'
        'Area-Build & Release' = '👷'
        'Area-Code Formatting' = '💎'
        'Area-Configuration' = '🔧'
        'Area-Debugging' = '🔍'
        'Area-Documentation' = '📖'
        'Area-Engine' = '🚂'
        'Area-Folding' = '📚'
        'Area-Integrated Console' = '📟'
        'Area-IntelliSense' = '🧠'
        'Area-Logging' = '💭'
        'Area-Pester' = '🐢'
        'Area-Script Analysis' = '👮‍'
        'Area-Snippets' = '✂️'
        'Area-Startup' = '🛫'
        'Area-Symbols & References' = '🔗'
        'Area-Tasks' = '✅'
        'Area-Test' = '🚨'
        'Area-Threading' = '⏱️'
        'Area-UI' = '📺'
        'Area-Workspaces' = '📁'
    }
    NoThanks = $noThanks
    Verbose = $VerbosePreference
}

$clSectionParams = @{
    Categories = $categories.Keys
    DefaultCategory = $defaultCategory
    DateFormat = $dateFormat
    Verbose = $VerbosePreference
}

Write-Verbose "Creating PSES changelog"

$psesChangelogSection = Get-GitCommit @psesGetCommitParams |
    Get-ChangeInfoFromCommit -GitHubToken $GitHubToken -Verbose:$VerbosePreference |
    Skip-IgnoredChange @ignore -Verbose:$VerbosePreference |
    New-ChangelogEntry @clEntryParams |
    New-ChangelogSection @clSectionParams -ReleaseName $PsesReleaseName

Write-Host "PSES CHANGELOG:`n`n$psesChangelogSection`n`n"

#endregion PSES Changelog

#region vscode-PowerShell Changelog
$psesChangelogPostamble = $psesChangelogSection -split "`n"
$psesChangelogPostamble = @("#### [$psesRepoName](https://github.com/$Organization/$psesRepoName)") + $psesChangelogPostamble[2..($psesChangelogPostamble.Length-3)]
$psesChangelogPostamble = $psesChangelogPostamble -join "`n"

$psExtGetCommitParams = @{
    SinceRef = $PSExtensionSinceRef
    UntilRef = $PSExtensionUntilRef
    GitHubToken = $GitHubToken
    RepositoryPath = $PSExtensionRepositoryPath
    Verbose = $VerbosePreference
}
$psextChangelogSection = Get-GitCommit @psExtGetCommitParams |
    Get-ChangeInfoFromCommit -GitHubToken $GitHubToken -Verbose:$VerbosePreference |
    Skip-IgnoredChange @ignore -Verbose:$VerbosePreference |
    New-ChangelogEntry @clEntryParams |
    New-ChangelogSection @clSectionParams -Preamble "#### [$vscodeRepoName](https://github.com/$Organization/$vscodeRepoName)" -Postamble $psesChangelogPostamble -ReleaseName $PSExtensionReleaseName

Write-Host "vscode-PowerShell CHANGELOG:`n`n$psextChangelogSection`n`n"

#endregion vscode-PowerShell Changelog

#region PRs

# PSES PR
$cloneLocation = Join-Path ([System.IO.Path]::GetTempPath()) "${psesRepoName}_changelogupdate"

$cloneParams = @{
    OriginRemote = "https://github.com/$FromFork/$psesRepoName"
    Destination = $cloneLocation
    CheckoutBranch = $branchName
    CloneBranch = $PsesBaseBranch
    Clobber = $true
    Remotes = @{ 'upstream' = "https://github.com/$TargetFork/$vscodeRepoName" }
}
Copy-GitRepository @cloneParams -Verbose:$VerbosePreference

UpdateChangelogFile -NewSection $psesChangelogSection -Path "$cloneLocation/$ChangelogName"

Submit-GitChanges -RepositoryLocation $cloneLocation -File $GalleryFileName -Branch $branchName -Message "Update CHANGELOG for $PsesReleaseName" -Verbose:$VerbosePreference

$prParams = @{
    Organization = $TargetFork
    Repository = $psesRepoName
    Branch = $branchName
    Title = "Update CHANGELOG for $PsesReleaseName"
    GitHubToken = $GitHubToken
    FromOrg = $FromFork
    TargetBranch = $PsesBaseBranch
}
New-GitHubPR @prParams -Verbose:$VerbosePreference

# vscode-PowerShell PR
$cloneLocation = Join-Path ([System.IO.Path]::GetTempPath()) "${vscodeRepoName}_changelogupdate"

$cloneParams = @{
    OriginRemote = "https://github.com/$FromFork/$vscodeRepoName"
    Destination = $cloneLocation
    CheckoutBranch = $branchName
    CloneBranch = $PSExtensionBaseBranch
    Clobber = $true
    Remotes = @{ 'upstream' = "https://github.com/$TargetFork/$vscodeRepoName" }
    PullUpstream = $true
}
Copy-GitRepository @cloneParams -Verbose:$VerbosePreference

UpdateChangelogFile -NewSection $psextChangelogSection -Path "$cloneLocation/$ChangelogName"

Submit-GitChanges -RepositoryLocation $cloneLocation -File $GalleryFileName -Branch $branchName -Message "Update CHANGELOG for $PSExtensionReleaseName" -Verbose:$VerbosePreference

$prParams = @{
    Organization = $TargetFork
    Repository = $vscodeRepoName
    Branch = $branchName
    Title = "Update $extensionName CHANGELOG for $PSExtensionReleaseName"
    GitHubToken = $GitHubToken
    FromOrg = $FromFork
    TargetBranch = $PSExtensionBaseBranch
}
New-GitHubPR @prParams -Verbose:$VerbosePreference

#endregion PRs
