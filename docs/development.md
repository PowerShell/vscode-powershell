# Development Instructions for the PowerShell Extension

## Development Setup

You'll need to clone two repositories and set up your development environment
to before you can proceed.

### 1. [Fork and clone](https://help.github.com/articles/fork-a-repo/) the [vscode-powershell repository](https://github.com/PowerShell/vscode-powershell)

### 2. [Fork and clone](https://help.github.com/articles/fork-a-repo/) the [PowerShell Editor Services repository](https://github.com/PowerShell/PowerShellEditorServices)

### 3. Follow the [development instructions](https://github.com/PowerShell/PowerShellEditorServices#development) for PowerShell Editor Services

### 4. Install [Visual Studio Code Insiders Release](https://code.visualstudio.com/insiders)

### 5. Install [Node.js](https://nodejs.org/en/) 6.0.0 or higher.

## Building the Code

#### From Visual Studio Code:

Press <kbd>Ctrl+P</kbd> and type `task build`

This will compile the TypeScript files in the project to JavaScript files.

#### From a command prompt:

```
Invoke-Build Build
```

## Launching the extension

#### From Visual Studio Code:

To debug the extension, press <kbd>F5</kbd>.  To run the extension without debugging,
press <kbd>Ctrl+F5</kbd> or <kbd>Cmd+F5</kbd> on macOS.

#### From a command prompt:

```
code --extensionDevelopmentPath="c:\path\to\vscode-powershell" .
```
