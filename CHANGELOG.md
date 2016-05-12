# vscode-powershell Release History

## 0.6.0
### Thursday, May 12, 2016

#### Added a new cross-editor extensibility model

- We've added a new extensibility model which allows you to write PowerShell
  code to add new functionality to Visual Studio Code and other editors with
  a single API.  If you've used `$psISE` in the PowerShell ISE, you'll feel
  right at home with `$psEditor`.  Check out the [documentation](https://powershell.github.io/PowerShellEditorServices/guide/extensions.html)
  for more details!

#### Support for user and system-wide profiles

- We've now introduced the `$profile` variable which contains the expected
  properties that you normally see in `powershell.exe` and `powershell_ise.exe`:
  - `AllUsersAllHosts`
  - `AllUsersCurrentHost`
  - `CurrentUserAllHosts`
  - `CurrentUserCurrentHost`
- In Visual Studio Code the profile name is `Microsoft.VSCode_profile.ps1`.
- `$host.Name` now returns "Visual Studio Code Host" and `$host.Version` returns
  the version of the PowerShell extension that is being used.

#### Other improvements

- IntelliSense for static methods and properties now works correctly.  If you
  type `::` after a type such as `[System.Guid]` you will now get the correct
  completion results.  This also works if you press `Ctrl+Space` after the `::`
  characters.
- `$env` variables now have IntelliSense complete correctly.
- Added support for new VSCode command `Debug: Start Without Debugging`.  Shortcut
  for this command is <kbd>Ctrl+F5</kbd>.
- Changed the keyboard shortcut for `PowerShell: Expand Alias` from <kbd>Ctrl+F5</kbd> to <kbd>Ctrl+Alt+e</kbd>.
- Added support for specifying a PSScriptAnalyzer settings file by
  providing a full path in your User Settings for the key `powershell.scriptAnalysis.settingsPath`.
  You can also configure the same setting in your project's `.vscode\settings.json`
  file to contain a workspace-relative path.  If present, this workspace-level setting
  overrides the one in your User Settings file. See the extension's `examples\.vscode\settings.json`
  file for an example.
- The debug adapter now does not crash when you attempt to add breakpoints
  for files that have been moved or don't exist.
- Fixed an issue preventing output from being written in the debugger if you
  don't set a breakpoint before running a script.

#### New configuration settings

- `powershell.scriptAnalysis.settingsPath`: Specifies the path to a PowerShell Script Analyzer settings file. Use either an absolute path (to override the default settings for all projects) or use a path relative to your workspace.

## 0.5.0
### Thursday, March 10, 2016

#### Support for PowerShell v3 and v4

- Support for PowerShell v3 and v4 is now complete!  Note that for this release,
  Script Analyzer support has been disabled for PS v3 and v4 until we implement
  a better strategy for integrating it as a module dependency

#### Debugging improvements

- Added support for command breakpoints.

  Hover over the Debug workspace's 'Breakpoints' list header and click the 'Add'
  button then type a command name (like `Write-Output`) in the new text box that
  appears in the list.

- Added support for conditional breakpoints.

  Right click in the breakpoint margin to the left of the code editor and click
  'Add conditional breakpoint' then enter a PowerShell expression in the text box
  that appears in the editor.

#### Other improvements

- Added a preview of a possible project template for PowerShell Gallery modules in
  the `examples` folder.  Includes a PSake build script with Pester test, clean,
  build, and publish tasks.  See the `examples\README.md` file for instructions.
  Check it out and give your feedback on GitHub!
- `using 'module'` now resolves relative paths correctly, removing a syntax error that
  previously appeared when relative paths were used
- Calling `Read-Host -AsSecureString` or `Get-Credential` from the console now shows an
  appropriate "not supported" error message instead of crashing the language service.
  Support for these commands will be added in a later release.

#### New configuration settings

- `powershell.useX86Host`: If true, causes the 32-bit language service to be used on 64-bit Windows.  On 32-bit Windows this setting has no effect.

## 0.4.1
### Wednesday, February 17, 2016

- Updated PSScriptAnalyzer 1.4.0 for improved rule marker extents
- Added example Pester task for running tests in the examples folder
- Fixed #94: Scripts fail to launch in the debugger if the working directory path contains spaces

## 0.4.0
### Tuesday, February 9, 2016

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
- Many improvements to the PowerShell snippets, more clearly separating functional and example snippets (all of the latter are prefixed with `ex-`)
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
