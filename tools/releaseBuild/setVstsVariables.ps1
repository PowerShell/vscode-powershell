$vstsVariables = @{
    PSES_BRANCH = 'master'
}

# Use VSTS's API to set an env vars
foreach ($var in $vstsVariables.Keys)
{
    # Allow environment to override
    if (Get-Item "env:$var" -ErrorAction Ignore)
    {
        continue
    }

    $val = $vstsVariables[$var]
    Write-Host "Setting var '$var' to value '$val'"
    Write-Host "##vso[task.setvariable variable=$var]$val"
}
