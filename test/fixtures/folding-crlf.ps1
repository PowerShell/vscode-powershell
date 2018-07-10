function short-func {};
<#
.SYNOPSIS
  Displays a list of WMI Classes based upon a search criteria
.EXAMPLE
 Get-WmiClasses -class disk -ns rootcimv2"
#>
function New-VSCodeCannotFold {
<#
.SYNOPSIS
  Displays a list of WMI Classes based upon a search criteria
.EXAMPLE
 Get-WmiClasses -class disk -ns rootcimv2"
#>
  $I = @'
cannot fold

'@

  # this won't be folded

  # This should be foldable
  # This should be foldable
  # This should be foldable

  #region This fools the indentation folding.
  Write-Host "Hello"
    # region
    Write-Host "Hello"
    # comment1
    Write-Host "Hello"
    #endregion
    Write-Host "Hello"
    # comment2
    Write-Host "Hello"
    # endregion

  $c = {
    Write-Host "Hello"
  }

  # Array fools indentation folding
  $d = @(
  'element1',
  'elemet2'
  )
}
