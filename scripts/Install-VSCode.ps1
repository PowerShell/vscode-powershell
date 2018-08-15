<#PSScriptInfo

.VERSION 1.1

.GUID 539e5585-7a02-4dd6-b9a6-5dd288d0a5d0

.AUTHOR Microsoft

.COMPANYNAME Microsoft Corporation

.COPYRIGHT (c) Microsoft Corporation

.TAGS install vscode installer

.LICENSEURI https://github.com/PowerShell/vscode-powershell/blob/develop/LICENSE.txt

.PROJECTURI https://github.com/PowerShell/vscode-powershell/blob/develop/scripts/Install-VSCode.ps1

.ICONURI

.EXTERNALMODULEDEPENDENCIES

.REQUIREDSCRIPTS

.EXTERNALSCRIPTDEPENDENCIES

.RELEASENOTES
    15/08/2018 - added functionality to install the new "User Install" variant of Insiders Edition.
    --
    28/12/2017 - added functionality to support 64-bit versions of VSCode
    & support for installation of VSCode Insiders Edition.
    --
    Initial release.
#>

<#
.SYNOPSIS
    Installs Visual Studio Code, the PowerShell extension, and optionally
    a list of additional extensions.

.DESCRIPTION
    This script can be used to easily install Visual Studio Code and the
    PowerShell extension on your machine.  You may also specify additional
    extensions to be installed using the -AdditionalExtensions parameter.
    The -LaunchWhenDone parameter will cause VS Code to be launched as
    soon as installation has completed.

    Please contribute improvements to this script on GitHub!

    https://github.com/PowerShell/vscode-powershell/blob/develop/scripts/Install-VSCode.ps1

.PARAMETER Architecture
    A validated string defining the bit version to download. Values can be either 64-bit or 32-bit.
    If 64-bit is chosen and the OS Architecture does not match, then the 32-bit build will be
    downloaded instead. If parameter is not used, then 64-bit is used as default.

.PARAMETER BuildEdition
    A validated string defining which build edition or "stream" to download:
    Stable or Insiders Edition (system install or user profile install).
    If the parameter is not used, then stable is downloaded as default.


.PARAMETER AdditionalExtensions
    An array of strings that are the fully-qualified names of extensions to be
    installed in addition to the PowerShell extension.  The fully qualified
    name is formatted as "<publisher name>.<extension name>" and can be found
    next to the extension's name in the details tab that appears when you
    click an extension in the Extensions panel in Visual Studio Code.

.PARAMETER LaunchWhenDone
    When present, causes Visual Studio Code to be launched as soon as installation
    has finished.

.EXAMPLE
    Install-VSCode.ps1 -Architecture 32-bit

    Installs Visual Studio Code (32-bit) and the powershell extension.
.EXAMPLE
    Install-VSCode.ps1 -LaunchWhenDone

    Installs Visual Studio Code (64-bit) and the PowerShell extension and then launches
    the editor after installation completes.

.EXAMPLE
    Install-VSCode.ps1 -AdditionalExtensions 'eamodio.gitlens', 'vscodevim.vim'

    Installs Visual Studio Code (64-bit), the PowerShell extension, and additional
    extensions.

.EXAMPLE
    Install-VSCode.ps1 -BuildEdition Insider-User -LaunchWhenDone

    Installs Visual Studio Code Insiders Edition (64-bit) to the user profile and then launches the editor
    after installation completes.

.NOTES
    This script is licensed under the MIT License:

    Copyright (c) Microsoft Corporation.

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
#>
[CmdletBinding()]
param(
    [parameter()]
    [ValidateSet(,"64-bit","32-bit")]
    [string]$Architecture = "64-bit",

    [parameter()]
    [ValidateSet("Stable","Insider-System","Insider-User")]
    [string]$BuildEdition = "Stable",

    [Parameter()]
    [switch]$User,

    [Parameter()]
    [ValidateNotNull()]
    [string[]]$AdditionalExtensions = @(),

    [switch]$LaunchWhenDone
)

if (!($IsLinux -or $IsOSX)) {
    switch ($Architecture) {
        "64-bit" {
            if ((Get-CimInstance -ClassName Win32_OperatingSystem).OSArchitecture -eq "64-bit") {
                $codePath = $env:ProgramFiles
                $bitVersion = "win32-x64"
            }
            else {
                $codePath = $env:ProgramFiles
                $bitVersion = "win32"
                $Architecture = "32-bit"
            }
            break;
        }
        "32-bit" {
            if ((Get-CimInstance -ClassName Win32_OperatingSystem).OSArchitecture -eq "32-bit"){
                $codePath = $env:ProgramFiles
                $bitVersion = "win32"
            }
            else {
                $codePath = ${env:ProgramFiles(x86)}
                $bitVersion = "win32"
            }
            break;
        }
    }
    switch ($BuildEdition) {
        "Stable" {
            $codeCmdPath = "$codePath\Microsoft VS Code\bin\code.cmd"
            $appName = "Visual Studio Code ($($Architecture))"
            $fileUri = "https://vscode-update.azurewebsites.net/latest/$($bitVersion)/$($BuildEdition)"

            break;
        }
        "Insider-System" {
            $codeCmdPath = "$codePath\Microsoft VS Code Insiders\bin\code-insiders.cmd"
            $appName = "Visual Studio Code - Insiders Edition ($($Architecture))"
            $fileUri = "https://vscode-update.azurewebsites.net/latest/$($bitVersion)/$($BuildEdition)"

            break;
        }
        "Insider-User" {
            $codeCmdPath = "$env:LocalAppData\Programs\Microsoft VS Code Insiders\bin\code-insiders.cmd"
            $appName = "Visual Studio Code - Insiders Edition ($($Architecture) - User)"
            $fileUri = "https://vscode-update.azurewebsites.net/latest/$($bitVersion)-user/$($BuildEdition)"
            break;
        }
    }
    try {
        $ProgressPreference = 'SilentlyContinue'

        if (!(Test-Path $codeCmdPath)) {
            Write-Host "`nDownloading latest $appName..." -ForegroundColor Yellow
            Remove-Item -Force "$env:TEMP\vscode-$($BuildEdition).exe" -ErrorAction SilentlyContinuev
            $bitsDl = Start-BitsTransfer $fileUri -Destination "$env:TEMP\vscode-$($BuildEdition).exe" -Asynchronous
            do {
                Write-Progress -Activity "Downloading: $AppName" -Status "$([math]::round($bitsDl.BytesTransferred / 1mb))mb / $([math]::round($bitsDl.BytesTotal / 1mb))mb" -PercentComplete ($($bitsDl.BytesTransferred) / $($bitsDl.BytesTotal) * 100 )
            }
            until ($bitsDl.JobState -eq "Transferred")

            Write-Host "`nInstalling $appName..." -ForegroundColor Yellow
            Start-Process -Wait "$env:TEMP\vscode-$($BuildEdition).exe" -ArgumentList /silent, /mergetasks=!runcode
        }
        else {
            Write-Host "`n$appName is already installed." -ForegroundColor Yellow
        }

        $extensions = @("ms-vscode.PowerShell") + $AdditionalExtensions
        foreach ($extension in $extensions) {
            Write-Host "`nInstalling extension $extension..." -ForegroundColor Yellow
            & $codeCmdPath --install-extension $extension
        }

        if ($LaunchWhenDone) {
            Write-Host "`nInstallation complete, starting $appName...`n`n" -ForegroundColor Green
            & $codeCmdPath
        }
        else {
            Write-Host "`nInstallation complete!`n`n" -ForegroundColor Green
        }
    }
    finally {
        $ProgressPreference = 'Continue'
    }
}
else {
    Write-Error "This script is currently only supported on the Windows operating system."
}
