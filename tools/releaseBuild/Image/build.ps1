param ( [string]$target )
if ( ! (test-path ${target} ) ) {
    new-item -type directory ${target}
}
else {
    if ( test-path -pathtype leaf ${target} ) {
        remove-item -force ${target}
        new-item -type directory ${target}
    }
}
push-location C:/vscode-powershell
Invoke-Build GetExtensionData,Clean,Build,Test,CheckPreview,Package
Copy-Item -Verbose -Recurse "C:/vscode-powershell/PowerShell-insiders.vsix" "${target}/PowerShell-insiders.vsix"
Copy-Item -Verbose -Recurse "C:/vscode-powershell/scripts/Install-VSCode.ps1" "${target}/Install-VSCode.ps1"
