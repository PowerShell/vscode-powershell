# Example Files README

*NOTE: For a more comfortable reading experience, use the key combination `Ctrl+Shift+V`*

This folder contains a few basic PowerShell script files that you can use
to experiment with the new PowerShell editing debugging capabilities as well
as an early preview of a workflow for publishing a module to the PowerShell
Gallery.

Here are some ideas for what you can try with these scripts:

## Language Features

- **Integrated syntax checks** from the PowerShell engine and **integrated
  rule-based analysis** using PowerShell Script Analyzer
  - Try opening `DebugTest.ps1` by double-clicking on its file name in the
    Explorer view. You will see a green squiggle on the function name `Do-Work`
    indicating that `Do` is not an approved verb.  These rule-based checks use
    PSScriptAnalyzer to analyze/lint your scripts.  You can introduce a syntax
    error somewhere to see a red squiggle for that as well.  To see a list of
    all errors and warnings, try pressing `Ctrl+Shift+M`.
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
   Click the plus sign `+` button and type `$str` then press enter.
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

At runtime these arguments will be concatenated together using a space
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

## Module Publishing Preview

### Requirements:
* [PSake](https://github.com/psake/psake) - install PSake with the command:

  PS C:\\> `Install-Module PSake -Scope CurrentUser`

The are two files (Build.ps1 and tasks.json) that facilitate building a directory from which
to publish a module from and then publishing from that directory.  The act of creating or
building this "Release" directory can be executed with the key combination `Ctrl+Shift+B`
which is the `Build` keyboard shortcut in Visual Studio Code.

When you execute the `Build` command, the build task from the `.vscode\tasks.json` file
is executed.  This task invokes PSake on the file `Build.ps1`.  This file
contains items you might want to customize such as `$PublishRepository` or the
`$ReleaseNotesPath`.  It also contains two PSake tasks which you might want to
customize: `PrePublish` and `PostPublish`.  If you sign your scripts, you can
use the `PrePublish` task and the script in it will get executed after the build
but before the `Publish` task is executed.

To execute the `Publish` task, press `Ctrl+P` then type `"task publish"` and press `Enter`.

NOTE: the `Publish` task does not actually publish to allow for experimentation.
If you wish to publish, remove the `-WhatIf` parameter on the `Publish-Module` command
in Build.ps1. But make sure you've modified the module manifest (psd1) file or supplied your own
in order to give your module a unique name and guid.

NOTE: the very first time you execute the publish task, you will be prompted for
a NuGet API Key.  This would normally be the NuGet API Key you are assigned when you
register for an account on the [PowerShell Gallery](https://www.powershellgallery.com/).
However since this is just an example of how this feature could work in the future,
you can supply any string you want.

For more details on how this works, inspect the `.vscode\tasks.json` file and the
`Build.ps1` file.

## Feedback

We would love to hear your feedback!  Please post feature requests or issue
reports on our [GitHub issues page](http://github.com/PowerShell/vscode-powershell).

If you are experiencing any errors or crashes, please include the
following two log files:

- The language service log file: `$Home\.vscode\extensions\ms-vscode.PowerShell-<version>\bin\EditorServices.log`
- The debugging service log file: `$Home\.vscode\extensions\ms-vscode.PowerShell-<version>\bin\DebugService.log`
  - NOTE: This file may not exist if you haven't use the debugger yet.  Replace `<version>` in the paths above with the version number of the extension.
