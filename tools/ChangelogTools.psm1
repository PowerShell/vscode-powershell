# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

#requires -Version 6.0

using module .\GitHubTools.psm1

class IgnoreConfiguration
{
    [string[]]$User
    [string[]]$IssueLabel
    [string[]]$PRLabel
    [string[]]$CommitLabel
}

class ChangeInfo
{
    [GitHubCommitInfo]$Commit
    [GitHubPR]$PR
    [GitHubIssue[]]$ClosedIssues
    [int]$IssueNumber = -1
    [int]$PRNumber = -1
    [string]$ContributingUser
    [string]$BodyText
    [string]$Subject
}

class ChangelogEntry
{
    [uri]$IssueLink
    [uri]$PRLink
    [string]$Category
    [string[]]$Tags
    [string]$BodyText
    [string]$Subject
    [string]$Thanks
    [string]$RepositoryName
    [ChangeInfo]$Change
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

filter Get-ChangeInfoFromCommit
{
    [OutputType([ChangeInfo])]
    param(
        [Parameter(Mandatory, ValueFromPipeline, Position=0)]
        [GitHubCommitInfo[]]
        $Commit,

        [Parameter(Mandatory)]
        [string]
        $GitHubToken
    )

    foreach ($singleCommit in $Commit)
    {
        Write-Verbose "Getting change information for commit $($Commit.Hash)"

        $changelogItem = [ChangeInfo]@{
            Commit = $singleCommit
            BodyText = $singleCommit.Body
            Subject = $singleCommit.Subject
            ContributingUser = $singleCommit.GitHubCommitData.author.login
        }

        if ($Commit.PRNumber -ge 0)
        {
            $getPrParams = @{
                Organization = $singleCommit.Organization
                Repository = $singleCommit.Repository
                PullNumber = $singleCommit.PRNumber
                GitHubToken = $GitHubToken
            }
            $pr = Get-GitHubPR @getPrParams

            $changelogItem.PR = $pr
            $changelogItem.PRNumber = $pr.Number

            $closedIssueInfos = $pr.GetClosedIssueInfos()
            if ($closedIssueInfos)
            {
                $changelogItem.ClosedIssues = $closedIssueInfos | Get-GitHubIssue
                $changelogItem.IssueNumber = $closedIssueInfos[0].Number
            }
        }

        $changelogItem
    }
}

filter New-ChangelogEntry
{
    [OutputType([ChangelogEntry])]
    param(
        [Parameter(Mandatory, ValueFromPipeline)]
        [ChangeInfo]
        $Change,

        [Parameter(Mandatory)]
        [System.Collections.Specialized.OrderedDictionary]
        $EntryCategories,

        [Parameter(Mandatory)]
        [string]
        $DefaultCategory,

        [Parameter(Mandatory)]
        [hashtable]
        $TagLabels,

        [Parameter()]
        [string[]]
        $NoThanks = @()
    )

    [string[]]$tags = @()
    :labelLoop foreach ($issueLabel in $Change.ClosedIssues.Labels)
    {
        if (-not $entryCategory)
        {
            foreach ($category in $EntryCategories.GetEnumerator())
            {
                if ($issueLabel -in $category.Value.Issue)
                {
                    $entryCategory = $category.Key
                    continue :labelLoop
                }
            }
        }

        $tag = $TagLabels[$issueLabel]
        if ($tag)
        {
            $tags += $tag
        }
    }

    if (-not $entryCategory)
    {
        $entryCategory = $DefaultCategory
    }

    $organization = $Change.Commit.Organization
    $repository = $Change.Commit.Repository

    $issueLink = if ($Change.IssueNumber -ge 0) { $Change.ClosedIssues[0].GetHtmlUri() } else { $null }
    $prLink = if ($Change.PRNumber -ge 0) { "https://github.com/$organization/$repository/pull/$($Change.PRNumber)" } else { $null }
    $thanks = if ($Change.ContributingUser -notin $NoThanks) { $Change.ContributingUser } else { $null }

    $subject = $Change.Subject
    if ($subject -match '(.*)\(#\d+\)$')
    {
        $subject = $Matches[1]
    }

    Write-Verbose "Assembled changelog entry for commit $($Change.Commit.Hash)"

    return [ChangelogEntry]@{
        IssueLink = $issueLink
        PRLink = $prLink
        Thanks = $thanks
        Category = $entryCategory
        Tags = $tags
        Change = $Change
        RepositoryName = "$organization/$repository"
        BodyText = $Change.BodyText
        Subject = $subject
    }
}

function New-ChangeLogSection
{
    [OutputType([string])]
    param(
        [Parameter(Mandatory, ValueFromPipeline)]
        [ChangelogEntry[]]
        $ChangelogEntry,

        [Parameter(Mandatory)]
        [string]
        $ReleaseName,

        [Parameter(Mandatory)]
        [string[]]
        $Categories,

        [Parameter(Mandatory)]
        [string]
        $DefaultCategory,

        [Parameter()]
        [string]
        $Preamble,

        [Parameter()]
        [string]
        $Postamble,

        [Parameter()]
        [datetime]
        $Date = [datetime]::Now,

        [Parameter()]
        [ValidateNotNullOrEmpty()]
        [string]
        $DateFormat = 'dddd, dd MM yyyy',

        [Parameter()]
        [string]
        $Indent = '  '
    )

    begin
    {
        $entries = [ordered]@{}

        foreach ($category in $Categories)
        {
            $entries[$category] = [System.Collections.Generic.List[ChangelogEntry]]::new()
        }
    }

    process
    {
        foreach ($entry in $ChangelogEntry)
        {
            $entries[$entry.Category].Add($entry)
        }
    }

    end
    {
        $dateStr = $Date.ToString($DateFormat)
        $sb = [System.Text.StringBuilder]::new().AppendLine("## $ReleaseName").AppendLine("### $dateStr")

        if ($Preamble)
        {
            [void]$sb.AppendLine($Preamble)
        }

        [void]$sb.AppendLine()

        foreach ($category in $entries.GetEnumerator())
        {
            if (-not $category.Value)
            {
                continue
            }

            if ($category.Key -ne $DefaultCategory)
            {
                [void]$sb.AppendLine("$($category.Key):")
            }

            foreach ($item in $category.Value)
            {
                # Set up the pieces needed for a changelog entry
                $link = if ($item.PRLink) { $item.PRLink } else { $org = $item.Change.Commit.Organization; "https://github.com/$org/$project" }
                $thanks = $item.Thanks

                if ($item.Change.IssueNumber -ge 0)
                {
                    $project = $item.Change.ClosedIssues[0].Repository
                    $issueNumber = $item.Change.IssueNumber
                }
                elseif ($item.Change.PRNumber -ge 0)
                {
                    $project = $item.Change.PR.Repository
                    $issueNumber = $item.Change.PRNumber
                }

                # Add the list bullet
                [void]$sb.Append('- ')

                # Start with the tags
                if ($item.Tags)
                {
                    [void]$sb.Append(($item.Tags -join ' ')).Append(' ')
                }

                # Create a header for the change if there is an issue number
                if ($issueNumber)
                {
                    [void]$sb.AppendLine("[$project #$issueNumber]($link) -").Append($Indent)
                }

                [void]$sb.Append($item.Subject)
                if ($thanks)
                {
                    [void]$sb.Append(" (Thanks @$thanks!)")
                }
                [void]$sb.AppendLine()
            }
        }

        if ($Postamble)
        {
            [void]$sb.AppendLine().AppendLine($Postamble)
        }

        [void]$sb.AppendLine()

        return $sb.ToString()
    }
}

filter Skip-IgnoredChange
{
    param(
        [Parameter(Mandatory, ValueFromPipeline)]
        [ChangeInfo[]]
        $Change,

        [Parameter()]
        [string]
        $User,

        [Parameter()]
        [string]
        $CommitLabel,

        [Parameter()]
        [string[]]
        $IssueLabel,

        [Parameter()]
        [string[]]
        $PRLabel
    )

    :outer foreach ($chg in $Change)
    {
        $msg = $chg.Subject
        if ($chg.ContributingUser -in $User)
        {
            $u = $chg.ContributingUser
            Write-Verbose "Skipping change from user '$u': '$msg'"
            continue
        }

        foreach ($chgCommitLabel in $chg.Commit.CommitLabels)
        {
            if ($chgCommitLabel -in $CommitLabel)
            {
                Write-Verbose "Skipping change with commit label '$chgCommitLabel': '$msg'"
                continue outer
            }
        }

        foreach ($chgIssueLabel in $chg.ClosedIssues.Labels)
        {
            if ($chgIssueLabel -in $IssueLabel)
            {
                Write-Verbose "Skipping change with issue label '$chgIssueLabel': '$msg'"
                continue outer
            }
        }

        foreach ($chgPRLabel in $chg.PR.Labels)
        {
            if ($chgPRLabel -in $PRLabel)
            {
                Write-Verbose "Skipping change with PR label '$chgPRLabel': '$msg'"
                continue outer
            }
        }

        # Yield the change
        $chg
    }
}

Export-ModuleMember -Function Get-ChangeInfoFromCommit,New-ChangelogEntry,New-ChangelogSection,Skip-IgnoredChange
