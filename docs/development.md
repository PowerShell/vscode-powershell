# Development Instructions for the PowerShell Extension

## Development Setup

You'll need to clone two repositories and set up your development environment
to before you can proceed.

1. [Fork and clone](https://help.github.com/articles/fork-a-repo/) the [vscode-powershell repository](https://github.com/PowerShell/vscode-powershell)

2. [Fork and clone](https://help.github.com/articles/fork-a-repo/) the [PowerShell Editor Services (PSES) repository](https://github.com/PowerShell/PowerShellEditorServices)

> NOTE: the `vscode-powershell` folder and the `PowerShellEditorServices` folder should be next to each other on the file system. Code in `vscode-powershell` looks for PSES at `../PowerShellEditorServices` if you're building locally so PSES must be in that location.

3. Follow the [development instructions](https://github.com/PowerShell/PowerShellEditorServices#development) for PowerShell Editor Services. **You will need to complete this step before proceeding**.

4. Install the latest [Visual Studio Code Insiders release](https://code.visualstudio.com/insiders)
    - You can also use the [standard Visual Studio Code release](https://code.visualstudio.com/). Both will work, but using VSCode
    Insiders means the extension can be developed ready for new features
    and changes in the next VSCode release.

5. Install [Node.js](https://nodejs.org/en/) 10.x or higher.

## Building the Code

#### From Visual Studio Code:

Press <kbd>Ctrl</kbd>+<kbd>P</kbd> and type `task build`

This will compile the TypeScript files in the project to JavaScript files.

#### From a PowerShell prompt:

```
Invoke-Build Build
```

## Launching the extension

#### From Visual Studio Code:

To debug the extension, press <kbd>F5</kbd>.  To run the extension without debugging,
press <kbd>Ctrl</kbd>+<kbd>F5</kbd> or <kbd>Cmd</kbd>+<kbd>F5</kbd> on macOS.

#### From a command prompt:

```
code --extensionDevelopmentPath="c:\path\to\vscode-powershell" .
```

## Contributing Snippets

For more information on contributing snippets please read our [snippet requirements](https://github.com/PowerShell/vscode-powershell/blob/master/docs/community_snippets.md#contributing). 
