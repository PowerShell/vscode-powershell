$branch = [uri]::EscapeDataString($env:PSES_BRANCH)
$headers = @{Authorization = "Bearer $env:SYSTEM_ACCESSTOKEN"}

$buildsUrl = $env:VSTS_PSES_URL_TEMPLATE -f $branch, "succeeded"
$succeededBuilds = Invoke-RestMethod -ContentType application/json -Uri $buildsUrl -Headers $headers
Write-Host "Requested URL: $buildsUrl"
Write-Host "Got response:`n$(ConvertTo-Json $builds)"

$buildsUrl = $env:VSTS_PSES_URL_TEMPLATE -f $branch, "partiallySucceeded"
$partiallySucceededBuilds = Invoke-RestMethod -ContentType application/json -Uri $buildsUrl -Headers $headers
Write-Host "Requested URL: $buildsUrl"
Write-Host "Got response:`n$(ConvertTo-Json $builds)"

$builds = @(
    $succeededBuilds.value
    $partiallySucceededBuilds.value
    ) | Sort-Object finishTime -Descending

Write-Host "Got PSES_BRANCH: ${env:PSES_BRANCH}"
Write-Host "setting PSES_BUILDID to $($builds.value[0].Id)"
Write-Host "##vso[task.setvariable variable=PSES_BUILDID]$($builds.value[0].Id)"
