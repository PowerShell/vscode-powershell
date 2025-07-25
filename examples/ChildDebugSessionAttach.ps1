# Example on how Start-DebugAttachSession can be used to attach to another
# process. This launches a child process that runs ChildDebugSessionTarget.ps1
# but it can be adapted to attach to any other PowerShell process that is
# either already running or started like this example. To test this example,
# add a breakpoint to ChildDebugSessionTarget.ps1, select the
# 'PowerShell Launch Current File' configuration and press F5.

$pipeName = "TestPipe-$(New-Guid)"
$scriptPath = Join-Path -Path $PSScriptRoot -ChildPath 'ChildDebugSessionTarget.ps1'

$procParams = @{
    FilePath = 'pwsh'
    ArgumentList = ('-CustomPipeName {0} -File "{1}" -WaitForAttach' -f $pipeName, $scriptPath)
    PassThru = $true
}
$proc = Start-Process @procParams

Start-DebugAttachSession -CustomPipeName $pipeName -RunspaceId 1

# We need to ensure this debug session stays alive until the process exits. If
# we exit early then the child debug session will also exit.
$proc | Wait-Process
