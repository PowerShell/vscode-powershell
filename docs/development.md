# Working with the PowerShell extension code

## Building the code

First, install the package dependencies:

```
npm install
```

Now you can compile the code:

```
npm run compile
```

After the initial compile, the source files will be watched and recompiled
when changes are saved.

## Running the compiled code

From a PowerShell or cmd.exe prompt, run the following command:

```
code --extensionDevelopmentPath="c:\path\to\vscode-powershell" .
```
		
If you allow the compiler to continue watching for file changes, you can use
the `Reload Window` command found in the command palette `(Ctrl+Shift+P)` 
so that the new source files are loaded.
