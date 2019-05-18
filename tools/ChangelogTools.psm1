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
    param(
        [Parameter(Mandatory, ValueFromPipeline)]
        [ChangeInfo]
        $Change,

        [Parameter(Mandatory)]
        [System.Collections.Specialized.OrderedDictionary]
        $EntryCategories,

        [Parameter(Mandatory)]
        [hashtable]
        $DefaultCategory,

        [Parameter(Mandatory)]
        [hashtable]
        $TagLabels,

        [Parameter()]
        [string[]]
        $NoThanks = @(),

        [Parameter()]
        [string]
        $Organization = 'PowerShell',

        [Parameter()]
        [string]
        $Repository = 'vscode-powershell'
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
        $entryCategory = $DefaultCategory.Name
    }

    $issueLink = if ($Change.IssueNumber -ge 0) { "https://github.com/$Organization/$Repository/issues/$($Change.IssueNumber)" } else { $null }
    $prLink = if ($Change.PRNumber -ge 0) { "https://github.com/$Organization/$Repository/$($Change.PRNumber)" } else { $null }
    $thanks = if ($Change.ContributingUser -notin $NoThanks) { $Change.ContributingUser } else { $null }

    $subject = $Change.Subject
    if ($subject -match '(.*)\(#\d+\)$')
    {
        $subject = $Matches[1]
    }

    return [ChangelogEntry]@{
        IssueLink = $issueLink
        PRLink = $prLink
        Thanks = $thanks
        Category = $entryCategory
        Tags = $tags
        Change = $Change
        RepositoryName = "$Organization/$Repository"
        BodyText = $Change.BodyText
        Subject = $subject
    }
}

filter Skip-IgnoredChanges
{
    param(
        [Parameter(Mandatory, ValueFromPipeline)]
        [ChangeInfo]
        $Change,

        [Parameter()]
        [string[]]
        $User,

        [Parameter()]
        [string[]]
        $CommitLabel,

        [Parameter()]
        [string[]]
        $IssueLabel,

        [Parameter()]
        [string[]]
        $PRLabel
    )

    if ($Change.ContributingUser -in $User)
    {
        return
    }

    foreach ($changeCommitLabel in $Change.Commit.CommitLabels)
    {
        if ($changeCommitLabel -in $CommitLabel)
        {
            return
        }
    }

    foreach ($changeIssueLabel in $Change.Commit.IssueLabels)
    {
        if ($changeIssueLabel -in $IssueLabel)
        {
            return
        }
    }

    foreach ($changePRLabel in $Change.Commit.PRLabels)
    {
        if ()
    }


    return $Change
}

function New-ChangeLogSection
{
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
                $project = $item.Change.Commit.Repository
                $link = if ($item.PRLink) { $item.PRLink } else { $org = $item.Change.Commit.Organization; "https://github.com/$org/$project" }
                $thanks = $item.Thanks

                $issueNumber = if ($item.Change.IssueNumber -ge 0)
                {
                    $item.Change.IssueNumber
                }
                elseif ($item.Change.PRNumber -ge 0)
                {
                    $item.Change.PRNumber
                }
                else
                {
                    $null
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

function New-ChangelogRelease
{
    param(
        [Parameter(Mandatory)]
        [string]
        $GitHubToken,

        [Parameter(Mandatory)]
        [string]
        $RepositoryPath,

        [Parameter(Mandatory)]
        [string]
        $SinceRef,

        [Parameter()]
        [string]
        $UntilRef = 'HEAD',

        [Parameter()]
        [IgnoreConfiguration]
        $Ignore
    )
}

Export-ModuleMember -Function Get-ChangeInfoFromCommit,New-ChangelogEntry,Skip-IgnoredChanges,New-ChangeLogSection
