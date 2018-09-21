# PowerShell Language Support for Visual Studio Code

[![Version](https://vsmarketplacebadge.apphb.com/version/ms-vscode.PowerShell.svg)](https://marketplace.visualstudio.com/items?itemName=ms-vscode.PowerShell) [![Installs](https://vsmarketplacebadge.apphb.com/installs-short/ms-vscode.PowerShell.svg)](https://marketplace.visualstudio.com/items?itemName=ms-vscode.PowerShell) [![windows build](https://img.shields.io/appveyor/ci/PowerShell/vscode-powershell/master.svg?label=windows+build)](https://ci.appveyor.com/project/PowerShell/vscode-powershell) [![linux/macos build](https://img.shields.io/travis/PowerShell/vscode-powershell/master.svg?label=linux/macos+build)](https://travis-ci.org/PowerShell/vscode-powershell) [![Join the chat at https://gitter.im/PowerShell/vscode-powershell](https://badges.gitter.im/PowerShell/vscode-powershell.svg)](https://gitter.im/PowerShell/vscode-powershell?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

This extension provides rich PowerShell language support for [Visual Studio Code](https://github.com/Microsoft/vscode).
Now you can write and debug PowerShell scripts using the excellent IDE-like interface
that Visual Studio Code provides.

## Platform support

- **Windows 7 through 10** with Windows PowerShell v3 and higher, and PowerShell Core
- **Linux** with PowerShell Core (all PowerShell-supported distributions)
- **macOS and OS X** with PowerShell Core

Read the [installation instructions](https://github.com/PowerShell/PowerShell/blob/master/docs/learning-powershell/using-vscode.md)
to get more details on how to use the extension on these platforms.

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
- Local script debugging and basic interactive console support!

## Installing the Extension

You can install the official release of the PowerShell extension by following the steps
in the [Visual Studio Code documentation](https://code.visualstudio.com/docs/editor/extension-gallery).
In the Extensions pane, search for "PowerShell" extension and install it there.  You will
get notified automatically about any future extension updates!

You can also install a VSIX package from our [Releases page](https://github.com/PowerShell/vscode-powershell/releases) by following the
[Install from a VSIX](https://code.visualstudio.com/docs/extensions/install-extension#_install-from-a-vsix)
instructions.  The easiest way is through the command line:

```
code --install-extension PowerShell-<version>.vsix
```

> NOTE: If you are using VS Code Insiders, the command will be `code-insiders`.

## Script-based Installation

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
[read the script](https://github.com/PowerShell/vscode-powershell/blob/develop/scripts/Install-VSCode.ps1)
first before running it in this way!

```powershell
iex (iwr https://git.io/vbxjj)
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

```
C:\Users\<yourusername>\.vscode\extensions\ms-vscode.PowerShell-<version>\examples
```

To open/view the extension's examples in Visual Studio Code, run the following from your PowerShell command prompt:

```powershell
code (Get-ChildItem $Home\.vscode\extensions\ms-vscode.PowerShell-*\examples)[-1]
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
