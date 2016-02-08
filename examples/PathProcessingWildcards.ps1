function Import-FileWildcard {
    [CmdletBinding(SupportsShouldProcess=$true, DefaultParameterSetName='Path')]
    param(
        # Specifies a path to one or more locations. Wildcards are permitted.
        [Parameter(Mandatory=$true,
                   Position=0,
                   ParameterSetName="Path",
                   ValueFromPipeline=$true,
                   ValueFromPipelineByPropertyName=$true,
                   HelpMessage="Path to one or more locations.")]
        [ValidateNotNullOrEmpty()]
        [SupportsWildcards()]
        [string[]]
        $Path,
        
        # Specifies a path to one or more locations. Unlike the Path parameter, the value of the LiteralPath parameter is
        # used exactly as it is typed. No characters are interpreted as wildcards. If the path includes escape characters,
        # enclose it in single quotation marks. Single quotation marks tell Windows PowerShell not to interpret any
        # characters as escape sequences.
        [Parameter(Mandatory=$true,
                   Position=0,
                   ParameterSetName="LiteralPath",
                   ValueFromPipelineByPropertyName=$true,
                   HelpMessage="Literal path to one or more locations.")]
        [Alias("PSPath")]
        [ValidateNotNullOrEmpty()]
        [string[]]
        $LiteralPath
    )
    
    begin {
    }
    
    process {
        # Modify [CmdletBinding()] to [CmdletBinding(SupportsShouldProcess=$true, DefaultParameterSetName='Path')]
        $paths = @()
        if ($psCmdlet.ParameterSetName -eq 'Path') {
            foreach ($aPath in $Path) {
                if (!(Test-Path -Path $aPath)) {
                    $ex = New-Object System.Management.Automation.ItemNotFoundException "Cannot find path '$aPath' because it does not exist."
                    $category = [System.Management.Automation.ErrorCategory]::ObjectNotFound
                    $errRecord = New-Object System.Management.Automation.ErrorRecord $ex,'PathNotFound',$category,$aPath
                    $psCmdlet.WriteError($errRecord)
                    continue
                }
            
                # Resolve any wildcards that might be in the path
                $provider = $null
                $paths += $psCmdlet.SessionState.Path.GetResolvedProviderPathFromPSPath($aPath, [ref]$provider)
            }
        }
        else {
            foreach ($aPath in $LiteralPath) {
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