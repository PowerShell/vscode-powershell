$branch = [uri]::EscapeDataString($env:PSES_BRANCH)
$buildsUrl = "https://mscodehub.visualstudio.com/PowerShellEditorServices/_apis/build/Builds?definitions=441&branchName=refs%2Fheads%2F${branch}&resultFilter=succeeded&reasonFilter=individualCI%20OR%20manual"
$headers = @{Authorization = "Bearer $env:SYSTEM_ACCESSTOKEN"}
$builds = Invoke-RestMethod -ContentType application/json -Uri $buildsUrl -Headers $headers
<<<<<<< HEAD
Write-Host "Got PSES_BRANCH: ${env:PSES_BRANCH}"
Write-Host "Requested URL: $buildsUrl"
Write-Host "Got response:`n$(ConvertTo-Json $builds)"
Write-Host "setting PSES_BUILDID to $($builds.value[0].Id)"
=======
Write-Host "setting PSES_BUILDID to $builds.value[0].Id"
Write-Host "Value: $($builds.value[0] | ConvertTo-Json)"
>>>>>>> 65464f190a74c84d3f670de39611c7cce64c6feb
Write-Host "##vso[task.setvariable variable=PSES_BUILDID]$($builds.value[0].Id)"