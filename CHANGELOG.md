# vscode-powershell Release History

## 0.8.0
### Friday, December 16, 2016

#### Improved PowerShell session management

It's now much easier to manage the active PowerShell session.  We've added a
new item to the status bar to indicate the state of the session and the version
of PowerShell you're using:

![Screenshot of status indicator](https://cloud.githubusercontent.com/assets/79405/21247551/fcf2777c-c2e4-11e6-9659-7349c35adbcd.png)

When this status item is clicked, a new menu appears to give you some session
management options:

![Screenshot of session menu](https://cloud.githubusercontent.com/assets/79405/21247555/009fa64c-c2e5-11e6-8171-76914d3366a0.png)

You can restart the active session, switch between 32-bit and 64-bit PowerShell on
Windows or switch to another PowerShell process (like a 6.0 alpha build) that
you've configured with the `powershell.developer.powerShellExePath`.

We've also improved the overall experience of loading and using the extension:

- It will prompt to restart the PowerShell session if it crashes for any reason
- It will also prompt to restart the session if you change any relevant PowerShell
  configuration setting like the aforementioned  `powershell.developer.powerShellExePath`.
- You can easily access the logs of the current session by running the command
  `Open PowerShell Extension Logs Folder`.

#### Create new modules with Plaster

In this release we've added integration with the [Plaster](https://github.com/PowerShell/Plaster)
module to provide a `Create New Project from Plaster Template` command.  This command will
walk you through the experience of selecting a template and filling in all of
the project details:

![Screenshot of Plaster template selection](https://cloud.githubusercontent.com/assets/79405/21247560/087b47a4-c2e5-11e6-86e7-ba3727b5e36d.png)

![Screenshot of Plaster input](https://cloud.githubusercontent.com/assets/79405/21247562/0a79b130-c2e5-11e6-97e9-cfd672803f75.png)

We include one basic project template by default and will add more in the very
near future.  However, you won't need to update the PowerShell extension to get these
new templates, they will appear when you install an update to the Plaster module from
the [PowerShell Gallery](https://www.powershellgallery.com/).

Check out [Plaster's documentation](https://github.com/PowerShell/Plaster/tree/master/docs/en-US)
for more details on how it can be used and how you can create your own templates.

#### New "quick fix" actions for PSScriptAnalyzer rules

The PowerShell extension now uses any "suggested corrections" which are returned with
a rule violation in your script file to provide a "quick fix" option for the affected
section of code.  For example, when the `PSAvoidUsingCmdletAliases` rule finds the use
of a non-whitelisted alias, you will see a light bulb icon that gives the option to
change to the full name (right click or <kbd>Ctrl+.</kbd> on the marker):

![Screenshot of PSScriptAnalyzer quick fix](https://cloud.githubusercontent.com/assets/79405/21247558/05887e86-c2e5-11e6-9c67-e4558a7e2dba.png)

If you'd like to see more quick fixes for PowerShell code, head over to the
[PSScriptAnalyzer](https://github.com/PowerShell/PSScriptAnalyzer) GitHub page and
get involved!

#### Easily enable and disable PSScriptAnalyzer rules

Another improvement related to PSScriptAnalyzer is the ability to change the active
PSScriptAnalyzer rules in the current editing session using a helpful selection menu:

![Screenshot of PSScriptAnalyzer rule selection](https://cloud.githubusercontent.com/assets/79405/21247557/037888b6-c2e5-11e6-816f-6732e13cddb7.png)

You can enable and disable active rules by running the `Select PSScriptAnalyzer Rules`
command.  For now this only changes the active session but in a future release we will
modify your PSScriptAnalyzer settings file so that the changes are persisted to future
editing sessions.

#### New "hit count" breakpoints in the debugger

When debugging PowerShell scripts you can now set "hit count" breakpoints which
cause the debugger to stop only after the breakpoint has been encountered a specified
number of times.

![Screenshot of a hit count breakpoint](https://cloud.githubusercontent.com/assets/79405/21247563/0c159202-c2e5-11e6-8c91-36791c4fa804.png)

#### Other fixes and improvements

- We now provide snippets for the `launch.json` configuration file which make it easier
  to add new PowerShell debugging configurations for your project.
- In PowerShell `launch.json` configurations, the `program` parameter has now been
  renamed to `script`.  Configurations still using `program` will continue to work.
- Fixed #353: Cannot start PowerShell debugger on Windows when offline
- Fixed #217: PowerShell output window should be shown when F8 is pressed
- Fixed #292: Check for Homebrew's OpenSSL libraries correctly on macOS
- Fixed #384: PowerShell snippets broken in VS Code 1.8.0

## 0.7.2
### Friday, September 2, 2016

- Fixed #243: Debug adapter process has terminated unexpectedly
- Fixed #264: Add check for OpenSSL on OS X before starting the language service
- Fixed #271: PSScriptAnalyzer settings path isn't being passed along
- Fixed #273: Debugger crashes after multiple runs
- Fixed #274: Extension crashes on Ctrl+Hover

## 0.7.1
### Tuesday, August 23, 2016

- "Auto" variable scope in debugger UI now expands by default
- Fixed #244: Extension fails to load if username contains spaces
- Fixed #246: Restore default PSScriptAnalyzer ruleset
- Fixed #248: Extension fails to load on Windows 7 with PowerShell v3

## 0.7.0
### Thursday, August 18, 2016

#### Introducing support for Linux and macOS!

This release marks the beginning of our support for Linux and macOS via
the new [cross-platform release of PowerShell](https://github.com/PowerShell/PowerShell).
You can find installation and usage instructions at the [PowerShell GitHub repository](https://github.com/PowerShell/PowerShell).

## 0.6.2
### Friday, August 12, 2016

- Fixed #231: In VS Code 1.4.0, IntelliSense has stopped working
- Fixed #193: Typing "n" breaks intellisense
- Fixed #187: Language server sometimes crashes then $ErrorActionPreference = "Stop"

## 0.6.1
### Monday, May 16, 2016

- Fixed #180: Profile loading should be enabled by default
- Fixed #183: Language server sometimes fails to initialize preventing IntelliSense, etc from working
- Fixed #182: Using 'Run Selection' on a line without a selection only runs to the cursor position
- Fixed #184: When running a script in the debugger, $host.Version reports wrong extension version

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
