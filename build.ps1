#!/usr/bin/env pwsh
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
<#
.SYNOPSIS
A bootstrap for Invoke-Build which will perform the rest of the process. This is mostly compatability for programs that still use it, normally you should use Invoke-Build directly unless you don't have invoke-build installed. For noninteractive use, be sure to specify -Confirm:$false to avoid prompts
#>
#requires -version 5
using namespace System.Management.Automation
using namespace System.Collections.Generic

[CmdletBinding(DefaultParameterSetName = 'Build')]
param(
    [Parameter(ParameterSetName = 'Bootstrap')]
    [switch]
    $Bootstrap,

    [Parameter(ParameterSetName = 'Build')]
    [switch]
    $Clean,

    [Parameter(ParameterSetName = 'Build')]
    [switch]
    $Test
)
$SCRIPT:ErrorActionPreference = 'Stop'
# Pin the InvokeBuild version to avoid possible supply chain attacks or breaking changes.
$InvokeBuildVersion = '5.10.3'

# Get unique non-common parameters specified to pass to Invoke-Build
[hashset[string]]$commonParameters = ([PSCmdlet]::CommonParameters, [PSCmdlet]::OptionalCommonParameters) | ForEach-Object { $_ }
$ibParams = @{}
$ibParams.Task = ($PSBoundParameters.Keys | Where-Object { $_ -notin $commonParameters }) -join ','
$commonParams = @{}
$PSBoundParameters.GetEnumerator() | Where-Object Key -In $commonParameters | ForEach-Object {
    $commonParams[$PSItem.Key] = $PSItem.Value
    $ibParams[$PSItem.Key] = $PSItem.Value
}

try {
    $invokeBuildCommand = Get-Command Invoke-Build -FullyQualifiedModule @{ModuleName = 'InvokeBuild'; RequiredVersion = $InvokeBuildVersion }
    Write-Verbose "Bootstrap: Invoke-Build $InvokeBuildVersion detected."
} catch {
    Write-Warning "Invoke-Build $InvokeBuildVersion not detected. Installing..."
    Install-Module -Name InvokeBuild -RequiredVersion $InvokeBuildVersion -Scope CurrentUser @commonParams
}

Write-Verbose "Starting Invoke-Build $($ibParams.Task -join ', ')"
& $invokeBuildCommand @ibParams

# $NeededTools = @{
#     VSCode = "Visual Studio Code"
#     NodeJS = "Node.js 6.0 or higher"
#     PowerShellGet = "PowerShellGet latest"
#     InvokeBuild = "InvokeBuild latest"
# }

# function needsVSCode () {
#     try {
#             $vscodeVersion = (code -v)
#             if (-not $vscodeVersion) {
#                 Throw
#             }
#     } catch {
#         try {
#             $vscodeInsidersVersion = (code-insiders -v)
#             if (-not $vscodeInsidersVersion) {
#                 Throw
#             }
#         } catch {
#             return $true
#         }
#     }
#     return $false
# }

# function needsNodeJS () {
#     try {
#         $nodeJSVersion = node -v
#     } catch {
#         return $true
#     }

#     if ($nodeJSVersion -notmatch 'v(\d+\.\d+\.\d+)') {
#         return $true
#     }

#     $nodeVer = [System.Version]$matches[1]
#     return ($nodeVer.Major -lt 6)
# }

# function needsPowerShellGet () {
#     if (Get-Module -ListAvailable -Name PowerShellGet) {
#         return $false
#     }
#     return $true
# }

# function needsInvokeBuild () {
#     if (Get-Module -ListAvailable -Name InvokeBuild) {
#         return $false
#     }
#     return $true
# }

# function getMissingTools () {
#     $missingTools = @()

#     if (needsVSCode) {
#         $missingTools += $NeededTools.VSCode
#     }
#     if (needsNodeJS) {
#         $missingTools += $NeededTools.NodeJS
#     }
#     if (needsPowerShellGet) {
#         $missingTools += $NeededTools.PowerShellGet
#     }
#     if (needsInvokeBuild) {
#         $missingTools += $NeededTools.InvokeBuild
#     }

#     return $missingTools
# }

# function hasMissingTools () {
#     return ((getMissingTools).Count -gt 0)
# }

# if ($Bootstrap) {
#     $string = "Here is what your environment is missing:`n"
#     $missingTools = getMissingTools
#     if (($missingTools).Count -eq 0) {
#         $string += "* nothing!`n`n Run this script without a flag to build or a -Clean to clean."
#     } else {
#         $missingTools | ForEach-Object {$string += "* $_`n"}
#         $string += "`nAll instructions for installing these tools can be found on VSCode PowerShell's Github:`n" `
#             + "https://github.com/PowerShell/vscode-powershell/blob/main/docs/development.md"
#     }
#     Write-Host "`n$string`n"
# } elseif(hasMissingTools) {
#     Write-Host "You are missing needed tools. Run './build.ps1 -Bootstrap' to see what they are."
# } else {
#     if($Clean) {
#         Invoke-Build Clean
#     }

#     Invoke-Build Build

#     if($Test) {
#         Invoke-Build Test
#     }
# }
