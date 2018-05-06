# For more information on PSScriptAnalyzer settings see:
# https://github.com/PowerShell/PSScriptAnalyzer/blob/master/README.md#settings-support-in-scriptanalyzer
@{
    # Only diagnostic records of the specified severity will be generated.
    # Uncomment the following line if you only want Errors and Warnings but
    # not Information diagnostic records.
    #Severity = @('Error','Warning')

    # Analyze **only** the following rules. Use IncludeRules when you want
    # to invoke only a small subset of the defualt rules.
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
    #     PSAlignAssignmentStatement = @{
    #         Enable         = $true
    #         CheckHashtable = $true
    #     }
    #     PSAvoidUsingCmdletAliases = @{
    #         Whitelist = @("cd")
    #     }
    #     PSPlaceCloseBrace = @{
    #         Enable             = $true
    #         NoEmptyLineBefore  = $false
    #         IgnoreOneLineBlock = $true
    #         NewLineAfter       = $true
    #     }
    #     PSPlaceOpenBrace = @{
    #         Enable             = $true
    #         OnSameLine         = $true
    #         NewLineAfter       = $true
    #         IgnoreOneLineBlock = $true
    #     }
    #     PSProvideCommentHelp = @{
    #         Enable                  = $true
    #         ExportedOnly            = $false
    #         BlockComment            = $true
    #         VSCodeSnippetCorrection = $false
    #         Placement               = "before"
    #     }
    #     PSUseCompatibleCmdlets = @{
    #         compatibility = @("core-6.0.0-alpha-windows", "core-6.0.0-alpha-linux")
    #     }
    #     PSUseConsistentIndentation = @{
    #         Enable          = $true
    #         IndentationSize = 4
    #     }
    #     PSUseConsistentWhitespace = @{
    #         Enable         = $true
    #         CheckOpenBrace = $true
    #         CheckOpenParen = $true
    #         CheckOperator  = $true
    #         CheckSeparator = $true
    #     }
    # }
}
