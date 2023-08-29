# PowerShell for Visual Studio Code

[![Build Status](https://dev.azure.com/powershell/vscode-powershell/_apis/build/status/PowerShell.vscode-powershell?branchName=main)](https://dev.azure.com/powershell/vscode-powershell/_build/latest?definitionId=51&branchName=main)
[![Version](https://img.shields.io/visual-studio-marketplace/v/ms-vscode.PowerShell)](https://marketplace.visualstudio.com/items?itemName=ms-vscode.PowerShell)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/ms-vscode.PowerShell)](https://marketplace.visualstudio.com/items?itemName=ms-vscode.PowerShell)
[![Join the chat on Discord](https://img.shields.io/discord/180528040881815552.svg?label=%23vscode&logo=discord&logoColor=white)](https://aka.ms/powershell-vscode-discord)

This extension provides rich [PowerShell][] language support for [Visual Studio Code][] (VS Code).
Now you can write and debug PowerShell scripts using the excellent IDE-like interface
that VS Code provides.

This repository, `vscode-powershell`, is the [Language Server Protocol][] client for VS
Code and [`PowerShellEditorServices`][] is the server (also used by other editors, such as
Emacs and Vim).

[PowerShell]: https://github.com/PowerShell/PowerShell
[Visual Studio Code]: https://github.com/Microsoft/vscode
[`PowerShellEditorServices`]: https://github.com/PowerShell/PowerShellEditorServices
[Language Server Protocol]: https://microsoft.github.io/language-server-protocol/

## Available Features

- [Syntax highlighting][]
- Advanced built-in [code snippets][]
- [IntelliSense][] for cmdlets and more
- [Problems][] reported by [PowerShell Script Analyzer][]
- [Go to Definition][] of cmdlets, variables, classes and more
- [Find References][] of cmdlets, variables, classes and more
- Document and Workspace [Symbol Navigation][]
- Symbol-based [Outline View][]
- Run selected PowerShell code in current terminal using <kbd>F8</kbd>
- Launch online help for the symbol under the cursor using <kbd>Ctrl+F1</kbd>
- PowerShell [Debugger][] integration
- An Extension Terminal that can interact with the debugger (try `Set-PSBreakpoint`!)
- PowerShell ISE theme findable in the [theme picker][]
- Also try ISE Mode with the **Toggle ISE Mode** command

Bundled with the extension is the PowerShell ISE theme. It is not activated by default,
but after installing this extension either click **Set Color Theme** or use the [theme
picker][] and select **PowerShell ISE**.

[Syntax highlighting]: https://github.com/PowerShell/EditorSyntax
[code snippets]: https://code.visualstudio.com/docs/editor/userdefinedsnippets
[IntelliSense]: https://code.visualstudio.com/docs/editor/intellisense
[Problems]: https://code.visualstudio.com/docs/getstarted/tips-and-tricks#_errors-and-warnings
[PowerShell Script Analyzer]: http://github.com/PowerShell/PSScriptAnalyzer
[Go to Definition]: https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition
[Find References]: https://code.visualstudio.com/docs/editor/editingevolved#_reference-information
[Symbol Navigation]: https://code.visualstudio.com/docs/editor/editingevolved#_open-symbol-by-name
[Outline View]: https://code.visualstudio.com/docs/getstarted/userinterface#_outline-view
[Debugger]: https://learn.microsoft.com/powershell/scripting/dev-cross-plat/vscode/using-vscode#debugging-with-visual-studio-code
[theme picker]: https://code.visualstudio.com/docs/getstarted/themes

## Platform Support

The extension should work anywhere VS Code itself and PowerShell Core 7.2 or higher is
[supported][]. For Windows PowerShell, only version 5.1 is supported and only on a best-effort
basis. PowerShell Core 6, 7.0, and 7.1 have reached end-of-support. We test the following
configurations:

- **Windows Server 2022** with Windows PowerShell 5.1 and PowerShell Core 7.2
- **Windows Server 2019** with Windows PowerShell 5.1 and PowerShell Core 7.2
- **macOS 11** with PowerShell Core 7.2
- **Ubuntu 20.04** with PowerShell Core 7.2

Read the [installation instructions][]
to get more details on how to use the extension on these platforms.

For Windows PowerShell 5.1, [.NET Framework 4.8][dotnet-framework] or higher is required.

[supported]: https://docs.microsoft.com/en-us/powershell/scripting/powershell-support-lifecycle
[installation instructions]: https://docs.microsoft.com/en-us/powershell/scripting/components/vscode/using-vscode
[dotnet-framework]: https://dotnet.microsoft.com/en-us/download/dotnet-framework

## Installing the Extension

The PowerShell extension can be installed from the Visual Studio Code Marketplace by
clicking the [**Install Button**][]. You can also install the PowerShell extension from
within VS Code by opening the **Extensions** view with keyboard shortcut
<kbd>Ctrl+Shift+X</kbd>, typing PowerShell, and selecting the extension.

We would encourage you to try the _pre-release_ version whenever possible. When a
_Pre-Release_ is available, it can be installed from the marketplace using the
**Switch to Pre-Release Version** button. You can switch back to the stable version of the
extension by using the **Switch to Release Version** button that will appear. You can also
downgrade to other versions of the extension using the arrow next to the **Uninstall**
button and choosing **Install Another Version**.

[**Install Button**]: vscode:extension/ms-vscode.PowerShell

## Getting Help

If you experience any problems with the PowerShell Extension, see the
[troubleshooting docs](docs/troubleshooting.md) for common issues.

If you find a bug, please [open an issue][] so we can fix it.

Don't forget to check out the official guide on
[Using VS Code for PowerShell Development][].

[Using VS Code for PowerShell Development]: https://learn.microsoft.com/en-us/powershell/scripting/dev-cross-plat/vscode/using-vscode
[open an issue]: https://github.com/PowerShell/vscode-powershell/issues/new/choose

## Contributing to the Code

Check out the [development documentation](docs/development.md) for more details
on how to contribute to this extension!

## Security Note

For any security issues, please see [here](./SECURITY.md).

## Maintainers

### Current

- Andy Jordan - [@andschwa](https://github.com/andschwa)
- Patrick Meinecke - [@SeeminglyScience](https://github.com/SeeminglyScience)
- Sydney Smith - [@SydneyhSmith](https://github.com/SydneyhSmith)

### Emeriti

- Keith Hill - [@rkeithhill](https://github.com/rkeithhill)
- Rob Holt - [@rjmholt](https://github.com/rjmholt)
- Tyler Leonhardt - [@TylerLeonhardt](https://github.com/TylerLeonhardt)
- David Wilson - [@daviwil](https://github.com/daviwil)

## License

This extension is [licensed under the MIT License](LICENSE.txt). Please see the
[third-party notices](Third%20Party%20Notices.txt) file for details on the third-party
binaries that we include with releases of this project.

## [Code of Conduct][conduct-md]

This project has adopted the [Microsoft Open Source Code of Conduct][conduct-code].
For more information see the [Code of Conduct FAQ][conduct-FAQ] or contact [opencode@microsoft.com][conduct-email] with any additional questions or comments.

[conduct-code]: http://opensource.microsoft.com/codeofconduct/
[conduct-FAQ]: http://opensource.microsoft.com/codeofconduct/faq/
[conduct-email]: mailto:opencode@microsoft.com
[conduct-md]: https://github.com/PowerShell/vscode-powershell/blob/main/CODE_OF_CONDUCT.md
