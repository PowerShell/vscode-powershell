$vstsVariables = @{
    PSES_BRANCH = 'release/v2.0.0-preview.1'
}

# Use VSTS's API to set an env vars
foreach ($var in $vstsVariables.Keys)
{
    $val = $vstsVariables[$var]
    Write-Host "Setting var '$var' to value '$val'"
    Write-Host "##vso[task.setvariable variable=$var]$val"
}
