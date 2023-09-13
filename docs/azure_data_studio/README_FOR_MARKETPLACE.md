# PowerShell  for Azure Data Studio

[![Build Status](https://dev.azure.com/powershell/vscode-powershell/_apis/build/status/PowerShell.vscode-powershell?branchName=main)](https://dev.azure.com/powershell/vscode-powershell/_build/latest?definitionId=51&branchName=main)
[![Version](https://vsmarketplacebadge.apphb.com/version/ms-vscode.PowerShell.svg)](https://marketplace.visualstudio.com/items?itemName=ms-vscode.PowerShell)
[![Installs](https://vsmarketplacebadge.apphb.com/installs-short/ms-vscode.PowerShell.svg)](https://marketplace.visualstudio.com/items?itemName=ms-vscode.PowerShell)
[![Join the chat on Discord](https://img.shields.io/discord/180528040881815552.svg?label=%23vscode&logo=discord&logoColor=white)](https://aka.ms/powershell-vscode-discord)
[![Join the chat on Gitter](https://badges.gitter.im/PowerShell/vscode-powershell.svg)](https://gitter.im/PowerShell/vscode-powershell?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

This extension provides rich PowerShell language support for [Azure Data Studio](https://github.com/Microsoft/azuredatastudio) (ADS).
Now you can write and run PowerShell scripts using the excellent IDE-like interface
that ADS provides.

This extension is powered by the PowerShell language server,
[PowerShell Editor Services](https://github.com/PowerShell/PowerShellEditorServices).
This leverages the
[Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
where `PowerShellEditorServices` is the server and `vscode-powershell` is the client.

Also included in this extension is the PowerShell ISE theme for Visual Studio Code. It is
not activated by default, but after installing this extension either click "Set Color
Theme" or use the [theme picker](https://code.visualstudio.com/docs/getstarted/themes) and
select "PowerShell ISE" for a fun and familiar experience.

## Platform Support

The extension _should_ work anywhere ADS itself and PowerShell Core 7.2 or higher is
[supported][]. For Windows PowerShell, only version 5.1 is supported. Please note that
PowerShell Core 6 is end-of-life and so not supported. Our test matrix includes the
following:

- **Windows Server 2022** with Windows PowerShell 5.1 and PowerShell Core 7.2.7
- **Windows Server 2019** with Windows PowerShell 5.1 and PowerShell Core 7.2.7
- **macOS 11** with PowerShell Core 7.2.7
- **Ubuntu 20.04** with PowerShell Core 7.2.7

[supported]: https://docs.microsoft.com/en-us/powershell/scripting/powershell-support-lifecycle?view=powershell-7.1#supported-platforms

Read the [installation instructions](https://docs.microsoft.com/en-us/powershell/scripting/components/vscode/using-vscode)
to get more details on how to use the extension on these platforms.

**Read the [troubleshooting guide](./docs/troubleshooting.md) for answers to common questions.**

## Features

- Syntax highlighting
- Code snippets
- IntelliSense for cmdlets and more
- Rule-based analysis provided by [PowerShell Script Analyzer](http://github.com/PowerShell/PSScriptAnalyzer)
- Go to Definition of cmdlets and variables
- Find References of cmdlets and variables
- Document and workspace symbol discovery
- Run selected selection of PowerShell code using <kbd>F8</kbd>
- Launch online help for the symbol under the cursor using <kbd>Ctrl</kbd>+<kbd>F1</kbd>
- Local script debugging
- Extension Terminal support
- PowerShell ISE color theme

## Installing the Extension

You can install the official release of the PowerShell extension by following the steps
in the [Azure Data Studio documentation](https://docs.microsoft.com/en-us/sql/azure-data-studio/extensions).
In the Extensions pane, search for "PowerShell" extension and install it there.  You will
get notified automatically about any future extension updates!

You can also install a VSIX package from our [releases page](https://github.com/PowerShell/vscode-powershell/releases) by following the
[Install from a VSIX](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix)
instructions. The easiest way is through the command line:

```powershell
azuredatastudio --install-extension powershell-<version>.vsix
```

## Reporting Problems

If you experience any problems with the PowerShell Extension, see
[the troubleshooting docs](./docs/troubleshooting.md) for information
on diagnosing and reporting issues.

## Security Note

For any security issues, please see [here](./SECURITY.md).

## Example Scripts

There are some example scripts in the extension's `examples` folder that you can
use to discover PowerShell editing and debugging functionality.  Please
check out the included [README.md](examples/README.md) file to learn more about
how to use them.

This folder can be found at the following path:

```powershell
$HOME/.azuredatastudio/extensions/ms-vscode.powershell-<version>/examples
```

To open/view the extension's examples in Azure Data Studio, run the following from your
PowerShell session:

```powershell
azuredatastudio (Get-ChildItem $HOME/.azuredatastudio/extensions/ms-vscode.powershell-*/examples)[-1]
```

### SQL PowerShell Examples

In order to use these examples (below), you need to install the SqlServer module from the
[PowerShell Gallery](https://www.powershellgallery.com/packages/SqlServer).

```powershell
Install-Module -Name SqlServer
```

> NOTE: With version `21.1.18102` and up, the `SqlServer` module supports [PowerShell Core](https://github.com/PowerShell/PowerShell) 6.2 and up, in addion to Windows PowerShell.

In this example, we use the `Get-SqlInstance` cmdlet to Get the Server SMO objects for
ServerA and ServerB. The default output for this command will include the Instance name,
version, Service Pack, and CU Update Level of the instances.

```powershell
Get-SqlInstance -ServerInstance ServerA, ServerB
```

Here is a sample of what that output will look like:

```powershell
Instance Name             Version    ProductLevel UpdateLevel  HostPlatform HostDistribution
-------------             -------    ------------ -----------  ------------ ----------------
ServerA                   13.0.5233  SP2          CU4          Windows      Windows Server 2016 Datacenter
ServerB                   14.0.3045  RTM          CU12         Linux        Ubuntu
```

In the following example, we will do a `dir` (alias for `Get-ChildItem`) to get the list of all SQL Server instances listed in your Registered Servers file, and then use the `Get-SqlDatabase` cmdlet to get a list of Databases for each of those instances.

```powershell
dir 'SQLSERVER:\SQLRegistration\Database Engine Server Group' -Recurse |
WHERE { $_.Mode -ne 'd' } |
FOREACH {
    Get-SqlDatabase -ServerInstance $_.Name
}
```

Here is a sample of what that output will look like:

```powershell
Name                 Status           Size     Space  Recovery Compat. Owner
                                            Available  Model     Level
----                 ------           ---- ---------- -------- ------- -----
AdventureWorks2017   Normal      336.00 MB   57.01 MB Simple       140 sa
main               Normal        6.00 MB  368.00 KB Simple       140 sa
model                Normal       16.00 MB    5.53 MB Full         140 sa
msdb                 Normal       48.44 MB    1.70 MB Simple       140 sa
PBIRS                Normal      144.00 MB   55.95 MB Full         140 sa
PBIRSTempDB          Normal       16.00 MB    4.20 MB Simple       140 sa
SSISDB               Normal      325.06 MB   26.21 MB Full         140 sa
tempdb               Normal       72.00 MB   61.25 MB Simple       140 sa
WideWorldImporters   Normal         3.2 GB     2.6 GB Simple       130 sa
```

This example uses the `Get-SqlDatabase` cmdlet to retrieve a list of all databases on the ServerB instance, then presents a grid/table (using the `Out-GridView` cmdlet) to select which databases should be backed up.  Once the user clicks on the "OK" button, only the highlighted databases will be backed up.

```powershell
Get-SqlDatabase -ServerInstance ServerB |
Out-GridView -PassThru |
Backup-SqlDatabase -CompressionOption On
```

This example, again, gets list of all SQL Server instances listed in your Registered Servers file, then calls the `Get-SqlAgentJobHistory` which reports every failed SQL Agent Job since Midnight, for each SQL Server instances listed.

```powershell
dir 'SQLSERVER:\SQLRegistration\Database Engine Server Group' -Recurse |
WHERE {$_.Mode -ne 'd' } |
FOREACH {
    Get-SqlAgentJobHistory -ServerInstance  $_.Name -Since Midnight -OutcomesType Failed
}
```

## Contributing to the Code

Check out the [development documentation](docs/development.md) for more details
on how to contribute to this extension!

## Maintainers

- Patrick Meinecke - [@SeeminglyScience](https://github.com/SeeminglyScience)
- Andy Jordan - [@andschwa](https://github.com/andschwa)
- Sydney Smith - [@SydneyhSmith](https://github.com/SydneyhSmith)

### Emeriti

- Keith Hill - [@rkeithhill](https://github.com/rkeithhill)
- Rob Holt - [@rjmholt](https://github.com/rjmholt)
- Tyler Leonhardt - [@TylerLeonhardt](https://github.com/TylerLeonhardt)
- David Wilson - [@daviwil](https://github.com/daviwil)

## License

This extension is [licensed under the MIT License](LICENSE.txt).  Please see the
[third-party notices](Third%20Party%20Notices.txt) file for details on the third-party
binaries that we include with releases of this project.

## [Code of Conduct][conduct-md]

This project has adopted the [Microsoft Open Source Code of Conduct][conduct-code].
For more information see the [Code of Conduct FAQ][conduct-FAQ] or contact [opencode@microsoft.com][conduct-email] with any additional questions or comments.

[conduct-code]: http://opensource.microsoft.com/codeofconduct/
[conduct-FAQ]: http://opensource.microsoft.com/codeofconduct/faq/
[conduct-email]: mailto:opencode@microsoft.com
[conduct-md]: https://github.com/PowerShell/vscode-powershell/blob/main/CODE_OF_CONDUCT.md
