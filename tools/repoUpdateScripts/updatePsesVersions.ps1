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
    $BranchName,

    [Parameter()]
    [string]
    $PRDescription
)

Import-Module "$PSScriptRoot/../GitHubTools.psm1"
Import-Module "$PSScriptRoot/../FileUpdateTools.psm1"

function FindPsesModuleSpan
{
    param(
        [Parameter()]
        [string]
        $ModuleManifestContent
    )

    # Inscrutable regex looks for PSD1 "ModuleVersion = '2.0.0'" type of field
    $pattern = [regex]'\s*ModuleVersion\s*=\s*(?:''|")(\d+?(?:\.\d+?(?:\.\d+)))(?:''|")'

    $versionGroup = $pattern.Match($ModuleManifestContent).Groups[1]

    return @{
        Start = $versionGroup.Index
        End = $versionGroup.Index + $versionGroup.Length
    }
}

function UpdatePsesModuleVersion
{
    param(
        [Parameter()]
        [string]
        $PsesModuleManifestPath,

        [Parameter()]
        [semver]
        $NewVersion
    )

    $version = GetVersionFromSemVer -SemVer $NewVersion

    $PsesModuleManifestPath = $PSCmdlet.GetUnresolvedProviderPathFromPSPath($PsesModuleManifestPath)

    $manifestContent = Get-Content -Raw $PsesModuleManifestPath

    $span = FindPsesModuleSpan -ModuleManifestContent $manifestContent

    $newContent = ReplaceStringSegment -String $manifestContent -NewSegment $version -StartIndex $span.Start -EndIndex $span.End

    SetFileContent -FilePath $PsesModuleManifestPath -Value $newContent
}

function GetPsesCurrentVersion
{
    [OutputType([semver])]
    param(
        [Parameter()]
        [string]
        $PsesPropsPath
    )

    $propsXml = [xml](Get-Content -Raw $PsesPropsPath)

    $version = $propsXml.Project.PropertyGroup.VersionPrefix
    $prereleaseTag = $propsXml.Project.PropertyGroup.VersionSuffix
    if ($prereleaseTag)
    {
        $version = "$version-$prereleaseTag"
    }

    return [semver]$version
}

function UpdatePsesPropsXml
{
    param(
        [Parameter(Mandatory)]
        [semver]
        $NewVersion,

        [Parameter(Mandatory)]
        [string]
        $PsesPropsPath
    )

    $PsesPropsPath = $PSCmdlet.GetUnresolvedProviderPathFromPSPath($PsesPropsPath)

    $propsXml = [xml](Get-Content -Raw $PsesPropsPath)

    $versionParts = $NewVersion.ToString().Split('-')

    if ($versionParts.Length -eq 2)
    {
        $propsXml.Project.PropertyGroup.VersionPrefix = $versionParts[0]
        $propsXml.Project.PropertyGroup.VersionSuffix = $versionParts[1]
    }
    else
    {
        $propsXml.Project.PropertyGroup.VersionPrefix = $versionParts[0]

        # Remove the prerelease tag if it's present
        $prereleaseNode = $propsXml.Project.PropertyGroup.GetElementsByTagName('VersionSuffix')
        if ($prereleaseNode)
        {
            $null = $propsXml.Project.PropertyGroup.RemoveChild($prereleaseNode[0])
        }
    }

    $xmlWriterSettings = [System.Xml.XmlWriterSettings]@{
        Encoding = [System.Text.UTF8Encoding]::new(<# BOM #>$false)
        OmitXmlDeclaration = $true
        Indent = $true
        IndentChars = "  "
        NewLineHandling = 'Replace'
        NewLineChars = "`r`n"
    }
    $xmlWriter = [System.Xml.XmlWriter]::Create($PsesPropsPath, $xmlWriterSettings)
    try
    {
        $propsXml.Save($xmlWriter)
    }
    finally
    {
        $xmlWriter.Dispose()
    }
}

$repoLocation = Join-Path ([System.IO.Path]::GetTempPath()) 'pses-update-temp'
$paths = @{
    props = "$repoLocation/PowerShellEditorServices.Common.props"
    manifest = "$repoLocation/module/PowerShellEditorServices/PowerShellEditorServices.psd1"
}

if (-not $BranchName)
{
    $BranchName = "update-pses-version-$NewVersion"
}

if (-not $PRDescription)
{
    $PRDescription = "Updates PSES to version $NewVersion.**Note**: This is an automated PR."
}

# Clone the PSES repo
$cloneParams = @{
    OriginRemote = 'https://github.com/rjmholt/PowerShellEditorServices'
    Destination = $repoLocation
    CheckoutBranch = $BranchName
    Remotes = @{
        upstream = 'https://github.com/PowerShell/PowerShellEditorServices'
    }
    Clobber = $true
}
CloneRepo @cloneParams

# If we need to increment the version, do that
if ($IncrementLevel)
{
    $currVersion = GetPsesCurrentVersion -PsesPropsPath $paths.props
    $NewVersion = IncrementVersion -CurrentVersion $currVersion -IncrementLevel $IncrementLevel
}

# Update the Props XML file
UpdatePsesPropsXml -NewVersion $NewVersion -PsesPropsPath $paths.props

# Update the PSD1 file
UpdatePsesModuleVersion -PsesModuleManifestPath $paths.manifest -NewVersion $NewVersion

# Commit changes
$commitParams = @{
    RepoLocation = $repoLocation
    Message = "[Ignore] Update PSES version to $NewVersion"
    Branch = $BranchName
    File = @(
        'PowerShellEditorServices.Common.props'
        'module/PowerShellEditorServices/PowerShellEditorServices.psd1'
    )
}
CommitAndPushChanges @commitParams

# Open a PR
$prParams = @{
    Branch = $BranchName
    Title = "Update PowerShellEditorServices version to $NewVersion"
    GitHubToken = $GitHubToken
    Organization = $TargetFork
    Repository = 'PowerShellEditorServices'
    Description = $PRDescription
    FromOrg = 'rjmholt'
}
OpenGitHubPr @prParams