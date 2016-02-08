# Example Files README

*NOTE: For a more comfortable reading experience, use the key combination `Ctrl+Shift+V`*

This folder contains a few basic PowerShell script files that you can use
to experiment with the new PowerShell editing and debugging capabilities.
Here are some ideas for what you can try with these scripts:

## Language Features

- **Integrated syntax checks** from the PowerShell engine and **integrated
  rule-based analysis** using PowerShell Script Analyzer
  - Try opening `DebugTest.ps1` and `StopTest.ps1` by double-clicking on their
    file names.  You will see red and green squiggles for rule-based checks.
    You can introduce a syntax error somewhere to see the red squiggle for
    that as well.  To see a list of all errors and warnings, try pressing
    `Ctrl+Shift+M`.
- **Go to definition `(F12)`** and **Peek definition `(Alt+F12)`**
  for cmdlet and variable names
  - Try this on the `Stop-Process2` cmdlet in `StopTest.ps1`
- **Find all references `(Shift+F12)`** for cmdlet and variable names
  - Also try this on the `Stop-Process2` cmdlet in `StopTest.ps1`
- **Change all occurrences `(Ctrl+F2)`** for renaming symbols
  - Try this on the `$process` variable in `Stop-Process2.ps1`

## Local Script Debugging

You can run scripts under the debugger by going to the debug workspace
`(Ctrl+Shift+D)` and clicking the `Start` button or just by pressing `F5`.
By default the debugger will start the `DebugTest.ps1` script.  You can
set breakpoints, pause execution, look at the call stack, inspect variables,
and set specific variables to be watched.

Try these steps:

1. Open the Debug workspace by pressing `Ctrl+Shift+D`
2. Press `F5` to start debugging. Once the status bar turns orange, the script is running.
3. Press the blue **Pause** button at the top of the screen.  The debugger
   will stop executing wherever it is at the moment and will bring you to the
   file and line where it stopped.
4. Check out the **Variables** pane at the top left of the window.  Scroll
   through the list and inspect some of the variables there.
5. Find the variable `i` in the Variables list, right click it and select
   **Add to Watch**.  The variable should appear in the **Watch** pane now.
6. Hover over the title of the **Watch** pane and some buttons should appear.
   Click the plus sign `+` button and type `str` then press enter.
7. Back in the editor, click to the left of line 10 to set a breakpoint there.
8. Click the green **Play** button or press `F5` to continue execution.
9. Observe that every time the breakpoint is hit, the watch variables get updated.
10. When you're done debugging, click the red **Stop** button or press `Shift+F5`

The debugger will attempt to execute the file in the active editor pane.
If you would like to configure a single script to always be executed upon
launch of the debugger, you will need to edit the `.vscode\launch.json`
file and change the `program` parameter to point to the script file to be
debugged.  The path must be absolute but you can use the ${workspaceRoot} variable
to refer to the open folder in VSCode e.g.
`"program": "${workspaceRoot}\\DebugTest.ps1"`

### Passing Arguments to the Script

If you would like to pass arguments to your script, open the `.vscode\launch.json`
file in your workspace and modify the `args` parameter e.g.:

`"args": [ "-Param1 foo -Recurse" ]`

You can pass all your script arguments in a single string or break them up
into individual strings e.g.:

`"args": [ "-Param1", "foo" "-Recurse" ],`

At runtime these arguments will be concatenated togehter using a space
delimiter so it will result in the same string as the first `args` example.

### Setting the Working Directory

When the debugger starts it will set the working directory of the PowerShell
environment depending on the value of the `cwd` parameter in the
`.vscode\launch.json` file in your workspace.  If this parameter is missing or
is set to an empty string, the working directory will be set to the workspace directory.
By default it is set to `${file}` which will set the working directory to the parent
directory of the file in the active editor pane when the debugger is launched.
You can also set the parameter explicitly e.g.:

`"cwd": "C:\\Users\\JSnover\\Documents\\MonadUberAlles"`

## Feedback

We would love to hear your feedback!  Please post feature requests or issue
reports on our [GitHub issues page](http://github.com/PowerShell/vscode-powershell).

If you are experiencing any errors or crashes, please include the
following two log files:

- The language service log file: `$Home\.vscode\extensions\ms-vscode.PowerShell-<version>\bin\EditorServices.log`
- The debugging service log file: `$Home\.vscode\extensions\ms-vscode.PowerShell-<version>\bin\DebugService.log`
  - NOTE: This file may not exist if you haven't use the debugger yet.  Replace `<version>` in the paths above with the version number of the extension.
