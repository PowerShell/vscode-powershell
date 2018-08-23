# vscode-powershell Release History

## v1.8.3
### Wednesday, August 15, 2018

#### [vscode-powershell](https://github.com/powershell/vscode-powershell)

-  [PowerShell/vscode-powershell #1480](https://github.com/PowerShell/vscode-powershell/pull/1480) -
   Use PowerShell signing script in VSTS builds
-  [PowerShell/vscode-powershell #1460](https://github.com/PowerShell/vscode-powershell/pull/1460) -
   Use newer version for preleases
-  [PowerShell/vscode-powershell #1475](https://github.com/PowerShell/vscode-powershell/pull/1475) -
   Change resourceLangId to editorLangId so right-click works properly with unsaved files (Thanks @corbob!)
-  [PowerShell/vscode-powershell #1467](https://github.com/PowerShell/vscode-powershell/pull/1467) -
   Remove region folding from non-region areas (Thanks @glennsarti!)
   
 #### [PowerShellEditorServices](https://github.com/powershell/PowerShellEditorServices)

- [PowerShell/PowerShellEditorServices #722](https://github.com/PowerShell/PowerShellEditorServices/pull/722) -
  Add VSTS signing step
- [PowerShell/PowerShellEditorServices #717](https://github.com/PowerShell/PowerShellEditorServices/pull/717) -
  Increment version for prerelease
- [PowerShell/PowerShellEditorServices #715](https://github.com/PowerShell/PowerShellEditorServices/pull/715) -
  Reduce allocations when parsing files (Thanks @mattpwhite!)

## v1.8.2
### Thursday, July 26, 2018

#### [vscode-powershell](https://github.com/powershell/vscode-powershell)

- [PowerShell/vscode-powershell #1438](https://github.com/PowerShell/vscode-powershell/pull/1438) -
  Fix detecting contiguous comment blocks and regions (Thanks @glennsarti!)
- [PowerShell/vscode-powershell #1436](https://github.com/PowerShell/vscode-powershell/pull/1436) -
  First approach to fix issue with dbg/run start before PSES running (Thanks @rkeithhill!)

#### [PowerShellEditorServices](https://github.com/powershell/PowerShellEditorServices)

- [PowerShell/PowerShellEditorServices #712](https://github.com/PowerShell/PowerShellEditorServices/pull/712) -
  workaround to support inmemory://
- [PowerShell/PowerShellEditorServices #706](https://github.com/PowerShell/PowerShellEditorServices/pull/706) -
  Go To Definition works with different Ast types
- [PowerShell/PowerShellEditorServices #707](https://github.com/PowerShell/PowerShellEditorServices/pull/707) -
  fix stdio passing
- [PowerShell/PowerShellEditorServices #709](https://github.com/PowerShell/PowerShellEditorServices/pull/709) -
  Stop Diagnostic logging from logging to stdio when the communication protocol is set to stdio
- [PowerShell/PowerShellEditorServices #710](https://github.com/PowerShell/PowerShellEditorServices/pull/710) -
  stdio should only launch language service not debug
- [PowerShell/PowerShellEditorServices #705](https://github.com/PowerShell/PowerShellEditorServices/pull/705) -
  Fix load order of PSSA modules
- [PowerShell/PowerShellEditorServices #704](https://github.com/PowerShell/PowerShellEditorServices/pull/704) -
  Do not enable PSAvoidTrailingWhitespace rule by default as it currenly flags whitespace-only lines as well (Thanks @bergmeister!)

## v1.8.1
### Wednesday, July 11, 2018

- [PowerShell/vscode-powershell #1418](https://github.com/PowerShell/vscode-powershell/pull/1418) -
  Fix code folding in documents using CRLF newlines. (Thanks @glennsarti!)

## v1.8.0
### Tuesday, July 10, 2018

- [PowerShell/vscode-powershell #1238](https://github.com/PowerShell/vscode-powershell/pull/1238) -
  Added functionality to install the VSCode context menus. (Thanks @detlefs!)
- [PowerShell/vscode-powershell #1354](https://github.com/PowerShell/vscode-powershell/pull/1354) -
  Edit snippet to fix issue #1353 (Thanks @kilasuit!)
- [PowerShell/vscode-powershell #1362](https://github.com/PowerShell/vscode-powershell/pull/1362) -
  Updated Pester Problem Matcher (Thanks @awickham10!)
- [PowerShell/vscode-powershell #1359](https://github.com/PowerShell/vscode-powershell/pull/1359) -
  (maint) Add visual ruler for line length (Thanks @glennsarti!)
- [PowerShell/vscode-powershell #1344](https://github.com/PowerShell/vscode-powershell/pull/1344) -
  Update to TypeScript 2.9.x (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1323](https://github.com/PowerShell/vscode-powershell/pull/1323) -
  SpecProcId - interactive var replacement supports only string type (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1327](https://github.com/PowerShell/vscode-powershell/pull/1327) -
  Switch to named pipes
- [PowerShell/vscode-powershell #1321](https://github.com/PowerShell/vscode-powershell/pull/1321) -
  GitHub issue template tweaks and add PSSA template (Thanks @bergmeister!)
- [PowerShell/vscode-powershell #1320](https://github.com/PowerShell/vscode-powershell/pull/1320) -
  Take advantage of multiple issue templates (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1317](https://github.com/PowerShell/vscode-powershell/pull/1317) -
  Change SpecifyScriptArgs command to only return string - not string[] (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1318](https://github.com/PowerShell/vscode-powershell/pull/1318) -
  Update package veresion in lock file, format package.json file. (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1312](https://github.com/PowerShell/vscode-powershell/pull/1312) -
  Updates to Examples PSSA settings file to include more rule config (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1305](https://github.com/PowerShell/vscode-powershell/pull/1305) -
  Make SaveAs work for untitled files
- [PowerShell/vscode-powershell #1307](https://github.com/PowerShell/vscode-powershell/pull/1307) -
  Added Columns, Improved readability for ToC. (Thanks @st0le!)
- [PowerShell/vscode-powershell #1368](https://github.com/PowerShell/vscode-powershell/pull/1368) -
  Add new snippet for #region (#1368) (Thanks @lipkau!)
- [PowerShell/vscode-powershell #1416](https://github.com/PowerShell/vscode-powershell/pull/1416) -
  (GH-1413) Resolve promise correctly in Folding feature (Thanks @glennsarti!)
- [PowerShell/vscode-powershell #1412](https://github.com/PowerShell/vscode-powershell/pull/1412) -
  Set the extension's log level based on settings value (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1411](https://github.com/PowerShell/vscode-powershell/pull/1411) -
  Escape paths w/single quotes before passing to powershell in single-quoted strings (#1411) (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1409](https://github.com/PowerShell/vscode-powershell/pull/1409) -
  Rename file to match type name (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1408](https://github.com/PowerShell/vscode-powershell/pull/1408) -
  Restore ability to start debug session when script run in PSIC hits breakpoint (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1407](https://github.com/PowerShell/vscode-powershell/pull/1407) -
  Scroll the terminal to bottom for F8 executionPartial fix #1257 (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1414](https://github.com/PowerShell/vscode-powershell/pull/1414) -
  Update grammar parsing for vscode-textmate v4 module (Thanks @glennsarti!)
- [PowerShell/vscode-powershell #1397](https://github.com/PowerShell/vscode-powershell/pull/1397) -
  Allow debugging in interactive session with no dir change (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1402](https://github.com/PowerShell/vscode-powershell/pull/1402) -
  Move lint directive after the file-header to fix lint error (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1366](https://github.com/PowerShell/vscode-powershell/pull/1366) -
  Add support for side-by-side PS Core preview on Linux/macOS (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1391](https://github.com/PowerShell/vscode-powershell/pull/1391) -
  Add PowerShell Online Help lookup to context menu (Thanks @corbob!)
- [PowerShell/vscode-powershell #1396](https://github.com/PowerShell/vscode-powershell/pull/1396) -
  Add tslint rule file-header to enforce copyright in TS files (Thanks @rkeithhill!)
- [PowerShell/vscode-powershell #1355](https://github.com/PowerShell/vscode-powershell/pull/1355) -
  Add syntax aware folding provider (Thanks @glennsarti!)
- [PowerShell/vscode-powershell #1395](https://github.com/PowerShell/vscode-powershell/pull/1395) -
  Update community_snippets.md (Thanks @fullenw1!)
- [PowerShell/vscode-powershell #1382](https://github.com/PowerShell/vscode-powershell/pull/1382) -
  Fix markdown syntax (Thanks @lipkau!)
- [PowerShell/vscode-powershell #1369](https://github.com/PowerShell/vscode-powershell/pull/1369) -
  Update README.md with kbds and what to do if you find a vulnerability
- [PowerShell/vscode-powershell #1297](https://github.com/PowerShell/vscode-powershell/pull/1297) -
  Added some snippets (#1297) (Thanks @SQLDBAWithABeard!)

## 1.7.0
### Wednesday, April 25, 2018

- [PowerShell/vscode-powershell #1285](https://github.com/PowerShell/vscode-powershell/pull/1285) -
  Add a community snippet for date-annotated `Write-Verbose` messages.

- [PowerShell/vscode-powershell #1228](https://github.com/PowerShell/vscode-powershell/issues/1228) -
  Make comment-based help trigger always be `##` with a new setting `powershell.helpCompletion` to
  allow you to select between help comment styles: `BlockComment` (default) or `LineComment`.
  You can also specify Disabled to disable this functionality.

- [PowerShell/vscode-powershell #603](https://github.com/PowerShell/vscode-powershell/issues/603) -
  Fix PowerShell crashing on machines with IPv6 disabled.

- [PowerShell/vscode-powershell #1243](https://github.com/PowerShell/vscode-powershell/issues/1243) -
  Support custom PowerShell executable paths in user configuration which can be selected (via name)
  in either user or workspace configuration.

- [PowerShell/vscode-powershell #1264](https://github.com/PowerShell/vscode-powershell/pull/1264) -
  Add support for [Visual Studio Live Share](https://code.visualstudio.com/visual-studio-live-share).

- [PowerShell/vscode-powershell #1261](https://github.com/PowerShell/vscode-powershell/pull/1261) -
  Add support for `$psEditor.GetEditorContext.CurrentFile.SaveAs("NewFileName.ps1")`.

- [PowerShell/vscode-powershell #1252](https://github.com/PowerShell/vscode-powershell/pull/1252) -
  Change the way the extension builds and runs, so that PowerShellEditorServices is self-contained.

- [PowerShell/vscode-powershell #1248](https://github.com/PowerShell/vscode-powershell/pull/1248) -
  Replace `$global:IsOSX` with `$global:IsMacOS`.

- [PowerShell/vscode-powershell #1246](https://github.com/PowerShell/vscode-powershell/pull/1246) -
  Create [community_snippets.md](./docs/community_snippets.md) for user created snippets.

- [PowerShell/vscode-powershell #1155](https://github.com/PowerShell/vscode-powershell/issues/1155) -
  Fix PSES crashes caused by running "Set PSScriptAnalyzer Rules" on an untitled file.

- [PowerShell/vscode-powershell #1236](https://github.com/PowerShell/vscode-powershell/pull/1236) -
  Stop an error occurring when VSCode trims trailing whitespace and sends document update messages.

- [PowerShell/vscode-powershell #996](https://github.com/PowerShell/vscode-powershell/issues/996) -
  Fix `Install-PSCode.ps1` crashing due to `$IsLinux` variable in older PowerShell versions.

- [PowerShell/vscode-powershell #1234](https://github.com/PowerShell/vscode-powershell/pull/1234) -
  Add snippets for Hashtable and PSCustomObject.

- [PowerShell/vscode-powershell #1233](https://github.com/PowerShell/vscode-powershell/pull/1233) -
  Add a keybinding for Show Addtional Commands to <kbd>Shift</kbd>-<kbd>Alt</kbd>-<kbd>S</kbd>.

- [PowerShell/vscode-powershell #1227](https://github.com/PowerShell/vscode-powershell/pull/1227) -
  Add an indicator for when PowerShell is running in the status bar.

- [PowerShell/vscode-powershell #1225](https://github.com/PowerShell/vscode-powershell/pull/1225) -
  Fix launch config not using temporary integrated console setting.

- [PowerShell/vscode-powershell #1208](https://github.com/PowerShell/vscode-powershell/issues/1208) -
  Stop configured temporary windows closing after running Pester tests.

## 1.6.0
### Thursday, February 22, 2018

#### Fixes and Improvements

- [PowerShell/vscode-powershell #907](https://github.com/PowerShell/vscode-powershell/issues/907) -
  Persist temp console debug session.

- [PowerShell/vscode-powershell #1198](https://github.com/PowerShell/vscode-powershell/pull/1198) -
  Enhance Start-EditorServices.ps1 for better logging and fix bugs.

- [PowerShell/PowerShellEditorServices #413](https://github.com/PowerShell/PowerShellEditorServices/issues/413) -
  Allow opening files as not previews to allow Open-EditorFile to open multiple files passed in.

- [PowerShell/vscode-powershell #1177](https://github.com/PowerShell/vscode-powershell/issues/1177) -
  Add function-advanced snippet. Thanks to [Benny1007](https://github.com/Benny1007)!

- [PowerShell/vscode-powershell #1179](https://github.com/PowerShell/vscode-powershell/issues/1179) -
  Switch onDebug to onDebugResolve:type for better debugging perf.

- [PowerShell/vscode-powershell #1086](https://github.com/PowerShell/vscode-powershell/issues/1086) -
  Add tslint to vscode-powershell and address all issues.

- [PowerShell/vscode-powershell #1153](https://github.com/PowerShell/vscode-powershell/issues/1153) -
  Add docs for ps remoting in vscode.

- [PowerShell/vscode-powershell #1161](https://github.com/PowerShell/vscode-powershell/pull/1161) -
  Check for the expected version of the PowerShell Editor Services module fails because of the wrong function parameters. Thanks to [ant-druha](https://github.com/ant-druha)!

- [PowerShell/vscode-powershell #1141](https://github.com/PowerShell/vscode-powershell/pull/1141) -
  Updated install script minified URL. Thanks to [tabs-not-spaces](https://github.com/tabs-not-spaces)!

- [PowerShell/PowerShellEditorServices #258](https://github.com/PowerShell/PowerShellEditorServices/issues/258) -
  add .Save() to FileContext API.

- [PowerShell/vscode-powershell #1137](https://github.com/PowerShell/vscode-powershell/pull/1137) -
  Added 64bit support & vscode-insiders install support. Thanks to [tabs-not-spaces](https://github.com/tabs-not-spaces)!

- [PowerShell/vscode-powershell #1115](https://github.com/PowerShell/vscode-powershell/issues/1115) -
  Fixed "Open in ISE" keyboard shortcut from overwriting basic editing keyboard shortcut.

- [PowerShell/vscode-powershell #1111](https://github.com/PowerShell/vscode-powershell/issues/1111) -
  Update examples tasks.json for 2.0.0 schema.

## 1.5.1
### Tuesday, November 14, 2017

- [PowerShell/vscode-powershell #1100](https://github.com/PowerShell/vscode-powershell/issues/1100) -
  Fixed CodeLens on Pester test invocation fails with "Error: command 'vscode.startDebug' not found".

- [PowerShell/vscode-powershell #1091](https://github.com/PowerShell/vscode-powershell/issues/1091) -
  Fixed crash when editing remote file using psedit.

- [PowerShell/vscode-powershell #1084](https://github.com/PowerShell/vscode-powershell/issues/1084) -
  Fixed authenticode signature 'HashMismatch' on Start-EditorServices.ps1.

- [PowerShell/vscode-powershell #1078](https://github.com/PowerShell/vscode-powershell/issues/1078) -
  Fixed debug adapter process terminating when setting breakpoint in an Untitled file or in a Git diff window.

- Update download.sh to remove macOS OpenSSL check since PowerShell Core Beta and higher no longer depend on OpenSSL.  Thanks to [elovelan](https://github.com/elovelan)!

- Get-Help -ShowWindow will no longer error in the PowerShell Integrated Console.  The help window will appear but at the moment, it will appear behind VSCode.

- Fix language server crash when processing a deep directory structure that exceeds max path.

## 1.5.0
### Friday, October 27, 2017

#### Fixes and Improvements

- [PowerShell/vscode-powershell #820](https://github.com/PowerShell/vscode-powershell/issues/820) -
  Added new "Upload Bug Report to GitHub" command to make it easy to post an issue to the vscode-powershell GitHub repo.  Thanks to [Mark Schill](https://github.com/PowerSchill)!

- [PowerShell/vscode-powershell #910](https://github.com/PowerShell/vscode-powershell/issues/910) -
  Set-VSCodeHtmlContentView cmdlet now exposes `JavaScriptPaths` and `StyleSheetPaths` parameters to allow using JavaScript code and CSS stylesheets in VS Code HTML preview views.

- [PowerShell/vscode-powershell #909](https://github.com/PowerShell/vscode-powershell/issues/909) -
  Write-VSCodeHtmlContentView's AppendBodyContent now accepts input from the pipeline

- [PowerShell/vscode-powershell #1071](https://github.com/PowerShell/vscode-powershell/pull/1071) -
  Updated session menu to find PowerShell Core installs with the new pwsh.exe path

- [PowerShell/vscode-powershell #842](https://github.com/PowerShell/vscode-powershell/issues/842) -
  psedit can now open empty files in remote sessions

- [PowerShell/vscode-powershell #1040](https://github.com/PowerShell/vscode-powershell/issues/1040) -
  Non-PowerShell files opened in remote sessions using psedit can now be saved back to the remote server

- [PowerShell/vscode-powershell #660](https://github.com/PowerShell/vscode-powershell/issues/660) -
  Set/Enable/Disable/Remove-PSBreakpoint commands now cause the VS Code breakpoint UI to be updated while the debugger is active

- [PowerShell/vscode-powershell #625](https://github.com/PowerShell/vscode-powershell/issues/625) -
  Breakpoints are now cleared from the session when the debugger starts so that stale breakpoints from previous sessions are not hit

- [PowerShell/vscode-powershell #1004](https://github.com/PowerShell/vscode-powershell/issues/1004) -
  Handle exception case when finding references of a symbol

- [PowerShell/vscode-powershell #942](https://github.com/PowerShell/vscode-powershell/issues/942) -
  Temporary debugging session now does not hang when running "PowerShell Interactive Session" debugging configuration

- [PowerShell/vscode-powershell #917](https://github.com/PowerShell/vscode-powershell/issues/917) -
  Added PowerShell.InvokeRegisteredEditorCommand command to be used from HTML preview views for invoking editor commands registered in PowerShell.  Thanks to [Kamil Kosek](https://github.com/kamilkosek)!

- [PowerShell/vscode-powershell #872](https://github.com/PowerShell/vscode-powershell/issues/872) -
  Watch variables with children are now expandable

- [PowerShell/vscode-powershell #1060](https://github.com/PowerShell/vscode-powershell/issues/1060)  -
  $psEditor.Workspace.NewFile() now works again in VSC 1.18.0 Insiders builds

- [PowerShell/vscode-powershell #1046](https://github.com/PowerShell/vscode-powershell/issues/1046)  -
  Debugging now works again in VSC 1.18.0 Insiders builds

- [PowerShell/PowerShellEditorServices #342](https://github.com/PowerShell/PowerShellEditorServices/issues/342) -
  Unexpected file URI schemes are now handled more reliably

- [PowerShell/PowerShellEditorServices #396](https://github.com/PowerShell/PowerShellEditorServices/issues/396) -
  Resolved errors being written to Integrated Console when running native applications while transcription is turned on

- [PowerShell/PowerShellEditorServices #529](https://github.com/PowerShell/PowerShellEditorServices/issues/529) -
  Fixed an issue with loading the PowerShellEditorServices module in PowerShell Core 6.0.0-beta3

- [PowerShell/PowerShellEditorServices #533](https://github.com/PowerShell/PowerShellEditorServices/pull/533)  -
  Added new $psEditor.GetCommand() method for getting all registered editor commands.  Thanks to [Kamil Kosek](https://github.com/kamilkosek)!

- [PowerShell/PowerShellEditorServices #535](https://github.com/PowerShell/PowerShellEditorServices/pull/535)  -
  Type information is now exposed on hover for variables in the Variables view

## 1.4.3
### Wednesday, September 13, 2017

- [#1016](https://github.com/PowerShell/vscode-powershell/issues/1016) -
  Fixed a conflict with the "Azure Resource Manager for Visual Studio
  Code" extension which prevented the PowerShell extension from loading
  successfully.

## 1.4.2
### Tuesday, September 5, 2017

- [#993](https://github.com/PowerShell/vscode-powershell/issues/993) -
  `powershell.powerShellExePath` using Sysnative path should be automatically
  corrected when using 64-bit Visual Studio Code
- [#1008](https://github.com/PowerShell/vscode-powershell/issues/1008) -
  Windows PowerShell versions (x64 and x86) are not enumerated correctly
  when using 64-bit Visual Studio Code
- [#1009](https://github.com/PowerShell/vscode-powershell/issues/1009) -
  PowerShell version indicator in status bar is missing tooltip
- [#1020](https://github.com/PowerShell/vscode-powershell/issues/1020) -
  "Show Session Menu", "Show Integrated Console", and "Restart Current Session"
  commands should cause PowerShell extension to be activated

## 1.4.1
### Thursday, June 22, 2017

- [PowerShell/PowerShellEditorServices#529](https://github.com/PowerShell/PowerShellEditorServices/issues/529) -
  Fixed an issue with loading the extension with in PowerShell Core 6.0.0-beta3

## 1.4.0
### Wednesday, June 21, 2017

#### New HTML content view commands enabling custom UI tabs

You can now show editor tabs with custom HTML-based UI by using the
new HTML content view commands!  This is the first step toward UI
extensions for VS Code written in PowerShell.

Here's an example:

```powershell
$view = New-VSCodeHtmlContentView -Title "My Custom View" -ShowInColumn One
Set-VSCodeHtmlContentView -View $view -Content "<h1>Hello world!</h1>"
Write-VSCodeHtmlContentView $view -Content "<b>I'm adding new content!</b><br />"
```

And here's the result:

![HTML view demo](https://user-images.githubusercontent.com/79405/27394133-f96c38cc-565f-11e7-8102-a3727014ea5a.GIF)

Check out the cmdlet help for the following commands to learn more:

- `New-VSCodeHtmlContentView`
- `Show-VSCodeHtmlContentView`
- `Close-VSCodeHtmlContentView`
- `Set-VSCodeHtmlContentView`
- `Write-VSCodeHtmlContentView`

Since this is a first release, we've restricted the use of JavaScript
inside of the HTML.  We will add this capability in a future release!

#### Code formatting setting presets for common styles

We've now added code formatting presets for the most common code style
conventions used in the PowerShell community:

- **[OTBS](https://en.wikipedia.org/wiki/Indent_style#Variant:_1TBS_.28OTBS.29)** -
  Known as the "One True Brace Style". Causes `else`, `catch`, and other
  keywords to be "cuddled", keeping them on the same line as the previous
  closing brace:

  ```powershell
  if ($var -eq $true) {
    # Do the thing
  } else {
    # Do something else
  }
  ```

- **[Stroustrup](https://en.wikipedia.org/wiki/Indent_style#Variant:_Stroustrup)** -
  Causes beginning curly braces to be placed on the same line as the statement:

  ```powershell
  if ($var -eq $true) {
    # Do the thing
  }
  else {
    # Do something else
  }
  ```

- **[Allman](https://en.wikipedia.org/wiki/Indent_style#Allman_style)** - All curly braces are preceded by a newline:

  ```powershell
  if ($var -eq $true)
  {
    # Do the thing
  }
  else
  {
    # Do something else
  }
  ```

- **Custom** - Allows full customization of the code formatting settings.

In addition, code formatting now respects your `editor.insertSpaces` and
`editor.tabSize` settings!

#### Debugging in a temporary PowerShell Integrated Console

We've added the ability to debug your PowerShell code in a temporary
PowerShell Integrated Console so that you have a fresh runspace and
PowerShell process each time you hit F5!

This setting is necessary if you are developing with PowerShell 5
classes or modules using .NET assemblies because .NET types cannot
be reloaded inside of the same PowerShell process.  This new setting
saves you from reloading your PowerShell session each time you debug
your code!

You can configure this behavior in two ways:

- Use the `launch.json` configuration parameter `createTemporaryIntegratedConsole`:

  ```json
  {
    "type": "PowerShell",
    "request": "launch",
    "name": "PowerShell Launch Current File in Temporary Console",
    "script": "${file}",
    "args": [],
    "cwd": "${file}",
    "createTemporaryIntegratedConsole": true
  },
  ```

- Configure the setting `powershell.debugging.createTemporaryIntegratedConsole`:

  ```json
  "powershell.debugging.createTemporaryIntegratedConsole": true,
  ```

The default value for these settings is `false`, meaning that the temporary
console behavior is **opt-in**.

Configuring the user or workspace setting will cause all debugging sessions
to be run in a temporary Integrated Console so it's useful if you would prefer
this to be the default behavior.  The `launch.json` setting overrides the user
setting so you can always customize the behavior for a specific launch
configuration.

#### NewFile() API and Out-CurrentFile command

You can now create a new untitled file from within the Integrated Console
by using the `$psEditor.Workspace.NewFile()` command!  Also, you can send
the formatted output of any PowerShell command to the current file by using
the `Out-CurrentFile` command:

```powershell
Get-Process | Out-CurrentFile
```

Special thanks to [Doug Finke](https://github.com/dfinke) for the contribution!

#### Other fixes and improvements

- [#881](https://github.com/PowerShell/vscode-powershell/pull/881) -
  When you select a different PowerShell version in the session menu, your choice
  is persisted to the `powershell.powerShellExePath` setting.

- [#891](https://github.com/PowerShell/vscode-powershell/issues/891) -
  Pester CodeLenses now run tests without string interpolation of test names

## 1.3.2
### Monday, June 12, 2017

- [PowerShell/vscode-powershell#864](https://github.com/PowerShell/vscode-powershell/issues/864) - Improved the visibility of hyphen characters on the currently edited line in the PowerShell ISE theme (thanks [Stefan Stranger](https://github.com/stefanstranger)!)

- [PowerShell/vscode-powershell#857](https://github.com/PowerShell/vscode-powershell/issues/855) - Typing a new function into a file no longer causes the language server to crash

- [PowerShell/vscode-powershell#855](https://github.com/PowerShell/vscode-powershell/issues/855) - "Format Document" no longer hangs indefinitely

- [PowerShell/vscode-powershell#859](https://github.com/PowerShell/vscode-powershell/issues/859) - Language server no longer hangs when opening a Pester test file containing dot-sourced script references

- [PowerShell/vscode-powershell#856](https://github.com/PowerShell/vscode-powershell/issues/856) - CodeLenses for function definitions no longer count the definition itself as a reference and shows "0 references" when there are no uses of that function

- [PowerShell/vscode-powershell#838](https://github.com/PowerShell/vscode-powershell/issues/838) - Right-clicking a debugger variable and selecting "Add to Watch" now has the desired result

- [PowerShell/vscode-powershell#837](https://github.com/PowerShell/vscode-powershell/issues/837) - Debugger call stack now navigates correctly to the user's selected stack frame

- [PowerShell/vscode-powershell#862](https://github.com/PowerShell/vscode-powershell/issues/862) - Terminating errors in the language server now close the Integrated Console immediately and prompt the user to restart the session

- [PowerShell/PowerShellEditorServices#505](https://github.com/PowerShell/PowerShellEditorServices/issues/505) - Added improved cmdlet help in the PowerShellEditorServices.Commands module

- [PowerShell/PowerShellEditorServices#509](https://github.com/PowerShell/PowerShellEditorServices/issues/509) - Importing the PowerShellEditorServices.Commands module no longer causes errors to be written about missing help languages

## 1.3.1
### Friday, June 9, 2017

#### Fixes and improvements

- [#850](https://github.com/PowerShell/vscode-powershell/issues/850) -
  Fixed an issue where lower-cased "describe" blocks were not identified by
  the CodeLens feature.

- [#851](https://github.com/PowerShell/vscode-powershell/issues/851) -
  Fixed an issue where the language server would hang when typing out a describe
  block.

- [#852](https://github.com/PowerShell/vscode-powershell/issues/852) -
  Fixed an issue where Pester test names would not be detected correctly when
  other arguments like -Tags were being used on a Describe block.

## 1.3.0
### Friday, June 9, 2017

#### CodeLens for running and debugging Pester tests

We've added two new CodeLens actions that show up above Describe blocks in
your Pester tests, "Run tests" and "Debug tests".  By clicking one of these
CodeLenses, your tests will be executed in the Integrated Console with
the debugger attached.  You can now set breakpoints and quickly debug a portion
of your test script:

![Pester CodeLens](https://user-images.githubusercontent.com/79405/26988706-3c054ed0-4d05-11e7-87f0-5bbf16ee73ef.GIF)

#### CodeLens support for finding references of a function or cmdlet

We've also added CodeLenses for showing the number of references for a function or
cmdlet that is defined in a script.  If you click this CodeLens, the references
pane will appear so that you can navigate through all of the references:

![References CodeLens](https://user-images.githubusercontent.com/79405/26989245-384a4866-4d07-11e7-9c1e-076dbd7d6eb4.GIF)

We will add CodeLens support for PowerShell 5+ classes and class methods in a future
update!

#### Document symbol support for Pester tests

We've also added document symbol support for Pester tests so that you can easily
navigate among the Describe, Context, and It blocks in large Pester script files:

![Pester symbols](https://user-images.githubusercontent.com/79405/26989077-91e7a306-4d06-11e7-8e26-916bb78720f8.GIF)

#### New PowerShell ISE theme

We now include a new color theme that tries to provide a faithful interpretation
of the PowerShell ISE's style, including a blue console background!  To use this
theme open the Command Palette (Ctrl+Shift+P), run the "Preferences: Color Theme"
command, then select "PowerShell ISE".

![ISE theme](https://user-images.githubusercontent.com/79405/26988805-9769aea6-4d05-11e7-81fc-da79bf1ec3cb.png)

This is a first attempt at making this happen so [give us feedback](https://git.io/v9jnL)
if you think that the colors can be improved! Super huge thanks to
[Matt McNabb](https://twitter.com/mcnabbmh) for putting this together!

#### New cmdlets inside the Integrated Console

Thanks to new PowerShell Editor Services co-maintainer [Patrick Meinecke](https://github.com/SeeminglyScience),
we've gained a new set of useful commands for interacting with the $psEditor APIs
within the Integrated Console:

- [Find-Ast](https://github.com/PowerShell/PowerShellEditorServices/blob/master/module/docs/Find-Ast.md)
- [Get-Token](https://github.com/PowerShell/PowerShellEditorServices/blob/master/module/docs/Get-Token.md)
- [ConvertFrom-ScriptExtent](https://github.com/PowerShell/PowerShellEditorServices/blob/master/module/docs/ConvertFrom-ScriptExtent.md)
- [ConvertTo-ScriptExtent](https://github.com/PowerShell/PowerShellEditorServices/blob/master/module/docs/ConvertTo-ScriptExtent.md)
- [Set-ScriptExtent](https://github.com/PowerShell/PowerShellEditorServices/blob/master/module/docs/Set-ScriptExtent.md)
- [Join-ScriptExtent](https://github.com/PowerShell/PowerShellEditorServices/blob/master/module/docs/Join-ScriptExtent.md)
- [Test-ScriptExtent](https://github.com/PowerShell/PowerShellEditorServices/blob/master/module/docs/Test-ScriptExtent.md)
- [Import-EditorCommand](https://github.com/PowerShell/PowerShellEditorServices/blob/master/module/docs/Import-EditorCommand.md)

This should also resolve the issues some people were seeing when we tried
to load the unsigned temporary script containing `Register-EditorCommand`
on machines with an AllSigned execution policy ([#784]([https://github.com/PowerShell/vscode-powershell/issues/784])).

#### Fixes and improvements

- [#827](https://github.com/PowerShell/vscode-powershell/issues/827) -
  Fixed an issue where an Output panel will appear with an error when you close
  the PowerShell Integrated Terminal

## 1.2.1
### Thursday, June 1, 2017

#### Fixes and improvements

- [PowerShell/PowerShellEditorServices#478](https://github.com/PowerShell/PowerShellEditorServices/issues/478) -
  Dynamic comment help snippets now generate parameter fields correctly
  when `<#` is typed above a `param()` block.

- [#808](https://github.com/PowerShell/vscode-powershell/issues/808) -
  An extra `PS>` is no longer being written to the Integrated Console for
  some users who have custom prompt functions.

- [#813](https://github.com/PowerShell/vscode-powershell/issues/813) -
  Finding references of symbols across the workspace now properly handles
  inaccessible folders and file paths

- [#810](https://github.com/PowerShell/vscode-powershell/issues/810) -
  `$psEditor.GetEditorContext()` now doesn't throw exceptions when in an
  untitled file

- [#807](https://github.com/PowerShell/vscode-powershell/issues/807) -
  The users's previously selected PowerShell session type is now retained
  when running the "PowerShell: Restart Current Session" command.

- [#821](https://github.com/PowerShell/vscode-powershell/issues/821) -
  Note properties on PSObjects are now visible in the debugger's Variables
  view

## 1.2.0
### Wednesday, May 31, 2017

#### Dynamic comment-based help snippets now work inside functions ([#763](https://github.com/PowerShell/vscode-powershell/issues/748))

You asked for it, you got it!  Dynamic comment-based help snippets now work
inside function definitions, both above the `param()` block and at the end
of the function body:

![Comment help GIF](https://cloud.githubusercontent.com/assets/79405/26637844/6e76cfa6-45d5-11e7-89b8-a2d6a559536b.GIF)

*NOTE: There is an issue where parameter sections don't get generated inside of a function
with a `[CmdletBinding()]` attribute.  This is being tracked at [PowerShell/PSScriptAnalyzer#768](https://github.com/PowerShell/PSScriptAnalyzer/issues/768).*

#### Session menu now contains entries for PowerShell Core installations on Windows ([#794](https://github.com/PowerShell/vscode-powershell/issues/794))

It's now much easier to switch between Windows PowerShell and PowerShell Core installs
on Windows.  When you run the "PowerShell: Show Session Menu" command or click the
PowerShell version indication in the status bar you'll now see PowerShell Core entries
in the menu:

![Session menu](https://cloud.githubusercontent.com/assets/79405/26637984/d177f5f8-45d5-11e7-9def-705b3fa68953.png)

#### Improved PSScriptAnalyzer marker display and suppression snippets ([#781](https://github.com/PowerShell/vscode-powershell/issues/781)) and ([#783](https://github.com/PowerShell/vscode-powershell/issues/783))

The green squiggle markers you receive from PSScriptAnalyzer now include the
name of the corresponding rule in their description:

![Rule name](https://cloud.githubusercontent.com/assets/79405/26638073/15aaaaae-45d6-11e7-93a0-cf6d5397553e.png)

This is really helpful with the new rule suppression snippets contributed by
[Jos Verlinde](https://github.com/Josverl)!  You can access them by typing
`suppress-` and selecting one of the suppression snippet options:

![Suppress rule](https://cloud.githubusercontent.com/assets/79405/26638390/d8c42164-45d6-11e7-8844-a34a314654a5.GIF)

#### New built-in Pester problem matcher ([#798](https://github.com/PowerShell/vscode-powershell/issues/798))

We now include a built-in [problem matcher](https://code.visualstudio.com/Docs/editor/tasks#_defining-a-problem-matcher)
for Pester test output so that you don't need to define one in your `tasks.json`
file any longer! You can reference the built-in problem matcher in your test
tasks by using the name `$pester`:

```json
    {
        "taskName": "Test",
        "suppressTaskName": true,
        "isTestCommand": true,
        "showOutput": "always",
        "args": [ "Invoke-Pester -PesterOption @{IncludeVSCodeMarker=$true}" ],
        "problemMatcher": "$pester"
    }
```

*NOTE: There is an issue with problem matchers when using the new `2.0.0`
version of VS Code's task runner.  Pester errors may show up multiple
times in the Problems panel.  This issue is being tracked at
[#797](https://github.com/PowerShell/vscode-powershell/issues/797).*

#### Other fixes and improvements

- [#710](https://github.com/PowerShell/vscode-powershell/issues/710) -
  Variable definitions can now be found across the workspace

- [#771](https://github.com/PowerShell/vscode-powershell/issues/771) -
  Improved dynamic comment help snippet performance in scripts with many functions

- [#786](https://github.com/PowerShell/vscode-powershell/issues/786) -
  Running the "Show Integrated Console" command will now start the extension
  if it isn't already started

- [#774](https://github.com/PowerShell/vscode-powershell/issues/774) -
  Pressing Enter now causes custom prompt functions to be fully evaluated

- [#770](https://github.com/PowerShell/vscode-powershell/issues/770) -
  Fixed issue where custom prompt function might be written twice when
  starting the integrated console

- [#767](https://github.com/PowerShell/vscode-powershell/issues/767) -
  Fixed placeholder navigation for many built-in snippets

- [#782](https://github.com/PowerShell/vscode-powershell/issues/782) -
  Fixed extension host crash when restarting the PowerShell session

- [#737](https://github.com/PowerShell/vscode-powershell/issues/737) -
  Fixed hangs and high CPU when restarting or switching between PowerShell sessions

- [#777](https://github.com/PowerShell/vscode-powershell/issues/777) -
  Changed "Starting PowerShell" message to clearly indicate that we're in the
  PowerShell Integrated Console

## 1.1.0
### Thursday, May 18, 2017

#### New dynamic snippet for adding comment-based help ([#748](https://github.com/PowerShell/vscode-powershell/issues/748))

We've added a really cool new feature that enables you to create comment-based
help blocks with ease!  When you've defined a function in a PowerShell script
file, you can now start typing a comment block above the function definition
and it will be completed for you:

![Help Comment GIF](https://cloud.githubusercontent.com/assets/79405/26216440/f31a47c8-3bb8-11e7-9fbc-7e3fb596c0ea.GIF)

This comment block works like a snippet, allowing you to tab through the fields
to quickly add documentation for the parts you care about.

This is a first pass for this feature and we plan to do more with it in the future.
Please feel free to [file feature requests](https://git.io/v9jnL) for anything else
you'd like to see!

#### Breakpoints hit in the Integrated Console now activate the debugger UI ([#619](https://github.com/PowerShell/vscode-powershell/issues/619))

In previous releases it was necessary to start the "PowerShell Interactive Session"
debugging configuration before you could run a command or script from the Integrated
Console and hit breakpoints in the editor UI.  We've just removed this limitation!

Now when you set a breakpoint using `Set-PSBreakpoint` and run a script or command in the
Integrated Console, the debugger UI now gets activated:

![Debugger Activate GIF](https://cloud.githubusercontent.com/assets/79405/26217019/d17708f2-3bba-11e7-982f-4d481c2cf533.GIF)

Note that breakpoints set in the Integrated Console [still do not show up](https://github.com/PowerShell/vscode-powershell/issues/660)
in the editor UI; this requires [changes to VS Code](https://github.com/Microsoft/vscode/issues/8642)
that we'll be contributing for their next feature release.

#### Improved output when loading profile scripts ([#663](https://github.com/PowerShell/vscode-powershell/issues/663) and [#689](https://github.com/PowerShell/vscode-powershell/issues/689))

We now write the errors and Write-Output calls that occur while loading profile
scripts so that it's easier to diagnose issues with your profile scripts.  This
fix will help us identify the things missing from the Integrated Console which
cause your profile scripts to fail (like the current lack of a [PrivateData object for setting console colors](https://github.com/PowerShell/vscode-powershell/issues/571)).

Please feel free to [file issues](https://git.io/v9jnL) for anything that causes
your profile scripts to throw errors when they get loaded!

#### Other fixes and improvements

- [#751](https://github.com/PowerShell/vscode-powershell/issues/751) -
  Removed keybinding for the "Find PowerShell Modules from the Gallery" command
  because it conflicts with VS Code's default "Format Selection" keybinding.

- [#739](https://github.com/PowerShell/vscode-powershell/issues/739) -
  Fixed wording of PowerShell extension commands to have consistent capitalization.
  Thanks to [@AndySchneiderDev](https://github.com/AndySchneiderDev) for the
  contribution!

## 1.0.0
### Wednesday, May 10, 2017

We are excited to announce that we've reached version 1.0!  For more information,
please see the [official announcement](https://blogs.msdn.microsoft.com/powershell/2017/05/10/announcing-powershell-for-visual-studio-code-1-0/)
on the PowerShell Team Blog.

#### New script argument UI when debugging ([#705](https://github.com/PowerShell/vscode-powershell/issues/705))

You can now set PowerShell debugger configurations to prompt for arguments to be
passed to your script when it is executed.  This is configured using the new
`${command:SpecifyScriptArgs}` configuration variable in `launch.json`:

```json
        {
            "type": "PowerShell",
            "request": "launch",
            "name": "PowerShell Launch DebugTest.ps1 w/Args Prompt",
            "script": "${workspaceRoot}/DebugTest.ps1",
            "args": [ "${command:SpecifyScriptArgs}" ],
            "cwd": "${file}"
        }
```

When you launch this configuration you will see a UI popup asking for arguments:


![image](https://cloud.githubusercontent.com/assets/5177512/25560503/e60e9822-2d12-11e7-9837-29464d077082.png)

You can type your arguments to the script as you would in PowerShell:

```
-Count 5
```

In future executions of this configuration, you will be presented with the arguments
you typed the last time you ran it so that you can easily edit them and test variations!

#### New hash table alignment formatting rule ([#672](https://github.com/PowerShell/vscode-powershell/issues/672))

We've added a new code formatting rule that automatically aligns the equal sign
in assignments of keys in hash tables or DSC configurations.  It also works with
nested hash tables! Here's a simple example:

**Before**

```powershell
$formatTest = @{
    Apple = 4
    Tangerine = @{
        Orange = 2
        CornflowerBlue = 6
    }
    Banana = 3
}
```

**After**

```powershell

$formatTest = @{
    Apple     = 4
    Tangerine = @{
        Orange         = 2
        CornflowerBlue = 6
    }
    Banana    = 3
}
```

This formatting rule is enabled by default but can be disabled with the following
setting:

```
"powershell.codeFormatting.alignPropertyValuePairs": false
```

#### Added basic module-wide function references support

In the past, finding the references or definition of a function in `FileA.ps1` only
worked if `FileA.ps1` had an explicit dot-source invocation of `FileB.ps1`.  We have
removed this limitation so that you can now find definitions and references of any
function across all the script files in your project folder!  This is especially
useful if you write PowerShell modules where all of the source files are dot-sourced
inside of the .psm1 file.

This new implementation is very basic and may give unexpected results, so please [file
an issue on GitHub](https://github.com/PowerShell/vscode-powershell/issues) if you get
a result you did not expect!

#### Other integrated console and debugger improvements

- Fixed [#698](https://github.com/PowerShell/vscode-powershell/issues/698) -
  When debugging scripts in the integrated console, the cursor position should now
  be stable after stepping through your code!  Please let us know if you see any
  other cases where this issue appears.

- Fixed [#626](https://github.com/PowerShell/vscode-powershell/issues/626) -
  Fixed an issue where debugging a script in one VS Code window would cause that script's
  output to be written to a different VS Code window in the same process.

- Fixed [#618](https://github.com/PowerShell/vscode-powershell/issues/618) -
  Pressing enter on an empty command line in the Integrated Console no longer adds the
  empty line to the command history.

- Fixed [#617](https://github.com/PowerShell/vscode-powershell/issues/617) -
  Stopping the debugger during a prompt for a mandatory script parameter no
  longer crashes the language server.

- Fixed [PowerShellEditorServices #428](https://github.com/PowerShell/PowerShellEditorServices/issues/428) -
  Debugger no longer hangs when you stop debugging while an input or choice prompt is
  active in the integrated console.

## 0.12.2
### Friday, April 7, 2017

- Fixed [#662](https://github.com/PowerShell/vscode-powershell/issues/662) -
  Changed usage of `$env:PSMODULEPATH` to `$env:PSModulePath` to conform to
  a recent change in PowerShell 6 ([PowerShell/PowerShell#3255](https://github.com/PowerShell/PowerShell/pull/3255))
  which makes the casing of `PSModulePath` consistent between Windows and
  the *NIX platforms.

  **NOTE: This is a breaking change for PowerShell extension users on Linux and macOS**

  If you are using PowerShell 6.0.0-alpha.17 or lower you **will** need to upgrade
  to 6.0.0-alpha.18.

- Fixed [#645](https://github.com/PowerShell/vscode-powershell/issues/645) -
  "Go to Definition" or "Find References" now work in untitled scripts without
  crashing the session
- Fixed [#632](https://github.com/PowerShell/vscode-powershell/issues/632) -
  Debugger no longer hangs when launched while PowerShell session is still
  initializing
- Fixed [#655](https://github.com/PowerShell/vscode-powershell/issues/655) -
  Fixed an issue with current working directory being set incorrectly when
  debugging untitled script files
- Fixed [PowerShellEditorServices #430](https://github.com/PowerShell/PowerShellEditorServices/issues/430) -
  Resolved occasional IntelliSense slowness by preventing the implicit loading
  of the PowerShellGet and PackageManagement modules.  This change will be reverted
  once a bug in PackageManagement is fixed.
- Fixed [PowerShellEditorServices #427](https://github.com/PowerShell/PowerShellEditorServices/issues/427) -
  Fixed an occasional crash when requesting editor IntelliSense while running
  a script in the debugger
- Fixed [PowerShellEditorServices #416](https://github.com/PowerShell/PowerShellEditorServices/issues/416) -
  Cleaned up errors that would appear in the `$Errors` variable from the use
  of `Get-Command` and `Get-Help` in IntelliSense results

## 0.12.1
### Tuesday, April 4, 2017

- Fixed [#648](https://github.com/PowerShell/vscode-powershell/issues/648) -
  Resolved an error when launching an untitled script file in a workspace
  with no launch.json or in a window without a workspace path

## 0.12.0
### Tuesday, April 4, 2017

#### Debugging untitled files ([#555](https://github.com/PowerShell/vscode-powershell/issues/555))

You can now debug untitled files that are set to the PowerShell language mode.  When you
create a new untitled file, use the "Change Language Mode" command (<kbd>Ctrl+K M</kbd>)
and choose "PowerShell" from the menu that appears.  You can now press F5 to start
debugging the script file without saving it.

In the upcoming 1.11.0 release of Visual Studio Code (or in the current VS Code Insiders
release), you can configure the new `files.defaultLanguage` setting to `powershell` in either
your User or Workspace settings to cause all untitled files to be created with the PowerShell
mode by default.  This will allow you to create new PowerShell scripts and debug them
immediately without saving first!

#### New right-click context menu for Run Selection ([#581](https://github.com/PowerShell/vscode-powershell/issues/581))

By user request, we've also added a new "Run Selection" item in the right-click context menu
for PowerShell script files:

![image](https://cloud.githubusercontent.com/assets/79405/24670885/a18513fe-1924-11e7-91d3-dc14c6cbfad9.png)

#### Debugging improvements

- Fixed [#620](https://github.com/PowerShell/vscode-powershell/issues/620) -
  PowerShell session now does not crash when a breakpoint is hit outside of
  debug mode

- Fixed [#614](https://github.com/PowerShell/vscode-powershell/issues/614) -
  Auto variables are now populating correctly in the debugger.  **NOTE**: There is
  a known issue where all of a script's variables begin to show up in the
  Auto list after running a script for the first time.  This is caused by
  a change in 0.11.0 where we now dot-source all debugged scripts.  We will
  provide an option for this behavior in the future.

- Fixed [#641](https://github.com/PowerShell/vscode-powershell/issues/641) -
  PowerShell script files with capitalized extensions (.PS1, .PSM1) can now
  be launched in the debugger

- Fixed [#616](https://github.com/PowerShell/vscode-powershell/issues/616) -
  Debugger now shows column position indicators when debugging pipelines or
  nested expressions:

  ![image](https://cloud.githubusercontent.com/assets/79405/24316990/2157480e-10b0-11e7-8a61-19fde63edfb7.png)

#### Integrated console improvements

- Fixed [PowerShell/PowerShellEditorServices#411](https://github.com/PowerShell/PowerShellEditorServices/issues/411) -
  Commands run outside of the integrated console prompt now interrupt the prompt
  correctly.  This resolves a class of issues that appear when running commands
  in the extension like "New Project from Plaster Template" or any `$psEditor`
  commands added with the "Register-EditorCommand" function.  Running any of
  these commands will now cause the current input prompt to be cancelled so that
  the command's output will be written correctly.

#### Code formatting improvements

- Fixed [#595](https://github.com/PowerShell/vscode-powershell/issues/595) -
  High CPU usage when using formatOnType has now been resolve

- Fixed [#559](https://github.com/PowerShell/vscode-powershell/issues/559) -
  The `newLineAfterCloseBrace` behavior has been improved to respect common syntax
  usages

- Fixed[PowerShell/PowerShellEditorServices#380](https://github.com/PowerShell/PowerShellEditorServices/issues/380) -
  The `whitespaceBeforeOpenBrace` behavior now leaves "magic" functions with the
  correct formatting.  For example: `(0 .. 10).foreach{$_}` now does not have a
  whitespace inserted before the `{`.

#### New Project with Plaster improvements

- Fixed [#643](https://github.com/PowerShell/vscode-powershell/issues/643) -
  Running Plaster using the New Project command now interrupts the command prompt
  correctly

- Fixed [#504](https://github.com/PowerShell/vscode-powershell/issues/504) -
  Confirming default values in Plaster input prompts by pressing Enter now works
  correctly

#### Other fixes and improvements

- Added [#639](https://github.com/PowerShell/vscode-powershell/pull/639) and
        [#640](https://github.com/PowerShell/vscode-powershell/pull/640) -
  Our configuration setting descriptions have been edited for superior clarity
  thanks to [June Blender](https://github.com/juneb)!

- Fixed [#611](https://github.com/PowerShell/vscode-powershell/pull/640) -
  Example-* snippets are now displaying correctly in IntelliSense results

- Added [#624](https://github.com/PowerShell/vscode-powershell/pull/624) -
  When you update the PowerShell extension after this release, you will now see
  version update indicators which offer to display the changelog in a preview
  tab

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
