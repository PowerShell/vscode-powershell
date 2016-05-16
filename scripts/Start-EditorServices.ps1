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

    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $LanguageServicePipeName,

    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $DebugServicePipeName,

    [ValidateNotNullOrEmpty()]
    [string]
    $BundledModulesPath,

    [ValidateNotNullOrEmpty()]
    $LogPath,

    [ValidateSet("Normal", "Verbose", "Error")]
    $LogLevel,

    [switch]
    $WaitForCompletion,

    [switch]
    $WaitForDebugger
)

# Add BundledModulesPath to $env:PSModulePath
if ($BundledModulesPath) {
    $env:PSModulePath = $BundledModulesPath + ";" + $env:PSModulePath
}

$parsedVersion = [System.Version]::new($EditorServicesVersion)
Import-Module PowerShellEditorServices -RequiredVersion $parsedVersion -ErrorAction Stop

Start-EditorServicesHost `
    -HostName $HostName `
    -HostProfileId $HostProfileId `
    -HostVersion $HostVersion `
    -LogPath $LogPath `
    -LogLevel $LogLevel `
    -LanguageServicePipeName $LanguageServicePipeName `
    -DebugServicePipeName $DebugServicePipeName `
    -BundledModulesPath $BundledModulesPath `
    -WaitForCompletion:$WaitForCompletion.IsPresent `
    -WaitForDebugger:$WaitForDebugger.IsPresent
