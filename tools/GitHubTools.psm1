# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

function GetHumanishRepoName
{
    param(
        [string]
        $Repository
    )

    if ($Repository.EndsWith('.git'))
    {
        $Repository = $Repository.Substring(0, $Repository.Length - 4)
    }
    else
    {
        $Repository = $Repository.Trim('/')
    }

    return $Repository.Substring($Repository.LastIndexOf('/') + 1)
}

function CloneRepo
{
    param(
        [Parameter(Mandatory)]
        [string]
        $OriginRemote,

        [Parameter()]
        [ValidateNotNullOrEmpty()]
        [string]
        $Destination = (GetHumanishRepoName $OriginRemote),

        [Parameter()]
        [string]
        $CloneBranch = 'master',

        [Parameter()]
        [string]
        $CheckoutBranch,

        [Parameter()]
        [hashtable]
        $Remotes,

        [switch]
        $Clobber
    )

    $Destination = $PSCmdlet.GetUnresolvedProviderPathFromPSPath($Destination)

    if (Test-Path $Destination)
    {
        if (-not $Clobber)
        {
            throw "Cannot clone repo to '$Destination'; path already exists."
        }

        Remove-Item -Force -Recurse $Destination -ErrorAction Stop
    }

    $containingDir = Split-Path $Destination
    if (-not (Test-Path $containingDir))
    {
        New-Item -Path $containingDir -ItemType Directory -ErrorAction Stop
    }

    git clone --single-branch --branch $CloneBranch $OriginRemote $Destination

    Push-Location $Destination
    try
    {
        git config core.autocrlf true

        foreach ($remote in $Remotes.get_Keys())
        {
            git remote add $remote $Remotes[$remote]
        }

        if ($remote['upstream'])
        {
            git pull upstream $CloneBranch
        }

        if ($CheckoutBranch)
        {
            git checkout -b $CheckoutBranch
        }
    }
    finally
    {
        Pop-Location
    }
}

function CommitAndPushChanges
{
    param(
        [Parameter(Mandatory)]
        [string]
        $Message,

        [Parameter(Mandatory)]
        [string]
        $Branch,

        [Parameter(Mandatory)]
        [string]
        $RepoLocation,

        [Parameter()]
        [string[]]
        $File,

        [Parameter()]
        [string]
        $Remote = 'origin'
    )

    Push-Location $RepoLocation
    try
    {
        # Try to checkout the relevant branch
        git checkout $Branch
        if (-not $?)
        {
            git checkout -b $Branch

            if (-not $?)
            {
                throw "Unable to checkout branch '$Branch'"
            }
        }

        if ($File)
        {
            git add $File
        }
        else
        {
            git add -A
        }
        git commit -m $Message
        git push $Remote $Branch
    }
    finally
    {
        Pop-Location
    }
}

function OpenGitHubPr
{
    param(
        [Parameter(Mandatory)]
        [string]
        $Branch,

        [Parameter(Mandatory)]
        [string]
        $Title,

        [Parameter(Mandatory)]
        [string]
        $GitHubToken,

        [Parameter(Mandatory)]
        [string]
        $Organization,

        [Parameter(Mandatory)]
        $Repository,

        [Parameter()]
        [string]
        $TargetBranch = 'master',

        [Parameter()]
        [string]
        $Description = '',

        [Parameter()]
        [string]
        $FromOrg
    )

    $uri = "https://api.github.com/repos/$Organization/$Repository/pulls"

    if ($FromOrg -and $FromOrg -ne $Organization)
    {
        $Branch = "${FromOrg}:${Branch}"
    }

    $body = @{
        title = $Title
        body = $Description
        head = $Branch
        base = $TargetBranch
        maintainer_can_modify = $true
    } | ConvertTo-Json

    $headers = @{
        Accept = 'application/vnd.github.v3+json'
        Authorization = "token $GitHubToken"
    }

    Invoke-RestMethod -Method Post -Uri $uri -Body $body -Headers $headers
}
