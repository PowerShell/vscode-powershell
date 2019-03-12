# PowerShell Language Support for Azure Data Studio

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/df06b9909e7442cebc1132bda0b8c0e3)](https://app.codacy.com/app/TylerLeonhardt/vscode-powershell?utm_source=github.com&utm_medium=referral&utm_content=PowerShell/vscode-powershell&utm_campaign=Badge_Grade_Dashboard)
[![windows build](https://img.shields.io/appveyor/ci/PowerShell/vscode-powershell/master.svg?label=windows+build)](https://ci.appveyor.com/project/PowerShell/vscode-powershell) [![linux/macos build](https://img.shields.io/travis/PowerShell/vscode-powershell/master.svg?label=linux/macos+build)](https://travis-ci.org/PowerShell/vscode-powershell) [![Join the chat at https://gitter.im/PowerShell/vscode-powershell](https://badges.gitter.im/PowerShell/vscode-powershell.svg)](https://gitter.im/PowerShell/vscode-powershell?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

This extension provides rich PowerShell language support for [Azure Data Studio](github.com/Microsoft/azuredatastudio).
Now you can write and debug PowerShell scripts using the excellent IDE-like interface
that Azure Data Studio provides.

## Platform support

- **Windows 7 through 10** with Windows PowerShell v3 and higher, and PowerShell Core
- **Linux** with PowerShell Core (all PowerShell-supported distributions)
- **macOS** with PowerShell Core

Read the [FAQ](https://github.com/PowerShell/vscode-powershell/wiki/FAQ) for answers to common questions.

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
- Basic interactive console support!

## Installing the Extension

You can install the official release of the PowerShell extension by following the steps
in the [Azure Data Studio documentation](docs.microsoft.com/en-us/sql/azure-data-studio/extensions).
In the Extensions pane, search for "PowerShell" extension and install it there.  You will
get notified automatically about any future extension updates!

You can also install a VSIX package from our [Releases page](https://github.com/PowerShell/vscode-powershell/releases) and install it through the command line:

```powershell
azuredatastudio --install-extension PowerShell-<version>.vsix
```

## Reporting Problems

If you experience any problems with the PowerShell Extension, see
[the troubleshooting docs](./docs/troubleshooting.md) for information
on diagnosing and reporting issues.

#### Security Note
For any security issues, please see [here](./docs/troubleshooting.md#note-on-security).

## Example Scripts

There are some example scripts in the extension's `examples` folder that you can
use to discover PowerShell editing and debugging functionality.  Please
check out the included [README.md](examples/README.md) file to learn more about
how to use them.

This folder can be found at the following path:

```powershell
$HOME/.azuredatastudio/extensions/ms-vscode.PowerShell-<version>/examples
```

or if you're using the preview version of the extension

 ```powershell
$HOME/.azuredatastudio/extensions/ms-vscode.powershell-preview-<version>/examples
```

To open/view the extension's examples in Visual Studio Code, run the following from your PowerShell command prompt:

```powershell
code (Get-ChildItem $Home\.azuredatastudio\extensions\ms-vscode.PowerShell-*\examples)[-1]
```

## Contributing to the Code

Check out the [development documentation](docs/development.md) for more details
on how to contribute to this extension!

## Maintainers

- [Keith Hill](https://github.com/rkeithhill) - [@r_keith_hill](http://twitter.com/r_keith_hill)
- [Tyler Leonhardt](https://github.com/tylerl0706) - [@TylerLeonhardt](http://twitter.com/tylerleonhardt)
- [Rob Holt](https://github.com/rjmholt)

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
[conduct-md]: https://github.com/PowerShell/vscode-powershell/blob/master/CODE_OF_CONDUCT.md

## SQL PowerShell Examples
In order to use these examples (below), you need to install the SqlServer module from the [PowerShell Gallery](https://www.powershellgallery.com/packages/SqlServer).

```
Install-Module -Name SqlServer -AllowPrerelease
```

In this example, we use the `Get-SqlInstance` cmdlet to Get the Server SMO objects for ServerA & ServerB.  The default output for this command will include the Instance name, version, Service Pack, & CU Update Level of the instances.

```
Get-SqlInstance -ServerInstance ServerA, ServerB
```

Here is a sample of what that output will look like:

```
Instance Name             Version    ProductLevel UpdateLevel
-------------             -------    ------------ -----------
ServerA                   13.0.5233  SP2          CU4
ServerB                   14.0.3045  RTM          CU12
```

In this example, we will do a `dir` (alias for `Get-ChildItem`) to get the list of all SQL Server instances listed in your Registered Servers file, and then use the `Get-SqlDatabase` cmdlet to get a list of Databases for each of those instances.

```
dir 'SQLSERVER:\SQLRegistration\Database Engine Server Group' -Recurse |
WHERE {$_.Mode -ne 'd' } |
FOREACH {
        Get-SqlDatabase -ServerInstance $_.Name
        }
```
Here is a sample of what that output will look like:
```
Name                 Status           Size     Space  Recovery Compat. Owner
                                            Available  Model     Level      
----                 ------           ---- ---------- -------- ------- -----
AdventureWorks2017   Normal      336.00 MB   57.01 MB Simple       140 sa   
master               Normal        6.00 MB  368.00 KB Simple       140 sa   
model                Normal       16.00 MB    5.53 MB Full         140 sa   
msdb                 Normal       48.44 MB    1.70 MB Simple       140 sa   
PBIRS                Normal      144.00 MB   55.95 MB Full         140 sa   
PBIRSTempDB          Normal       16.00 MB    4.20 MB Simple       140 sa   
SSISDB               Normal      325.06 MB   26.21 MB Full         140 sa   
tempdb               Normal       72.00 MB   61.25 MB Simple       140 sa   
WideWorldImporters   Normal         3.2 GB     2.6 GB Simple       130 sa   
```

This example uses the `Get-SqlDatabase` cmdlet to retireve a list of all databases on the ServerB instance, then presents a grid/table to select which databases should be backed up.  Once the user clicks on the "OK" button, only the highlighted databases will be backed up.

```
Get-SqlDatabase -ServerInstance ServerB |
Out-GridView -PassThru |
Backup-SqlDatabase -CompressionOption On
```

This example again gets list of all SQL Server instances listed in your Registered Servers file, then calls the `Get-SqlAgentJobHistory` which reports every failed SQL Agent Job since Midnight, for each SQL Server instances listed.

```
dir 'SQLSERVER:\SQLRegistration\Database Engine Server Group' -Recurse |
WHERE {$_.Mode -ne 'd' } |
FOREACH {
        Get-SqlAgentJobHistory -ServerInstance  $_.Name -Since Midnight -OutcomesType Failed
        }
```
