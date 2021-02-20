$branch = [uri]::EscapeDataString($env:PSES_BRANCH)
$headers = @{Authorization = "Bearer $env:SYSTEM_ACCESSTOKEN"}

$buildsUrl = $env:VSTS_PSES_URL_TEMPLATE -f $branch, "succeeded"
$succeededBuilds = Invoke-RestMethod -ContentType application/json -Uri $buildsUrl -Headers $headers
Write-Host "Requested URL: $buildsUrl"
Write-Host "Got response:`n$(ConvertTo-Json $succeededBuilds)"

$buildsURL = $buildsURL -replace "branchName", "tagName"
$taggedBuilds = Invoke-RestMethod -ContentType application/json -Uri $buildsUrl -Headers $headers
Write-Host "Requested URL: $buildsUrl"
Write-Host "Got response:`n$(ConvertTo-Json $taggedBuilds)"

$buildsUrl = $env:VSTS_PSES_URL_TEMPLATE -f $branch, "partiallySucceeded"
$partiallySucceededBuilds = Invoke-RestMethod -ContentType application/json -Uri $buildsUrl -Headers $headers
Write-Host "Requested URL: $buildsUrl"
Write-Host "Got response:`n$(ConvertTo-Json $partiallySucceededBuilds)"

$builds = @(
    $succeededBuilds.value
    $taggedBuilds.value
    $partiallySucceededBuilds.value
    ) | Sort-Object finishTime -Descending

Write-Host "Got PSES_BRANCH: ${env:PSES_BRANCH}"
Write-Host "setting PSES_BUILDID to $($builds[0].Id)"
Write-Host "##vso[task.setvariable variable=PSES_BUILDID]$($builds[0].Id)"
