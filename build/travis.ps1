# Install InvokeBuild
Install-Module InvokeBuild -Scope CurrentUser -Force
Install-Module PlatyPS -Scope CurrentUser -Force

# Build the code and perform tests
Import-module InvokeBuild
Invoke-Build
