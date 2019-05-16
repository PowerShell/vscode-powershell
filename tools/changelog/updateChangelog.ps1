# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

#requires -Version 6.0

using module ../ChangelogTools.psm1
using module ../GitHubTools.psm1

param(
    [Parameter(Mandatory)]
    [string]
    $GitHubToken,

    [Parameter(Mandatory)]
    [string]
    $SinceRef,

    [Parameter()]
    [string]
    $UntilRef = 'HEAD',

    [Parameter()]
    [string]
    $RepositoryLocation = (Resolve-Path "$PSScriptRoot/../../")
)

class ChangelogEntry
{
    [uri]$IssueLink
    [uri]$PRLink
    [string]$Category
    [string[]]$Tags
    [string]$Text
    [string]$Thanks
    [ChangelogItem]$CLItem
}

class ChangeLog
{
    ChangeLog()
    {
        $this.Sections = [System.Collections.Generic.Dictionary[string, ChangelogEntry]]::new()
    }

    [string]$ReleaseName
    [datetime]$Date
    [string]$Preamble
    [System.Collections.Generic.Dictionary[string, ChangelogEntry]]$Sections
}

$script:ChangelogConfig = @{
    DateFormat = 'dddd, dd MMMM yyyy'
    NoThanks = @(
        'rjmholt'
        'TylerLeonhardt'
        'daxian-dbw'
        'SteveL-MSFT'
        'PaulHigin'
    )
    Ignore = @{
        Users = 'dependabot[bot]'
        Labels = @{
            Commit = 'Ignore'
        }
    }
    TagLabels = @{
        'Issue-Enhancement' = 'Feature'
        'Issue-Bug' = 'BugFix'
    }
    ChangeCategories = @{
        Default = @{
            Name = 'General'
            Issue = 'Area-General'
        }
        Categories = [ordered]@{
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
            'Intellisense' = @{
                Issue = 'Area-Intellisense'
            }
        }
    }
}

filter FilterIgnoredCommits
{
    param(
        [Parameter(Mandatory, ValueFromPipeline)]
        [ChangelogItem]
        $CLItem,

        [Parameter]
        [string[]]
        $IgnoreUser,

        [Parameter()]
        [string[]]
        $IgnoreCommitLabel
    )

    if ($CLItem.ContributingUser -in $IgnoreUser)
    {
        return
    }

    foreach ($commitLabel in $CLItem.Commit.CommitLabels)
    {
        if ($commitLabel -in $IgnoreCommitLabel)
        {
            return
        }
    }

    return $CLItem
}

filter AssembleCLEntry
{
    param(
        [Parameter(Mandatory, ValueFromPipeline)]
        [ChangelogItem]
        $CLItem,

        [Parameter()]
        [string]
        $Organization = 'PowerShell',

        [Parameter()]
        [string]
        $Repository = 'vscode-powershell'
    )

    [string[]]$tags = @()
    :labelLoop foreach ($issueLabel in $CLItem.ClosedIssues.Labels)
    {
        if (-not $entryCategory)
        {
            foreach ($category in $script:ChangelogConfig.ChangeCategories.Categories.GetEnumerator())
            {
                if ($issueLabel -in $category.Value.Issue)
                {
                    $entryCategory = $category.Key
                    continue :labelLoop
                }
            }
        }

        $tag = $script:ChangelogConfig.TagLabels[$issueLabel]
        if ($tag)
        {
            $tags += $tag
        }
    }

    if (-not $entryCategory)
    {
        $entryCategory = $script:ChangelogConfig.ChangeCategories.Default.Name
    }

    return [ChangelogEntry]@{
        IssueLink = if ($CLItem.IssueNumber -ge 0) { "https://github.com/$Organization/$Repository/issues/$($CLItem.IssueNumber)" }
        PRLink = if ($CLItem.PRNumber -ge 0) { "https://github.com/$Organization/$Repository/$($CLItem.PRNumber)" }
        Thanks = if ($CLItem.ContributingUser -notin $script:NoThanks) { $CLItem.ContributingUser }
        Category = $entryCategory
        Tags = $tags
        CLItem = $CLItem
    }
}

function AssembleCLObject
{

}

function BuildChangelog
{

}

$changeLog = Get-GitCommit -SinceRef $SinceRef -UntilRef $UntilRef -GitHubToken $GitHubToken |
    Get-ChangelogItemFromCommit -GitHubToken $GitHubToken |
    FilterIgnoredCommits -IgnoreUser $ignore.Users -IgnoreCommitLabel $ignore.Labels.Commit |
    AssembleCLEntry