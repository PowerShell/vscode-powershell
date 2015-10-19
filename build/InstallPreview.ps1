
# Make sure VS Code isn't running first
$ErrorActionPreference = "SilentlyContinue"
if ((Get-Process -Name "Code").Count -gt 0)
{
	Write-Warning "Visual Studio Code is currently running.  You must close all VS Code windows before continuing."
}
else
{
	# Fail fast on future errors
	$ErrorActionPreference = "Stop"
	
	$destPath = "$env:USERPROFILE\.vscode\extensions\vscode-powershell\"
	
	if (Test-Path $destPath)
	{
		Remove-Item $destPath -Recurse
	}
	
	Write-Output "Installing to $destPath"
	Expand-Archive -Path ".\vscode-powershell.zip" -DestinationPath $destPath
	
	if ($?)
	{
		Write-Output "Installation complete!"
		Write-Output ""
		Write-Output "Launching Visual Studio Code..."
		
		& "${env:ProgramFiles(x86)}\Microsoft VS Code\Code.exe" "$destPath\examples\" "$destPath\examples\README.md" 2>&1 | Out-Null
	}
	else
	{
		Write-Output "Installation failed!"
	}
}
