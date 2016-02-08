# vscode-powershell Release History

## 0.4.0
### Monday, February 8, 2016

#### Debugging improvements

[@rkeithhill](https://github.com/rkeithhill) spent a lot of time polishing the script debugging experience for this release:

- You can now pass arguments to scripts in the debugger with the `args` parameter in launch.json
- You can also run your script with the 32-bit debugger by changing the `type` parameter in launch.json to "PowerShell x86" (also thanks to [@adamdriscoll](https://github.com/adamdriscoll)!)
- The new default PowerShell debugger configuration now launches the active file in the editor
- You can also set the working directory where the script is run by setting the `cwd` parameter in launch.json to an absolute path.  If you need a workspace relative path, use ${workspaceRoot} to create an absolute path e.g. `"${workspaceRoot}/modules/foo.psm1"`.

We recommend deleting any existing `launch.json` file you're using so that a new one will
be generated with the new defaults.

#### Console improvements

- Improved PowerShell console output formatting and performance
  - The console prompt is now displayed after a command is executed
  - Command execution errors are now displayed correctly in more cases
  - Console output now wraps at 120 characters instead of 80 characters

- Added choice and input prompt support
  - When executing code using the 'Run Selection' command, choice and input prompts appear as VS Code UI popups
  - When executing code in the debugger, choice and input prompts appear in the Debug Console

#### New commands

- "Find/Install PowerShell modules from the gallery" (`Ctrl+K Ctrl+F`): Enables you to find and install modules from the PowerShell Gallery (thanks [@dfinke](https://github.com/dfinke)!)
- "Open current file in PowerShell ISE" (`Ctrl+Shift+i`): Opens the current file in the PowerShell ISE (thanks [@janegilring](https://github.com/janegilring)!)

#### Editor improvements

- Path auto-completion lists show just the current directory's contents instead of the full path (which had resulted in clipped text)
- Parameter auto-completion lists are now sorted in the same order as they are in PowerShell ISE where command-specific parameters preceed the common parameters
- Parameter auto-completion lists show the parameter type
- Command auto-completion lists show the resolved command for aliases and the path for executables
- Many improvements to the PowerShell snippets, more clearly separating functional and example snippets
- Added some additional example script files in the `examples` folder

#### New configuration settings

- `powershell.developer.editorServicesLogLevel`: configures the logging verbosity for PowerShell Editor Services.  The default log level will now write less logs, improving overall performance

## 0.3.1
### Thursday, December 17, 2015

- Fix issue #49, Debug Console does not receive script output

## 0.3.0
### Tuesday, December 15, 2015

- Major improvements in variables retrieved from the debugging service:
  - Global and script scope variables are now accessible
  - New "Auto" scope which shows only the variables defined within the current scope
  - Greatly improved representation of variable values, especially for dictionaries and
    objects that implement the ToString() method
- Added new "Expand Alias" command which resolves command aliases used in a file or
  selection and updates the source text with the resolved command names
- Reduced default Script Analyzer rules to a minimal list
- Fixed a wide array of completion text replacement bugs
- Improved extension upgrade experience

## 0.2.0
### Monday, November 23, 2015

- (Experimental) Added a new "Run selection" (F8) command which executes the current code selection and displays the output
- Added a new online help command!  Press Ctrl+F1 to get help for the symbol under the cursor.
- Enabled PowerShell language features for untitled and in-memory (e.g. in Git diff viewer) PowerShell files
- Added `powershell.scriptAnalysis.enable` configuration variable to allow disabling script analysis for performance (issue #11)
- Fixed issue where user's custom PowerShell snippets did not show up
- Fixed high CPU usage when completing or hovering over an application path

## 0.1.0
### Wednesday, November 18, 2015

Initial release with the following features:

- Syntax highlighting
- Code snippets
- IntelliSense for cmdlets and more
- Rule-based analysis provided by PowerShell Script Analyzer
- Go to Definition of cmdlets and variables
- Find References of cmdlets and variables
- Document and workspace symbol discovery
- Local script debugging and basic interactive console support
