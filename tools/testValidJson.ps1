# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
<#
    .SYNOPSIS
        Get all JSON files recursively and test if they are valid by trying to import them.

    .EXAMPLE
        & $psEditor.GetEditorContext().CurrentFile.Path -WorkingDir $PWD
#>

# Input and expected output
[OutputType([System.Void])]
Param(
    [Parameter()]
    [ValidateScript({[System.IO.Directory]::Exists($_)})]
    [string] $WorkingDir = $PWD
)

# PowerShell preferences
$ErrorActionPreference = 'Stop'

# Try to import all JSON files in the repo
$TestValidJson = [PSCustomObject[]](
    [System.IO.Directory]::GetFiles($WorkingDir, '*.json', [System.IO.SearchOption]::AllDirectories).ForEach{
        [PSCustomObject]@{
            'Path'        = [string] $_
            'IsValidJson' = [bool]$(
                Try {
                    $null = ConvertFrom-Json -InputObject (Get-Content -Raw -Path $_) -AsHashtable
                    $?
                }
                Catch {
                    $false
                }
            )
        }
    }
)

# Output results
$TestValidJson | Format-Table

# Throw if errors were found
if ($TestValidJson.Where{-not $_.'IsValidJson'}.'Count' -gt 0) {
    Throw ('Found {0} non-valid JSON file(s).' -f $TestValidJson.Where{-not $_.'IsValidJson'}.'Count')
}
