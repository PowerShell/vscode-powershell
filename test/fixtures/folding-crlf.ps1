#RegIon This should fold
<#
Nested different comment types.  This should fold
#>
#EnDReGion

# region This should not fold due to whitespace
$shouldFold = $false
#    endRegion
function short-func-not-fold {};
<#
.SYNOPSIS
  This whole comment block should fold, not just the SYNOPSIS
.EXAMPLE
  This whole comment block should fold, not just the EXAMPLE
#>
function New-VSCodeShouldFold {
<#
.SYNOPSIS
  This whole comment block should fold, not just the SYNOPSIS
.EXAMPLE
  This whole comment block should fold, not just the EXAMPLE
#>
  $I = @'
herestrings should fold

'@

$I = @"
double quoted herestrings should also fold

"@

  # this won't be folded

  # This block of comments should be foldable as a single block
  # This block of comments should be foldable as a single block
  # This block of comments should be foldable as a single block

  #region This fools the indentation folding.
  Write-Host "Hello"
    #region Nested regions should be foldable
    Write-Host "Hello"
    # comment1
    Write-Host "Hello"
    #endregion
    Write-Host "Hello"
    # comment2
    Write-Host "Hello"
    #endregion

  $c = {
    Write-Host "Script blocks should be foldable"
  }

  # Array fools indentation folding
  $d = @(
  'should fold1',
  'should fold2'
  )
}
