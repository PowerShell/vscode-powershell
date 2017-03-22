# vscode-powershell Release History

## 0.11.0
### Wednesday, March 22, 2017

#### Remotely edited files can now be saved

- Added [#583](https://github.com/PowerShell/vscode-powershell/issues/583) -
  When you open files in a remote PowerShell session with the `psedit` command,
  their updated contents are now saved back to the remote machine when you save
  them in the editor.

#### Integrated console improvements

- Fixed [#533](https://github.com/PowerShell/vscode-powershell/issues/533) -
  The backspace key now works in the integrated console on Linux and macOS.  This
  fix also resolves a few usability problems with the integrated console on all
  supported OSes.

- Fixed [542](https://github.com/PowerShell/vscode-powershell/issues/542) -
  Get-Credential now hides keystrokes correctly on Linux and macOS.

We also added some new settings ([#580](https://github.com/PowerShell/vscode-powershell/issues/580),
[#588](https://github.com/PowerShell/vscode-powershell/issues/588)) to allow fine-tuning
of the integrated console experience:

- `powershell.startAutomatically` (default: `true`) - If true, causes PowerShell extension
  features to start automatically when a PowerShell file is opened.  If false, the user must
  initiate startup using the 'PowerShell: Restart Current Session' command.  IntelliSense,
  code navigation, integrated console, code formatting, and other features will not be
  enabled until the extension has been started.  Most users will want to leave this
  setting to `true`, though it was added to save CPU cycles if you often use new VS Code
  instances to quickly view PowerShell files.

- `powershell.integratedConsole.showOnStartup` (default: `true`) - If true, causes the
  integrated console to be shown automatically when the PowerShell extension is initialized.

- `powershell.integratedConsole.focusConsoleOnExecute` (default: `true`) - If `true`,
  causes the integrated console to be focused when a script selection is run or a
  script file is debugged.

#### Interactive debugging improvements

- Added [#540](https://github.com/PowerShell/vscode-powershell/issues/540) -
  The scripts that you debug are now dot-sourced into the integrated console's
  session, allowing you to experiment with the results of your last execution.

- Added [#600](https://github.com/PowerShell/vscode-powershell/issues/600) -
  Debugger commands like `stepInto`, `continue`, and `quit` are now available
  in the integrated console while debugging a script.

- Fixed [#596](https://github.com/PowerShell/vscode-powershell/issues/596) -
  VS Code's Debug Console now warns the user when it is used while debugging
  a script.  All command evaluation now happens through the integrated console
  so this message should help alleviate confusion.

#### Other fixes and improvements

- Fixed [#579](https://github.com/PowerShell/vscode-powershell/issues/579) -
  Sorting of IntelliSense results is now consistent with the PowerShell ISE
- Fixed [#591](https://github.com/PowerShell/vscode-powershell/issues/591) -
  "Editor commands" registered with the `Register-EditorCommand` function are
  now sorted alphabetically by their `Name` field, causing commands to be grouped
  based on their source module.
- Fixed [#575](https://github.com/PowerShell/vscode-powershell/issues/575) -
  The interactive console no longer starts up with errors in the `$Error` variable.
- Fixed [#599](https://github.com/PowerShell/vscode-powershell/issues/599) -
  The [SSASCMDLETS module](https://msdn.microsoft.com/en-us/library/hh213141.aspx?f=255&MSPPError=-2147217396)
  from SQL Server Analytics Service should now load correctly in the integrated
  console.

## 0.10.1
### Thursday, March 16, 2017

#### Fixes and improvements

- Fixed [#566](https://github.com/PowerShell/vscode-powershell/issues/566) -
  Enable editor IntelliSense while stopped at a breakpoint
- Fixed [#556](https://github.com/PowerShell/vscode-powershell/issues/556) -
  Running and debugging scripts in the integrated console should not steal focus from the editor
- Fixed [#543](https://github.com/PowerShell/vscode-powershell/issues/543) -
  Keyboard input using <kbd>AltGr</kbd> <kbd>Ctrl+Alt</kbd> modifiers does not work
- Fixed [#421](https://github.com/PowerShell/vscode-powershell/issues/421) -
  Session startup should give a helpful error message if ConstrainedLanguage mode is turned on
- Fixed [#401](https://github.com/PowerShell/vscode-powershell/issues/401) -
  Session startup should indicate if current PowerShell version is unsupported (PSv1 and v2)
- Fixed [#454](https://github.com/PowerShell/vscode-powershell/issues/454) -
  ExecutionPolicy set via group policy or registry key should not cause language server to crash
- Fixed [#532](https://github.com/PowerShell/vscode-powershell/issues/532) -
  DEVPATH environment variable not being set for interactive console session
- Fixed [PowerShellEditorServices #387](https://github.com/PowerShell/PowerShellEditorServices/issues/387) -
  Write-(Warning, Verbose, Debug) are missing message prefixes and foreground colors
- Fixed [PowerShellEditorServices #382](https://github.com/PowerShell/PowerShellEditorServices/issues/382) -
  PSHostUserInterface implementation should set SupportsVirtualTerminal to true

## 0.10.0
### Tuesday, March 14, 2017

#### New interactive console experience

We are excited to provide you with the first release of our new interactive
console experience!  When you open up a PowerShell script file, you will
be greeted with a new VS Code integrated terminal window called
"PowerShell Integrated Console"

![integrated console screenshot](https://cloud.githubusercontent.com/assets/79405/23910661/b599f2ee-0897-11e7-9426-00af794c10b5.png)

In this console you will have an experience that falls somewhere between
the PowerShell ISE and the PowerShell console host:

- Tab completion of commands and their parameters
- Basic command history, accessed using the up/down arrow keys
- The `psedit` command opens existing files in an editor pane
- Pressing <kbd>F8</kbd> in an editor pane runs the current line or selection in the console
- Native applications like `git` are fully supported
- Script debugging shares the same console session with the editor for
  a true ISE-like debugging experience

It even works with your fancy prompt function if configured in your
VS Code profile (`$HOME\Documents\WindowsPowerShell\Microsoft.VSCode_profile.ps1`):

![custom prompt screenshot](https://cloud.githubusercontent.com/assets/79405/23910654/b1bca66c-0897-11e7-81b1-70eff5b97c21.png)

The integrated console is supported on PowerShell v3 through v6 and works
on Linux and macOS with PowerShell Core.  By default you don't have to
configure which PowerShell to run, we will pick an appropriate default
based on your platform.  If you'd like to choose a different install
of PowerShell you can always change the `powershell.developer.powerShellExePath`
setting.

Keep in mind that this is the first release for this feature and there are
bound to be issues and missing functionality.  Please feel free to file
GitHub issues for any bugs or feature requests!

##### Known Issues and Limitations

- [#535](https://github.com/PowerShell/vscode-powershell/issues/535) PSReadline
  is currently **not** supported in the integrated console.  We will enable this
  in a future release.
- [#534](https://github.com/PowerShell/vscode-powershell/issues/534) Integrated console
  prompt is not restarted when you stop the debugging of a local runspace in another
  process.  This will be addressed soon in a patch update.
- [#533](https://github.com/PowerShell/vscode-powershell/issues/533) Backspace key
  does not work in the integrated console on Linux and macOS.  The workaround for now
  is to use <kbd>Ctrl+H</kbd> instead of the Backspace key.  This will be addressed
  soon in a patch update.
- [#536](https://github.com/PowerShell/vscode-powershell/issues/536) Integrated console
  sometimes does not have a scrollbar at startup.  The workaround is to resize the width
  of the VS Code window slightly and the scrollbar will appear.  This will be addressed
  soon in a patch update.

#### Get-Credential and PSCredential support

Now that we have the integrated console, we have added support for the `Get-Credential`
cmdlet, `Read-Host -AsSecureString`, and any input prompt of type `SecureString` or `PSCredential`.
When you run any of these cmdlets you will be prompted inside the integrated console:

![credential screenshot](https://cloud.githubusercontent.com/assets/79405/23910668/bac9019c-0897-11e7-80e2-eaf1b9e507f8.png)

#### Code formatting improvements

We now support VS Code's `editor.formatOnType` setting so that your code gets formatted
as you type!  Formatting will be triggered when you press Enter or the closing curly
brace character `}`.

Based on your feedback, we've also added new code formatting options, all of which
are turned on by default:

- `powershell.codeFormatting.newLineAfterCloseBrace` - Causes a newline to be inserted
  after a closing brace in multi-line expressions like if/else
- `powershell.codeFormatting.whitespaceBeforeOpenBrace` - Causes whitespace to be
  inserted before an open brace like `Foreach-Object {`
- `powershell.codeFormatting.whitespaceBeforeOpenParen` - Causes whitespace to be
  inserted before an open parentheses like `if (`
- `powershell.codeFormatting.whitespaceAroundOperator` - Causes whitespace to be
  inserted around operators like `=` or `+`
- `powershell.codeFormatting.whitespaceAfterSeparator` - Causes whitespace to be
  inserted around separator characters like `;` and `,`
- `powershell.codeFormatting.ignoreOneLineBlock` - Single-line expressions, like
  small if/else statements, will not be expanded to multiple lines.

We've also made many improvements to the performance and stability of the formatter.

#### Debugging improvements

We've added a new configuration for debugging your Pester tests.  By default it
merely runs `Invoke-Pester` at the workspace path, but you can also edit the
configuation to add additional arguments to be passed through.

We've also added support for column breakpoints.  Now you can set a breakpoint
directly within a pipeline by placing your cursor at any column on a line and
running the `Debug: Column Breakpoint` command:

![column breakpoint screenshot](https://cloud.githubusercontent.com/assets/79405/23910649/aaef70e4-0897-11e7-93b7-0d729969a1e2.png)

For the latest PowerShell Core release ([6.0.0-alpha.17](https://github.com/PowerShell/PowerShell/releases/tag/v6.0.0-alpha.17)),
we have also added the ability to step into ScriptBlocks that are executed on another
machine using `Invoke-Command -Computer`.

Set a breakpoint on an `Invoke-Command` line and then once it's hit:

![Invoke-Command screenshot](https://cloud.githubusercontent.com/assets/79405/23911032/c01b8ff6-0898-11e7-89e3-02a31d419fc5.png)

Press `F11` and you will step into the ScriptBlock.  You can now continue to use
"step in" and trace the ScriptBlock's execution on the remote machine:

![remote script listing screenshot](https://cloud.githubusercontent.com/assets/79405/23918844/ca86cf28-08b1-11e7-8014-c689cdcccf87.png)

Note that you cannot currently set breakpoints in the script listing file as
this code is being executed without an actual script file on the remote machine.

#### Other fixes and improvements

- Fixed [#427](https://github.com/PowerShell/vscode-powershell/issues/427) -
  The keybinding for "Expand Alias" command has been changed to <kbd>Shift+Alt+E</kbd>
- Fixed [#519](https://github.com/PowerShell/vscode-powershell/issues/519) -
  Debugger hangs after continuing when watch expressions are set
- Fixed [#448](https://github.com/PowerShell/vscode-powershell/issues/448) -
  Code formatter should keep indentation for multi-line pipelines
- Fixed [#518](https://github.com/PowerShell/vscode-powershell/issues/518) -
  Code formatter fails when dollar-paren `$()` expressions are used
- Fixed [#447](https://github.com/PowerShell/vscode-powershell/issues/447) -
  Code formatter crashes when run on untitled documents

## 0.9.0
### Thursday, January 19, 2017

#### New PowerShell code formatter

We've added a formatter for PowerShell code which allows you to format an
entire file or a selection within a file.  You can access this formatter by
running VS Code's `Format Document` and `Format Selection` commands inside
of a PowerShell file.

You can configure code formatting with the following settings:

- `powershell.codeFormatting.openBraceOnSameLine` - Places open brace on the
  same line as its associated statement.  Default is `true`.
- `powershell.codeFormatting.newLineAfterOpenBrace` - Ensures that a new line
  occurs after an open brace (unless in a pipeline statement on the same line).
  Default is `true`
- `editor.tabSize` - Specifies the indentation width for code blocks.  This
  is a VS Code setting but it is respected by the code formatter.
- `editor.formatOnSave` - If true, automatically formats when they are saved.
  This is a VS Code setting and may also affect non-PowerShell files.

Please note that this is only a first pass at PowerShell code formatting, it
may not format your code perfectly in all cases.  If you run into any issues,
please [file an issue](https://github.com/PowerShell/vscode-powershell/issues/new)
and give us your feedback!

#### Streamlined debugging experience - launch.json is now optional!

**NOTE: This improvement depends on VS Code 1.9.0 which is due for release
early February!** However, you can try it out right now with the [VS Code Insiders](https://code.visualstudio.com/insiders)
release.

Thanks to a new improvement in VS Code's debugging APIs, we are now able to
launch the PowerShell debugger on a script file without the need for a `launch.json`
file.  You can even debug individual PowerShell scripts without opening a
workspace folder!  Don't worry, you can still use a `launch.json` file to configure
specific debugging scenarios.

We've also made debugger startup much more reliable.  You will no longer see the
dreaded "Debug adapter terminated unexpectedly" message when you try to launch
the debugger while the language server is still starting up.

#### Support for debugging remote and attached runspaces

We now support remote PowerShell sessions via the [`Enter-PSSession`](https://msdn.microsoft.com/en-us/powershell/reference/5.0/microsoft.powershell.core/enter-pssession)
cmdlet.  This cmdlet allows you to create a PowerShell session on another machine
so that you can run commands or debug scripts there.  The full debugging
experience works with these remote sessions on PowerShell 4 and above, allowing
you to set breakpoints and see remote files be opened locally when those breakpoints
are hit.

For PowerShell 5 and above, we also support attaching to local and remote PowerShell
host processes using the [`Enter-PSHostProcess`](https://msdn.microsoft.com/en-us/powershell/reference/5.0/microsoft.powershell.core/enter-pshostprocess)
and [`Debug-Runspace`](https://msdn.microsoft.com/en-us/powershell/reference/5.0/microsoft.powershell.utility/debug-runspace)
cmdlets.  This allows you to jump into another process and then debug a script that
is already running in one of the runspaces in that process.  The debugger will break
execution of the running script and then the associated script file will be opened
in the editor so that you can set breakpoints and step through its execution.

We've also added a new `launch.json` configuration for debugging PowerShell host processes:

![Process launch configuration screenshot](https://cloud.githubusercontent.com/assets/79405/22089468/391e8120-dda0-11e6-950c-64f81b364c35.png)

When launched, the default "attach" configuration will prompt you with a list of
PowerShell host processes on the local machine so that you can easily select one
to be debugged:

![Process selection UI screenshot](https://cloud.githubusercontent.com/assets/79405/22081037/c205e516-dd76-11e6-834a-66f4c38e181d.png)

You can also edit the launch configuration to hardcode the launch parameters, even
setting a remote machine to connect to before attaching to the remote process:

```json
        {
            "type": "PowerShell",
            "request": "attach",
            "name": "PowerShell Attach to Host Process",
            "computerName": "my-remote-machine",
            "processId": "12345",
            "runspaceId": 1
        }
```

Please note that we currently do not yet support initiating remote sessions from Linux
or macOS.  This will be supported in an upcoming release.

#### Initial support for remote file opening using `psedit`

Another nice improvement is that we now support the `psedit` command in remote and
attached sessions.  This command allows you to open a file in a local or remote session
so that you can set breakpoints in it using the UI before launching it.  For now these
remotely-opened files will not be saved back to the remote session when you edit and
save them.  We plan to add this capability in the next feature update.

#### New "interactive session" debugging mode

You can now create a new launch configuration which drops you directly into the
debug console so that you can debug your scripts and modules however you wish.
You can call Set-PSBreakpoint to set any type of breakpoint and then invoke your
code through the console to see those breakpoints get hit.  This mode can also be
useful for debugging remote sessions.

![Interactive session config screenshot](https://cloud.githubusercontent.com/assets/79405/22089502/5e56b4c6-dda0-11e6-8a51-f24e29ce7988.png)

Please note that this is NOT a replacement for a true interactive console experience.
We've added this debugging configuration to enable a few other debugging scenarios, like
debugging PowerShell modules, while we work on a true interactive console experience using
VS Code's Terminal interface.

#### New document symbol support for PSD1 files

We've extended our document symbol support to `.psd1` files to make it really easy to
navigate through them.  When you have a `.psd1` file open, run the `Go to Symbol in File...`
command (<kbd>Ctrl + Shift + O</kbd>) and you'll see this popup:

![psd1 symbol screenshot](https://cloud.githubusercontent.com/assets/79405/22094872/85c7d9a2-ddc5-11e6-9bee-5fc8c3dae097.png)

You can type a symbol name or navigate using your arrow keys.  Once you select one of the
symbol names, the editor pane will jump directly to that line.

#### Other fixes and improvements

- Added a new `Open Examples Folder` command to easily open the extension's
  example script folder.
- Added a new setting `powershell.developer.powerShellExeIsWindowsDevBuild`
  which, when true, indicates that the `powerShellExePath` points to a Windows
  PowerShell development build.
- Fixed [#395](https://github.com/PowerShell/vscode-powershell/issues/395):
  Quick Fix for PSAvoidUsingAliases rule replaces the entire command
- Fixed [#396](https://github.com/PowerShell/vscode-powershell/issues/396):
  Extension commands loaded in PowerShell profile are not being registered
- Fixed [#391](https://github.com/PowerShell/vscode-powershell/issues/391):
  DSC IntelliSense can cause the language server to crash
- Fixed [#400](https://github.com/PowerShell/vscode-powershell/issues/400):
  Language server can crash when selecting PSScriptAnalyzer rules
- Fixed [#408](https://github.com/PowerShell/vscode-powershell/issues/408):
  Quick fix requests meant for other extensions crash the language server
- Fixed [#401](https://github.com/PowerShell/vscode-powershell/issues/401):
  Extension startup should indicate if the current PowerShell version is unsupported
- Fixed [#314](https://github.com/PowerShell/vscode-powershell/issues/314):
  Errors/Warnings still show up in Problems window when file is closed
- Fixed [#388](https://github.com/PowerShell/vscode-powershell/issues/388):
  Syntax errors are not reported when powershell.scriptAnalysis.enable is set to false

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
