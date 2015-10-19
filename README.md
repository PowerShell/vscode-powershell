# Windows PowerShell for Visual Studio Code

Windows PowerShell language support for Visual Studio Code.
More details forthcoming.

## Building the code

`npm run compile`

After the initial compile, the source files will be watched and recompiled
when changes are saved.

## Running the compiled code

From a PowerShell or cmd.exe prompt, run the following command:

`code --extensionDevelopmentPath="c:\path\to\vscode-powershell" .`
		
If you allow the compiler to continue watching for file changes, you can use
the `Reload Window` command found in the command palette `(Ctrl+Shift+P)` 
so that the new source files are loaded.

## Example Scripts

There are some example scripts in the `examples` folder that you can
use to discover PowerShell editing and debugging functionality.  Please
check out the [README.md](examples/README.md) file to learn more about
how to use them.

## License

This project is [licensed under the MIT License](LICENSE).  Please see the
[third-party notices](Third Party Notices.txt) file for details on the third-party
binaries that we include with releases of this project.
