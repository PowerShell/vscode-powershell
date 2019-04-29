function CloneRepo
{
    param(
        [Parameter(Mandatory)]
        [string]
        $OriginRemote,

        [Parameter(Mandatory)]
        [string]
        $Destination,

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

        Remove-Item -Force -Recurse $Destination
    }

    $containingDir = Split-Path $Destination
    if (-not (Test-Path $containingDir))
    {
        New-Item -Path $containingDir -ItemType Directory
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
            git push --force-with-lease $OriginRemote $CloneBranch
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
        git checkout $Branch
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
        $TargetBranch,

        [Parameter(Mandatory)]
        [string]
        $Organization,

        [Parameter(Mandatory)]
        $Repository,

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
