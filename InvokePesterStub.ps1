#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Stub around Invoke-Pester command used by VSCode PowerShell extension.
.DESCRIPTION
    The stub checks the version of Pester and if >= 4.6.0, invokes Pester
    using the LineNumber parameter (if specified). Otherwise, it invokes
    using the TestName parameter (if specified). If the All parameter
    is specified, then all the tests are invoked in the specifed file.
    Finally, if none of these three parameters are specified, all tests
    are invoked and a warning is issued indicating what the user can do
    to allow invocation of individual Describe blocks.
.EXAMPLE
    PS C:\> .\InvokePesterStub.ps1 ~\project\test\foo.tests.ps1 -LineNumber 14
    Invokes a specific test by line number in the specified file.
.EXAMPLE
    PS C:\> .\InvokePesterStub.ps1 ~\project\test\foo.tests.ps1 -TestName 'Foo Tests'
    Invokes a specific test by test name in the specified file.
.EXAMPLE
    PS C:\> .\InvokePesterStub.ps1 ~\project\test\foo.tests.ps1 -All
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
    $LineNumber,

    # If specified, executes all the tests in the specified test script.
    [Parameter()]
    [switch]
    $All
)

$pesterModule = Microsoft.PowerShell.Core\Get-Module Pester
if (!$pesterModule) {
    Write-Output "Importing Pester module..."
    $pesterModule = Microsoft.PowerShell.Core\Import-Module Pester -ErrorAction Ignore -PassThru
    if (!$pesterModule) {
        # If we still don't have an imported Pester module, that is (most likely) because Pester is not installed.
        Write-Warning "Failed to import the Pester module. You must install Pester to run or debug Pester tests."
        Write-Warning "You can install Pester by executing: Install-Module Pester -Scope CurrentUser -Force"
        return
    }
}

if ($All) {
    Pester\Invoke-Pester -Script $ScriptPath -PesterOption @{IncludeVSCodeMarker=$true}
}
elseif ($TestName) {
    Pester\Invoke-Pester -Script $ScriptPath -PesterOption @{IncludeVSCodeMarker=$true} -TestName $TestName
}
elseif (($LineNumber -match '\d+') -and ($pesterModule.Version -ge '4.6.0')) {
    Pester\Invoke-Pester -Script $ScriptPath -PesterOption (New-PesterOption -ScriptBlockFilter @{
        IncludeVSCodeMarker=$true; Line=$LineNumber; Path=$ScriptPath})
}
else {
    # We get here when the TestName expression is of type ExpandableStringExpressionAst.
    # PSES will not attempt to "evaluate" the expression so it returns null for the TestName.
    Write-Warning "The Describe block's TestName cannot be evaluated. EXECUTING ALL TESTS instead."
    Write-Warning "To avoid this, install Pester >= 4.6.0 or remove any expressions in the TestName."

    Pester\Invoke-Pester -Script $ScriptPath -PesterOption @{IncludeVSCodeMarker=$true}
}
