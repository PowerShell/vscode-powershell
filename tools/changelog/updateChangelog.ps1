using module ../ChangelogTools.psm1
using module ../GitHubTools.psm1

param(
    [Parameter()]
    $RepositoryLocation = (Resolve-Path "$PSScriptRoot/../../")
)

$script:ChangelogConfig = @{
    DefaultCategory = 'General'
    Categories = @(
        @{
            Name = 'Debugging'
            Issue = 'Area-Debugging'
        },
        @{
            Name = 'CodeLens'
            Issue = 'Area-CodeLens'
        },
        @{
            Name = 'Script Analysis'
            Issue = 'Area-Script Analysis'
        },
        @{
            Name = 'Formatting'
            Issue = 'Area-Formatting'
        },
        @{
            Name = 'Integrated Console'
            Issue = 'Area-Integrated Console','Area-PSReadLine'
        }
        @{
            Name = Intellisense
            Issue = 'Area-Intellisense'
        }
    )
}

