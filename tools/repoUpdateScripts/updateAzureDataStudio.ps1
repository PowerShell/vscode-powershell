# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

param(
    [Parameter(Mandatory)]
    [string]
    $GitHubToken,

    [Parameter(Mandatory)]
    [version]
    $ExtensionVersion,

    [Parameter()]
    [string]
    $GalleryFileName = 'extensionsGallery.json',

    [Parameter()]
    [string]
    $TargetFork = 'Microsoft'
)

Import-Module "$PSScriptRoot/../GitHubTools.psm1" -Force
Import-Module "$PSScriptRoot/../FileUpdateTools.psm1" -Force

function NewReleaseVersionEntry
{
    param(
        [Parameter()]
        [version]
        $Version,

        [Parameter()]
        [datetime]
        $UpdateDate = [datetime]::Now.Date
    )

    return [ordered]@{
        version = "$Version"
        lastUpdated = $UpdateDate.ToString('M/dd/yyyy')
        assetUri = ''
        fallbackAssetUri = 'fallbackAssetUri'
        files = @(
            [ordered]@{
                assetType = 'Microsoft.VisualStudio.Services.VSIXPackage'
                source = "https://sqlopsextensions.blob.core.windows.net/extensions/powershell/PowerShell-$Version.vsix"
            }
            [ordered]@{
                assetType = 'Microsoft.VisualStudio.Services.Icons.Default'
                source = 'https://raw.githubusercontent.com/PowerShell/vscode-powershell/master/images/PowerShell_icon.png'
            }
            [ordered]@{
                assetType = 'Microsoft.VisualStudio.Services.Content.Details'
                source = 'https://raw.githubusercontent.com/PowerShell/vscode-powershell/master/docs/azure_data_studio/README_FOR_MARKETPLACE.md'
            }
            [ordered]@{
                assetType = 'Microsoft.VisualStudio.Code.Manifest'
                source = 'https://raw.githubusercontent.com/PowerShell/vscode-powershell/master/package.json'
            }
            [ordered]@{
                assetType = 'Microsoft.VisualStudio.Services.Content.License'
                source = 'https://raw.githubusercontent.com/PowerShell/vscode-powershell/master/LICENSE.txt'
            }
        )
        properties = @(
            [ordered]@{
                key = 'Microsoft.VisualStudio.Code.ExtensionDependencies'
                value = ''
            }
            [ordered]@{
                key = 'Microsoft.VisualStudio.Code.Engine'
                value = '>=0.32.1'
            }
            [ordered]@{
                key = 'Microsoft.VisualStudio.Services.Links.Source'
                value = 'https://github.com/PowerShell/vscode-powershell/'
            }
        )
    }
}

function NewPowerShellExtensionEntry
{
    param(
        [Parameter()]
        [version]
        $ExtensionVersion
    )

    return [ordered]@{
        extensionId = '35'
        extensionName = 'powershell'
        displayName = 'PowerShell'
        shortDescription = 'Develop PowerShell scripts in Azure Data Studio'
        publisher = [ordered]@{
            displayName = 'Microsoft'
            publisherId = 'Microsoft'
            publisherName = 'Microsoft'
        }
        versions = @(
            NewReleaseVersionEntry -Version $ExtensionVersion
        )
        statistics = @()
        flags = 'preview'
    }

}

function FindPSExtensionJsonSpan
{
    param(
        [Parameter()]
        [string]
        $GalleryExtensionFileContent
    )

    try
    {
        $reader = [System.IO.StringReader]::new($GalleryExtensionFileContent)
        $jsonReader = [Newtonsoft.Json.JsonTextReader]::new($reader)

        $depth = 0
        $startLine = -1
        $startColumn = -1
        $startDepth = -1
        $awaitingExtensionName = $false
        $foundPowerShell = $false
        while ($jsonReader.Read())
        {
            switch ($jsonReader.TokenType)
            {
                'StartObject'
                {
                    if (-not $foundPowerShell)
                    {
                        $startDepth = $depth
                        $startLine = $jsonReader.LineNumber
                        $startColumn = $jsonReader.LinePosition
                    }
                    $depth++
                    continue
                }

                'EndObject'
                {
                    if ($foundPowerShell -and $depth -eq $startDepth + 1)
                    {
                        return @{
                            Start = @{
                                Line = $startLine
                                Column = $startColumn
                            }
                            End = @{
                                Line = $jsonReader.LineNumber
                                Column = $jsonReader.LinePosition
                            }
                        }
                    }
                    $depth--
                    continue
                }

                'PropertyName'
                {
                    if ($jsonReader.Value -eq 'extensionName')
                    {
                        $awaitingExtensionName = $true
                    }
                    continue
                }

                'String'
                {
                    if (-not $awaitingExtensionName)
                    {
                        continue
                    }

                    $awaitingExtensionName = $false

                    if ($jsonReader.Value -eq 'PowerShell')
                    {
                        $foundPowerShell = $true
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

    throw 'Did not find PowerShell extension'
}

function UpdateGalleryFile
{
    param(
        [Parameter(Mandatory)]
        [version]
        $ExtensionVersion,

        [Parameter()]
        [string]
        $GalleryFilePath = './extensionsGallery-insider.json'
    )

    # Create a new PowerShell extension entry
    $powershellEntry = NewPowerShellExtensionEntry -ExtensionVersion $ExtensionVersion
    $entryStr = ConvertToIndentedJson $powershellEntry -IndentChar "`t" -IndentWidth 1

    # Find the position in the existing file where the PowerShell extension should go
    $galleryFileContent = Get-Content -Raw $GalleryFilePath
    $span = FindPSExtensionJsonSpan -GalleryExtensionFileContent $galleryFileContent
    $startOffset = GetStringOffsetFromSpan -String $galleryFileContent -EndLine $span.Start.Line -Column $span.Start.Column
    $endOffset = GetStringOffsetFromSpan -String $galleryFileContent -EndLine $span.End.Line -StartLine $span.Start.Line -Column $span.End.Column -InitialOffset $startOffset

    # Create the new file contents with the inserted segment
    $newGalleryFileContent = ReplaceStringSegment -String $galleryFileContent -NewSegment $entryStr -StartIndex $startOffset -EndIndex $endOffset

    # Write out the new entry
    SetFileContent $GalleryFilePath $newGalleryFileContent
}

$repoLocation = Join-Path ([System.IO.Path]::GetTempPath()) 'ads-temp-checkout'
$branchName = "update-psext-$ExtensionVersion"

$cloneParams = @{
    OriginRemote = 'https://github.com/rjmholt/AzureDataStudio'
    Destination = $repoLocation
    CloneBranch = 'release/extensions'
    CheckoutBranch = $branchName
    Clobber = $true
    Remotes = @{
        upstream = 'https://github.com/Microsoft/AzureDataStudio'
    }
}
CloneRepo @cloneParams

UpdateGalleryFile -ExtensionVersion $ExtensionVersion -GalleryFilePath "$repoLocation/$GalleryFileName"

CommitAndPushChanges -RepoLocation $repoLocation -File $GalleryFileName -Branch $branchName -Message "Update PS extension to v$ExtensionVersion"

$prParams = @{
    Organization = $TargetFork
    Repository = 'AzureDataStudio'
    TargetBranch = 'release/extensions'
    Branch = $branchName
    Title = "Update PowerShell extension to v$ExtensionVersion"
    Description = "Updates the version of the PowerShell extension in ADS to $ExtensionVersion.`n**Note**: This is an automated PR."
    GitHubToken = $GitHubToken
    FromOrg = 'rjmholt'
}
OpenGitHubPr @prParams