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
Invoke-Build GetExtensionVersion,Clean,Build,Test,Package
Copy-Item -Verbose -Recurse "C:/vscode-powershell/PowerShell-insiders.vsix" "${target}/PowerShell-insiders.vsix"
