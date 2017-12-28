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

.PARAMETER BuildEdition
    A validated string defining which build edition or "stream" to download - stable or
    insiders edition. If the parameter is not used, then stable is downloaded as default.

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
    Install-VSCode.ps1 -LaunchWhenDone

    Installs Visual Studio Code and the PowerShell extension and then launches
    the editor after installation completes.

.EXAMPLE
    Install-VSCode.ps1 -AdditionalExtensions 'eamodio.gitlens', 'vscodevim.vim'

    Installs Visual Studio Code, the PowerShell extension, and additional
    extensions.

.EXAMPLE
    Install-VSCode.ps1 -BuildEdition Insider -LaunchWhenDone

    Installs Visual Studio Code Insiders Edition and then launches the editor
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
    [ValidateSet("stable","insider")]
    [string]$BuildEdition = "stable",
    [Parameter()]
    [ValidateNotNull()]
    [string[]]$AdditionalExtensions = @(),
    [switch]$LaunchWhenDone
)

if (!($IsLinux -or $IsOSX)) {
    switch ($BuildEdition) {
        "Stable" {
            $codeCmdPath = "C:\Program*\Microsoft VS Code\bin\code.cmd"
            break;
        }
        "Insider" {
            $codeCmdPath = "C:\Program*\Microsoft VS Code Insiders\bin\code-insiders.cmd"
            break;
        }
    }


    try {
        $ProgressPreference = 'SilentlyContinue'

        if (!(Test-Path $codeCmdPath)) {
            Write-Host "`nDownloading latest $($BuildEdition) Visual Studio Code..." -ForegroundColor Yellow
            Remove-Item -Force "$env:TEMP\vscode-$($BuildEdition).exe" -ErrorAction SilentlyContinue
            Invoke-WebRequest -Uri "https://vscode-update.azurewebsites.net/latest/win32-x64/$($BuildEdition)" -OutFile "$env:TEMP\vscode-$($BuildEdition).exe"

            Write-Host "`nInstalling Visual Studio Code..." -ForegroundColor Yellow
            Start-Process -Wait "$env:TEMP\vscode-$($BuildEdition).exe" -ArgumentList /silent, /mergetasks=!runcode
        }
        else {
            Write-Host "`nVisual Studio Code is already installed." -ForegroundColor Yellow
        }

        $extensions = @("ms-vscode.PowerShell") + $AdditionalExtensions
        foreach ($extension in $extensions) {
            Write-Host "`nInstalling extension $extension..." -ForegroundColor Yellow
            & $codeCmdPath --install-extension $extension
        }

        if ($LaunchWhenDone) {
            Write-Host "`nInstallation complete, starting Visual Studio Code...`n`n" -ForegroundColor Green
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
