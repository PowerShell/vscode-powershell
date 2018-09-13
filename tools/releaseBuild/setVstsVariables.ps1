$vstsVariables = @{
    PSES_BRANCH = '2.0.0'
}

# Use VSTS's API to set an env vars
<<<<<<< HEAD
foreach ($var in $vstsVariables.Keys)
{
    $val = $vstsVariables[$var]
    Write-Host "Setting var '$var' to value '$val'"
    Write-Host "##vso[task.setvariable variable=$var]$val"
=======
foreach ($var in $vstsVariables)
{
    $val = $vstsVariables[$var]
    Write-Host "##vso[task.setvariable variable=$var]$var"
>>>>>>> 65464f190a74c84d3f670de39611c7cce64c6feb
}