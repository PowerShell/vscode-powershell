# Troubleshooting PowerShell Extension Issues

This document contains troubleshooting steps for commonly reported issues when using the
[PowerShell Extension][] for Visual Studio Code.

## How do I change the PowerShell version?

Starting VS Code 1.65, extensions now use the [language status item API][] instead of
manually adding a button to the status bar. That means the PowerShell icon button in the
status bar now exists under the language status menu, which looks like: `{}`. You can then
pin the icon back to the status bar by hovering over that menu and clicking the pin
button. The PowerShell icon will show you the current session's version, and clicking it
will let you change to another session. The language status icon will only appear when the
active editor's language mode is PowerShell.

### Using Windows PowerShell 5.1

While we _highly encourage_ the use of [PowerShell Core 7.2][], if you must use Windows
PowerShell 5.1 we attempt to support it on a best-effort basis. Unfortunately, being two
major versions behind and in maintenance mode, Windows PowerShell is missing many of the
bug fixes and APIs we use to make the extension experience great. So please, if you can,
use PowerShell Core. That said, when using Windows PowerShell on older versions of the
Windows operating system, if the extension is failing to start (e.g. [#2571][]), try
installing [WMF 5.1][] and [.NET Framework 4.8][dotnet-framework].

## How do I debug my PowerShell script?

This topic is best covered in the "Debugging PowerShell Script in Visual Studio Code"
Scripting Guys blog posts (thanks community!):

* [Part 1](https://blogs.technet.microsoft.com/heyscriptingguy/2017/02/06/debugging-powershell-script-in-visual-studio-code-part-1/)
* [Part 2](https://blogs.technet.microsoft.com/heyscriptingguy/2017/02/13/debugging-powershell-script-in-visual-studio-code-part-2/)

## Script analysis is reporting false errors

Script analysis is provided by the [PSScriptAnalyzer][] project on GitHub. If the warning
message starts with `[PSScriptAnalyzer]` or if you are getting faulty script diagnostics
(red and green squiggly lines under PowerShell in scripts) please [open an issue there][].

## Completions aren't appearing

First, please ensure that the extension itself has properly started. Do this by opening
the PowerShell Extension Terminal and checking the value of the variable `$psEditor`,
it should return a version and other fields. If it does not, you're probably in a
different "PowerShell" terminal in VS Code, and not the PowerShell Extension Terminal.
So please open a bug about your extension failing to start instead.

If the extension _is_ started and the Extension Terminal functional, completions should appear! Please
double-check that your `editor.suggest.showFunctions` VS Code setting is `true`, as
setting it to `false` _will_ disable completions (from all extensions). You may also want
to check other related settings under "Text Editor -> Suggestions" in VS Code.

## Double-click isn't selecting the whole variable

VS Code provides a default set of word separators, that is, characters that split words
and so affect double-click selections. The editor's defaults include `-`, however we
exclude `-` for PowerShell documents because unlike programming languages that use
`CamelCase` or `snake_case`, PowerShell uses a `Verb-Noun` style where dashes are part of
many symbol names (like underscores in other languages). So by excluding it we configure
VS Code to treat `Verb-Noun` as one symbol/word, which matches what the extension
semantically highlights when the cursor is placed within it.

Users may also wish to set VS Code's integrated terminal's word separators (a separate
setting) to exclude `-` to mirror the behavior in the terminal. This will apply to _all_
terminals, not just PowerShell terminals.

```json
"terminal.integrated.wordSeparators": " ()[]{}',\"`─"
```

Different users have a variety of different preferences around these word selection
settings and you can easily configure your own [word separators][] in VS Code's settings.

To revert this behavior, add the following entry to the VS Code's `settings.json`:

```json
"[powershell]": {
    "editor.wordSeparators": "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?"
}
```

This will cause `-` to register as a word boundary, meaning for example on the `G` in
`Get-Process` will only select `Get` rather than the verb and noun `Get-Process`.

## Problems with syntax highlighting

PowerShell syntax highlighting is performed in combination by the [PowerShell Extension][]
(semantic highlighting) and [Editor Syntax][]. Syntax highlighting for VS Code, Atom,
SublimeText and even GitHub is provided by the [Editor Syntax][] repository on GitHub.

We introduced [Semantic Highlighting][] in [v2021.2.2][], a feature that applies tokenized
colors at a layer above [Editor Syntax][]. However, after [community feedback][#3221] and
multiple bug reports (including colors changing unexpectedly and [randomly][#3295]), we
have decided to disable it by default.

To enable semantic highlighting and use this "experimental" feature, set:

```json
"[powershell]": {
    "editor.semanticHighlighting.enabled": true
}
```

If you enable it, you can customize the colors used for the various tokens. See [#3221][]
for more info and to leave suggestions.

If it is disabled and your issue remains, then please open those syntax highlighting
issues there in [Editor Syntax][].

## Windows aren't appearing

Due to a known issue in [Electron][], windows spawned by VS Code (such as those for
`Get-Credential`, `Connect-MsolService`, `Connect-AzAccount`, `Connect-AzureAd`, etc.) do
not appear above VS Code. Use <kbd>Alt</kbd>+<kbd>Tab</kbd> on Windows or
<kbd>Cmd</kbd>+<kbd>Tab</kbd> on macOS to switch to the other window.

## Visual Studio Code is not working like the ISE

The [PowerShell Extension][] does not aim to perfectly recreate the experience of the
PowerShell ISE. However, we do want to support compatibility whenever possible to do so
without breaking existing functionality.

Please see the [ISE compatibility doc][] for ways to increase VS Code's similarity.

Bear in mind that many of the UI/UX aspects of VS Code are driven by VS Code itself and
can't be changed by the extension. The VS Code maintainers are quite reasonable though,
and you can ask for new features [in their repository](https://github.com/Microsoft/vscode).

## Known issues in the extension

* "CorruptZip: end of central directory record signature not found" when installing the
  extension, [#4474][].

  * Unfortunately it appears that a common corporate VPN with a firewall by Palo Alto is
    disrupting the download of the extension binary from the VS Code marketplace. Please
    reach out to your network administrators about this.

* "The Language Service could not be started" but it does start with the x86 version of
  PowerShell.

  * Do you use Avecto / BeyondSoft? We've received reports that Avecto, BeyondSoft and
    other privilege management software dramatically slow down the start up of Windows
    PowerShell x64. Please give the privilege management software feedback.

* `Write-Output` is broken in Windows PowerShell 5.1, [#3991][].

  * We seem to have recently narrowed this down! If `Start-Transcript` has been called
    within the Extension Terminal, say in your PowerShell profile, this will eventually
    cause output to no longer appear. Please try removing the call to `Start-Transcript`
    and restarting the extension. We are investigating a fix.

* Variable renaming doesn't work as expected, [#261][].

  * PowerShell's usage of [dynamic scope][] rather than [lexical scope][] makes it
    [formally undecidable][] to statically rename variables correctly (the only way to
    know for sure which `$x`s refer to the same variable is to run the PowerShell script).
    However, like with many features, we attempt a best effort.

* `$PSScriptRoot` is not populated when running a code block (via F8), [#633][].

  * This is by design. The value of `$PSScriptRoot` is only populated by PowerShell when
    the caller is a script. Since <kbd>F8</kbd> or "Run Selection" is essentially
    copy-pasting the selection into the terminal, it's behavior is the same as if you the
    user pasted it. That is, it's a block of code and not a script file, and therefore
    there is no relevant context to populate `$PSScriptRoot`.

* Completions don't cycle when <kbd>Tab</kbd> is pressed like in the ISE, [#25][].

  * Use the tab completion settings recommended in the [ISE compatibility doc][].

* My command that opens a dialog does nothing, [#410 (comment)][].

  * Check that the dialog hasn't opened behind VS Code. This is a known issue in
    [Electron][], the framework used by VS Code.

* Document formatting takes a long time, [#984][].

  * Document formatting is provided by [PSScriptAnalyzer][], but there may be
    opportunities to improve our integration with it in the extension too.

* PSReadLine throws an error ever so often, [#3701][].

  * This is a known issue due to the PowerShell eventing framework running registered
    `OnIdle` events outside of PowerShell Editor Service's dedicated PowerShell execution
    pipeline. Until we can disable event registration, you will need to avoid registering
    events in the first place.

  * A known work around includes unregistering from this event. `Get-EventSubscriber
    -Force -SourceIdentifier PowerShell.OnIdle -EA 0 | Unregister-Event -Force` can be run
    manually (or added to your profile) to avoid this bug.

  * Also see: [PowerShell Editor Services #1591](https://github.com/PowerShell/PowerShellEditorServices/issues/1591),
    [PSReadLine #3091](https://github.com/PowerShell/PSReadLine/issues/3091),
    and [Azure PowerShell #16585](https://github.com/Azure/azure-powershell/issues/16586).

## Reporting an issue

If you experience a problem with the PowerShell Extension:

1. Search through [existing issues][] on GitHub.

   In some circumstances, an issue may already be closed due to a fix being merged but not
   yet released - so be sure to quickly check closed issues as well.

2. Most features are provided by the client-agnostic [PowerShell Editor Services][]
   backend project that the extension leverages, so it's also worth a [look there][].

3. If you don't see the issue you're experiencing, please [open a new issue][].

## Opening a new issue

If you experience an issue with the PowerShell Extension and can't find an existing issue
for it, [open a new issue][].

You can also open an issue directly from VS Code by entering the [Command Palette][] with
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
(<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> on macOS) and running the `PowerShell:
Upload Bug Report to GitHub` command.

When opening an issue, keep in mind:

* The fastest way to fixing a bug is reproducing it, and reproducing it
  is easier with [more information][].

* The issue templates are designed to help you provide all the information needed to solve
  your issue, please fill out the entire questionnaire.

* As Open Source Software the [PowerShell Extension][] thrives on the contributions of
  community members! If you're interested in [tackling an issue][], we love accepting
  contributions and will help you at every step.

## Reproducing the issue

To fix the issue, we need to be able to reproduce it. To do that, we need:

* A small/minimal script or sequence of user steps that result in the problem occurring.
* A description of the behavior you are expecting.
* A description of the actual behavior that occurs.

In some cases, a GIF of the issue occurring is also very helpful.

When you [open a new issue][], the GitHub issue template will have sections to guide you
through providing all of this information as well as environment information discussed
below.

## Providing information about your environment

For solving most issues, the following information is important to provide:

### Logs

Logs provide context for what was happening when the issue occurred. **You should browse
your logs for any sensitive information you would not like to share online!**

* Before sending through logs, try and reproduce the issue with **log level set to
  Trace**. You can set this in the [VS Code Settings][]
  (<kbd>Ctrl</kbd>+<kbd>,</kbd>) with:

  ```json
  "powershell.developer.editorServicesLogLevel": "Trace"
  ```

* After you have captured the issue with the log level turned up, you may want to return
  it (since verbose logging can use disk space):

  ```json
  "powershell.developer.editorServicesLogLevel": "Normal"
  ```

* Logs are located at:
  * Unix: `~/.config/Code/User/globalStorage/ms-vscode.powershell/logs`.
  * Windows: `%APPDATA%\Code\User\globalStorage\ms-vscode.powershell\logs`

* In VS Code you can open and read the logs directly from the [Command Palette][]
  (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) with `PowerShell: Open PowerShell Extension Logs Folder`.

  > NOTE: Don't forget to also attach the [Language Server Protocol payload
  > logs](#provide-language-server-protocol-payload-logs)!

* You can attach your logs to an issue by zipping them and dragging and dropping them onto
  your open issue description in the browser.

* If you prefer to share your logs privately, you can send them to
  <vscode-powershell@microsoft.com>. **Please still open an issue though so we can track
  the work, and reference it in your email.**

#### Provide Language Server Protocol payload logs

A lot of the features of the PowerShell extension actually come from Visual Studio Code directly interacting with the [PowerShell Editor Services](https://github.com/PowerShell/PowerShellEditorServices) process via a [Language Server Protocol client](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#logging-support-for-language-server).
In some cases, getting to the bottom of a bug will require looking at the payloads of
these messages. To enable viewing these messages:

* Add the following setting to your settings file:

  ```json
  "powershell.trace.server":"verbose"
  ```

* Restart VS Code and reproduce the issue.

* Go into the "Output" panel (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd> or
  <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd>).

* In the drop down on the right, select "PowerShell Editor Services Client".

* Copy the entire contents of the Output panel and paste it into the GitHub issue in the
  browser. At this point, you may delete the setting if you want.

* Again, if you prefer to share your logs privately, you can send them to
  <vscode-powershell@microsoft.com>. **Please still open an issue though so we can track
  the work, and reference it in your email.**

### Visual Studio Code version

[Your VS Code version][] can be obtained from the Extension Terminal or any terminal:

```powershell
code --version
```

If you are using VS Code Insiders, substitute `code-insiders` for `code`.

You should get an output like:

```text
1.57.1
507ce72a4466fbb27b715c3722558bb15afa9f48
arm64
```

If VS Code is not on your path, you will get a message like:

```text
code: The term 'code' is not recognized as the name of a cmdlet, ...
```

In this case, use the file menu in VS Code and choose `Help` > `About` (or `Code` > `About
Visual Studio Code` on macOS) to get version information.

### PowerShell extension version

[Your installed PowerShell Extension version][] can similarly be found with:

```powershell
code --list-extensions --show-versions | Select-String powershell
```

You should get an output like:

```text
ms-vscode.powershell@2021.8.0
```

If VS Code isn't on your path, use the [Command Palette][]
(<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) to run `Extensions: Show Installed
Extensions` and list your extensions.

### Editor Services version

To get the [PowerShell Editor Services][] version, in the Extension Terminal, enter:

```powershell
> $psEditor.EditorServicesVersion
Major  Minor  Build  Revision
-----  -----  -----  --------
1      8      4      0
```

### PowerShell version table

You can get [your PowerShell version table][] from the Extension Terminal through the
variable `$PSVersionTable`:

```powershell
PS> $PSVersionTable

Name                           Value
----                           -----
PSVersion                      7.1.3
PSEdition                      Core
GitCommitId                    7.1.3
OS                             Darwin 20.4.0 Darwin Kernel
Platform                       Unix
PSCompatibleVersions           {1.0, 2.0, 3.0, 4.0…}
PSRemotingProtocolVersion      2.3
SerializationVersion           1.1.0.1
WSManStackVersion              3.0
```

### Operating system information

* Windows: all needed information should already be in the `$PSVersionTable`.
* macOS: your macOS version (e.g. High Sierra 10.13.6).
* Linux: Use `uname -a` and and `lsb_release -a`.

[Editor Syntax]: https://github.com/PowerShell/EditorSyntax
[PowerShell Editor Services]: https://github.com/PowerShell/PowerShellEditorServices
[PowerShell Extension]: https://github.com/PowerShell/vscode-powershell/
[PSScriptAnalyzer]: https://github.com/PowerShell/PSScriptAnalyzer

[Command Palette]: https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette
[dynamic scope]: http://ig2600.blogspot.com/2010/01/powershell-is-dynamically-scoped-and.html
[Electron]: https://github.com/Microsoft/vscode/issues/42356
[existing issues]: https://github.com/PowerShell/vscode-powershell/issues
[formally undecidable]: https://en.wikipedia.org/wiki/Undecidable_problem
[ISE compatibility doc]: https://docs.microsoft.com/powershell/scripting/components/vscode/how-to-replicate-the-ise-experience-in-vscode
[language status item API]: https://code.visualstudio.com/updates/v1_65#_language-status-items
[lexical scope]: https://stackoverflow.com/questions/1047454/what-is-lexical-scope
[look there]: https://github.com/PowerShell/PowerShellEditorServices/issues
[more information]: #providing-information-about-your-environment
[open a new issue]: https://github.com/PowerShell/vscode-powershell/issues/new/choose
[open an issue there]: https://github.com/PowerShell/PSScriptAnalyzer/issues/new/choose
[PowerShell Core 7.2]: https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows?view=powershell-7.2
[semantic highlighting]: https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide
[tackling an issue]: ./development.md
[v2021.2.2]: https://github.com/PowerShell/vscode-powershell/releases/tag/v2021.2.2
[VS Code Settings]: https://code.visualstudio.com/docs/getstarted/settings
[WMF 5.1]: https://docs.microsoft.com/en-us/powershell/scripting/windows-powershell/wmf/setup/install-configure
[dotnet-framework]: https://dotnet.microsoft.com/en-us/download/dotnet-framework
[word separators]: https://stackoverflow.com/questions/31632351/visual-studio-code-customizing-word-separators
[Your installed PowerShell Extension version]: https://code.visualstudio.com/docs/editor/extension-gallery#_list-installed-extensions
[your PowerShell version table]: http://www.powertheshell.com/topic/learnpowershell/firststeps/psversion/
[Your VS Code version]: https://code.visualstudio.com/docs/supporting/FAQ#_how-do-i-find-the-vs-code-version

[#25]: https://github.com/PowerShell/vscode-powershell/issues/25
[#4474]: https://github.com/PowerShell/vscode-powershell/issues/4474
[#3991]: https://github.com/PowerShell/vscode-powershell/issues/3991
[#261]: https://github.com/PowerShell/vscode-powershell/issues/261
[#410 (comment)]: https://github.com/PowerShell/vscode-powershell/issues/410#issuecomment-397531817
[#984]: https://github.com/PowerShell/vscode-powershell/issues/984
[#2571]: https://github.com/PowerShell/vscode-powershell/issues/2572
[#3221]: https://github.com/PowerShell/vscode-powershell/issues/3221#issuecomment-810563456
[#3295]: https://github.com/PowerShell/vscode-powershell/issues/3295
[#3701]: https://github.com/PowerShell/vscode-powershell/issues/3701
[#633]: https://github.com/PowerShell/vscode-powershell/issues/633
