# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

#requires -Version 6.0

class GitCommitInfo
{
    [string]$Hash
    [string[]]$ParentHashes
    [string]$Subject
    [string]$Body
    [string]$ContributorName
    [string]$ContributorEmail
    [string[]]$CommitLabels
    [int]$PRNumber = -1
}

class GitHubCommitInfo : GitCommitInfo
{
    [string]$Organization
    [string]$Repository
    [pscustomobject]$GitHubCommitData
}

class GitHubIssueInfo
{
    [int]$Number
    [string]$Organization
    [string]$Repository

    [uri]GetHtmlUri()
    {
        return [uri]"https://github.com/$($this.Organization)/$($this.Repository)/issues/$($this.Number)"
    }

    [uri]GetApiUri()
    {
        return [uri]"https://api.github.com/repos/$($this.Organization)/$($this.Repository)/issues/$($this.Number)"
    }
}

class GitHubIssue : GitHubIssueInfo
{
    [pscustomobject]$RawResponse
    [string]$Body
    [string[]]$Labels
}

class GitHubPR : GitHubIssue
{
    hidden [GitHubIssueInfo[]]$ClosedIssues = $null

    [GitHubIssueInfo[]]GetClosedIssueInfos()
    {
        if ($null -eq $this.ClosedIssues)
        {
            $this.ClosedIssues = $this.Body |
                GetClosedIssueUrisInBodyText |
                GetGitHubIssueFromUri
        }

        return $this.ClosedIssues
    }

    [uri]GetHtmlUri()
    {
        return [uri]"https://github.com/$($this.Organization)/$($this.Repository)/pull/$($this.Number)"
    }

    [uri]GetApiUri()
    {
        return [uri]"https://api.github.com/repos/$($this.Organization)/$($this.Repository)/pulls/$($this.Number)"
    }
}

function GetGitHubHeaders
{
    param(
        [Parameter()]
        [string]
        $GitHubToken,

        [Parameter()]
        [string]
        $Accept
    )

    $headers = @{}

    if ($GitHubToken)
    {
        $headers.Authorization = "token $GitHubToken"
    }

    if ($Accept)
    {
        $headers.Accept = $Accept
    }

    return $headers
}

$script:CloseKeywords = @(
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
$script:EndNonCharRegex = [regex]::new('[^0-9]*$', 'compiled')
filter GetClosedIssueUrisInBodyText
{
    param(
        [Parameter(ValueFromPipeline)]
        [string]
        $Text
    )

    $words = $Text.Split()

    $expectIssue = $false
    for ($i = 0; $i -lt $words.Length; $i++)
    {
        $currWord = $words[$i]

        if ($script:CloseKeywords -contains $currWord)
        {
            $expectIssue = $true
            continue
        }

        if (-not $expectIssue)
        {
            continue
        }

        $expectIssue = $false

        $trimmedWord = $script:EndNonCharRegex.Replace($currWord, '')

        if ([uri]::IsWellFormedUriString($trimmedWord, 'Absolute'))
        {
            # Yield
            [uri]$trimmedWord
        }
    }
}

filter GetGitHubIssueFromUri
{
    param(
        [Parameter(ValueFromPipeline)]
        [uri]
        $IssueUri
    )

    if ($IssueUri.Authority -ne 'github.com')
    {
        return
    }

    if ($IssueUri.Segments.Length -ne 5)
    {
        return
    }

    if ($IssueUri.Segments[3] -ne 'issues/')
    {
        return
    }

    $issueNum = -1
    if (-not [int]::TryParse($IssueUri.Segments[4], [ref]$issueNum))
    {
        return
    }

    return [GitHubIssueInfo]@{
        Organization = $IssueUri.Segments[1].TrimEnd('/')
        Repository = $IssueUri.Segments[2].TrimEnd('/')
        Number = $issueNum
    }
}

filter GetHumanishRepositoryDetails
{
    param(
        [string]
        $RemoteUrl
    )

    if ($RemoteUrl.EndsWith('.git'))
    {
        $RemoteUrl = $RemoteUrl.Substring(0, $RemoteUrl.Length - 4)
    }
    else
    {
        $RemoteUrl = $RemoteUrl.Trim('/')
    }

    $lastSlashIdx = $RemoteUrl.LastIndexOf('/')
    $repository =  $RemoteUrl.Substring($lastSlashIdx + 1)
    $secondLastSlashIdx = $RemoteUrl.LastIndexOfAny(('/', ':'), $lastSlashIdx - 1)
    $organization = $RemoteUrl.Substring($secondLastSlashIdx + 1, $lastSlashIdx - $secondLastSlashIdx - 1)

    return @{
        Organization = $organization
        Repository = $repository
    }
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
        $Destination = ((GetHumanishRepositoryDetails $OriginRemote).Repository),

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
        $Clobber,

        [switch]
        $PullUpstream,

        [switch]
        $UpdateOrigin
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

        if ($Remotes)
        {
            foreach ($remote in $Remotes.get_Keys())
            {
                Exec { git remote add $remote $Remotes[$remote] }
            }

            if ($PullUpstream -and $Remotes['upstream'])
            {
                Exec { git pull upstream $CloneBranch }

                if ($UpdateOrigin)
                {
                    Exec { git push origin "+$CloneBranch"}
                }
            }
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

function Get-GitCommit
{
    [OutputType([GitHubCommitInfo])]
    [CmdletBinding(DefaultParameterSetName='SinceRef')]
    param(
       [Parameter(Mandatory, ParameterSetName='SinceRef')]
       [Alias('SinceBranch', 'SinceTag')]
       [string]
       $SinceRef,

       [Parameter(ParameterSetName='SinceRef')]
       [Alias('UntilBranch', 'UntilTag')]
       [string]
       $UntilRef = 'HEAD',

       [Parameter()]
       [string]
       $Remote,

       [Parameter()]
       [string]
       $GitHubToken,

       [Parameter()]
       [string]
       $RepositoryPath
    )

    if ($RepositoryPath)
    {
        Push-Location $RepositoryPath
    }
    try
    {
        if (-not $Remote)
        {
            $Remote = 'upstream'
            try
            {
                $null = Exec { git remote get-url $Remote }
            }
            catch
            {
                $Remote = 'origin'
            }
        }

        $originDetails = GetHumanishRepositoryDetails -RemoteUrl (Exec { git remote get-url $Remote })
        $organization = $originDetails.Organization
        $repository = $originDetails.Repository

        $format = '%H||%P||%aN||%aE||%s'
        $commits = Exec { git --no-pager log "$SinceRef..$UntilRef" --format=$format }

        $irmParams = if ($GitHubToken)
        {
            @{ Headers = GetGitHubHeaders -GitHubToken $GitHubToken -Accept 'application/vnd.github.v3+json' }
        }
        else
        {
            @{ Headers = GetGitHubHeaders -Accept 'application/vnd.github.v3+json' }
        }

        return $commits |
            ForEach-Object {
                $hash,$parents,$name,$email,$subject = $_.Split('||')
                $body = (Exec { git --no-pager show $hash -s --format=%b }) -join "`n"
                $commitVal = [GitHubCommitInfo]@{
                Hash = $hash
                ParentHashes = $parents
                ContributorName = $name
                ContributorEmail = $email
                Subject = $subject
                Body = $body
                Organization = $organization
                Repository = $repository
                }

                # Query the GitHub API for more commit information
                $commitVal.GitHubCommitData = Invoke-RestMethod -Method Get -Uri "https://api.github.com/repos/$organization/$repository/commits/$hash" @irmParams

                # Look for something like 'This is a commit message (#1224)'
                $pr = [regex]::Match($subject, '\(#(\d+)\)$').Groups[1].Value
                if ($pr)
                {
                    $commitVal.PRNumber = $pr
                }

                # Look for something like '[Ignore] [giraffe] Fix tests'
                $commitLabels = [regex]::Matches($subject, '^(\[(.*?)\]\s*)*')
                if ($commitLabels.Groups.Length -ge 3 -and $commitLabels.Groups[2].Captures.Value)
                {
                    $commitVal.CommitLabels = $commitLabels.Groups[2].Captures.Value
                }

                $commitVal
            }
    }
    finally
    {
        if ($RepositoryPath)
        {
            Pop-Location
        }
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

    $headers = GetGitHubHeaders -GitHubToken $GitHubToken -Accept 'application/vnd.github.v3+json'

    Invoke-RestMethod -Method Post -Uri $uri -Body $body -Headers $headers
}

function Get-GitHubPR
{
    param(
        [Parameter(Mandatory)]
        [string]
        $Organization,

        [Parameter(Mandatory)]
        [string]
        $Repository,

        [Parameter(Mandatory)]
        [int[]]
        $PullNumber,

        [Parameter()]
        [ValidateNotNullOrEmpty()]
        [string]
        $GitHubToken
    )

    return $PullNumber |
        ForEach-Object {
            $params = @{
                Method = 'Get'
                Uri = "https://api.github.com/repos/$Organization/$Repository/pulls/$_"
            }

            if ($GitHubToken)
            {
                $params.Headers = GetGitHubHeaders -GitHubToken $GitHubToken
            }

            $prResponse = Invoke-RestMethod @params

            [GitHubPR]@{
                RawResponse = $prResponse
                Number = $prResponse.Number
                Organization = $Organization
                Repository = $Repository
                Body = $prResponse.body
                Labels = $prResponse.labels.name
            }
        }
}

filter Get-GitHubIssue
{
    [CmdletBinding(DefaultParameterSetName='IssueInfo')]
    param(
        [Parameter(Mandatory, ValueFromPipeline, Position=0, ParameterSetName='IssueInfo')]
        [GitHubIssueInfo]
        $IssueInfo,

        [Parameter(Mandatory, ParameterSetName='Params')]
        [string]
        $Organization,

        [Parameter(Mandatory, ParameterSetName='Params')]
        [string]
        $Repository,

        [Parameter(Mandatory, ParameterSetName='Params')]
        [int]
        $Number,

        [Parameter()]
        [ValidateNotNullOrEmpty()]
        [string]
        $GitHubToken
    )

    if (-not $IssueInfo)
    {
        $IssueInfo = [GitHubIssueInfo]@{
            Organization = $Organization
            Repository = $Repository
            Number = $Number
        }
    }

    $irmParams = @{
        Method = 'Get'
        Uri = $IssueInfo.GetApiUri()
    }

    if ($GitHubToken)
    {
        $irmParams.Headers = GetGitHubHeaders -GitHubToken $GitHubToken
    }

    $issueResponse = Invoke-RestMethod @irmParams

    return [GitHubIssue]@{
        Organization = $Organization
        Repository = $Repository
        Number = $Number
        RawResponse = $issueResponse
        Body = $issueResponse.body
        Labels = $issueResponse.labels.name
    }
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
    $headers = GetGitHubHeaders -GitHubToken $GitHubToken -Accept 'application/vnd.github.v3+json'

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
        }

        $assetUri = "${assetBaseUri}?name=$fileName"
        $headers = GetGitHubHeaders -GitHubToken $GitHubToken
        # This can be very slow, but it does work
        $null = Invoke-RestMethod -Method Post -Uri $assetUri -InFile $asset -ContentType $contentType -Headers $headers
    }

    return $response
}

Export-ModuleMember -Function @(
    'Copy-GitRepository',
    'Submit-GitChanges',
    'Get-GitCommit',
    'New-GitHubPR',
    'Get-GitHubPR',
    'Get-GitHubIssue',
    'Publish-GitHubRelease'
)
