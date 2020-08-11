# PowerShell Preview Extension Release History March 2020

This document shows the combined changes that were moved from the Preview extension to the stable extension as part of the March 2020 release.

## Top Features

- ✨ 📺 [vscode-PowerShell #2335](https://github.com/PowerShell/vscode-powershell/pull/2335) -
  Add editor command `PowerShell: Enable/Disable ISE Mode` for ISE emulation in VS Code.
- ✨ 📟 [vscode-PowerShell #2316](https://github.com/PowerShell/vscode-PowerShell/pull/2316) -
  Add `powershell.integratedConsole.forceClearScrollbackBuffer` setting to enable `Clear-Host` to clear scrollback buffer.
- 🚂 [PowerShellEditorServices #1056](https://github.com/PowerShell/PowerShellEditorServices/pull/1056) -
  Re-architect PowerShell Editor Services to use the Omnisharp LSP platform.
- [PowerShellEditorServices #741](https://github.com/PowerShell/PowerShellEditorServices/pull/741) -
  Migrate to netstandard2.0 and PSStandard
- [PowerShellEditorServices #672](https://github.com/PowerShell/PowerShellEditorServices/pull/672) -
  PSReadLine integration (Thanks @SeeminglyScience!)

## v2020.2.0
### Thursday, February 20, 2020
#### [vscode-PowerShell](https://github.com/PowerShell/vscode-PowerShell)

- 🐛📖 [vscode-PowerShell #2470](https://github.com/PowerShell/vscode-powershell/pull/2470) -
  Fix incorrect reference to `New-ManifestModule` in documentation. (Thanks @rbleattler!)
- 🐛📺 [vscode-PowerShell #2469](https://github.com/PowerShell/vscode-powershell/pull/2469) -
  Close other open pwsh instances when updating PowerShell.
- 🐛📟 [vscode-PowerShell #2434](https://github.com/powershell/vscode-powershell/pull/2437) -
  Use a new VSCode API to hide the integrated terminal from the shell list
  until debugging when `showOnStartup` is disabled.
- ✨🐢 [vscode-PowerShell #2445](https://github.com/PowerShell/vscode-powershell/pull/2445) -
  Add `Run/Debug Pester tests` context menu options in the VSCode explorer
  for Pester test files. (Thanks @bergmeister!)
- 🐛🐢 [vscode-PowerShell #2438](https://github.com/PowerShell/vscode-powershell/pull/2447/) -
  Fixes test failures in Pester contexts not showing up in the Problems pane. (Thanks @tillig!)
- 🐛🔍 [vscode-PowerShell #2548](https://github.com/PowerShell/vscode-powershell/pull/2458) -
  Show error message instead of hanging when temp debugging is used with an untitled file.
- 👷 [vscode-PowerShell #2465](https://github.com/PowerShell/vscode-powershell/pull/2465) -
  Move macOS CI images to 10.14 (Thanks @bergmeister!)

#### [PowerShellEditorServices](https://github.com/PowerShell/PowerShellEditorServices)

- 🐛📁 [vscode-PowerShell #2421](https://github.com/powershell/powershelleditorservices/pull/1161) -
  Fix WorkspacePath so that references work with non-ASCII characters.
- 🐛📟 [vscode-PowerShell #2372](https://github.com/powershell/powershelleditorservices/pull/1162) -
  Fix prompt behavior when debugging.
- 🐛🛫 [PowerShellEditorServices #1171](https://github.com/powershell/powershelleditorservices/pull/1171) -
  Fix race condition where running multiple profiles caused errors.
- 🐛📟 [vscode-PowerShell #2420](https://github.com/powershell/powershelleditorservices/pull/1173) -
  Fix an issue where pasting to a `Get-Credential` prompt in some Windows versions caused a crash.
- 🐛📟 [vscode-PowerShell #1790](https://github.com/powershell/powershelleditorservices/pull/1174) -
  Fix an inconsistency where `Read-Host -Prompt 'prompt'` would return `$null` rather than empty string
  when given no input.
- 🐛🔗 [PowerShellEditorServices #1177](https://github.com/powershell/powershelleditorservices/pull/1174) -
  Fix an issue where untitled files did not work with CodeLens.
- ⚡️⏱️ [PowerShellEditorServices #1172](https://github.com/powershell/powershelleditorservices/pull/1172) -
  Improve `async`/`await` and `Task` usage to reduce concurrency overhead and improve performance.
- 🐛📟 [PowerShellEditorServices #1178](https://github.com/powershell/powershelleditorservices/pull/1178) -
  Improve PSReadLine experience where no new line is rendered in the console.
- ✨🔍 [PowerShellEditorServices #1119](https://github.com/powershell/powershelleditorservices/pull/1119) -
  Enable new debugging APIs added in PowerShell 7, improving performance and fixing issues where
  the debugger would hang or be unable to update breakpoints while scripts were running.
- 👷📟 [PowerShellEditorServices #1187](https://github.com/PowerShell/PowerShellEditorServices/pull/1187) -
  Upgrade built-in PSReadLine to 2.0.0 GA.
- 🐛👮 [PowerShellEditorServices #1179](https://github.com/PowerShell/PowerShellEditorServices/pull/1179) -
  Improve integration with PSScriptAnalyzer, improving performance,
  fixing an error when PSScriptAnalyzer is not available, fix CodeActions not appearing on Windows,
  fix an issue where the PSModulePath is reset by PSScriptAnalyzer opening new runspaces.
- 🚂 [PowerShellEditorServices #1183](https://github.com/PowerShell/PowerShellEditorServices/pull/1183) -
  Close over public APIs not intended for external use and replace with new, async-friendly APIs.

## v2020.1.0
### Monday, January 13, 2020
#### [vscode-PowerShell](https://github.com/PowerShell/vscode-PowerShell)

- 🛫 ✨ [vscode-powershell #2384](https://github.com/PowerShell/vscode-PowerShell/pull/2400) -
  Add -Login startup option.
- 🛫 🐛 [vscode-powershell #2380](https://github.com/PowerShell/vscode-PowerShell/pull/2399) -
  Make PowerShell names case insensitive for configuration.
- 🛫 📺 ✨ [vscode-powershell #2370](https://github.com/PowerShell/vscode-PowerShell/pull/2398) -
  Add configuration to enable/disable banner.

#### [PowerShellEditorServices](https://github.com/PowerShell/PowerShellEditorServices)

- 📺 [vscode-powershell #2405](https://github.com/PowerShell/PowerShellEditorServices/pull/1152) -
  Add tooltip to completions ParameterValue.
- 🛫 🐛 [vscode-powershell #2393](https://github.com/PowerShell/PowerShellEditorServices/pull/1151) -
  Probe netfx dir for deps.
- 🚂 ⏱️ 🐛 [vscode-powershell #2352](https://github.com/PowerShell/PowerShellEditorServices/pull/1149) -
  Fix lock up that occurs when WinForms is executed on the pipeline thread.
- 💭 🐛 [vscode-powershell #2402](https://github.com/PowerShell/PowerShellEditorServices/pull/1150) -
  Fix temp debugging after it broke bringing in $psEditor.
- 🧠 🐛 [vscode-powershell #2324](https://github.com/PowerShell/PowerShellEditorServices/pull/1143) -
  Fix unicode character uri bug.
- 🛫 📺 ✨ [vscode-powershell #2370](https://github.com/PowerShell/PowerShellEditorServices/pull/1141) -
  Make startup banner simpler.
- [vscode-powershell #2386](https://github.com/PowerShell/PowerShellEditorServices/pull/1140) -
  Fix uncaught exception when SafeToString returns null. (Thanks @jborean93!)
- 🔗 🐛 [vscode-powershell #2374](https://github.com/PowerShell/PowerShellEditorServices/pull/1139) -
  Simplify logic of determining Reference definition.
- 🛫 🐛 [vscode-powershell #2379](https://github.com/PowerShell/PowerShellEditorServices/pull/1138) -
  Use -Option AllScope to fix Windows PowerShell error.

## v2019.12.0

### Wednesday, December 11, 2019

#### [vscode-PowerShell](https://github.com/PowerShell/vscode-PowerShell)

- ✨ 📺 [vscode-PowerShell #2335](https://github.com/PowerShell/vscode-powershell/pull/2335) -
  Add editor command `PowerShell: Enable/Disable ISE Mode` for ISE emulation in VS Code.
- ⚡️ 🛫 [vscode-PowerShell #2348](https://github.com/PowerShell/vscode-PowerShell/pull/2348) -
  Start EditorServices without start script.
- ✨ 📟 [vscode-PowerShell #2316](https://github.com/PowerShell/vscode-PowerShell/pull/2316) -
  Add `powershell.integratedConsole.forceClearScrollbackBuffer` setting to enable `Clear-Host` to clear scrollback buffer.
- 🐛 📺 [vscode-PowerShell #2325](https://github.com/PowerShell/vscode-PowerShell/pull/2325) -
  Fix update PowerShell feature on windows.
- 🔧 📁 🐛 [vscode-powershell #2099](https://github.com/PowerShell/vscode-PowerShell/pull/2304) -
  Use `powerShellDefaultVersion` everywhere and stop using `powerShellExePath`.
- 🐛 📺 [vscode-PowerShell #2294](https://github.com/PowerShell/vscode-PowerShell/pull/2294) -
  Buttons show up for untitled files.

#### [PowerShellEditorServices](https://github.com/PowerShell/PowerShellEditorServices)

- 👷 📟 [PowerShellEditorServices #1129](https://github.com/PowerShell/PowerShellEditorServices/pull/1129) -
  Update PSReadLine to 2.0.0-rc1 in modules.json.
- 🛫 🐛 ⚡️ [vscode-powershell #2292](https://github.com/PowerShell/PowerShellEditorServices/pull/1118) -
  Isolate PSES dependencies from PowerShell on load + make PSES a pure binary module.
- ✨ 📟 [PowerShellEditorServices #1108](https://github.com/PowerShell/PowerShellEditorServices/pull/1108) -
  Clear the terminal via the LSP message `editor/clearTerminal`.
- 🔍 🐛 [vscode-powershell #2319](https://github.com/PowerShell/PowerShellEditorServices/pull/1117) -
  Run one invocation per SetBreakpoints request. (Thanks @SeeminglyScience!)
- 🐛 [PowerShellEditorServices #1114](https://github.com/PowerShell/PowerShellEditorServices/pull/1114) -
  Fix `Import-EditorCommand -Module`. (Thanks @sk82jack!)
- 🐛 🔍 [PowerShellEditorServices #1112](https://github.com/PowerShell/PowerShellEditorServices/pull/1112) -
  Fix breakpoint setting deadlock.
- 🔗 🐛 [vscode-powershell #2306](https://github.com/PowerShell/PowerShellEditorServices/pull/1110) -
  Fix references on Windows due to bad WorkspacePath.
- ✨ 👷 [PowerShellEditorServices #993](https://github.com/PowerShell/PowerShellEditorServices/pull/993) -
  Add devcontainer support for building in container. (Thanks @bergmeister!)
- 🛫 🐛 [vscode-powershell #2311](https://github.com/PowerShell/PowerShellEditorServices/pull/1107) -
  Protect against no RootUri (no open workspace).
- 🐛 📟 [vscode-powershell #2274](https://github.com/PowerShell/PowerShellEditorServices/pull/1092) -
  Fix '@' appearing in console.
- 👮‍ 🐛 [vscode-powershell #2288](https://github.com/PowerShell/PowerShellEditorServices/pull/1094) -
  Use RootUri.LocalPath for workspace path.
- 👮‍ 🔗 🐛 [vscode-powershell #2290](https://github.com/PowerShell/PowerShellEditorServices/pull/1098) -
  Fix diagnostics not showing in untitled files and now also show CodeLens.
- 🔍 🐛 [vscode-powershell #1850](https://github.com/PowerShell/PowerShellEditorServices/pull/1097) -
  Fixes no prompt showing up when debugging.
- 🚂 📺 🐛 [vscode-powershell #2284](https://github.com/PowerShell/PowerShellEditorServices/pull/1096) -
  Fix running indicator by ignoring PSRL aborts.

## v2019.11.0
### Friday, November 1, 2019

##### Special Note
In this release of the preview extension,
we've merged significant architectural work into PowerShell Editor Services.
After several months of work, PSES now uses the Omnisharp LSP library
to handle Language Server Protocol interaction instead of rolling its own,
allowing PSES to concentrate on being a good PowerShell backend.
We hope you'll see increased performance and stability in this release.
As always, [please let us know if you find any issues](https://github.com/PowerShell/vscode-powershell/issues/new/choose).

#### [vscode-PowerShell](https://github.com/PowerShell/vscode-PowerShell)

- 🔧 [vscode-PowerShell #2262](https://github.com/PowerShell/vscode-PowerShell/pull/2262) -
  Introduce `powershell.integratedConsole.useLegacyReadline` setting disable PSReadLine.
- 🚂 [vscode-PowerShell #2226](https://github.com/PowerShell/vscode-PowerShell/pull/2226) -
  Changes needed for Omnisharp migration of PowerShellEditorServices.

#### [PowerShellEditorServices](https://github.com/PowerShell/PowerShellEditorServices)

- 🐛 [PowerShellEditorServices #1080](https://github.com/PowerShell/PowerShellEditorServices/pull/1080) -
  Remove extra newline in GetComment feature.
- 🐛 [PowerShellEditorServices #1079](https://github.com/PowerShell/PowerShellEditorServices/pull/1079) -
  Fix duplicate diagnostics caused by DidChange handler.
- 🔧 [PowerShellEditorServices #1076](https://github.com/PowerShell/PowerShellEditorServices/pull/1076) -
  Graduate PSReadLine feature and add UseLegacyReadLine.
- ⚙️ [PowerShellEditorServices #1075](https://github.com/PowerShell/PowerShellEditorServices/pull/1075) -
  Lock OmniSharp dependencies to v0.14.0. (Thanks @mholo65!)
- 🐛 [PowerShellEditorServices #1073](https://github.com/PowerShell/PowerShellEditorServices/pull/1073) -
  Fix prerelease version discovery and fix omnisharp change.
- 🐛 [PowerShellEditorServices #1065](https://github.com/PowerShell/PowerShellEditorServices/pull/1065) -
  Fix TEMP debugging.
- 🐛 [vscode-powershell #1753](https://github.com/PowerShell/PowerShellEditorServices/pull/1072) -
  Override PSRL ReadKey on Windows as well.
- 🚂 [PowerShellEditorServices #1056](https://github.com/PowerShell/PowerShellEditorServices/pull/1056) -
  Re-architect PowerShell Editor Services to use the Omnisharp LSP platform.

## v2019.5.0
### Wednesday, May 22, 2019
#### [vscode-PowerShell](https://github.com/PowerShell/vscode-PowerShell)

- ✨ [vscode-PowerShell #1945](https://github.com/PowerShell/vscode-PowerShell/pull/1945) -
  Edit snippets to support $TM_SELECTED_TEXT (Thanks @travis-c-lagrone!)
- 👷 [vscode-PowerShell #1942](https://github.com/PowerShell/vscode-PowerShell/pull/1942) -
  Stop supporting 6.0
- ✨ [vscode-PowerShell #1928](https://github.com/PowerShell/vscode-PowerShell/pull/1928) -
  Add RunCode command for CodeLens providers
- 🐛 [vscode-PowerShell #1927](https://github.com/PowerShell/vscode-PowerShell/pull/1927) -
  Fix change session by moving to async/await promise
- 🐛 [vscode-PowerShell #1925](https://github.com/PowerShell/vscode-PowerShell/pull/1925) -
  Fix error in HtmlContentView.ShowContent when no JS/CSS provided (Thanks @rkeithhill!)
- 📖 [vscode-PowerShell #1900](https://github.com/PowerShell/vscode-PowerShell/pull/1900) -
  Small update to Azure Data Studio marketplace README (Thanks @SQLvariant!)
- 💻 [vscode-PowerShell #1871](https://github.com/PowerShell/vscode-PowerShell/pull/1871) -
  Change CI to use Azure Pipelines
- 🐛 [vscode-PowerShell #1867](https://github.com/PowerShell/vscode-PowerShell/pull/1867) -
  Change whitespace settings to camelCase
- 🐛 [vscode-PowerShell #1852](https://github.com/PowerShell/vscode-PowerShell/pull/1852) -
  Turn `powershell.codeformatting.useCorrectCasing` setting off by default until PSScriptAnalyzer issues are fixed (Thanks @bergmeister!)
- 🐛 [vscode-powershell #1822](https://github.com/PowerShell/vscode-PowerShell/pull/1838) -
  Set featureFlag default to null so that it can be resolved by settings
- 🐛 [vscode-PowerShell #1837](https://github.com/PowerShell/vscode-PowerShell/pull/1837) -
  Don't use -EncodedCommand to start PowerShell on Windows
- 🐛 [vscode-PowerShell #1825](https://github.com/PowerShell/vscode-PowerShell/pull/1825) -
  Switch to current lowercase names for powershell and mdlint extensions (Thanks @rkeithhill!)
- 👷 [vscode-PowerShell #1823](https://github.com/PowerShell/vscode-PowerShell/pull/1823) -
  Update to official TSLint extension in extensions.json, old version deprecated (Thanks @rkeithhill!)

#### [PowerShellEditorServices](https://github.com/PowerShell/PowerShellEditorServices)

- 🚨 [PowerShellEditorServices #944](https://github.com/PowerShell/PowerShellEditorServices/pull/944) -
  Add integration testing module with simple tests to verify PSES starts and stops
- 🐛 [PowerShellEditorServices #954](https://github.com/PowerShell/PowerShellEditorServices/pull/955) -
  Ensure NamedPipeServerStream is assigned in Windows PowerShell
- ✨ [PowerShellEditorServices #952](https://github.com/PowerShell/PowerShellEditorServices/pull/952) -
  Update to PSReadLine 2.0.0-beta4
- ✨ [PowerShellEditorServices #877](https://github.com/PowerShell/PowerShellEditorServices/pull/877) -
  Add filtering for CodeLens and References (Thanks @glennsarti!)
- 👷 [PowerShellEditorServices #878](https://github.com/PowerShell/PowerShellEditorServices/pull/878) -
  Remove native named pipes implementation
- 🐛 [PowerShellEditorServices #946](https://github.com/PowerShell/PowerShellEditorServices/pull/946) -
  Rename to use async
- 👷 [PowerShellEditorServices #943](https://github.com/PowerShell/PowerShellEditorServices/pull/943) -
  Improvements to the log parsing module (Thanks @rkeithhill!)
- 🐛 [PowerShellEditorServices #908](https://github.com/PowerShell/PowerShellEditorServices/pull/908) -
  Fix issue with reference code lens not working with UNC paths (Thanks @rkeithhill!)
- 🐛 [vscode-powershell #1571](https://github.com/PowerShell/PowerShellEditorServices/pull/911) -
  Fix faulty netfx check
- 🐛 [PowerShellEditorServices #906](https://github.com/PowerShell/PowerShellEditorServices/pull/906) -
  Fix New-EditorFile with no folder or no files open
- ✨ [vscode-powershell #1398](https://github.com/PowerShell/PowerShellEditorServices/pull/902) -
  Improve path auto-completion (Thanks @rkeithhill!)
- 🐛 [PowerShellEditorServices #910](https://github.com/PowerShell/PowerShellEditorServices/pull/910) -
  Fix UseCorrectCasing to be actually configurable via `powershell.codeFormatting.useCorrectCasing` (Thanks @bergmeister!)
- 👷 [PowerShellEditorServices #909](https://github.com/PowerShell/PowerShellEditorServices/pull/909) -
  Use global.json to pin .Net Core SDK version and update it from 2.1.402 to 2.1.602 (Thanks @bergmeister!)
- 👷 [PowerShellEditorServices #903](https://github.com/PowerShell/PowerShellEditorServices/pull/903) -
  Move temp folder into repo to avoid state that causes build errors from time to time when rebuilding locally (and packages have updated) (Thanks @bergmeister!)
- 💻 [PowerShellEditorServices #904](https://github.com/PowerShell/PowerShellEditorServices/pull/904) -
  Add initial credscan configuation ymls for CI
- 🐛 [PowerShellEditorServices #901](https://github.com/PowerShell/PowerShellEditorServices/pull/901) -
  Switch to current lowercase names for powershell and mdlint exts (Thanks @rkeithhill!)

## v2.0.0-preview.3
### Wednesday, April 10, 2019
#### [vscode-powershell](https://github.com/powershell/vscode-powershell)

- [vscode-PowerShell #1838](https://github.com/PowerShell/vscode-PowerShell/pull/1838) -
  Set PSReadLine featureFlag default to null so that it can be resolved by settings
- [vscode-PowerShell #1825](https://github.com/PowerShell/vscode-PowerShell/pull/1825) -
  Switch to current lowercase names for powershell and mdlint recommended extensions (Thanks @rkeithhill!)
- [vscode-PowerShell #1823](https://github.com/PowerShell/vscode-PowerShell/pull/1823) -
  Update to official TSLint ext in extensions.json, old version deprecated (Thanks @rkeithhill!)

#### [PowerShellEditorServices](https://github.com/powershell/PowerShellEditorServices)

- [PowerShellEditorServices #909](https://github.com/PowerShell/PowerShellEditorServices/pull/909) -
  Use global.json to pin .Net Core SDK version and update it from 2.1.402 to 2.1.602 (Thanks @bergmeister!)
- [PowerShellEditorServices #903](https://github.com/PowerShell/PowerShellEditorServices/pull/903) -
  Move temp folder into repo to avoid state that causes build errors from time to time when rebuilding locally (and packages have updated) (Thanks @bergmeister!)

## v2.0.0-preview.2
### Friday, March 29, 2019

### Highlights

* `Write-Progress` work in the integrated console ⏰
* Support for [PSScriptAnalyzer 1.18](https://github.com/PowerShell/PSScriptAnalyzer/releases/tag/1.18.0) 📝
* The ability to debug any runspace in any process 🔎
* PSReadLine enabled by default on Windows 🎨
* (Bug fix!) You can open untitled workspaces/folders again! 🐛☠️

There are a lot more goodies in this version. Checkout the changelog below!

#### [vscode-powershell](https://github.com/powershell/vscode-powershell)

- [vscode-PowerShell #1794](https://github.com/PowerShell/vscode-PowerShell/pull/1794) -
  Make PSReadLine default on Windows
- [vscode-PowerShell #1741](https://github.com/PowerShell/vscode-PowerShell/pull/1741) -
  Update build to clear node modules directory (Thanks @corbob!)

#### [PowerShellEditorServices](https://github.com/powershell/PowerShellEditorServices)

- [PowerShellEditorServices #858](https://github.com/PowerShell/PowerShellEditorServices/pull/858) -
  Fix XUnit warnings that better assertion operators should be used. (Thanks @bergmeister!)
- [PowerShellEditorServices #859](https://github.com/PowerShell/PowerShellEditorServices/pull/859) -
  Upgrade PowerShellStandard.Library, PowerShell.SDK, NET.Test.SDK and Serilog NuGet packages to latest released version and enable AppVeyor build on any branch (Thanks @bergmeister!)

## v2.0.0-preview.1
### Wednesday, January 23, 2019

#### Preview builds of the PowerShell extension are now available in VSCode

We are excited to announce the PowerShell Preview extension in the VSCode marketplace!
The PowerShell Preview extension allows users on Windows PowerShell 5.1 and PowerShell Core 6 to get and test the latest updates
to the PowerShell extension and comes with some exciting features.

The PowerShell Preview extension is a substitute for the PowerShell extension so
both the PowerShell extension and the PowerShell Preview extension should not be enabled at the same time.

By having a preview channel, in addition to our existing stable channel, we can get new features out faster and get feedback faster from you, the users.

##### How to Get/Use the PowerShell Preview extension

If you dont already have VSCode, start [here](https://code.visualstudio.com/Docs/setup/setup-overview).

Once you have VSCode open, click `Clt+Shift+X` to open the extensions marketplace.
Next, type `PowerShell Preview` in the search bar.
Click `Install` on the `PowerShell Preview` page.
Finally, click `Reload` in order to refresh VSCode.

If you already have the PowerShell extension, please disable it to use the Powershell Preview extension.
To disable the PowerShell extension, find it in the Extensions sidebar view, specifically under the list of Enabled extensions,
Right-click on the PowerShell extension and select `Disable`.
Please note that it is important to only have either the PowerShell extension or the PowerShell Preview extension enabled at one time.
![How to Disable](https://github.com/PowerShell/powershell.github.io/blob/master/PowerShell-Blog/Images/disable-extension.jpg)

#### What the first preview contains

The v2.0.0-preview.1 version of the extension is built on .NET Standard
(enabling support for both Windows PowerShell and PowerShell Core from one assembly)

It also contains PSReadLine support in the integrated console for Windows behind a feature flag.
PSReadLine provides a consistent and rich interactive experience,
including syntax coloring and multi-line editing and history, in the PowerShell console, in Cloud Shell,
and now in VSCode terminal. For more information on the benefits of PSReadLine,
check out their [documentation](https://docs.microsoft.com/en-us/powershell/module/psreadline/about/about_psreadline?view=powershell-6).

HUGE thanks to @SeeminglyScience for all his amazing work getting PSReadLine working in PowerShell Editor Services!

#### Breaking Changes

As stated above, this version of the PowerShell extension only works with Windows PowerShell versions 5.1 and PowerShell Core 6.

#### [vscode-powershell](https://github.com/powershell/vscode-powershell)

- [vscode-PowerShell #1587](https://github.com/PowerShell/vscode-PowerShell/pull/1587) -
  Removed ShowOnlineHelp Command (Thanks @corbob!)

#### [PowerShellEditorServices](https://github.com/powershell/PowerShellEditorServices)

- [PowerShellEditorServices #792](https://github.com/PowerShell/PowerShellEditorServices/pull/792) -
  Add Async suffix to async methods (Thanks @dee-see!)
- [PowerShellEditorServices #775](https://github.com/PowerShell/PowerShellEditorServices/pull/775) -
  Removed ShowOnlineHelp Message (Thanks @corbob!)
- [PowerShellEditorServices #769](https://github.com/PowerShell/PowerShellEditorServices/pull/769) -
  Set Runspaces to use STA when running in Windows PowerShell
- [PowerShellEditorServices #741](https://github.com/PowerShell/PowerShellEditorServices/pull/741) -
  Migrate to netstandard2.0 and PSStandard
- [PowerShellEditorServices #672](https://github.com/PowerShell/PowerShellEditorServices/pull/672) -
  PSReadLine integration (Thanks @SeeminglyScience!)
