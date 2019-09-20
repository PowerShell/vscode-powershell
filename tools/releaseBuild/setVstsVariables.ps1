$vstsVariables = @{
    PSES_BRANCH = 'legacy/1.x'
}

# Use VSTS's API to set an env vars
foreach ($var in $vstsVariables.Keys)
{
    $val = $vstsVariables[$var]
    Write-Host "Setting var '$var' to value '$val'"
    Write-Host "##vso[task.setvariable variable=$var]$val"
}