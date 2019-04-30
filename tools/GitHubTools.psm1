# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

function GetHumanishRepositoryName
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

function Exec
{
    param([scriptblock]$Invocation)

    & $Invocation

    if ($LASTEXITCODE -ne 0)
    {
        # Get caller location for easier debugging
        $caller = Get-PSCallStack -ErrorAction SilentlyContinue
        if($caller)
        {
            $callerLocationParts = $caller[1].Location -split ":\s*line\s*"
            $callerFile = $callerLocationParts[0]
            $callerLine = $callerLocationParts[1]

            $errorMessage = "Execution of {$Invocation} by ${callerFile}: line $callerLine failed with exit code $LASTEXITCODE"
            throw $errorMessage
        }
        throw "Execution of {$Invocation} failed with exit code $LASTEXITCODE"
    }
}

function Copy-GitRepository
{
    param(
        [Parameter(Mandatory)]
        [string]
        $OriginRemote,

        [Parameter()]
        [ValidateNotNullOrEmpty()]
        [string]
        $Destination = (GetHumanishRepositoryName $OriginRemote),

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

    Exec { git clone --single-branch --branch $CloneBranch $OriginRemote $Destination }

    Push-Location $Destination
    try
    {
        Exec { git config core.autocrlf true }

        foreach ($remote in $Remotes.get_Keys())
        {
            Exec { git remote add $remote $Remotes[$remote] }
        }

        if ($remote['upstream'])
        {
            Exec { git pull upstream $CloneBranch }
        }

        if ($CheckoutBranch)
        {
            Exec { git checkout -b $CheckoutBranch }
        }
    }
    finally
    {
        Pop-Location
    }
}

function Submit-GitChanges
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
        $RepositoryLocation,

        [Parameter()]
        [string[]]
        $File,

        [Parameter()]
        [string]
        $Remote = 'origin'
    )

    Push-Location $RepositoryLocation
    try
    {
        # Try to checkout the relevant branch
        try
        {
            Exec { git checkout $Branch }
        }
        catch
        {
            Exec { git checkout -b $Branch }
        }

        if ($File)
        {
            Exec { git add $File }
        }
        else
        {
            Exec { git add -A }
        }
        Exec { git commit -m $Message }
        Exec { git push $Remote $Branch }
    }
    finally
    {
        Pop-Location
    }
}

function New-GitHubPR
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

function Publish-GitHubRelease
{
    param(
        [Parameter(Mandatory)]
        [string]
        $Organization,

        [Parameter(Mandatory)]
        [string]
        $Repository,

        [Parameter(Mandatory)]
        [string]
        $Tag,

        [Parameter(Mandatory)]
        [string]
        $ReleaseName,

        [Parameter(Mandatory)]
        [string]
        $Description,

        [Parameter(Mandatory)]
        [string]
        $GitHubToken,

        [Parameter()]
        [Alias('Branch', 'Commit')]
        [string]
        $Commitish,

        [Parameter()]
        [string[]]
        $AssetPath,

        [switch]
        $Draft,

        [switch]
        $Prerelease
    )

    $restParams = @{
        tag_name = $Tag
        name = $ReleaseName
        body = $Description
        draft = [bool]$Draft
        prerelease = [bool]$Prerelease
    }

    if ($Commitish)
    {
        $restParams.target_commitish = $Commitish
    }

    $restBody = ConvertTo-Json -InputObject $restParams
    $uri = "https://api.github.com/repos/$Organization/$Repository/releases"
    $headers = @{
        Accept = 'application/vnd.github.v3+json'
        Authorization = "token $GitHubToken"
    }

    $response = Invoke-RestMethod -Method Post -Uri $uri -Body $restBody -Headers $headers

    $releaseId = $response.id
    $assetBaseUri = "https://uploads.github.com/repos/$Organization/$Repository/releases/$releaseId/assets"
    foreach ($asset in $AssetPath)
    {
        $extension = [System.IO.Path]::GetExtension($asset)
        $fileName = [uri]::EscapeDataString([System.IO.Path]::GetFileName($asset))
        $contentType = 'text/plain'
        switch ($extension)
        {
            { $_ -in '.zip','.vsix' }
            {
                $contentType = 'application/zip'
                break
            }

            '.json'
            {
                $contentType = 'application/json'
                break
            }

            default
            {
                $contentType = 'text/plain'
            }
        }

        $assetUri = "${assetBaseUri}?name=$fileName"
        $headers = @{
            Authorization = "token $GitHubToken"
        }
        # This can be very slow, but it does work
        $null = Invoke-RestMethod -Method Post -Uri $assetUri -InFile $asset -ContentType $contentType -Headers $headers
    }

    return $response
}

Export-ModuleMember -Function Copy-GitRepository,Submit-GitChanges,New-GitHubPR