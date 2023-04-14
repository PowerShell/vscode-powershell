#!/usr/bin/env pwsh
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
<#
.SYNOPSIS
A bootstrap for Invoke-Build which will perform the rest of the process. This is mostly compatability for programs that still use it, normally you should use Invoke-Build directly unless you don't have invoke-build installed.
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
if (-not $ibParams.Task) {
    $ibParams.Task = '.'
}
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
    Install-Module -Name InvokeBuild -RequiredVersion $InvokeBuildVersion -Scope CurrentUser @commonParams -Force
}

Write-Verbose "Starting Invoke-Build $($ibParams.Task -join ', ')"
& $invokeBuildCommand @ibParams
