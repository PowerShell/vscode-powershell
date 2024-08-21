# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

if ($PSVersionTable.PSVersion -lt [Version]"7.4") {
    throw "The build script requires PowerShell 7.4 or higher!"
}

Register-PSResourceRepository -PSGallery -Trusted -Force

Install-PSResource -Name InvokeBuild -Scope CurrentUser
Install-PSResource -Name platyPS -Scope CurrentUser
