# PowerShell Language Support for Visual Studio Code

[![Version](https://vsmarketplacebadge.apphb.com/version/ms-vscode.PowerShell.svg)](https://marketplace.visualstudio.com/items?itemName=ms-vscode.PowerShell) [![Installs](https://vsmarketplacebadge.apphb.com/installs-short/ms-vscode.PowerShell.svg)](https://marketplace.visualstudio.com/items?itemName=ms-vscode.PowerShell) [![windows build](https://img.shields.io/appveyor/ci/PowerShell/vscode-powershell/master.svg?label=windows+build)](https://ci.appveyor.com/project/PowerShell/vscode-powershell) [![linux/macos build](https://img.shields.io/travis/PowerShell/vscode-powershell/master.svg?label=linux/macos+build)](https://travis-ci.org/PowerShell/vscode-powershell) [![Join the chat at https://gitter.im/PowerShell/vscode-powershell](https://badges.gitter.im/PowerShell/vscode-powershell.svg)](https://gitter.im/PowerShell/vscode-powershell?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

This extension provides rich PowerShell language support for [Visual Studio Code](https://github.com/Microsoft/vscode).
Now you can write and debug PowerShell scripts using the excellent IDE-like interface
that Visual Studio Code provides.

## Platform support

- **Windows 7 through 10** with PowerShell v3 and higher
- **Linux** with PowerShell v6 (all PowerShell-supported distributions)
- **macOS and OS X** with PowerShell v6

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
- Run selected selection of PowerShell code using `F8`
- Launch online help for the symbol under the cursor using `Ctrl+F1`
- Local script debugging and basic interactive console support!

## Quick Installation

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

## Reporting Problems

If you're having trouble with the PowerShell extension, please follow these instructions
to file an issue on our GitHub repository:

### 1. File an issue on our [Issues Page](https://github.com/PowerShell/vscode-powershell/issues)

Make sure to fill in the information that is requested in the issue template as it
will help us investigate the problem more quickly.

> Note To automatically create a bug report from within the extension run the *"Report a problem on GitHub"* command. Some basic information about your instance and powershell versions will be collected and inserted into a new GitHub issue.

### 2. Capture verbose logs and send them to us

If you're having an issue with crashing or other erratic behavior, add the following
line to your User Settings in Visual Studio Code:

```json
    "powershell.developer.editorServicesLogLevel": "Verbose"
```

Restart Visual Studio Code and try to reproduce the problem.  Once you are done with
that, zip up the logs in the corresponding folder for your operating system:

- **Windows**: `$HOME\.vscode\extensions\ms-vscode.PowerShell-<CURRENT VERSION>\logs`
- **Linux and macOS**: `~/.vscode/extensions/ms-vscode.PowerShell-<CURRENT VERSION>/logs`

You have two options for sending us the logs:

  1. If you are editing scripts that contain sensitive information (intellectual property,
     deployment or administrative information, etc), e-mail the logs directly to
     *daviwil [at] microsoft.com*

  2. If you are editing scripts that don't contain sensitive information, you can drag and
     drop your logs ZIP file into the GitHub issue that you are creating.

## Contributing to the Code

Check out the [development documentation](docs/development.md) for more details
on how to contribute to this extension!

## Maintainers

- [David Wilson](https://github.com/daviwil) - [@daviwil](http://twitter.com/daviwil)
- [Keith Hill](https://github.com/rkeithhill) - [@r_keith_hill](http://twitter.com/r_keith_hill)
- [Kapil Borle](https://github.com/kapilmb) - [@kmborle](http://twitter.com/kmborle)
- [Trevor Sullivan](https://github.com/pcgeek86) - [@pcgeek86](http://twitter.com/pcgeek86)

## License

This extension is [licensed under the MIT License](LICENSE.txt).  Please see the
[third-party notices](Third%20Party%20Notices.txt) file for details on the third-party
binaries that we include with releases of this project.
