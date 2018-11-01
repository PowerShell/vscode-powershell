<#PSScriptInfo

.VERSION 1.2

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
    21/03/2018 - added functionality to install the VSCode context menus. Also, VSCode is now always added to the search path
    --
    20/03/2018 - fix OS detection to prevent error
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

.PARAMETER EnableContextMenus
    When present, causes the installer to configure the Explorer context menus

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
    [ValidateSet(, "64-bit", "32-bit")]
    [string]$Architecture = "64-bit",

    [parameter()]
    [ValidateSet("Stable", "Insider-System", "Insider-User")]
    [string]$BuildEdition = "Stable",

    [Parameter()]
    [ValidateNotNull()]
    [string[]]$AdditionalExtensions = @(),

    [switch]$LaunchWhenDone,

    [switch]$EnableContextMenus,

    [switch]$WhatIf
)

function Test-IsOsX64 {
    if ($PSVersionTable.PSVersion.Major -lt 6) {
        return (Get-CimInstance -ClassName Win32_OperatingSystem).OSArchitecture -eq "64-bit"
    }

    return [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -eq [System.Runtime.InteropServices.Architecture]::X64
}

function Get-LinuxReleaseInfo {
    if (-not (Test-Path '/etc/*-release')) {
        return $null
    }

    return Get-Content -Raw '/etc/*-release' -ErrorAction SilentlyContinue `
        | ConvertFrom-Csv -Delimiter '=' -Header 'Key','Value' `
        | ForEach-Object { $obj = @{} } { $obj[$_.Key] = $_.Value } { [pscustomobject]$obj }
}

function Get-CodePlatformInformation {
    param(
        [Parameter(Mandatory=$true)]
        [ValidateSet('32-bit', '64-bit')]
        [string]
        $Bitness,

        [Parameter(Mandatory=$true)]
        [ValidateSet('Stable', 'Insider-System', 'Insider-User')]
        [string]
        $BuildEdition
    )

    if ($IsWindows -or $PSVersionTable.PSVersion.Major -lt 6) {
        $os = 'Windows'
    }
    elseif ($IsLinux) {
        $os = 'Linux'
    }
    elseif ($IsMacOS) {
        $os = 'MacOS'
    }
    else {
        throw 'Could not identify operating system'
    }

    if ($Bitness -ne '64-bit' -and $os -ne 'Windows') {
        throw "Non-64-bit *nix systems are not supported"
    }

    if ($BuildEdition.EndsWith('User') -and $os -ne 'Windows') {
        throw 'User builds are not available for non-Windows systems'
    }

    switch ($BuildEdition) {
        'Stable' {
            $appName = "Visual Studio Code ($Bitness)"
            break
        }

        'Insider-System' {
            $appName = "Visual Studio Code - Insiders Edition ($Bitness)"
            break
        }

        'Insider-User' {
            $appName = "Visual Studio Code - Insiders Edition ($($Architecture) - User)"
            break
        }
    }

    switch ($os) {
        'Linux' {
            $releaseInfo = Get-LinuxReleaseInfo

            switch ($releaseInfo.NAME) {
                { 'Ubuntu','Debian' -contains $_ } {
                    $platform = 'linux-deb-x64'
                    $ext = 'deb'
                    break
                }

                { 'Fedora','CentOS','RedHat' -contains $_ } {
                    $platform = 'linux-rpm-x64'
                    $ext = 'deb'
                    break
                }

                default {
                    $platform = 'linux-x64'
                    $ext = 'tar.gz'
                    break
                }
            }

            if ($BuildEdition.StartsWith('Insider')) {
                $exePath = '/usr/bin/code-insiders'
                break
            }

            $exePath = '/usr/bin/code'
            break
        }

        'MacOS' {
            $platform = 'darwin'
            $ext = 'zip'

            if ($BuildEdition.StartsWith('Insider')) {
                $exePath = '/usr/local/bin/code-insiders'
                break
            }

            $exePath = '/usr/local/bin/code'
            break
        }

        'Windows' {
            $ext = 'exe'
            switch ($Bitness) {
                '32-bit' {
                    $platform = 'win32'

                    if (Test-IsOsX64) {
                        $installBase = ${env:ProgramFiles(x86)}
                        break
                    }

                    $installBase = ${env:ProgramFiles}
                    break
                }

                '64-bit' {
                    $installBase = ${env:ProgramFiles}

                    if (Test-IsOsX64) {
                        $platform = 'win32-x64'
                        break
                    }

                    Write-Warning '64-bit install requested on 32-bit system. Installing 32-bit VSCode'
                    $platform = 'win32'
                    break
                }
            }

            switch ($BuildEdition) {
                'Stable' {
                    $exePath = "$installBase\Microsoft VS Code\bin\code.cmd"
                }

                'Insiders-System' {
                    $exePath = "$installBase\Microsoft VS Code Insiders\bin\code-insiders.cmd"
                }

                'Insiders-User' {
                    $exePath = "${env:LocalAppData}\Programs\Microsoft VS Code Insiders\bin\code-insiders.cmd"
                }
            }
        }
    }

    switch ($BuildEdition) {
        'Stable' {
            $channel = 'stable'
            break
        }

        'Insiders-System' {
            $channel = 'insider'
            break
        }

        'Insiders-User' {
            $channel = 'insider'
            $platform += '-user'
            break
        }
    }

    $info = @{
        AppName = $appName
        ExePath = $exePath
        Platform = $platform
        Channel = $channel
        FileUri = "https://vscode-update.azurewebsites.net/latest/$platform/$channel"
        Extension = $ext
    }

    return $info
}

function Save-WithBitsTransfer {
    param(
        [Parameter(Mandatory=$true)]
        [string]
        $FileUri,

        [Parameter(Mandatory=$true)]
        [string]
        $Destination,

        [Parameter(Mandatory=$true)]
        [string]
        $AppName
    )

    Write-Host "`nDownloading latest $AppName..." -ForegroundColor Yellow

    Remove-Item -Force $Destination -ErrorAction SilentlyContinue

    $bitsDl = Start-BitsTransfer $FileUri -Destination $Destination -Asynchronous

    while (($bitsDL.JobState -eq "Transferring") -or ($bitsDL.JobState -eq "Connecting")) {
        Write-Progress -Activity "Downloading: $AppName" -Status "$([math]::round($bitsDl.BytesTransferred / 1mb))mb / $([math]::round($bitsDl.BytesTotal / 1mb))mb" -PercentComplete ($($bitsDl.BytesTransferred) / $($bitsDl.BytesTotal) * 100 )
    }

    switch ($bitsDl.JobState) {

        "Transferred" {
            Complete-BitsTransfer -BitsJob $bitsDl
            break
        }

        "Error" {
            throw "Error downloading installation media."
        }
    }
}

function Install-VSCodeFromTar {
    param(
        [Parameter(Mandatory=$true)]
        [string]
        $TarPath,

        [Parameter()]
        [switch]
        $Insiders
    )

    $tarDir = Join-Path ([System.IO.Path]::GetTempPath()) 'VSCodeTar'
    $destDir = "/opt/VSCode-linux-x64"

    New-Item -ItemType Directory -Force -Path $tarDir
    try {
        Push-Location $tarDir
        tar xf $TarPath
        Move-Item -LiteralPath "$tarDir/VSCode-linux-x64" $destDir
    }
    finally {
        Pop-Location
    }

    if ($Insiders) {
        ln -s "$destDir/code-insiders" /usr/bin/code-insiders
        return
    }

    ln -s "$destDir/code" /usr/bin/code
}

try {
    $prevProgressPreference = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'

    $prevWhatIfPreference = $WhatIfPreference
    $WhatIfPreference = $WhatIfPreference -or $WhatIf

    $onWindows = $IsWindows -or $PSVersionTable.PSVersion.Major -lt 6

    # Get information required for installation
    $codePlatformInfo = Get-CodePlatformInformation -Bitness $Architecture -BuildEdition $BuildEdition

    # Download the installer
    $tmpdir = [System.IO.Path]::GetTempPath()

    $installerName = "vscode-install.$ext"

    $installerPath = [System.IO.Path]::Combine($tmpdir, $installerName)

    if ($onWindows) {
        Save-WithBitsTransfer -FileUri $codePlatformInfo.FileUri -Destination $installerPath -AppName $codePlatformInfo.AppName
    }
    else {
        Invoke-WebRequest -Uri $FileUri -OutFile $installerPath
    }

    # Install VSCode
    switch ($codePlatformInfo.Extension) {
        # On Debian-like Linux distros
        'deb' {
            if ($WhatIfPreference) {
                Write-Host "WhatIf: apt install $installerPath"
                break
            }
            apt install $installerPath
            break
        }

        # On RedHat-list Linux distros
        'rpm' {
            if ($WhatIfPreference) {
                Write-Host "WhatIf: rpm -ivh $installerPath"
                break
            }
            rpm -ivh $installerPath
            break
        }

        # On Windows
        'exe' {
            $exeArgs = '/verysilent /tasks=addtopath'
            if ($EnableContextMenus) {
                $exeArgs = '/verysilent /tasks=addcontextmenufiles,addcontextmenufolders,addtopath'
            }

            if ($WhatIfPreference) {
                Write-Host "WhatIf: Running $installerPath with args '$exeArgs'"
                break
            }

            Start-Process -Wait $installerPath -ArgumentList $exeArgs
            break
        }

        # On Mac
        'zip' {
            if ($WhatIfPreference) {
                Write-Host "Expanding zip $installerPath and moving to /Applications/"
                break
            }

            $zipDirPath = [System.IO.Path]::Combine($tmpdir, 'VSCode')
            Expand-Archive -LiteralPath $installerPath -DestinationPath $zipDirPath -Force
            Move-Item "$zipDirPath/*.app" '/Applications/'
            break
        }

        # Remaining Linux distros using tar - more complicated
        'tar.gz' {
            if ($WhatIfPreference) {
                Write-Host "Expanding tar $installerPath, moving to /opt/ and symlinking"
                break
            }

            Install-VSCodeFromTar -TarPath $installerPath -Insiders:($BuildEdition -ne 'Stable')
            break
        }

        default {
            throw "Unkown package type: $($codePlatformInfo.Extension)"
        }
    }

    $codeExePath = $codePlatformInfo.ExePath

    # Install any extensions
    $extensions = @("ms-vscode.PowerShell") + $AdditionalExtensions
    if ($WhatIfPreference) {
        Write-Host ("Installing extensions: " + ($extensions -join ','))
    }
    else {
        foreach ($extension in $extensions) {
            Write-Host "`nInstalling extension $extension..." -ForegroundColor Yellow
            & $codeExePath --install-extension $extension
        }
    }

    # Launch if requested
    if ($LaunchWhenDone) {
        $appName = $codePlatformInfo.AppName

        if ($WhatIfPreference) {
            Write-Host "Launching $appName from $codeExePath"
        }

        Write-Host "`nInstallation complete, starting $appName...`n`n" -ForegroundColor Green
        & $codeExePath
        return
    }

    Write-Host "`nInstallation complete!`n`n" -ForegroundColor Green
}
finally {
    $ProgressPreference = $prevProgressPreference
    $WhatIfPreference = $prevWhatIfPreference
}