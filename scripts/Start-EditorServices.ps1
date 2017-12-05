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
    ConvertTo-Json -InputObject $sessionInfo -Compress | Set-Content -Force -Path "$SessionDetailsPath" -ErrorAction Stop
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
    Remove-Module PSReadline -ErrorAction SilentlyContinue
}

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
        if ($isPS5orLater) {
            $ipAddress = [System.Net.Dns]::GetHostEntryAsync("localhost").Result.AddressList[0];
        }
        else {
            $ipAddress = [System.Net.Dns]::GetHostEntry("localhost").AddressList[0];
        }

        $tcpListener = New-Object System.Net.Sockets.TcpListener @($ipAddress, $portNumber)
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

$rand = New-Object System.Random
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
    $env:PSModulePath = $env:PSModulePath + [System.IO.Path]::PathSeparator + $BundledModulesPath
}

# Check if PowerShellGet module is available
if ((Test-ModuleAvailable "PowerShellGet") -eq $false) {
    # TODO: WRITE ERROR
}

# Check if the expected version of the PowerShell Editor Services
# module is installed
$parsedVersion = New-Object System.Version @($EditorServicesVersion)
if ((Test-ModuleAvailable "PowerShellEditorServices" -RequiredVersion $parsedVersion) -eq $false) {
    if ($ConfirmInstall -and $isPS5orLater) {
        # TODO: Check for error and return failure if necessary
        Install-Module "PowerShellEditorServices" -RequiredVersion $parsedVersion -Confirm
    }
    else {
        # Indicate to the client that the PowerShellEditorServices module
        # needs to be installed
        Write-Output "needs_install"
    }
}

try {
    if ($isPS5orLater) {
        Import-Module PowerShellEditorServices -RequiredVersion $parsedVersion -ErrorAction Stop
    }
    else {
        Import-Module PowerShellEditorServices -Version $parsedVersion -ErrorAction Stop
    }

    # Locate available port numbers for services
    $languageServicePort = Get-AvailablePort
    $debugServicePort = Get-AvailablePort

    if ($EnableConsoleRepl) {
        Write-Host "PowerShell Integrated Console`n"
    }

    # Create the Editor Services host
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

    $resultDetails = @{
        "status" = "started";
        "channel" = "tcp";
        "languageServicePort" = $languageServicePort;
        "debugServicePort" = $debugServicePort;
    };

    # Notify the client that the services have started
    WriteSessionFile $resultDetails
}
catch [System.Exception] {
    $e = $_.Exception;
    $errorString = ""

    while ($e -ne $null) {
        $errorString = $errorString + ($e.Message + "`r`n" + $e.StackTrace + "`r`n")
        $e = $e.InnerException;
    }

    ExitWithError ("An error occurred while starting PowerShell Editor Services:`r`n`r`n" + $errorString)
}

try {
    # Wait for the host to complete execution before exiting
    $editorServicesHost.WaitForCompletion()
}
catch [System.Exception] {
    $e = $_.Exception;
    $errorString = ""

    while ($e -ne $null) {
        $errorString = $errorString + ($e.Message + "`r`n" + $e.StackTrace + "`r`n")
        $e = $e.InnerException;
    }
}

# SIG # Begin signature block
# MIIdhQYJKoZIhvcNAQcCoIIddjCCHXICAQExCzAJBgUrDgMCGgUAMGkGCisGAQQB
# gjcCAQSgWzBZMDQGCisGAQQBgjcCAR4wJgIDAQAABBAfzDtgWUsITrck0sYpfvNR
# AgEAAgEAAgEAAgEAAgEAMCEwCQYFKw4DAhoFAAQUrH/lJTmc5ojU1tfaYNiRVKoP
# Ya2gghhTMIIEwjCCA6qgAwIBAgITMwAAAMRudtBNPf6pZQAAAAAAxDANBgkqhkiG
# 9w0BAQUFADB3MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4G
# A1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSEw
# HwYDVQQDExhNaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EwHhcNMTYwOTA3MTc1ODUy
# WhcNMTgwOTA3MTc1ODUyWjCBsjELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hp
# bmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
# b3JhdGlvbjEMMAoGA1UECxMDQU9DMScwJQYDVQQLEx5uQ2lwaGVyIERTRSBFU046
# MjEzNy0zN0EwLTRBQUExJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNl
# cnZpY2UwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCoA5rFUpl2jKM9
# /L26GuVj6Beo87YdPTwuOL0C+QObtrYvih7LDNDAeWLw+wYlSkAmfmaSXFpiRHM1
# dBzq+VcuF8YGmZm/LKWIAB3VTj6df05JH8kgtp4gN2myPTR+rkwoMoQ3muR7zb1n
# vNiLsEpgJ2EuwX5M/71uYrK6DHAPbbD3ryFizZAfqYcGUWuDhEE6ZV+onexUulZ6
# DK6IoLjtQvUbH1ZMEWvNVTliPYOgNYLTIcJ5mYphnUMABoKdvGDcVpSmGn6sLKGg
# iFC82nun9h7koj7+ZpSHElsLwhWQiGVWCRVk8ZMbec+qhu+/9HwzdVJYb4HObmwN
# Daqpqe17AgMBAAGjggEJMIIBBTAdBgNVHQ4EFgQUiAUj6xG9EI77i5amFSZrXv1V
# 3lAwHwYDVR0jBBgwFoAUIzT42VJGcArtQPt2+7MrsMM1sw8wVAYDVR0fBE0wSzBJ
# oEegRYZDaHR0cDovL2NybC5taWNyb3NvZnQuY29tL3BraS9jcmwvcHJvZHVjdHMv
# TWljcm9zb2Z0VGltZVN0YW1wUENBLmNybDBYBggrBgEFBQcBAQRMMEowSAYIKwYB
# BQUHMAKGPGh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2kvY2VydHMvTWljcm9z
# b2Z0VGltZVN0YW1wUENBLmNydDATBgNVHSUEDDAKBggrBgEFBQcDCDANBgkqhkiG
# 9w0BAQUFAAOCAQEAcDh+kjmXvCnoEO5AcUWfp4/4fWCqiBQL8uUFq6cuBuYp8ML4
# UyHSLKNPOoJmzzy1OT3GFGYrmprgO6c2d1tzuSaN3HeFGENXDbn7N2RBvJtSl0Uk
# ahSyak4TsRUPk/WwMQ0GOGNbxjolrOR41LVsSmHVnn8IWDOCWBj1c+1jkPkzG51j
# CiAnWzHU1Q25A/0txrhLYjNtI4P3f0T0vv65X7rZAIz3ecQS/EglmADfQk/zrLgK
# qJdxZKy3tXS7+35zIrDegdAH2G7d3jvCNTjatrV7cxKH+ZX9oEsFl10uh/U83KA2
# QiQJQMtbjGSzQV2xRpcNf2GpHBRPW0sK4yL3wzCCBgAwggPooAMCAQICEzMAAADD
# Dpun2LLc9ywAAAAAAMMwDQYJKoZIhvcNAQELBQAwfjELMAkGA1UEBhMCVVMxEzAR
# BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
# Y3Jvc29mdCBDb3Jwb3JhdGlvbjEoMCYGA1UEAxMfTWljcm9zb2Z0IENvZGUgU2ln
# bmluZyBQQ0EgMjAxMTAeFw0xNzA4MTEyMDIwMjRaFw0xODA4MTEyMDIwMjRaMHQx
# CzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRt
# b25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xHjAcBgNVBAMTFU1p
# Y3Jvc29mdCBDb3Jwb3JhdGlvbjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC
# ggEBALtX1zjRsQZ/SS2pbbNjn3q6tjohW7SYro3UpIGgxXXFLO+CQCq3gVN382MB
# CrzON4QDQENXgkvO7R+2/YBtycKRXQXH3FZZAOEM61fe/fG4kCe/dUr8dbJyWLbF
# SJszYgXRlZSlvzkirY0STUZi2jIZzqoiXFZIsW9FyWd2Yl0wiKMvKMUfUCrZhtsa
# ESWBwvT1Zy7neR314hx19E7Mx/znvwuARyn/z81psQwLYOtn5oQbm039bUc6x9nB
# YWHylRKhDQeuYyHY9Jkc/3hVge6leegggl8K2rVTGVQBVw2HkY3CfPFUhoDhYtuC
# cz4mXvBAEtI51SYDDYWIMV8KC4sCAwEAAaOCAX8wggF7MB8GA1UdJQQYMBYGCisG
# AQQBgjdMCAEGCCsGAQUFBwMDMB0GA1UdDgQWBBSnE10fIYlV6APunhc26vJUiDUZ
# rzBRBgNVHREESjBIpEYwRDEMMAoGA1UECxMDQU9DMTQwMgYDVQQFEysyMzAwMTIr
# YzgwNGI1ZWEtNDliNC00MjM4LTgzNjItZDg1MWZhMjI1NGZjMB8GA1UdIwQYMBaA
# FEhuZOVQBdOCqhc3NyK1bajKdQKVMFQGA1UdHwRNMEswSaBHoEWGQ2h0dHA6Ly93
# d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY3JsL01pY0NvZFNpZ1BDQTIwMTFfMjAx
# MS0wNy0wOC5jcmwwYQYIKwYBBQUHAQEEVTBTMFEGCCsGAQUFBzAChkVodHRwOi8v
# d3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2NlcnRzL01pY0NvZFNpZ1BDQTIwMTFf
# MjAxMS0wNy0wOC5jcnQwDAYDVR0TAQH/BAIwADANBgkqhkiG9w0BAQsFAAOCAgEA
# TZdPNH7xcJOc49UaS5wRfmsmxKUk9N9E1CS6s2oIiZmayzHncJv/FB2wBzl/5DA7
# EyLeDsiVZ7tufvh8laSQgjeTpoPTSQLBrK1Z75G3p2YADqJMJdTc510HAsooNGU7
# OYOtlSqOyqDoCDoc/j57QEmUTY5UJQrlsccK7nE3xpteNvWnQkT7vIewDcA12SaH
# X/9n7yh094owBBGKZ8xLNWBqIefDjQeDXpurnXEfKSYJEdT1gtPSNgcpruiSbZB/
# AMmoW+7QBGX7oQ5XU8zymInznxWTyAbEY1JhAk9XSBz1+3USyrX59MJpX7uhnQ1p
# gyfrgz4dazHD7g7xxIRDh+4xnAYAMny3IIq5CCPqVrAY1LK9Few37WTTaxUCI8aK
# M4c60Zu2wJZZLKABU4QBX/J7wXqw7NTYUvZfdYFEWRY4J1O7UPNecd/311HcMdUa
# YzUql36fZjdfz1Uz77LKvCwjqkQe7vtnSLToQsMPilFYokYCYSZaGb9clOmoQHDn
# WzBMfIDUUGeipe4O6z218eV5HuH1WBlvu4lteOIgWCX/5Eiz5q/xskAEF0ZQ1Axs
# kRR97sri9ibeGzsEZ1EuD6QX90L/P5GJMfinvLPlOlLcKjN/SmSRZdhlEbbbare0
# bFL8v4txFsQsznOaoOldCMFFRaUphuwBMW1edMZWMQswggYHMIID76ADAgECAgph
# Fmg0AAAAAAAcMA0GCSqGSIb3DQEBBQUAMF8xEzARBgoJkiaJk/IsZAEZFgNjb20x
# GTAXBgoJkiaJk/IsZAEZFgltaWNyb3NvZnQxLTArBgNVBAMTJE1pY3Jvc29mdCBS
# b290IENlcnRpZmljYXRlIEF1dGhvcml0eTAeFw0wNzA0MDMxMjUzMDlaFw0yMTA0
# MDMxMzAzMDlaMHcxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAw
# DgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
# ITAfBgNVBAMTGE1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQTCCASIwDQYJKoZIhvcN
# AQEBBQADggEPADCCAQoCggEBAJ+hbLHf20iSKnxrLhnhveLjxZlRI1Ctzt0YTiQP
# 7tGn0UytdDAgEesH1VSVFUmUG0KSrphcMCbaAGvoe73siQcP9w4EmPCJzB/LMySH
# nfL0Zxws/HvniB3q506jocEjU8qN+kXPCdBer9CwQgSi+aZsk2fXKNxGU7CG0OUo
# Ri4nrIZPVVIM5AMs+2qQkDBuh/NZMJ36ftaXs+ghl3740hPzCLdTbVK0RZCfSABK
# R2YRJylmqJfk0waBSqL5hKcRRxQJgp+E7VV4/gGaHVAIhQAQMEbtt94jRrvELVSf
# rx54QTF3zJvfO4OToWECtR0Nsfz3m7IBziJLVP/5BcPCIAsCAwEAAaOCAaswggGn
# MA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFCM0+NlSRnAK7UD7dvuzK7DDNbMP
# MAsGA1UdDwQEAwIBhjAQBgkrBgEEAYI3FQEEAwIBADCBmAYDVR0jBIGQMIGNgBQO
# rIJgQFYnl+UlE/wq4QpTlVnkpKFjpGEwXzETMBEGCgmSJomT8ixkARkWA2NvbTEZ
# MBcGCgmSJomT8ixkARkWCW1pY3Jvc29mdDEtMCsGA1UEAxMkTWljcm9zb2Z0IFJv
# b3QgQ2VydGlmaWNhdGUgQXV0aG9yaXR5ghB5rRahSqClrUxzWPQHEy5lMFAGA1Ud
# HwRJMEcwRaBDoEGGP2h0dHA6Ly9jcmwubWljcm9zb2Z0LmNvbS9wa2kvY3JsL3By
# b2R1Y3RzL21pY3Jvc29mdHJvb3RjZXJ0LmNybDBUBggrBgEFBQcBAQRIMEYwRAYI
# KwYBBQUHMAKGOGh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2kvY2VydHMvTWlj
# cm9zb2Z0Um9vdENlcnQuY3J0MBMGA1UdJQQMMAoGCCsGAQUFBwMIMA0GCSqGSIb3
# DQEBBQUAA4ICAQAQl4rDXANENt3ptK132855UU0BsS50cVttDBOrzr57j7gu1BKi
# jG1iuFcCy04gE1CZ3XpA4le7r1iaHOEdAYasu3jyi9DsOwHu4r6PCgXIjUji8FMV
# 3U+rkuTnjWrVgMHmlPIGL4UD6ZEqJCJw+/b85HiZLg33B+JwvBhOnY5rCnKVuKE5
# nGctxVEO6mJcPxaYiyA/4gcaMvnMMUp2MT0rcgvI6nA9/4UKE9/CCmGO8Ne4F+tO
# i3/FNSteo7/rvH0LQnvUU3Ih7jDKu3hlXFsBFwoUDtLaFJj1PLlmWLMtL+f5hYbM
# UVbonXCUbKw5TNT2eb+qGHpiKe+imyk0BncaYsk9Hm0fgvALxyy7z0Oz5fnsfbXj
# pKh0NbhOxXEjEiZ2CzxSjHFaRkMUvLOzsE1nyJ9C/4B5IYCeFTBm6EISXhrIniIh
# 0EPpK+m79EjMLNTYMoBMJipIJF9a6lbvpt6Znco6b72BJ3QGEe52Ib+bgsEnVLax
# aj2JoXZhtG6hE6a/qkfwEm/9ijJssv7fUciMI8lmvZ0dhxJkAj0tr1mPuOQh5bWw
# ymO0eFQF1EEuUKyUsKV4q7OglnUa2ZKHE3UiLzKoCG6gW4wlv6DvhMoh1useT8ma
# 7kng9wFlb4kLfchpyOZu6qeXzjEp/w7FW1zYTRuh2Povnj8uVRZryROj/TCCB3ow
# ggVioAMCAQICCmEOkNIAAAAAAAMwDQYJKoZIhvcNAQELBQAwgYgxCzAJBgNVBAYT
# AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xMjAwBgNVBAMTKU1pY3Jvc29mdCBS
# b290IENlcnRpZmljYXRlIEF1dGhvcml0eSAyMDExMB4XDTExMDcwODIwNTkwOVoX
# DTI2MDcwODIxMDkwOVowfjELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0
# b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
# dGlvbjEoMCYGA1UEAxMfTWljcm9zb2Z0IENvZGUgU2lnbmluZyBQQ0EgMjAxMTCC
# AiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAKvw+nIQHC6t2G6qghBNNLry
# tlghn0IbKmvpWlCquAY4GgRJun/DDB7dN2vGEtgL8DjCmQawyDnVARQxQtOJDXlk
# h36UYCRsr55JnOloXtLfm1OyCizDr9mpK656Ca/XllnKYBoF6WZ26DJSJhIv56sI
# UM+zRLdd2MQuA3WraPPLbfM6XKEW9Ea64DhkrG5kNXimoGMPLdNAk/jj3gcN1Vx5
# pUkp5w2+oBN3vpQ97/vjK1oQH01WKKJ6cuASOrdJXtjt7UORg9l7snuGG9k+sYxd
# 6IlPhBryoS9Z5JA7La4zWMW3Pv4y07MDPbGyr5I4ftKdgCz1TlaRITUlwzluZH9T
# upwPrRkjhMv0ugOGjfdf8NBSv4yUh7zAIXQlXxgotswnKDglmDlKNs98sZKuHCOn
# qWbsYR9q4ShJnV+I4iVd0yFLPlLEtVc/JAPw0XpbL9Uj43BdD1FGd7P4AOG8rAKC
# X9vAFbO9G9RVS+c5oQ/pI0m8GLhEfEXkwcNyeuBy5yTfv0aZxe/CHFfbg43sTUkw
# p6uO3+xbn6/83bBm4sGXgXvt1u1L50kppxMopqd9Z4DmimJ4X7IvhNdXnFy/dygo
# 8e1twyiPLI9AN0/B4YVEicQJTMXUpUMvdJX3bvh4IFgsE11glZo+TzOE2rCIF96e
# TvSWsLxGoGyY0uDWiIwLAgMBAAGjggHtMIIB6TAQBgkrBgEEAYI3FQEEAwIBADAd
# BgNVHQ4EFgQUSG5k5VAF04KqFzc3IrVtqMp1ApUwGQYJKwYBBAGCNxQCBAweCgBT
# AHUAYgBDAEEwCwYDVR0PBAQDAgGGMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0jBBgw
# FoAUci06AjGQQ7kUBU7h6qfHMdEjiTQwWgYDVR0fBFMwUTBPoE2gS4ZJaHR0cDov
# L2NybC5taWNyb3NvZnQuY29tL3BraS9jcmwvcHJvZHVjdHMvTWljUm9vQ2VyQXV0
# MjAxMV8yMDExXzAzXzIyLmNybDBeBggrBgEFBQcBAQRSMFAwTgYIKwYBBQUHMAKG
# Qmh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2kvY2VydHMvTWljUm9vQ2VyQXV0
# MjAxMV8yMDExXzAzXzIyLmNydDCBnwYDVR0gBIGXMIGUMIGRBgkrBgEEAYI3LgMw
# gYMwPwYIKwYBBQUHAgEWM2h0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMv
# ZG9jcy9wcmltYXJ5Y3BzLmh0bTBABggrBgEFBQcCAjA0HjIgHQBMAGUAZwBhAGwA
# XwBwAG8AbABpAGMAeQBfAHMAdABhAHQAZQBtAGUAbgB0AC4gHTANBgkqhkiG9w0B
# AQsFAAOCAgEAZ/KGpZjgVHkaLtPYdGcimwuWEeFjkplCln3SeQyQwWVfLiw++MNy
# 0W2D/r4/6ArKO79HqaPzadtjvyI1pZddZYSQfYtGUFXYDJJ80hpLHPM8QotS0LD9
# a+M+By4pm+Y9G6XUtR13lDni6WTJRD14eiPzE32mkHSDjfTLJgJGKsKKELukqQUM
# m+1o+mgulaAqPyprWEljHwlpblqYluSD9MCP80Yr3vw70L01724lruWvJ+3Q3fMO
# r5kol5hNDj0L8giJ1h/DMhji8MUtzluetEk5CsYKwsatruWy2dsViFFFWDgycSca
# f7H0J/jeLDogaZiyWYlobm+nt3TDQAUGpgEqKD6CPxNNZgvAs0314Y9/HG8VfUWn
# duVAKmWjw11SYobDHWM2l4bf2vP48hahmifhzaWX0O5dY0HjWwechz4GdwbRBrF1
# HxS+YWG18NzGGwS+30HHDiju3mUv7Jf2oVyW2ADWoUa9WfOXpQlLSBCZgB/QACnF
# sZulP0V3HjXG0qKin3p6IvpIlR+r+0cjgPWe+L9rt0uX4ut1eBrs6jeZeRhL/9az
# I2h15q/6/IvrC4DqaTuv/DDtBEyO3991bWORPdGdVk5Pv4BXIqF4ETIheu9BCrE/
# +6jMpF3BoYibV3FWTkhFwELJm3ZbCoBIa/15n8G9bW1qyVJzEw16UM0xggScMIIE
# mAIBATCBlTB+MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4G
# A1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSgw
# JgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBTaWduaW5nIFBDQSAyMDExAhMzAAAAww6b
# p9iy3PcsAAAAAADDMAkGBSsOAwIaBQCggbAwGQYJKoZIhvcNAQkDMQwGCisGAQQB
# gjcCAQQwHAYKKwYBBAGCNwIBCzEOMAwGCisGAQQBgjcCARUwIwYJKoZIhvcNAQkE
# MRYEFFuRkrj0ibuN0l3fKuGRvSfsG3XHMFAGCisGAQQBgjcCAQwxQjBAoBaAFABQ
# AG8AdwBlAHIAUwBoAGUAbABsoSaAJGh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9Q
# b3dlclNoZWxsIDANBgkqhkiG9w0BAQEFAASCAQBGYZGegA7v8gdPTiVDNexQbPWC
# /X15E+SB6B0Klpm1MbwNFZwpw6958CfjZlC90Lp0pWY4IZ+cS3DGR9tTLZ629f1p
# yjMBg6Lg4oWJMZVKGeMaAu1dyeoyUFM4MFfLRrHGFgPSaz3feixNb42lvnD3z2Cs
# K9nrC0vWtvdoJXgzf9DhTsLNTY4Eufwet3CXraPId9I4xIz2hxf4QwT6FZf+sCxt
# 3tzL8WroiZIPd+/XUAa2PqpAZC68FQDKipkiXuMxNAwjxdHSy5/uiWmLmw/7N96K
# PgfRP2EyGQTmFABqKGbiGn9Xn8Y4YonVNWMtwyXfPMqSnyAodh9zLt1snY2ooYIC
# KDCCAiQGCSqGSIb3DQEJBjGCAhUwggIRAgEBMIGOMHcxCzAJBgNVBAYTAlVTMRMw
# EQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVN
# aWNyb3NvZnQgQ29ycG9yYXRpb24xITAfBgNVBAMTGE1pY3Jvc29mdCBUaW1lLVN0
# YW1wIFBDQQITMwAAAMRudtBNPf6pZQAAAAAAxDAJBgUrDgMCGgUAoF0wGAYJKoZI
# hvcNAQkDMQsGCSqGSIb3DQEHATAcBgkqhkiG9w0BCQUxDxcNMTcxMTE2MTczOTU4
# WjAjBgkqhkiG9w0BCQQxFgQUslAD3C17ve4qcqXvoAnHDzQ+7GQwDQYJKoZIhvcN
# AQEFBQAEggEAm6dHeq5wngdGePAmB74BLr7OTqzmVbqFeuMMY0uQ5giCiZ1G3X65
# UCflLWDloGNXGfOkpGVHDQDm0ZmQBSpSZklfKhOLQOHeqbqULrEOKecR5rc1BIBi
# ie12jrY0tvcdIWi54fp2GskeILXQ60uOu1457D8rZxniBh2PYOjLeCEIevR8cukE
# tbgHatIwdTEkxYHd1Wx+9Q54++4Yd873kcUDaK/ge4+QYdmluOQ1HEokA1JRxS6B
# lSLoZ+r2Pv09jcpvLAaJaX8mej07QDYNpM8ICcCQ5SUwlfO31EkocHLjBiKtz0x+
# Ql3kTRs1S0Ra/32ZzAdb7WcRjSRyRQ0/IQ==
# SIG # End signature block
