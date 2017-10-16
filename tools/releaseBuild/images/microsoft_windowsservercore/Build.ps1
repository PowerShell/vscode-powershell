[cmdletbinding()]
# PowerShell Script to clone, build and package PowerShell from specified fork and branch
param (
    [string] $location = "$pwd\vscode-powershell",
    [string] $destination = "$env:WORKSPACE",
    [switch] $Wait
)

if(-not $env:homedrive)
{
    Write-Verbose "fixing empty home paths..." -Verbose
    $profileParts = $env:userprofile -split ':'
    $env:homedrive = $profileParts[0]+':'
    $env:homepath = $profileParts[1]
}

if(! (Test-Path $destination))
{
    Write-Verbose "Creating destination $destination" -Verbose
    $null = New-Item -Path $destination -ItemType Directory
}

#BUG BUG: External binaries should be retrieved via nuget package or similar
$editorServicesPath = Join-Path $location -ChildPath '..\PowerShellEditorServices'
git clone --quiet https://github.com/PowerShell/PowerShellEditorServices $editorServicesPath

Write-Verbose "homedrive : ${env:homedrive}"
Write-Verbose "homepath : ${env:homepath}"

# Don't use CIM_PhysicalMemory, docker containers may cache old values
$memoryMB = (Get-CimInstance win32_computersystem).TotalPhysicalMemory /1MB
$requiredMemoryMB = 2048
if($memoryMB -lt $requiredMemoryMB)
{
    throw "Building powershell requires at least $requiredMemoryMB MiB of memory and only $memoryMB MiB is present."
}
Write-Verbose "Running with $memoryMB MB memory." -Verbose

try{
    Install-Module InvokeBuild -Scope CurrentUser
    Import-module InvokeBuild -Verbose
    Set-Location $location

    Invoke-Build

    Get-ChildItem $location\PowerShell-*.vsix | Select-Object -ExpandProperty FullName | ForEach-Object {
        $file = $_
        Write-Verbose "Copying $file to $destination" -verbose
        Copy-Item -Path $file -Destination "$destination\" -Force
    }
}
finally
{
    Write-Verbose "Beginning build clean-up..." -verbose
    if($Wait.IsPresent)
    {
        $path = Join-Path $PSScriptRoot -ChildPath 'delete-to-continue.txt'
        $null = New-Item -Path $path -ItemType File
        Write-Verbose "Computer name: $env:COMPUTERNAME" -Verbose
        Write-Verbose "Delete $path to exit." -Verbose
        while(Test-Path -LiteralPath $path)
        {
            Start-Sleep -Seconds 60
        }
    }
}
