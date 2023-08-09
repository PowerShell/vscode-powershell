# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

#requires -Version 7.0

using module PowerShellForGitHub
using namespace System.Management.Automation

Import-Module $PSScriptRoot/VersionTools.psm1
$ChangelogFile = "CHANGELOG.md"

<#
.SYNOPSIS
  Creates and checks out `release` if not already on it.
#>
function Update-Branch {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryName
    )
    Use-Repository -RepositoryName $RepositoryName -Script {
        $Branch = git branch --show-current
        if ($Branch -ne "release") {
            if ($PSCmdlet.ShouldProcess("release", "git checkout -B")) {
                git checkout -B "release"
            }
        }
    }
}

<#
.SYNOPSIS
  Given a collection of PRs, generates a bulleted list.
#>
function Get-Bullets {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryName,

        [Parameter(Mandatory, ValueFromPipeline)]
        [PSCustomObject[]]$PullRequests
    )
    begin {
        $SkipThanks = @(
            'andyleejordan'
            'daxian-dbw'
            'PaulHigin'
            'SeeminglyScience'
            'SteveL-MSFT'
            'StevenBucher98'
            'SydneyhSmith'
        )

        $IssueEmojis = @{
            'Issue-Enhancement'         = '✨'
            'Issue-Bug'                 = '🐛'
            'Issue-Performance'         = '⚡️'
        }

        $AreaEmojis = @{
            'Area-Build & Release'      = '👷'
            'Area-Code Formatting'      = '💎'
            'Area-Configuration'        = '🔧'
            'Area-Debugging'            = '🔍'
            'Area-Documentation'        = '📖'
            'Area-Engine'               = '🚂'
            'Area-Folding'              = '📚'
            'Area-Extension Terminal'   = '📟'
            'Area-IntelliSense'         = '🧠'
            'Area-Logging'              = '💭'
            'Area-Pester'               = '🐢'
            'Area-Script Analysis'      = '‍🕵️'
            'Area-Snippets'             = '✂️'
            'Area-Startup'              = '🛫'
            'Area-Symbols & References' = '🔗'
            'Area-Tasks'                = '✅'
            'Area-Test'                 = '🚨'
            'Area-Threading'            = '⏱️'
            'Area-UI'                   = '📺'
            'Area-Workspaces'           = '📁'
        }

        $CloseKeywords = @(
            'close'
            'closes'
            'closed'
            'fix'
            'fixes'
            'fixed'
            'resolve'
            'resolves'
            'resolved'
        )

        # NOTE: The URL matcher must be explicit because the body of a PR may
        # contain other URLs with digits (like an image asset).
        $IssueRegex = '(' + ($CloseKeywords -join '|') + ')\s+((https://github.com/PowerShell/(?<repo>(vscode-powershell|PowerShellEditorServices))/issues/)|#)(?<number>\d+)'
    }

    process {
        $PullRequests | ForEach-Object {
            # Map all the labels to emoji (or use a default).
            $labels = if ($_.labels) { $_.labels.LabelName } else { "" }
            $issueEmoji = $IssueEmojis[$labels] + "#️⃣" | Select-Object -First 1
            $areaEmoji = $AreaEmojis[$labels] + "🙏" | Select-Object -First 1

            # Get a linked issue number if it exists (or use the PR).
            $link = if ($_.body -match $IssueRegex) {
                $number = $Matches.number
                $repo = $Matches.repo
                # Handle links to issues in both repos, in both shortcode and URLs.
                $name = ("vscode-powershell", "PowerShellEditorServices") | Where-Object { $repo -match $_ } | Select-Object -First 1
                "$($name ?? $RepositoryName) #$number"
            } else {
                "$RepositoryName #$($_.number)"
            }

            # Thank the contributor if they are not one of us.
            $thanks = if ($_.user.UserName -notin $SkipThanks) {
                "(Thanks @$($_.user.UserName)!)"
            }

            # Put the bullet point together.
            ("-", $issueEmoji, $areaEmoji, "[$link]($($_.html_url))", "-", "$($_.title).", $thanks -join " ").Trim()
        }
    }
}

<#
.SYNOPSIS
  Updates the CHANGELOG file with PRs merged since the last release.
.DESCRIPTION
  Uses the local Git repositories but does not pull, so ensure HEAD is where you
  want it. Creates the branch `release` if not already checked out. Handles any
  merge option for PRs, but is a little slow as it queries all PRs.
#>
function Update-Changelog {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)]
        [ValidateSet("vscode-powershell", "PowerShellEditorServices")]
        [string]$RepositoryName,

        [Parameter(Mandatory)]
        [string]$Version
    )

    # Since we depend on both parameters, we can't do this with `ValidateScript`.
    Test-VersionIsValid -RepositoryName $RepositoryName -Version $Version

    # Get the repo object, latest release, and commits since its tag.
    $Repo = Get-GitHubRepository -OwnerName PowerShell -RepositoryName $RepositoryName
    $Commits = Use-Repository -RepositoryName $RepositoryName -Script {
        git rev-list "v$(Get-Version -RepositoryName $RepositoryName)..."
    }

    # NOTE: This is a slow API as it gets all PRs, and then filters.
    $Bullets = $Repo | Get-GitHubPullRequest -State All |
        Where-Object { $_.merge_commit_sha -in $Commits } |
        Where-Object { -not $_.user.UserName.EndsWith("[bot]") } |
        Where-Object { "Ignore" -notin $_.labels.LabelName } |
        Where-Object { -not $_.title.StartsWith("[Ignore]") } |
        Where-Object { -not $_.title.StartsWith("Release ``v") } |
        Get-Bullets -RepositoryName $RepositoryName

    $NewSection = switch ($RepositoryName) {
        "vscode-powershell" {
            @(
                "#### [vscode-powershell](https://github.com/PowerShell/vscode-powershell)"
                ""
                $Bullets
                ""
                "#### [PowerShellEditorServices](https://github.com/PowerShell/PowerShellEditorServices) v$(Get-Version -RepositoryName PowerShellEditorServices)"
                ""
                (Get-FirstChangelog -RepositoryName "PowerShellEditorServices").Where({ $_.StartsWith("- ") }, "SkipUntil")
            )
        }
        "PowerShellEditorServices" {
            @($Bullets, "")
        }
    }

    Update-Branch -RepositoryName $RepositoryName

    Use-Repository -RepositoryName $RepositoryName -Script {
        $CurrentChangelog = Get-Content -Path $ChangelogFile
        @(
            $CurrentChangelog[0..1]
            "## $Version"
            "### $([datetime]::Now.ToString('dddd, MMMM dd, yyyy'))"
            ""
            $NewSection
            $CurrentChangelog[2..$CurrentChangelog.Length]
        ) | Set-Content -Encoding utf8NoBOM -Path $ChangelogFile

        if ($PSCmdlet.ShouldProcess("$RepositoryName/$ChangelogFile", "git commit")) {
            git add $ChangelogFile
            git commit -m "Update CHANGELOG for ``$Version``"
        }
    }
}

<#
.SYNOPSIS
  Updates version in repository.
.DESCRIPTION
  Note that our Git tags and changelog prefix all versions with `v`.

  PowerShellEditorServices: version is `X.Y.Z-preview`

  - PowerShellEditorServices.psd1:
    - `ModuleVersion` variable with `'X.Y.Z'` string, no pre-release info
  - PowerShellEditorServices.Common.props:
    - `VersionPrefix` field with `X.Y.Z`
    - `VersionSuffix` field with pre-release portion excluding hyphen

  vscode-powershell: version is `YYYY.M.X-preview`

  - package.json:
    - `version` field with `"X.Y.Z"` and no prefix or suffix
    - `preview` field is always `false` because now we do "pre-releases"
    - TODO: `icon` field has `_Preview ` inserted if preview
#>
function Update-Version {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)]
        [ValidateSet("vscode-powershell", "PowerShellEditorServices")]
        [string]$RepositoryName
    )
    $Version = Get-Version -RepositoryName $RepositoryName
    $v = Get-MajorMinorPatch -Version $Version

    Update-Branch -RepositoryName $RepositoryName

    Use-Repository -RepositoryName $RepositoryName -Script {
        switch ($RepositoryName) {
            "vscode-powershell" {
                # TODO: Bring this back when the marketplace supports it.
                # if ($Version.PreReleaseLabel) {
                #     $icon = "media/PowerShell_Preview_Icon.png"
                # } else {
                #     $icon = "media/PowerShell_Icon.png"
                # }

                $path = "package.json"
                $f = Get-Content -Path $path
                # NOTE: The prefix regex match two spaces exactly to avoid matching
                # nested objects in the file.
                $f = $f -replace '^(?<prefix>  "version":\s+")(.+)(?<suffix>",)$', "`${prefix}${v}`${suffix}"
                # TODO: $f = $f -replace '^(?<prefix>  "icon":\s+")(.+)(?<suffix>",)$', "`${prefix}${icon}`${suffix}"
                $f | Set-Content -Path $path
                git add $path
            }
            "PowerShellEditorServices" {
                $path = "PowerShellEditorServices.Common.props"
                $f = Get-Content -Path $path
                $f = $f -replace '^(?<prefix>\s+<VersionPrefix>)(.+)(?<suffix></VersionPrefix>)$', "`${prefix}${v}`${suffix}"
                $f = $f -replace '^(?<prefix>\s+<VersionSuffix>)(.*)(?<suffix></VersionSuffix>)$', "`${prefix}$($Version.PreReleaseLabel)`${suffix}"
                $f | Set-Content -Path $path
                git add $path

                $path = "module/PowerShellEditorServices/PowerShellEditorServices.psd1"
                $f = Get-Content -Path $path
                $f = $f -replace "^(?<prefix>ModuleVersion = ')(.+)(?<suffix>')`$", "`${prefix}${v}`${suffix}"
                $f | Set-Content -Path $path
                git add $path
            }
        }

        if ($PSCmdlet.ShouldProcess("$RepositoryName/v$Version", "git commit")) {
            git commit -m "Bump version to ``v$Version``"
        } # TODO: Git reset to unstage
    }
}

<#
.SYNOPSIS
  Creates a new draft GitHub PR from the release branch.
.DESCRIPTION
  Pushes the release branch to `origin` and then opens a draft PR.
#>
function New-ReleasePR {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)]
        [ValidateSet("vscode-powershell", "PowerShellEditorServices")]
        [string]$RepositoryName
    )
    $Version = Get-Version -RepositoryName $RepositoryName

    Update-Branch -RepositoryName $RepositoryName
    Use-Repository -RepositoryName $RepositoryName -Script {
        if ($PSCmdlet.ShouldProcess("$RepositoryName/release", "git push")) {
            Write-Host "Pushing release branch..."
            git push --force-with-lease origin release
        }
    }

    $Repo = Get-GitHubRepository -OwnerName PowerShell -RepositoryName $RepositoryName

    $Params = @{
        Head  = "release"
        Base  = "main"
        Draft = $true
        Title = "Release ``v$Version``"
        Body  = "Automated PR for new release!"
        # TODO: Fix passing Confirm/WhatIf (again)
    }

    $PR = $Repo | New-GitHubPullRequest @Params
    Write-Host "Draft PR URL: $($PR.html_url)"

    # NOTE: The API is weird. According to GitHub, all PRs are Issues, so this
    # works, but the module doesn't support it as easily as it could.
    $Repo | Add-GitHubIssueLabel -Issue $PR.PullRequestNumber -LabelName "Ignore"
}

<#
.SYNOPSIS
  Kicks off the whole release process for one of the repositories.
.DESCRIPTION
  This first updates the changelog (which creates and checks out the `release`
  branch), commits the changes, updates the version (and commits), pushes the
  branch, and then creates a GitHub PR for the release for both repositories.

  This is the function meant to be called by a maintainer as the first manual
  step to creating a release: it calls the correct functions in order to prepare
  the release. Each repository's release branch then needs to be pushed to the
  internal Azure DevOps mirror, at which point the automatic release pipeline
  will build and sign the assets, and queue up draft GitHub releases (using
  `New-DraftRelease` below). Those releases need to be manually validated and
  approved, and finally the last step is to approve the pipeline to publish the
  assets to the marketplace and gallery.
#>
function New-Release {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)]
        [ValidateSet("vscode-powershell", "PowerShellEditorServices")]
        [string]$RepositoryName,

        [Parameter(Mandatory)]
        [string]$Version
    )
    # TODO: Automate rolling a preview to a stable release.
    Update-Changelog -RepositoryName $RepositoryName -Version $Version
    Update-Version -RepositoryName $RepositoryName
    New-ReleasePR -RepositoryName $RepositoryName
}

<#
.SYNOPSIS
  Kicks off the whole release process for both repositories.
.DESCRIPTION
  This just simplifies the calling of `New-Release` for both repositories.
#>
function New-ReleaseBundle {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)]
        [string]$PsesVersion,

        [Parameter(Mandatory)]
        [string]$VsceVersion
    )
    "PowerShellEditorServices", "vscode-powershell" | ForEach-Object {
        $Version = switch ($_) {
            "PowerShellEditorServices" { $PsesVersion }
            "vscode-powershell" { $VsceVersion }
        }
        New-Release -RepositoryName $_ -Version $Version
    }
}

<#
.SYNOPSIS
  Creates a new draft GitHub release and Git tag from the updated changelog.
.DESCRIPTION
  Requires that the changelog has been updated first as it pulls the release
  content and new version number from it. Note that our tags and version name
  are prefixed with a `v`. Creates a Git tag if it does not already exist.
#>
function New-DraftRelease {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryName,

        [Parameter()]
        [string[]]$Assets
    )
    $Version = Get-Version -RepositoryName $RepositoryName
    $Changelog = (Get-FirstChangelog -RepositoryName $RepositoryName) -join "`n"
    $ReleaseParams = @{
        # NOTE: We rely on GitHub to create the tag at that branch.
        Tag            = "v$Version"
        Committish     = "release"
        Name           = "v$Version"
        Body           = $ChangeLog
        Draft          = $true
        PreRelease     = [bool]$Version.PreReleaseLabel
        OwnerName      = "PowerShell"
        RepositoryName = $RepositoryName
        # TODO: Fix passing Confirm/WhatIf (again)
    }

    $Release = New-GitHubRelease @ReleaseParams
    if ($Release) {
        Write-Host "Draft release URL: $($Release.html_url)"
        # NOTE: We must loop around `New-GitHubReleaseAsset` so we can pipe
        # `$Release` or it can fail to find the newly created release by its ID
        # (probably a race condition).
        Write-Host "Uploading assets..."
        $Assets | ForEach-Object { $Release | New-GitHubReleaseAsset -Path $_ }
    }
}
