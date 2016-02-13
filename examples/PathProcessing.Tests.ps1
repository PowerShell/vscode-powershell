# These Pester tests are for the for parameter-* and ex-path* snippets.
# Take a look at the .vscode\tasks.json file to see how you can create
# and configure a test task runner that will run all the Pester tests
# in your workspace folder.

# To run these Pester tests, press Ctrl+Shift+T or press Ctrl+Shift+P,
# type "test" and select "Tasks: Run Test Task".  This will invoke the
# test task runner defined in .vscode\tasks.json.

# This (empty) file is required by some of the tests.
$null = New-Item -Path 'foo[1].txt' -Force

. $PSScriptRoot\PathProcessingNonExistingPaths.ps1
Describe 'Verify Path Processing for Non-existing Paths Allowed Impl' {
    It 'Processes non-wildcard absolute path to non-existing file via -Path param' {
        New-File -Path $PSScriptRoot\ReadmeNew.md | Should Be "$PSScriptRoot\READMENew.md"
    }
    It 'Processes multiple absolute paths via -Path param' {
        New-File -Path $PSScriptRoot\Readme.md, $PSScriptRoot\XYZZY.ps1 |
            Should Be @("$PSScriptRoot\README.md", "$PSScriptRoot\XYZZY.ps1")
    }
    It 'Processes relative path via -Path param' {
        New-File -Path ..\examples\READMENew.md | Should Be "$PSScriptRoot\READMENew.md"
    }
    It 'Processes multiple relative path via -Path param' {
        New-File -Path ..\examples\README.md, XYZZY.ps1 |
            Should Be @("$PSScriptRoot\README.md", "$PSScriptRoot\XYZZY.ps1")
    }

    It 'Should accept pipeline input to Path' {
        Get-ChildItem -LiteralPath "$pwd\foo[1].txt" | New-File | Should Be "$PSScriptRoot\foo[1].txt"
    }
}

. $PSScriptRoot\PathProcessingNoWildcards.ps1
Describe 'Verify Path Processing for NO Wildcards Allowed Impl' {
    It 'Processes non-wildcard absolute path via -Path param' {
        Import-FileNoWildcard -Path $PSScriptRoot\Readme.md | Should Be "$PSScriptRoot\README.md"
    }
    It 'Processes multiple absolute paths via -Path param' {
        Import-FileNoWildcard -Path $PSScriptRoot\Readme.md, $PSScriptRoot\PathProcessingWildcards.ps1 |
            Should Be @("$PSScriptRoot\README.md", "$PSScriptRoot\PathProcessingWildcards.ps1")
    }
    It 'Processes relative path via -Path param' {
        Import-FileNoWildcard -Path ..\examples\README.md | Should Be "$PSScriptRoot\README.md"
    }
    It 'Processes multiple relative path via -Path param' {
        Import-FileNoWildcard -Path ..\examples\README.md, .vscode\launch.json |
            Should Be @("$PSScriptRoot\README.md", "$PSScriptRoot\.vscode\launch.json")
    }

    It 'Should accept pipeline input to Path' {
        Get-ChildItem -LiteralPath "$pwd\foo[1].txt" | Import-FileNoWildcard | Should Be "$PSScriptRoot\foo[1].txt"
    }
}

. $PSScriptRoot\PathProcessingWildcards.ps1
Describe 'Verify Path Processing for Wildcards Allowed Impl' {
    It 'Processes non-wildcard absolute path via -Path param' {
        Import-FileWildcard -Path $PSScriptRoot\Readme.md | Should Be "$PSScriptRoot\README.md"
    }
    It 'Processes multiple absolute paths via -Path param' {
        Import-FileWildcard -Path $PSScriptRoot\Readme.md, $PSScriptRoot\PathProcessingWildcards.ps1 |
            Should Be @("$PSScriptRoot\README.md", "$PSScriptRoot\PathProcessingWildcards.ps1")
    }
    It 'Processes wildcard absolute path via -Path param' {
        Import-FileWildcard -Path $PSScriptRoot\*.md | Should Be "$PSScriptRoot\README.md"
    }
    It 'Processes wildcard relative path via -Path param' {
        Import-FileWildcard -Path *.md | Should Be "$PSScriptRoot\README.md"
    }
    It 'Processes relative path via -Path param' {
        Import-FileWildcard -Path ..\examples\README.md | Should Be "$PSScriptRoot\README.md"
    }
    It 'Processes multiple relative path via -Path param' {
        Import-FileWildcard -Path ..\examples\README.md, .vscode\launch.json |
            Should Be @("$PSScriptRoot\README.md", "$PSScriptRoot\.vscode\launch.json")
    }

    It 'DefaultParameterSet should be Path' {
        Import-FileWildcard *.md | Should Be "$PSScriptRoot\README.md"
    }

    It 'Should process absolute literal paths via -LiteralPath param'{
        Import-FileWildcard -LiteralPath "$PSScriptRoot\foo[1].txt" | Should Be "$PSScriptRoot\foo[1].txt"
    }
    It 'Should process relative literal paths via -LiteralPath param'{
        Import-FileWildcard -LiteralPath "..\examples\foo[1].txt" | Should Be "$PSScriptRoot\foo[1].txt"
    }
    It 'Should process multiple literal paths via -LiteralPath param'{
        Import-FileWildcard -LiteralPath "..\examples\foo[1].txt", "$PSScriptRoot\README.md" |
            Should Be @("$PSScriptRoot\foo[1].txt", "$PSScriptRoot\README.md")
    }

    It 'Should accept pipeline input to LiteralPath' {
        Get-ChildItem -LiteralPath "$pwd\foo[1].txt" | Import-FileWildcard | Should Be "$PSScriptRoot\foo[1].txt"
    }
}
