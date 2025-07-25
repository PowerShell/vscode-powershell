[CmdletBinding()]
param (
    [Parameter()]
    [switch]
    $WaitForAttach
)

if ($WaitForAttach) {
    # For an attach request we need to wait for the debug pipe runspace to be
    # opened before continuing. There is no builtin way to do this so we
    # poll the runspace list until a new one is created.
    $runspaces = Get-Runspace
    while ($true) {
        if (Get-Runspace | Where-Object { $_.Id -notin $runspaces.Id }) {
            break
        }
        Start-Sleep -Seconds 1
    }

    # Windows PowerShell 5.1 will not sync breakpoints until the debugger has
    # stopped at least once. We use Wait-Debugger to make this happen.
    if ($PSVersionTable.PSVersion -lt '6.0') {
        Wait-Debugger
    }
    else {
        Start-Sleep -Seconds 1  # Give the debugger time to sync breakpoints
    }
}

$processInfo = "This process is running with PID $PID and has runspace ID $([Runspace]::DefaultRunspace.Id)"
Write-Host $processInfo  # Place breakpoint here
