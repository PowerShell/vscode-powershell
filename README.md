# PowerShell Language Support for Visual Studio Code

This extension provides rich PowerShell language support for Visual Studio Code.
Now you can write and debug PowerShell scripts using the excellent IDE-like interface
that VS Code provides.

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

## Example Scripts

There are some example scripts in the extension's `examples` folder that you can
use to discover PowerShell editing and debugging functionality.  Please
check out the included [README.md](examples/README.md) file to learn more about
how to use them.

This folder can be found at the following path:
```
$env:USERPROFILE\.vscode\extensions\ms-vscode.PowerShell-<version>\examples
```
To open/view the extension's examples Visual Studio Code, run the following from your PowerShell command prompt:
```
code (Get-ChildItem $Home\.vscode\extensions\ms-vscode.PowerShell-*\examples)[-1]
```

## Contributing to the Code

Check out the [development documentation](docs/development.md) for more details
on how to contribute to this extension!

## Maintainers

- [David Wilson](https://github.com/daviwil) - [@daviwil](http://twitter.com/daviwil)
- [Keith Hill](https://github.com/rkeithhill) - [@r_keith_hill](http://twitter.com/r_keith_hill)

## License

This extension is [licensed under the MIT License](LICENSE.txt).  Please see the
[third-party notices](Third Party Notices.txt) file for details on the third-party
binaries that we include with releases of this project.
