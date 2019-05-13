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
        $GitHubToken
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

Export-ModuleMember -Function Get-ChangelogItemFromCommit