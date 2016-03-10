<#
.SYNOPSIS
    Demonstrates how to write a command that works with paths that do
    not allow wildards and do not have to exist.
.DESCRIPTION
    This command does not require a LiteralPath parameter because the
    Path parameter can handle paths that use wildcard characters.  That's
    because this command does not "resolve" the supplied path. This command
    also does not verify the path exists because the point of the command is
    to create a new file at the specified path.
.EXAMPLE
    C:\PS> New-File -Path xyzzy[1].txt -WhatIf
    This example shows how the Path parameter can handle a path that happens
    to use the wildcard chars "[" and "]" and does not exist to start with.
#>
function New-File {
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