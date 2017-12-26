<#
.DESCRIPTION
 Simple wrapper around MSBuild with default action.

 .PARAMETER MSBuildPath
 Path to msbuild.exe

 .NOTES
 Additional arguemnts will be passed to MSBuild Verbatim.

.EXAMPLE
PS> ./build.ps1

.EXAMPLE
PS> ./build.ps1 -MSBuildPath "c:\temp\msbuild.exe"

.EXAMPLE
PS> ./build.ps1 -MSBuildPath "c:\temp\msbuild.exe" /t:Clean /p:"Foo=Bar"

#>
[CmdletBinding(PositionalBinding=$false)]
    param (
        [parameter(mandatory=$false)]
        [ValidateScript( { Test-Path -Path $_ -PathType Leaf }  )]
        [String]$MSBuildPath,

        [parameter(mandatory=$false, ValueFromRemainingArguments=$true)]
        $MSBuildArgs
    )

if ($PSBoundParameters.ContainsKey('MSBuildPath')) {
    $msbuildExe = $MSBuildPath
} else {
    try {
        Get-Command msbuild -ErrorAction Stop | Out-Null
        $msbuildExe = "msbuild"
    } catch {
        Write-Error "Could not find MSBuild.exe in Path, please specify -MSBuildPath <path/to/msbuild.exe>"
        return
    }
}

$projectFile = "vscode-powershell.proj"
if ($args.Count -gt 0) {
	$cmdline =  @($args) + @("/bl:msbuild.binlog;ProjectImports=None", $projectFile)
} else {
    $cmdline = @("/t:BuildAll", "/v:n", "/bl:msbuild.binlog;ProjectImports=None", $projectFile)
}

& "$msbuildExe" $cmdline