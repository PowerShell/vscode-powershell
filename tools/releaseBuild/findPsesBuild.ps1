$branch = [uri]::EscapeDataString($env:PSES_BRANCH)
$buildsUrl = $env:VSTS_PSES_URL_TEMPLATE -f $branch
$headers = @{Authorization = "Bearer $env:SYSTEM_ACCESSTOKEN"}
$builds = Invoke-RestMethod -ContentType application/json -Uri $buildsUrl -Headers $headers
Write-Host "Got PSES_BRANCH: ${env:PSES_BRANCH}"
Write-Host "Requested URL: $buildsUrl"
Write-Host "Got response:`n$(ConvertTo-Json $builds)"
Write-Host "setting PSES_BUILDID to $($builds.value[0].Id)"
Write-Host "##vso[task.setvariable variable=PSES_BUILDID]$($builds.value[0].Id)"