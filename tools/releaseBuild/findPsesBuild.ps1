$branch = [System.Web.HttpUtility]::UrlEncode($env:PSES_BRANCH)
$buildsUrl = "https://mscodehub.visualstudio.com/PowerShellEditorServices/_apis/build/Builds?definitions=441&branchName=refs%2Fheads%2F$branch&resultFilter=succeeded&reasonFilter=individualCI%20OR%20manual"
$headers = @{Authorization = "Bearer $env:SYSTEM_ACCESSTOKEN"}
$builds = Invoke-RestMethod -ContentType application/json -Uri $buildsUrl -Headers $headers
Write-Host "setting PSES_BUILDID to $builds.value[0].Id"
Write-Host "##vso[task.setvariable variable=PSES_BUILDID]$($builds.value[0].Id)"