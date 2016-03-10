<#
.SYNOPSIS
    Demonstrates how to write a command that works with paths that do
    not allow wildards but must exist.
.DESCRIPTION
    This command does not require a LiteralPath parameter because the
    Path parameter can handle paths that use wildcard characters.  That's
    because this command does not "resolve" the supplied path.
.EXAMPLE
    C:\PS> Import-FileNoWildcard -Path ..\..\Tests\foo[1].txt -WhatIf
    This example shows how the Path parameter can handle a path that happens
    to use the wildcard chars "[" and "]".
#>
function Import-FileNoWildcard {
    [CmdletBinding(SupportsShouldProcess=$true)]
    param(
        # Specifies a path to one or more locations.
        [Parameter(Mandatory=$true,
                   Position=0,
                   ParameterSetName="Path",
                   ValueFromPipeline=$true,
                   ValueFromPipelineByPropertyName=$true,
                   HelpMessage="Path to one or more locations.")]
        [Alias("PSPath")]
        [ValidateNotNullOrEmpty()]
        [string[]]
        $Path
    )

    begin {
    }

    process {
        # Modify [CmdletBinding()] to [CmdletBinding(SupportsShouldProcess=$true)]
        $paths = @()
        foreach ($aPath in $Path) {
            if (!(Test-Path -LiteralPath $aPath)) {
                $ex = New-Object System.Management.Automation.ItemNotFoundException "Cannot find path '$aPath' because it does not exist."
                $category = [System.Management.Automation.ErrorCategory]::ObjectNotFound
                $errRecord = New-Object System.Management.Automation.ErrorRecord $ex,'PathNotFound',$category,$aPath
                $psCmdlet.WriteError($errRecord)
                continue
            }

            # Resolve any relative paths
            $paths += $psCmdlet.SessionState.Path.GetUnresolvedProviderPathFromPSPath($aPath)
        }

        foreach ($aPath in $paths) {
            if ($pscmdlet.ShouldProcess($aPath, 'Operation')) {
                # Process each path
                $aPath
            }
        }
    }

    end {
    }
}