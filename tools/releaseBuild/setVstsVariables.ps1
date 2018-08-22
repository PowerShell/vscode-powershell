$vstsVariables = @{
    PSES_BRANCH = '2.0.0'
}

# Use VSTS's API to set an env vars
foreach ($var in $vstsVariables)
{
    $val = $vstsVariables[$var]
    Write-Host "##vso[task.setvariable variable=$var]$var"
}