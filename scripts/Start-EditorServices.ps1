# PowerShell Editor Services Bootstrapper Script
# ----------------------------------------------
# This script contains startup logic for the PowerShell Editor Services
# module when launched by an editor.  It handles the following tasks:
#
# - Verifying the existence of dependencies like PowerShellGet
# - Verifying that the expected version of the PowerShellEditorServices module is installed
# - Installing the PowerShellEditorServices module if confirmed by the user
# - Finding unused TCP port numbers for the language and debug services to use
# - Starting the language and debug services from the PowerShellEditorServices module
#
# NOTE: If editor integration authors make modifications to this
#       script, please consider contributing changes back to the
#       canonical version of this script at the PowerShell Editor
#       Services GitHub repository:
#
#       https://github.com/PowerShell/PowerShellEditorServices/blob/master/module/Start-EditorServices.ps1

param(
    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $EditorServicesVersion,

    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $HostName,

    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $HostProfileId,

    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $HostVersion,

    [ValidateNotNullOrEmpty()]
    [string]
    $BundledModulesPath,

    [ValidateNotNullOrEmpty()]
    $LogPath,

    [ValidateSet("Normal", "Verbose", "Error", "Diagnostic")]
    $LogLevel,

	[Parameter(Mandatory=$true)]
	[ValidateNotNullOrEmpty()]
	[string]
	$SessionDetailsPath,

    [switch]
    $EnableConsoleRepl,

    [switch]
    $DebugServiceOnly,

    [string[]]
    $AdditionalModules,

    [string[]]
    $FeatureFlags,

    [switch]
    $WaitForDebugger,

    [switch]
    $ConfirmInstall
)

$minPortNumber = 10000
$maxPortNumber = 30000

if ($LogLevel -ne "Normal") {
    $VerbosePreference = 'Continue'
    Start-Transcript (Join-Path (Split-Path $LogPath -Parent) Start-EditorServices.log) -Force
}

function LogSection([string]$msg) {
    Write-Verbose "`n#-- $msg $('-' * ([Math]::Max(0, 73 - $msg.Length)))"
}

function Log([string[]]$msg) {
    $msg | Write-Verbose
}
function ExitWithError($errorString) {
    Write-Host -ForegroundColor Red "`n`n$errorString"

    # Sleep for a while to make sure the user has time to see and copy the
    # error message
    Start-Sleep -Seconds 300

    exit 1;
}

# Are we running in PowerShell 2 or earlier?
if ($PSVersionTable.PSVersion.Major -le 2) {
    # No ConvertTo-Json on PSv2 and below, so write out the JSON manually
    "{`"status`": `"failed`", `"reason`": `"unsupported`", `"powerShellVersion`": `"$($PSVersionTable.PSVersion.ToString())`"}" |
        Set-Content -Force -Path "$SessionDetailsPath" -ErrorAction Stop

    ExitWithError "Unsupported PowerShell version $($PSVersionTable.PSVersion), language features are disabled."
}

function WriteSessionFile($sessionInfo) {
    $sessionInfoJson = ConvertTo-Json -InputObject $sessionInfo -Compress
    Log "Writing session file with contents:"
    Log $sessionInfoJson
    $sessionInfoJson | Set-Content -Force -Path "$SessionDetailsPath" -ErrorAction Stop
}

if ($host.Runspace.LanguageMode -eq 'ConstrainedLanguage') {
    WriteSessionFile @{
        "status" = "failed"
        "reason" = "languageMode"
        "detail" = $host.Runspace.LanguageMode.ToString()
    }

    ExitWithError "PowerShell is configured with an unsupported LanguageMode (ConstrainedLanguage), language features are disabled."
}

# Are we running in PowerShell 5 or later?
$isPS5orLater = $PSVersionTable.PSVersion.Major -ge 5

# If PSReadline is present in the session, remove it so that runspace
# management is easier
if ((Get-Module PSReadline).Count -gt 0) {
    LogSection "Removing PSReadLine module"
    Remove-Module PSReadline -ErrorAction SilentlyContinue
}

# This variable will be assigned later to contain information about
# what happened while attempting to launch the PowerShell Editor
# Services host
$resultDetails = $null;

function Test-ModuleAvailable($ModuleName, $ModuleVersion) {
    Log "Testing module availability $ModuleName $ModuleVersion"

    $modules = Get-Module -ListAvailable $moduleName
    if ($modules -ne $null) {
        if ($ModuleVersion -ne $null) {
            foreach ($module in $modules) {
                if ($module.Version.Equals($moduleVersion)) {
                    Log "$ModuleName $ModuleVersion found"
                    return $true;
                }
            }
        }
        else {
            Log "$ModuleName $ModuleVersion found"
            return $true;
        }
    }

    Log "$ModuleName $ModuleVersion NOT found"
    return $false;
}

function Get-PortsInUse {
    $portsInUse = @{}
    $ipGlobalProps = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties()

    $tcpConns = $ipGlobalProps.GetActiveTcpConnections()
    foreach ($tcpConn in $tcpConns) {
        $port = $tcpConn.LocalEndpoint.Port
        if (($port -ge $minPortNumber) -and ($port -le $maxPortNumber)) {
            $portsInUse[$port] = 1
        }
    }

    $tcpListeners = $ipGlobalProps.GetActiveTcpListeners()
    foreach ($tcpList in $tcpListeners) {
        $port = $tcpList.Port
        if (($port -ge $minPortNumber) -and ($port -le $maxPortNumber)) {
            $portsInUse[$port] = 1
        }
    }

    $udpListeners = $ipGlobalProps.GetActiveUdpListeners()
    foreach ($udpList in $udpListeners) {
        $port = $udpList.Port
        if (($port -ge $minPortNumber) -and ($port -le $maxPortNumber)) {
            $portsInUse[$port] = 1
        }
    }

    $portsInUse
}

<#
function Test-PortAvailability([Parameter(Mandatory=$true)][int]$PortNumber) {
    $portAvailable = $false;

    try {
        if ($isPS5orLater) {
            $ipAddress = [System.Net.Dns]::GetHostEntryAsync("localhost").Result.AddressList[0];
        }
        else {
            $ipAddress = [System.Net.Dns]::GetHostEntry("localhost").AddressList[0];
        }

        Log "Testing availability of port $PortNumber on IP address $ipAddress"

        $tcpListener = New-Object System.Net.Sockets.TcpListener @($ipAddress, $portNumber)
        $tcpListener.Start();
        $tcpListener.Stop();
        $portAvailable = $true;
    }
    catch [System.Net.Sockets.SocketException] {
        # Check the SocketErrorCode to see if it's the expected exception
        if ($_.Exception.SocketErrorCode -eq [System.Net.Sockets.SocketError]::AddressAlreadyInUse) {
            Log "Port $PortNumber is in use."
        }
        else {
            Log "Unexpected SocketException on port ${PortNumber}: $($_.Exception)"
        }
    }

    $portAvailable;
}
#>

$rand = New-Object System.Random
function Get-AvailablePort($portsInUse) {
    $triesRemaining = 10;

    while ($triesRemaining -gt 0) {
        $port = $rand.Next($minPortNumber, $maxPortNumber)
        Log "Checking port: $port, attempts remaining $triesRemaining --------------------"
        #if ($true -eq (Test-PortAvailability -PortNumber $port)) {
        if (!$portsInUse.ContainsKey($port)) {
            Write-Verbose "Port: $port is available"
            $portsInUse[$port] = 1
            return $port
        }

        Log "Port: $port is NOT available"
        $triesRemaining--;
    }

    Log "Did not find any available ports!!"
    return $null
}

# Add BundledModulesPath to $env:PSModulePath
if ($BundledModulesPath) {
    $env:PSModulePath = $env:PSModulePath.TrimEnd([System.IO.Path]::PathSeparator) + [System.IO.Path]::PathSeparator + $BundledModulesPath
    LogSection "Updated PSModulePath to:"
    Log ($env:PSModulePath -split [System.IO.Path]::PathSeparator)
}

LogSection "Check required modules available"
# Check if PowerShellGet module is available
if ((Test-ModuleAvailable "PowerShellGet") -eq $false) {
    Log "Failed to find PowerShellGet module"
    # TODO: WRITE ERROR
}

# Check if the expected version of the PowerShell Editor Services
# module is installed
$parsedVersion = New-Object System.Version @($EditorServicesVersion)
if ((Test-ModuleAvailable "PowerShellEditorServices" $parsedVersion) -eq $false) {
    if ($ConfirmInstall -and $isPS5orLater) {
        # TODO: Check for error and return failure if necessary
        LogSection "Install PowerShellEditorServices"
        Install-Module "PowerShellEditorServices" -RequiredVersion $parsedVersion -Confirm
    }
    else {
        # Indicate to the client that the PowerShellEditorServices module
        # needs to be installed
        Write-Output "needs_install"
    }
}

try {
    LogSection "Start up PowerShellEditorServices"
    Log "Importing PowerShellEditorServices"

    if ($isPS5orLater) {
        Import-Module PowerShellEditorServices -RequiredVersion $parsedVersion -ErrorAction Stop
    }
    else {
        Import-Module PowerShellEditorServices -Version $parsedVersion -ErrorAction Stop
    }

    # Locate available port numbers for services
    Log "Ports in use in range ${minPortNumber}-${maxPortNumber}:"
    $portsInUse = Get-PortsInUse
    $OFS = ","
    Log "$($portsInUse.Keys | Sort-Object -Unique)"

    Log "Searching for available socket port for the language service"
    $languageServicePort = Get-AvailablePort $portsInUse

    Log "Searching for available socket port for the debug service"
    $debugServicePort = Get-AvailablePort $portsInUse

    if (!$languageServicePort -or !$debugServicePort) {
        ExitWithError "failed to find an open socket port for either the language or debug service"
    }

    if ($EnableConsoleRepl) {
        Write-Host "PowerShell Integrated Console`n"
    }

    # Create the Editor Services host
    Log "Invoking Start-EditorServicesHost"
    $editorServicesHost =
        Start-EditorServicesHost `
            -HostName $HostName `
            -HostProfileId $HostProfileId `
            -HostVersion $HostVersion `
            -LogPath $LogPath `
            -LogLevel $LogLevel `
            -AdditionalModules $AdditionalModules `
            -LanguageServicePort $languageServicePort `
            -DebugServicePort $debugServicePort `
            -BundledModulesPath $BundledModulesPath `
            -EnableConsoleRepl:$EnableConsoleRepl.IsPresent `
            -DebugServiceOnly:$DebugServiceOnly.IsPresent `
            -WaitForDebugger:$WaitForDebugger.IsPresent

    # TODO: Verify that the service is started
    Log "Start-EditorServicesHost returned $editorServicesHost"

    $resultDetails = @{
        "status" = "started";
        "channel" = "tcp";
        "languageServicePort" = $languageServicePort;
        "debugServicePort" = $debugServicePort;
    }

    # Notify the client that the services have started
    WriteSessionFile $resultDetails

    Log "Wrote out session file"
}
catch [System.Exception] {
    $e = $_.Exception;
    $errorString = ""

    Log "ERRORS caught starting up EditorServicesHost"

    while ($e -ne $null) {
        $errorString = $errorString + ($e.Message + "`r`n" + $e.StackTrace + "`r`n")
        $e = $e.InnerException;
        Log $errorString
    }

    ExitWithError ("An error occurred while starting PowerShell Editor Services:`r`n`r`n" + $errorString)
}

try {
    # Wait for the host to complete execution before exiting
    LogSection "Waiting for EditorServicesHost to complete execution"
    $editorServicesHost.WaitForCompletion()
    Log "EditorServicesHost has completed execution"
}
catch [System.Exception] {
    $e = $_.Exception;
    $errorString = ""

    Log "ERRORS caught while waiting for EditorServicesHost to complete execution"

    while ($e -ne $null) {
        $errorString = $errorString + ($e.Message + "`r`n" + $e.StackTrace + "`r`n")
        $e = $e.InnerException;
        Log $errorString
    }
}
