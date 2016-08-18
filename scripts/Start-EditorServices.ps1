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

    [ValidateSet("Normal", "Verbose", "Error")]
    $LogLevel,

    [switch]
    $WaitForDebugger,

    [switch]
    $ConfirmInstall
)

# This variable will be assigned later to contain information about
# what happened while attempting to launch the PowerShell Editor
# Services host
$resultDetails = $null;

function Test-ModuleAvailable($ModuleName, $ModuleVersion) {
    $modules = Get-Module -ListAvailable $moduleName
    if ($modules -ne $null) {
        if ($ModuleVersion -ne $null) {
            foreach ($module in $modules) {
                if ($module.Version.Equals($moduleVersion)) {
                    return $true;
                }
            }
        }
        else {
            return $true;
        }
    }

    return $false;
}

function Test-PortAvailability($PortNumber) {
    $portAvailable = $true;

    try {
        $ipAddress = [System.Net.Dns]::GetHostEntryAsync("localhost").Result.AddressList[0];
        $tcpListener = [System.Net.Sockets.TcpListener]::new($ipAddress, $portNumber);
        $tcpListener.Start();
        $tcpListener.Stop();

    }
    catch [System.Net.Sockets.SocketException] {
        # Check the SocketErrorCode to see if it's the expected exception
        if ($error[0].Exception.InnerException.SocketErrorCode -eq [System.Net.Sockets.SocketError]::AddressAlreadyInUse) {
            $portAvailable = $false;
        }
        else {
            Write-Output ("Error code: " + $error[0].SocketErrorCode)
        }
    }

    return $portAvailable;
}

$rand = [System.Random]::new()
function Get-AvailablePort {
    $triesRemaining = 10;

    while ($triesRemaining -gt 0) {
        $port = $rand.Next(10000, 30000)
        if ((Test-PortAvailability -PortAvailability $port) -eq $true) {
            return $port
        }

        $triesRemaining--;
    }

    return $null
}

# Add BundledModulesPath to $env:PSModulePath
if ($BundledModulesPath) {
    $env:PSMODULEPATH = $BundledModulesPath + [System.IO.Path]::PathSeparator + $env:PSMODULEPATH
}

# Check if PowerShellGet module is available
if ((Test-ModuleAvailable "PowerShellGet") -eq $false) {
    # TODO: WRITE ERROR
}

# Check if the expected version of the PowerShell Editor Services
# module is installed
$parsedVersion = [System.Version]::new($EditorServicesVersion)
if ((Test-ModuleAvailable "PowerShellEditorServices" -RequiredVersion $parsedVersion) -eq $false) {
    if ($ConfirmInstall) {
        # TODO: Check for error and return failure if necessary
        Install-Module "PowerShellEditorServices" -RequiredVersion $parsedVersion -Confirm
    }
    else {
        # Indicate to the client that the PowerShellEditorServices module
        # needs to be installed
        Write-Output "needs_install"
    }
}

Import-Module PowerShellEditorServices -RequiredVersion $parsedVersion -ErrorAction Stop

# Locate available port numbers for services
$languageServicePort = Get-AvailablePort
$debugServicePort = Get-AvailablePort

$editorServicesHost =
    Start-EditorServicesHost `
        -HostName $HostName `
        -HostProfileId $HostProfileId `
        -HostVersion $HostVersion `
        -LogPath $LogPath `
        -LogLevel $LogLevel `
        -LanguageServicePort $languageServicePort `
        -DebugServicePort $debugServicePort `
        -BundledModulesPath $BundledModulesPath `
        -WaitForDebugger:$WaitForDebugger.IsPresent

# TODO: Verify that the service is started

$resultDetails = @{
    "status" = "started";
    "channel" = "tcp";
    "languageServicePort" = $languageServicePort;
    "debugServicePort" = $debugServicePort;
};

# Notify the client that the services have started
Write-Output (ConvertTo-Json -InputObject $resultDetails -Compress)

try {
    # Wait for the host to complete execution before exiting
    $editorServicesHost.WaitForCompletion()
}
catch [System.Exception] {
    $e = $_.Exception; #.InnerException;
    $errorString = ""

    while ($e -ne $null) {
        $errorString = $errorString + ($e.Message + "`r`n" + $e.StackTrace + "`r`n")
        $e = $e.InnerException;
    }

    Write-Error ("`r`nCaught error while waiting for EditorServicesHost to complete:`r`n" + $errorString)
}