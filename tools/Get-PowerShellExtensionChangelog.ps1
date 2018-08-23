# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

##############################
#.SYNOPSIS
#Generate the draft change log of the PowerShell Extension for VSCode
#
#.PARAMETER LastReleaseTag
#The last release tag
#
#.PARAMETER Token
#The authentication token to use for retrieving the GitHub user log-in names for external contributors. Get it from:
# https://github.com/settings/tokens
#
#.PARAMETER NewReleaseTag
#The github tag that will be associated with the next release
#
#.PARAMETER HasCherryPick
#Indicate whether there are any commits in the last release branch that were cherry-picked from the master branch
#
#.OUTPUTS
#The generated change log draft of vscode-powershell AND PowerShellEditorServices
#
#.NOTES
#Run from the path to /vscode-powershell
#
#.EXAMPLE
#
# .\tools\Get-PowerShellExtensionChangelog.ps1 -LastReleaseTag v1.7.0 -Token $TOKENSTR -NewReleaseTag v1.8.0
#
##############################
param(
        [Parameter(Mandatory)]
        [string]$LastReleaseTag,

        [Parameter(Mandatory)]
        [string]$Token,

        [Parameter(Mandatory)]
        [string]$NewReleaseTag,

        [Parameter()]
        [switch]$HasCherryPick
    )

# These powershell team members don't use 'microsoft.com' for Github email or choose to not show their emails.
# We have their names in this array so that we don't need to query Github to find out if they are powershell team members.
$Script:powershell_team = @(
    "Robert Holt"
    "Tyler Leonhardt"
)

$Script:powershell_team_emails = @(
    "tylerl0706@gmail.com"
    "rjmholt@gmail.com"
)

# Very active contributors; keep their email-login mappings here to save a few queries to Github.
$Script:community_login_map = @{}

class CommitNode {
    [string] $Hash
    [string[]] $Parents
    [string] $AuthorName
    [string] $AuthorGitHubLogin
    [string] $AuthorEmail
    [string] $Subject
    [string] $Body
    [string] $PullRequest
    [string] $ChangeLogMessage
    [bool] $IsBreakingChange

    CommitNode($hash, $parents, $name, $email, $subject, $body) {
        $this.Hash = $hash
        $this.Parents = $parents
        $this.AuthorName = $name
        $this.AuthorEmail = $email
        $this.Subject = $subject
        $this.Body = $body
        $this.IsBreakingChange = $body -match "\[breaking change\]"

        if ($subject -match "\(#(\d+)\)") {
            $this.PullRequest = $Matches[1]
        }
    }
}

##############################
#.SYNOPSIS
#In the release workflow, the release branch will be merged back to master after the release is done,
#and a merge commit will be created as the child of the release tag commit.
#This cmdlet takes a release tag or the corresponding commit hash, find its child merge commit, and
#return its metadata in this format: <merge-commit-hash>|<parent-commit-hashes>
#
#.PARAMETER LastReleaseTag
#The last release tag
#
#.PARAMETER CommitHash
#The commit hash of the last release tag
#
#.OUTPUTS
#Return the metadata of the child merge commit, in this format: <merge-commit-hash>|<parent-commit-hashes>
##############################
function Get-ChildMergeCommit
{
    [CmdletBinding(DefaultParameterSetName="TagName")]
    param(
        [Parameter(Mandatory, ParameterSetName="TagName")]
        [string]$LastReleaseTag,

        [Parameter(Mandatory, ParameterSetName="CommitHash")]
        [string]$CommitHash
    )

    $tag_hash = $CommitHash
    if ($PSCmdlet.ParameterSetName -eq "TagName") { $tag_hash = git rev-parse "$LastReleaseTag^0" }

    ## Get the merge commits that are reachable from 'HEAD' but not from the release tag
    $merge_commits_not_in_release_branch = git --no-pager log "$tag_hash..HEAD" --format='%H||%P'
    ## Find the child merge commit, whose parent-commit-hashes contains the release tag hash
    $child_merge_commit = $merge_commits_not_in_release_branch | Select-String -SimpleMatch $tag_hash
    return $child_merge_commit.Line
}

##############################
#.SYNOPSIS
#Create a CommitNode instance to represent a commit.
#
#.PARAMETER CommitMetadata
#The commit metadata. It's in this format:
#<commit-hash>|<parent-hashes>|<author-name>|<author-email>|<commit-subject>
#
#.PARAMETER CommitMetadata
#The commit metadata, in this format:
#<commit-hash>|<parent-hashes>|<author-name>|<author-email>|<commit-subject>
#
#.OUTPUTS
#Return the 'CommitNode' object
##############################
function New-CommitNode
{
    param(
        [Parameter(ValueFromPipeline)]
        [ValidatePattern("^.+\|.+\|.+\|.+\|.+$")]
        [string]$CommitMetadata
    )

    Process {
        $hash, $parents, $name, $email, $subject = $CommitMetadata.Split("||")
        $body = (git --no-pager show $hash -s --format=%b) -join "`n"
        return [CommitNode]::new($hash, $parents, $name, $email, $subject, $body)
    }
}

function Get-PRNumberFromCommitSubject
{
    param(
        [string]$CommitSubject
    )

    if (-not $CommitSubject)
    {
        return $null
    }

    if (-not ($CommitSubject -match '(.*)\(#(\d+)\)$'))
    {
        return $null
    }

    return @{
        Message = $Matches[1]
        PR = $Matches[2]
    }
}

function New-ChangeLogEntry
{
    param(
        [ValidateNotNullOrEmpty()][string]$RepositoryName,
        [ValidateNotNullOrEmpty()][string]$CommitMessage,
        [int]$PRNumber,
        [string]$UserToThank,
        [switch]$IsBreakingChange
    )

    $repoUrl = "https://github.com/PowerShell/$RepositoryName"

    $entry = if ($PRNumber)
    {
        "- [$RepositoryName #$PRNumber]($repoUrl/pulls/$PRNumber) -"
    }
    else
    {
        "- [$RepositoryName]($repoUrl) -"
    }

    $entry += "`n  "

    if ($IsBreakingChange)
    {
        $entry += "[Breaking Change] "
    }

    $entry += $CommitMessage

    if ($UserToThank)
    {
        $entry += " (Thanks @$UserToThank!)"
    }

    return $entry
}

##############################
#.SYNOPSIS
#Generate the draft change log of the git repo in the current directory
#
#.PARAMETER LastReleaseTag
#The last release tag
#
#.PARAMETER Token
#The authentication token to use for retrieving the GitHub user log-in names for external contributors
#
#.PARAMETER RepoUri
#The uri of the API endpoint. For example: https://api.github.com/repos/PowerShell/vscode-powershell
#
#.PARAMETER HasCherryPick
#Indicate whether there are any commits in the last release branch that were cherry-picked from the master branch
#
#.OUTPUTS
#The generated change log draft.
##############################
function Get-ChangeLog
{
    param(
        [Parameter(Mandatory)]
        [string]$LastReleaseTag,

        [Parameter(Mandatory)]
        [string]$Token,

        [Parameter(Mandatory)]
        [string]$RepoUri,

        [Parameter(Mandatory)]
        [string]$RepoName,

        [Parameter()]
        [switch]$HasCherryPick
    )

    $tag_hash = git rev-parse "$LastReleaseTag^0"
    $format = '%H||%P||%aN||%aE||%s'
    $header = @{"Authorization"="token $Token"}

    # Find the merge commit that merged the release branch to master.
    $child_merge_commit = Get-ChildMergeCommit -CommitHash $tag_hash
    $commit_hash, $parent_hashes = $child_merge_commit.Split("||")
    # Find the other parent of the merge commit, which represents the original head of master right before merging.
    $other_parent_hash = ($parent_hashes.Trim() -replace $tag_hash).Trim()

    if ($HasCherryPick) {
        ## Sometimes we need to cherry-pick some commits from the master branch to the release branch during the release,
        ## and eventually merge the release branch back to the master branch. This will result in different commit nodes
        ## in master branch that actually represent same set of changes.
        ##
        ## In this case, we cannot simply use the revision range "$tag_hash..HEAD" becuase it will include the original
        ## commits in the master branch that were cherry-picked to the release branch -- they are reachable from 'HEAD'
        ## but not reachable from the last release tag. Instead, we need to exclude the commits that were cherry-picked,
        ## and only include the commits that are not in the last release into the change log.

        # Find the commits that were only in the orginal master, excluding those that were cherry-picked to release branch.
        $new_commits_from_other_parent = git --no-pager log --first-parent --cherry-pick --right-only "$tag_hash...$other_parent_hash" --format=$format | New-CommitNode
        # Find the commits that were only in the release branch, excluding those that were cherry-picked from master branch.
        $new_commits_from_last_release = git --no-pager log --first-parent --cherry-pick --left-only "$tag_hash...$other_parent_hash" --format=$format | New-CommitNode
        # Find the commits that are actually duplicate but having different patch-ids due to resolving conflicts during the cherry-pick.
        $duplicate_commits = Compare-Object $new_commits_from_last_release $new_commits_from_other_parent -Property PullRequest -ExcludeDifferent -IncludeEqual -PassThru
        if ($duplicate_commits) {
            $duplicate_pr_numbers = @($duplicate_commits | ForEach-Object -MemberName PullRequest)
            $new_commits_from_other_parent = $new_commits_from_other_parent | Where-Object PullRequest -NotIn $duplicate_pr_numbers
        }

        # Find the commits that were made after the merge commit.
        $new_commits_after_merge_commit = @(git --no-pager log --first-parent "$commit_hash..HEAD" --format=$format | New-CommitNode)
        $new_commits = $new_commits_after_merge_commit + $new_commits_from_other_parent
    } else {
        ## No cherry-pick was involved in the last release branch.
        ## Using a ref rang like "$tag_hash..HEAD" with 'git log' means getting the commits that are reachable from 'HEAD' but not reachable from the last release tag.

        ## We use '--first-parent' for 'git log'. It means for any merge node, only follow the parent node on the master branch side.
        ## In case we merge a branch to master for a PR, only the merge node will show up in this way, the individual commits from that branch will be ignored.
        ## This is what we want because the merge commit itself already represents the PR.

        ## First, we want to get all new commits merged during the last release
        #$new_commits_during_last_release = @(git --no-pager log --first-parent "$tag_hash..$($other_parent_hash.TrimStart(" "))" --format=$format | New-CommitNode)
        ## Then, we want to get all new commits merged after the last release
        $new_commits_after_last_release  = @(git --no-pager log --first-parent "$commit_hash..HEAD" --format=$format | New-CommitNode)
        ## Last, we get the full list of new commits
        $new_commits = $new_commits_during_last_release + $new_commits_after_last_release
    }

    $new_commits = $new_commits | Where-Object { -not $_.Subject.StartsWith('[Ignore]', [System.StringComparison]::OrdinalIgnoreCase) }

    foreach ($commit in $new_commits) {
        $messageParts = Get-PRNumberFromCommitSubject $commit.Subject
        if ($messageParts) {
            $message = $messageParts.Message
            $prNumber = $messageParts.PR
        } else {
            $message = $commit.Subject
        }

        if (-not ($commit.AuthorEmail.EndsWith("@microsoft.com") -or ($powershell_team -contains $commit.AuthorName) -or ($powershell_team_emails -contains $commit.AuthorEmail))) {
            if ($Script:community_login_map.ContainsKey($commit.AuthorEmail)) {
                $commit.AuthorGitHubLogin = $Script:community_login_map[$commit.AuthorEmail]
            } else {
                $uri = "$RepoUri/commits/$($commit.Hash)"
                $response = Invoke-WebRequest -Uri $uri -Method Get -Headers $header -ErrorAction SilentlyContinue
                if($response) {
                    $content = ConvertFrom-Json -InputObject $response.Content
                    $commit.AuthorGitHubLogin = $content.author.login
                    $Script:community_login_map[$commit.AuthorEmail] = $commit.AuthorGitHubLogin
                }
            }
            $userToThank = $commit.AuthorGitHubLogin
        }

        $commit.ChangeLogMessage = New-ChangeLogEntry -RepositoryName $RepoName -CommitMessage $message -PRNumber $prNumber -UserToThank $userToThank -IsBreakingChange:$commit.IsBreakingChange
    }

    $new_commits | Sort-Object -Descending -Property IsBreakingChange | ForEach-Object -MemberName ChangeLogMessage
}

##############################
#.SYNOPSIS
#Generate the draft change log of the PowerShell Extension for VSCode
#
#.PARAMETER LastReleaseTag
#The last release tag
#
#.PARAMETER Token
#The authentication token to use for retrieving the GitHub user log-in names for external contributors. Get it from:
# https://github.com/settings/tokens
#
#.PARAMETER NewReleaseTag
#The github tag that will be associated with the next release
#
#.PARAMETER HasCherryPick
#Indicate whether there are any commits in the last release branch that were cherry-picked from the master branch
#
#.OUTPUTS
#The generated change log draft of vscode-powershell AND PowerShellEditorServices
#
#.NOTES
#Run from the path to /vscode-powershell
##############################
function Get-PowerShellExtensionChangeLog {
    param(
        [Parameter(Mandatory)]
        [string]$LastReleaseTag,

        [Parameter(Mandatory)]
        [string]$Token,

        [Parameter(Mandatory)]
        [string]$NewReleaseTag,

        [Parameter()]
        [switch]$HasCherryPick
    )

    $vscodePowerShell = Get-ChangeLog -LastReleaseTag $LastReleaseTag -Token $Token -HasCherryPick:$HasCherryPick.IsPresent -RepoUri 'https://api.github.com/repos/PowerShell/vscode-powershell' -RepoName 'vscode-PowerShell'
    Push-Location ../PowerShellEditorServices
    $pses = Get-ChangeLog -LastReleaseTag $LastReleaseTag -Token $Token -HasCherryPick:$HasCherryPick.IsPresent -RepoUri 'https://api.github.com/repos/PowerShell/PowerShellEditorServices' -RepoName 'PowerShellEditorServices'
    Pop-Location

    return @"
## $NewReleaseTag
### $([datetime]::Today.ToString("D"))
#### [vscode-powershell](https://github.com/powershell/vscode-powershell)

$($vscodePowerShell -join "`n")

#### [PowerShellEditorServices](https://github.com/powershell/PowerShellEditorServices)

$($pses -join "`n")

"@
}

Get-PowerShellExtensionChangeLog -LastReleaseTag $LastReleaseTag -Token $Token -NewReleaseTag $NewReleaseTag -HasCherryPick:$HasCherryPick.IsPresent