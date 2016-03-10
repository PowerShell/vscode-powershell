<#
.Synopsis
	Short description
.DESCRIPTION
	Long description
.EXAMPLE
	Example of how to use this cmdlet
.EXAMPLE
	Another example of how to use this cmdlet
#>
function Stop-Process2 {
	[CmdletBinding(SupportsShouldProcess = $true)]
	[Alias()]
	[OutputType([int])]
	param(
		# Param1 help description
		[Parameter(Mandatory=$true,
				   ValueFromPipelineByPropertyName=$true,
				   Position=0)]
		$Name
	)

	process	{
		if ($PSCmdlet.ShouldProcess("")) {
			$processes = Get-Process -Name $Name
			foreach ($process in $processes) {
				$id = $process.Id
				$name = $process.Name
				Write-Output "Killing $name ($id)"

				$process.Kill();

				Start-Sleep -Seconds 1
			}
		}
	}
}