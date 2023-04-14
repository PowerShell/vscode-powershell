@{
    Pwsh    = '7.2.0'
    Node    = '16.14.2'
    Modules = @(
        @{ ModuleName = 'InvokeBuild'; RequiredVersion = '5.0.0' }
        @{ ModuleName = 'Pester'; RequiredVersion = '5.3.0' } #For PSES Build. TODO: Remove once we hook into PSES build script
        @{ ModuleName = 'PSScriptAnalyzer'; RequiredVersion = '1.21.0' } #For PSES Build
        @{ ModuleName = 'platyPS'; RequiredVersion = '0.14.2' } #For PSES Build
    )
}
