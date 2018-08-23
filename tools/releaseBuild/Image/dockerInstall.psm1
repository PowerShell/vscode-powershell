function Install-ChocolateyPackage
{
    param(
        [Parameter(Mandatory=$true)]
        [string]
        $PackageName,

        [Parameter(Mandatory=$false)]
        [string]
        $Executable,

        [string[]]
        $ArgumentList,

        [switch]
        $Cleanup,

        [int]
        $ExecutionTimeout = 2700,

        [string]
        $Version
    )

    if(-not(Get-Command -name Choco -ErrorAction SilentlyContinue))
    {
        Write-Verbose "Installing Chocolatey provider..." -Verbose
        Invoke-WebRequest https://chocolatey.org/install.ps1 -UseBasicParsing | Invoke-Expression
    }

    Write-Verbose "Installing $PackageName..." -Verbose
    $extraCommand = @()
    if($Version)
    {
        $extraCommand += '--version', $version
    }
    choco install -y $PackageName --no-progress --execution-timeout=$ExecutionTimeout $ArgumentList $extraCommands

    if($executable)
    {
        Write-Verbose "Verifing $Executable is in path..." -Verbose
        $exeSource = $null
        $exeSource = Get-ChildItem -path "$env:ProgramFiles\$Executable" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
        if(!$exeSource)
        {
            Write-Verbose "Falling back to x86 program files..." -Verbose
            $exeSource = Get-ChildItem -path "${env:ProgramFiles(x86)}\$Executable" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
        }

        # Don't search the chocolatey program data until more official locations have been searched
        if(!$exeSource)
        {
            Write-Verbose "Falling back to chocolatey..." -Verbose
            $exeSource = Get-ChildItem -path "$env:ProgramData\chocolatey\$Executable" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
        }

        # all obvious locations are exhausted, use brute force and search from the root of the filesystem
        if(!$exeSource)
        {
            Write-Verbose "Falling back to the root of the drive..." -Verbose
            $exeSource = Get-ChildItem -path "/$Executable" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
        }

        if(!$exeSource)
        {
            throw "$Executable not found"
        }

        $exePath = Split-Path -Path $exeSource
        Add-Path -path $exePath
    }

    if($Cleanup.IsPresent)
    {
        Remove-Folder -Folder "$env:temp\chocolatey"
    }
}

function Add-Path
{
    param
    (
        $path
    )
    $machinePathString = [System.Environment]::GetEnvironmentVariable('path',[System.EnvironmentVariableTarget]::Machine)
    $machinePath = $machinePathString -split ';'

    if($machinePath -inotcontains $path)
    {
        $newPath = "$machinePathString;$path"
        Write-Verbose "Adding $path to path..." -Verbose
        [System.Environment]::SetEnvironmentVariable('path',$newPath,[System.EnvironmentVariableTarget]::Machine)
        Write-Verbose "Added $path to path." -Verbose
        $env:Path += ";$newPath"
    }
    else
    {
        Write-Verbose "$path already in path." -Verbose
    }
}

function Remove-Folder
{
    param(
        [string]
        $Folder
    )

    Write-Verbose "Cleaning up $Folder..." -Verbose
    $filter = Join-Path -Path $Folder -ChildPath *
    [int]$measuredCleanupMB = (Get-ChildItem $filter -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Remove-Item -recurse -force $filter -ErrorAction SilentlyContinue
    Write-Verbose "Cleaned up $measuredCleanupMB MB from $Folder" -Verbose
}
