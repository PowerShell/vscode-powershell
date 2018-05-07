# Use the PowerShell extension setting `powershell.scriptAnalysis.settingsPath` to get the current workspace
# to use this PSScriptAnalyzerSettings.psd1 file to configure code analysis in Visual Studio Code.
# This setting is configured in the workspace's `.vscode\settings.json`.
#
# For more information on PSScriptAnalyzer settings see:
# https://github.com/PowerShell/PSScriptAnalyzer/blob/master/README.md#settings-support-in-scriptanalyzer
#
# You can see the predefined PSScriptAnalyzer settings here:
# https://github.com/PowerShell/PSScriptAnalyzer/tree/master/Engine/Settings
@{
    # Only diagnostic records of the specified severity will be generated.
    # Uncomment the following line if you only want Errors and Warnings but
    # not Information diagnostic records.
    #Severity = @('Error','Warning')

    # Analyze **only** the following rules. Use IncludeRules when you want
    # to invoke only a small subset of the default rules.
    IncludeRules = @('PSAvoidDefaultValueSwitchParameter',
                     'PSMisleadingBacktick',
                     'PSMissingModuleManifestField',
                     'PSReservedCmdletChar',
                     'PSReservedParams',
                     'PSShouldProcess',
                     'PSUseApprovedVerbs',
                     'PSAvoidUsingCmdletAliases',
                     'PSUseDeclaredVarsMoreThanAssignments')

    # Do not analyze the following rules. Use ExcludeRules when you have
    # commented out the IncludeRules settings above and want to include all
    # the default rules except for those you exclude below.
    # Note: if a rule is in both IncludeRules and ExcludeRules, the rule
    # will be excluded.
    #ExcludeRules = @('PSAvoidUsingWriteHost')

    # You can use rule configuration to configure rules that support it:
    #Rules = @{
    #    PSAvoidUsingCmdletAliases = @{
    #        Whitelist = @("cd")
    #    }
    #}
}
