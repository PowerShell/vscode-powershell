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
