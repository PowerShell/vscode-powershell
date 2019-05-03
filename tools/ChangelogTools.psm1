# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

using module ./GitHubTools.psm1

$script:NoThanks = @(
    'rjmholt'
    'TylerLeonhardt'
    'daxian-dbw'
    'SteveL-MSFT'
    'PaulHigin'
)

class ChangelogItem
{
    [GitHubCommitInfo]$Commit
    [GitHubPR]$PR
    [GitHubIssue[]]$ClosedIssues
    [int]$IssueNumber = -1
    [int]$PRNumber = -1
    [string]$ContributingUser
}

filter Get-ChangelogItemFromCommit
{
    param(
        [Parameter(Mandatory, ValueFromPipeline, Position=0)]
        [GitHubCommitInfo[]]
        $Commit,

        [Parameter(Mandatory)]
        [string]
        $GitHubToken,

        [Parameter()]
        [hashtable]
        $KnownUserEmails
    )

    foreach ($singleCommit in $Commit)
    {
        $changelogItem = [ChangelogItem]@{
            Commit = $singleCommit
            BodyText = $singleCommit.Body
            ChangeLabels = $singleCommit.CommitLabels
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
                $changelogItem.Labels += ($closedIssueInfos | ForEach-Object { $_.Labels })
            }
        }

        $changelogItem
    }
}

function New-ChangelogSection
{
    param(
        [Parameter(Mandatory)]
        [string]
        $ReleaseName,

        [Parameter(Mandatory)]
        [string]
        $RepositoryUrl,

        [Parameter(ValueFromPipeline)]
        [ChangelogItem[]]
        $ChangelogItem,

        [Parameter()]
        [string]
        $DateFormat = 'dddd, dd MMMM yyyy',

        [Parameter()]
        [datetime]
        $Date = ([datetime]::Now)
    )

    begin
    {
        $repoDetails = GetHumanishRepositoryDetails -RemoteUrl $RepositoryUrl
        $repository = $repoDetails.Repository
        $organization = $repoDetails.Organization

        $clBuilder = [System.Text.StringBuilder]::new()
        $null = $clBuilder.Append("##$ReleaseName`n")
        $null = $clBuilder.Append("###$($Date.ToString($DateFormat))`n")
        $null = $clBuilder.Append("####[$repository]($RepositoryUrl)`n`n")
    }

    process
    {
        foreach ($clItem in $ChangelogItem)
        {
            if ($clItem.Labels -contains 'ignore')
            {
                continue
            }

            if (-not $clItem.BodyText)
            {
                continue
            }

            if ($clItem.IssueNumber -gt 0)
            {
                $issueNumber = $clItem.IssueNumber
            }
            elseif ($clItem.PRNumber -gt 0)
            {
                $issueNumber = $clItem.PRNumber
            }

            if ($issueNumber)
            {
                $itemHeader = "$repository #$issueNumber"
            }
            else
            {
                $itemHeader = "$repository"
            }

            $itemLink = "https://github.com/$organization/$repository"
            if ($clItem.PRNumber -ge 0)
            {
                $prNum = $clItem.PRNumber
                $itemLink += "/pull/$prNum"
            }

            $indentedBody = ($clItem.BodyText.Split("`n") | Where-Object { $_ } | ForEach-Object { "  $_" }) -join "`n"

            if ($script:NoThanks -notcontains $clItem.ContributingUser)
            {
                $thanks = " (thanks @$($clItem.ContributingUser)!)"
            }

            $itemText = "- [$itemHeader]($itemLink) -`n$indentedBody$thanks`n"

            $null = $clBuilder.Append($itemText)
        }
    }

    end
    {
        return $clBuilder.Append("`n").ToString()
    }
}