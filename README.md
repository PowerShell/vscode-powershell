# PowerShell Language Support for Visual Studio Code

[![Build Status](https://dev.azure.com/powershell/vscode-powershell/_apis/build/status/PowerShell.vscode-powershell?branchName=main)](https://dev.azure.com/powershell/vscode-powershell/_build/latest?definitionId=51&branchName=main)
[![Version](https://vsmarketplacebadge.apphb.com/version/ms-vscode.PowerShell.svg)](https://marketplace.visualstudio.com/items?itemName=ms-vscode.PowerShell)
[![Installs](https://vsmarketplacebadge.apphb.com/installs-short/ms-vscode.PowerShell.svg)](https://marketplace.visualstudio.com/items?itemName=ms-vscode.PowerShell)
[![Discord](https://img.shields.io/discord/180528040881815552.svg?label=%23vscode&logo=discord&logoColor=white)](https://aka.ms/powershell-vscode-discord)
[![Join the chat at https://gitter.im/PowerShell/vscode-powershell](https://badges.gitter.im/PowerShell/vscode-powershell.svg)](https://gitter.im/PowerShell/vscode-powershell?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

This extension provides rich PowerShell language support for [Visual Studio Code](https://github.com/Microsoft/vscode) (VS Code).
Now you can write and debug PowerShell scripts using the excellent IDE-like interface
that Visual Studio Code provides.

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

The extension _should_ work anywhere VS Code itself and PowerShell Core 7 or higher is
[supported][]. For Windows PowerShell, only version 5.1 is supported. Please note that
PowerShell Core 6 is end-of-life and so not supported. Our test matrix includes the
following:

- **Windows Server 2022** with Windows PowerShell 5.1 and PowerShell Core 7.2.5
- **Windows Server 2019** with Windows PowerShell 5.1 and PowerShell Core 7.2.5
- **macOS 11** with PowerShell Core 7.2.5
- **Ubuntu 20.04** with PowerShell Core 7.2.5

[supported]: https://docs.microsoft.com/en-us/powershell/scripting/powershell-support-lifecycle

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
in the [Visual Studio Code documentation](https://code.visualstudio.com/docs/editor/extension-gallery).
In the Extensions pane, search for "PowerShell" extension and install it there. You will
get notified automatically about any future extension updates!

You can also install a VSIX package from our [releases page](https://github.com/PowerShell/vscode-powershell/releases) by following the
[Install from a VSIX](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix)
instructions. The easiest way is through the command line:

```powershell
code --install-extension powershell-<version>.vsix
```

> NOTE: If you are using VS Code Insiders, the command will be `code-insiders`.

### Script-based Installation

If you're on Windows 7 or greater with the [PowerShellGet](https://msdn.microsoft.com/powershell/gallery/readme)
module installed, you can easily install both Visual Studio Code and the PowerShell
extension by running the following command:

```powershell
Install-Script Install-VSCode -Scope CurrentUser; Install-VSCode.ps1
```

You will need to accept the prompts that appear if this is your first time running
the `Install-Script` command.

**Alternatively** you can download and execute the script directly from the web
without the use of `Install-Script`.  However we **highly recommend** that you
[read the script](https://raw.githubusercontent.com/PowerShell/vscode-powershell/main/scripts/Install-VSCode.ps1)
first before running it in this way!

```powershell
iex (iwr https://raw.githubusercontent.com/PowerShell/vscode-powershell/main/scripts/Install-VSCode.ps1)
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
$HOME/.vscode[-insiders]/extensions/ms-vscode.powershell[-preview]-<version>/examples
```

To open/view the extension's examples in Visual Studio Code, run the following from your
PowerShell session:

```powershell
code (Get-ChildItem $HOME/.vscode/extensions/ms-vscode.powershell-*/examples)[-1]
```

## Contributing to the Code

Check out the [development documentation](docs/development.md) for more details
on how to contribute to this extension!

## Maintainers

- Patrick Meinecke - [@SeeminglyScience](https://github.com/SeeminglyScience)
- Andy Schwartzmeyer - [@andschwa](https://github.com/andschwa)
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
