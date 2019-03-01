#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Stub around Invoke-Pester command used by VSCode PowerShell extension.
.DESCRIPTION
    Stub around Invoke-Pester command used by VSCode PowerShell extension.
    The stub checks the version of Pester and if >= 4.6.0, invokes Pester
    using the LineNumber parameter (if specified). Otherwise, it invokes
    using the TestName parameter (if specified).
.EXAMPLE
    PS C:\> .\InvokePesterStub.ps1 ~\project\test\foo.tests.ps1 -LineNumber 14
    Invokes a specific test by line number in the specified file.
.EXAMPLE
    PS C:\> .\InvokePesterStub.ps1 ~\project\test\foo.tests.ps1 -TestName 'Foo Tests'
    Invokes a specific test by test name in the specified file.
.EXAMPLE
    PS C:\> .\InvokePesterStub.ps1 ~\project\test\foo.tests.ps1
    Invokes all tests in the specified file.
.INPUTS
    None
.OUTPUTS
    None
#>
param(
    # Specifies the path to the test script.
    [Parameter(Position=0, Mandatory)]
    [ValidateNotNullOrEmpty()]
    [string]
    $ScriptPath,

    # Specifies the name of the test taken from the Describe block's name.
    [Parameter()]
    [string]
    $TestName,

    # Specifies the starting line number of the DescribeBlock.  This feature requires
    # Pester 4.6.0 or higher.
    [Parameter()]
    [ValidatePattern('\d*')]
    [string]
    $LineNumber
)

try {
    $pesterVersion = (Microsoft.PowerShell.Core\Get-Command Invoke-Pester -ErrorAction Stop).Version
    if (($pesterVersion -ge '4.6.0') -and ($LineNumber -match '\d+')) {
        $pesterOption = New-PesterOption -ScriptBlockFilter @(
            @{ IncludeVSCodeMarker=$true; Line=$LineNumber; Path=$ScriptPath } )
        Invoke-Pester -Script $ScriptPath -PesterOption $pesterOption
    }
    elseif ($TestName) {
        Invoke-Pester -Script $ScriptPath -PesterOption @{ IncludeVSCodeMarker=$true } -TestName $TestName
    }
    else {
        Invoke-Pester -Script $ScriptPath -PesterOption @{IncludeVSCodeMarker=$true}
    }
}
catch [System.Management.Automation.CommandNotFoundException] {
    Write-Warning "You must install Pester to run or debug Pester Tests. You can install Pester by executing:"
    Write-Warning "Install-Module Pester -Scope CurrentUser -Force"
}
