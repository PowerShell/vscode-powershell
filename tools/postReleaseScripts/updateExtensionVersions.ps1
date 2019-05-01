# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

[CmdletBinding(DefaultParameterSetName='Increment')]
param(
    [Parameter(ParameterSetName='Increment')]
    [ValidateSet('Major', 'Minor', 'Patch', 'Preview')]
    [string]
    $IncrementLevel = 'Preview',

    [Parameter(Mandatory, ParameterSetName='SetVersion')]
    [semver]
    $NewVersion,

    [Parameter(Mandatory)]
    [string]
    $GitHubToken,

    [Parameter()]
    [string]
    $TargetFork = 'PowerShell',

    [Parameter()]
    [string]
    # Default set below, requires processing when $IncrementVersion is used
    $BranchName,

    [Parameter()]
    [string]
    # Default set below, requires processing when $IncrementVersion is used
    $PRDescription
)

Import-Module -Force "$PSScriptRoot/../FileUpdateTools.psm1"
Import-Module -Force "$PSScriptRoot/../GitHubTools.psm1"

function FindPackageJsonVersionSpan
{
    param(
        [Parameter(Mandatory)]
        [string]
        $PackageJsonContent
    )

    try
    {
        $reader = [System.IO.StringReader]::new($PackageJsonContent)
        $jsonReader = [Newtonsoft.Json.JsonTextReader]::new($reader)

        $depth = 0
        $seenVersion = $false
        $versionStartOffset = -1
        $versionStartColumn = -1
        while ($jsonReader.Read())
        {
            switch ($jsonReader.TokenType)
            {
                'StartObject'
                {
                    $depth++
                    continue
                }

                'EndObject'
                {
                    $depth--
                    continue
                }

                'PropertyName'
                {
                    if ($depth -ne 1)
                    {
                        continue
                    }

                    $seenVersion = $jsonReader.Value -eq 'version'

                    if (-not $seenVersion)
                    {
                        continue
                    }

                    $currIndex = Get-StringOffsetFromSpan -String $PackageJsonContent -EndLine $jsonReader.LineNumber -Column $jsonReader.LinePosition
                    $versionStartOffset = $PackageJsonContent.IndexOf('"', $currIndex) + 1
                    $versionStartColumn = $jsonReader.LinePosition + $versionStartOffset - $currIndex

                    continue
                }

                'String'
                {
                    if (-not $seenVersion -or $depth -ne 1)
                    {
                        continue
                    }

                    return @{
                        Start = $versionStartOffset
                        End = $versionStartOffset + $jsonReader.LinePosition - $versionStartColumn
                    }

                    continue
                }
            }
        }
    }
    finally
    {
        $reader.Dispose()
        $jsonReader.Dispose()
    }

    throw 'Did not find package.json version field'
}

function FindRequiredPsesVersionSpan
{
    param(
        [Parameter(Mandatory)]
        [string]
        $MainTsContent
    )

    $pattern = [regex]'const\s+requiredEditorServicesVersion\s+=\s+"(.*)"'
    $versionGroup = $pattern.Match($MainTsContent).Groups[1]

    return @{
        Start = $versionGroup.Index
        End = $versionGroup.Index + $versionGroup.Length
    }
}

function FindVstsBuildVersionSpan
{
    param(
        [Parameter(Mandatory)]
        [string]
        $DockerFileContent
    )

    $pattern = [regex]'ENV VSTS_BUILD_VERSION=(.*)'
    $versionGroup = $pattern.Match($DockerFileContent).Groups[1]

    return @{
        Start = $versionGroup.Index
        End = $versionGroup.Index + $versionGroup.Length
    }
}

function UpdateMainTsPsesVersion
{
    param(
        [Parameter(Mandatory)]
        [string]
        $MainTsPath,

        [Parameter(Mandatory)]
        [version]
        $Version
    )

    $mainTsContent = Get-Content -Raw $MainTsPath
    $mainTsVersionSpan = FindRequiredPsesVersionSpan $mainTsContent
    $newMainTsContent = Format-StringWithSegment -String $mainTsContent -NewSegment $Version -StartIndex $mainTsVersionSpan.Start -EndIndex $mainTsVersionSpan.End
    if ($newMainTsContent -ne $mainTsContent)
    {
        Set-Content -Path $MainTsPath -Value $newMainTsContent -Encoding utf8NoBOM -NoNewline
    }
}

function UpdateDockerFileVersion
{
    param(
        [Parameter(Mandatory)]
        [string]
        $DockerFilePath,

        [Parameter(Mandatory)]
        [version]
        $Version
    )

    $vstsDockerFileContent = Get-Content -Raw $DockerFilePath
    $vstsDockerFileVersionSpan = FindVstsBuildVersionSpan -DockerFileContent $vstsDockerFileContent
    $newDockerFileContent = Format-StringWithSegment -String $vstsDockerFileContent -NewSegment $Version -StartIndex $vstsDockerFileVersionSpan.Start -EndIndex $vstsDockerFileVersionSpan.End
    Set-Content -Path $DockerFilePath -Value $newDockerFileContent -Encoding utf8NoBOM -NoNewline
}

function GetMarketplaceVersionFromSemVer
{
    [OutputType([version])]
    param(
        [Parameter(Mandatory)]
        [semver]
        $SemVer
    )

    if (-not $SemVer.PreReleaseLabel)
    {
        return [version]($SemVer.ToString())
    }

    return [version]::new($NewVersion.Major, $NewVersion.Minor, $NewVersion.PreReleaseLabel.Substring(8)-1)
}

# Define locations/branch name
$repoLocation = Join-Path ([System.IO.Path]::GetTempPath()) 'vscps-updateversion-temp'
$paths = @{
    packageJson = "$repoLocation/package.json"
    mainTs = "$repoLocation/src/main.ts"
    vstsDockerFile = "$repoLocation/tools/releaseBuild/Image/DockerFile"
}

# Clone the repo
$cloneParams = @{
    OriginRemote = 'https://github.com/rjmholt/vscode-powershell'
    Destination = $repoLocation
    Clobber = $true
    Remotes = @{
        upstream = 'https://github.com/PowerShell/vscode-powershell'
    }
}
Copy-GitRepository @cloneParams

# We may need the version from the package.json, so get that first
$packageJson = Get-Content -Raw $paths.packageJson
$pkgJsonVersionOffsetSpan = FindPackageJsonVersionSpan -PackageJsonContent $packageJson

# If the option was to increment, we take the existing version and increment it
if ($IncrementLevel)
{
    $version = [semver]$packageJson.Substring($pkgJsonVersionOffsetSpan.Start, $pkgJsonVersionOffsetSpan.End - $pkgJsonVersionOffsetSpan.Start)
    $NewVersion = Get-IncrementedVersion -Version $version -IncrementLevel $IncrementLevel
}

if (-not $BranchName)
{
    $BranchName = "update-version-$NewVersion"
}

if (-not $PRDescription)
{
    $PRDescription = "Updates version strings in vscode-PowerShell to $NewVersion.`n**Note**: This is an automated PR."
}

# Get the marketplace/non-semver versions for various files
$psesVersion = Get-VersionFromSemVer -SemVer $NewVersion
$marketPlaceVersion = GetMarketplaceVersionFromSemVer -SemVer $NewVersion

# Finally create the new package.json file
$newPkgJsonContent = Format-StringWithSegment -String $packageJson -NewSegment $NewVersion -StartIndex $pkgJsonVersionOffsetSpan.Start -EndIndex $pkgJsonVersionOffsetSpan.End
Set-Content -Path $paths.packageJson -Value $newPkgJsonContent -Encoding utf8NoBOM -NoNewline

# Create the new content for the main.ts required version file
UpdateMainTsPsesVersion -MainTsPath $paths.mainTs -Version $psesVersion

# Create the new content for the VSTS dockerfile
UpdateDockerFileVersion -DockerFilePath $paths.vstsDockerFile -Version $marketPlaceVersion

# Commit and push the changes
$commitParams = @{
    Message = "[Ignore] Increment version to $NewVersion"
    Branch = $branchName
    RepositoryLocation = $repoLocation
    File = @(
        'package.json'
        'src/main.ts'
        'tools/releaseBuild/Image/DockerFile'
    )
}
Submit-GitChanges @commitParams

# Open a new PR in GitHub
$prParams = @{
    Organization = $TargetFork
    Repository = 'vscode-PowerShell'
    Branch = $branchName
    Title = "Update version to v$NewVersion"
    Description = $PRDescription
    GitHubToken = $GitHubToken
    FromOrg = 'rjmholt'
}
New-GitHubPR @prParams