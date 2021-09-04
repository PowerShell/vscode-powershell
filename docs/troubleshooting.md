# Troubleshooting PowerShell Extension Issues

This document contains troubleshooting steps for commonly reported issues when using the
[PowerShell Extension] for Visual Studio Code.

## How do I debug my PowerShell script?

This topic is best covered in the "Debugging PowerShell Script in Visual Studio Code"
Scripting Guys blog posts (thanks community!):

* [Part 1](https://blogs.technet.microsoft.com/heyscriptingguy/2017/02/06/debugging-powershell-script-in-visual-studio-code-part-1/)
* [Part 2](https://blogs.technet.microsoft.com/heyscriptingguy/2017/02/13/debugging-powershell-script-in-visual-studio-code-part-2/)

## Script analysis is reporting false errors

Script analysis is provided by the [PSScriptAnalyzer] project on GitHub. If the warning
message starts with `[PSScriptAnalyzer]` or if you are getting faulty script diagnostics
(red and green squiggly lines under PowerShell in scripts) please [open an issue there].

## Double-click isn't selecting the whole variable

Visual Studio Code provides a default set of word separators, that is,
characters that split words and so affect double-click selections. The editor's
defaults include both `-` and `$`. In [v2021.5.1] we started providing a default
value for PowerShell files that excludes these two symbols. The intention of
this change was to increase predictability, as double-clicking PowerShell
symbols would now select the same portion that the extension highlights as well
as align with collected user feedback.

Different users have a variety of different preferences around these word
selection settings and you can easily configure your own [word separators] in
Visual Studio Code's settings.

We exclude `-` by default because unlike programming languages that use
`CamelCase` or `snake_case`, PowerShell uses a `Verb-Noun` style where dashes
are part of many symbol names (like underscores in other languages). So by
excluding it we configure Visual Studio Code to treat `Verb-Noun` as one
symbol/word, which matches what the extension semantically highlights when the
cursor is placed within it.

We briefly excluded `$` by default too because PowerShell uses it as a prefix
for variable substition, and many users were already excluding it. However, we
could not find a strong consensus [#3378], so we reverted this exclusion.

To set the word separator behavior to separate words in PowerShell on `-` and
`$` add the following entry to the Visual Studio Code's `settings.json`:

```json
"[powershell]": {
    "editor.wordSeparators": "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?"
}
```

This will cause `-` and `$` to register as word boundaries, meaning for example
that double-clicking on a letter in `$MyVariable` will not select the `$` and on
the `G` in `Get-Process` will only select `Get` rather than the verb and noun.

Users may also wish to set Visual Studio Code's integrated terminal's word separators (a
separate setting) to exclude `-` to mirror the behavior in the terminal. This will apply
to _all_ terminals, not just PowerShell terminals.

```json
"terminal.integrated.wordSeparators": " ()[]{}',\"`─"
```

## Problems with syntax highlighting

PowerShell syntax highlighting is performed in combintation by the [PowerShell Extension]
(semantic highlighting) and [Editor Syntax]. Syntax highlighting for VS Code, Atom,
SublimeText and even GitHub is provided by the [Editor Syntax] repository on GitHub.

We introducted [Semantic Highlighting] in [v2021.2.2], a feature that applies tokenized
colors at a layer above [Editor Syntax]. However, after [community feedback][#3221] and
multiple bug reports (including colors changing unexpectedly and [randomly][#3295]), we
have decided to disable it by default.

To enable semantic highlighting and use this "experimental" feature, set:

```json
"[powershell]": {
    "editor.semanticHighlighting.enabled": false
}
```

If you enable it, you can customize the colors used for the various tokens. See [#3221]
for more info and to leave suggestions.

If it is disabled and your issue remains, then please open those syntax highlighting
issues there in [Editor Syntax].

## Windows aren't appearing

Due to an [issue](https://github.com/Microsoft/vscode/issues/42356) in Electron, windows
spawned by Visual Studio Code (such as those for `Get-Credential`, `Connect-MsolService`,
`Connect-AzAccount`, `Connect-AzureAd`, etc.) do not appear above Visual Studio Code.

## Visual Studio Code is not working like the ISE

The PowerShell extension does not aim to perfectly recreate
the experience of the PowerShell ISE.
However, we do want to support compatibility whenever possible
to do so without breaking existing functionality.

Please see [the ISE compatibility doc](https://docs.microsoft.com/powershell/scripting/components/vscode/how-to-replicate-the-ise-experience-in-vscode)
for ways to configure VSCode to be closer to the ISE.

Bear in mind that many of the UI/UX aspects of VSCode are driven by
VSCode itself and can't be changed by the extension.
The VSCode maintainers are quite reasonable though,
and you can ask for new features [in their repository](https://github.com/Microsoft/vscode).

## Known issues in the extension

- If you are running the Preview version "PowerShell Preview" side-by-side with the stable version "PowerShell"
  you will experience performance and debug issues.
  This is expected until VSCode offers extension channels - [vscode#15756](https://github.com/Microsoft/vscode/issues/15756)
  - You MUST [DISABLE](https://code.visualstudio.com/docs/editor/extension-gallery#_disable-an-extension) one of them for the best performance.
    Docs on how to disable an extension can be found [here](https://code.visualstudio.com/docs/editor/extension-gallery#_disable-an-extension)
- "The Language Service could not be started" but it does start with the x86 version of PowerShell
  - Do you use Avecto/BeyondSoft?
    We've received reports that Avecto, BeyondSoft
    and other privilege management software
    dramatically slow down the start up of Windows PowerShell x64.
    Please give the privilege management software feedback.
    For some,
    [updating to the latest version has fixed the issue](https://github.com/PowerShell/vscode-powershell/issues/2526#issuecomment-638329157).
- IntelliSense is slow
  - This is a known issue that we've been chipping away at. There doesn't seem
    to be any one performance drain, but we've been trying to incrementally
    improve performance bit-by-bit everywhere. Currently we are focusing on [this issue](https://github.com/PowerShell/PowerShellEditorServices/issues/1295).
- Variable renaming doesn't work properly - [#261]
  - PowerShell's usage of [dynamic scope] rather than [lexical scope]
    makes it [formally undecidable] to statically rename variables correctly
    (the only way to know for sure which `$x`s refer to the same variable is to
    run the PowerShell script).
    However, like with many features, we attempt a best effort.
- "Go to Definition" doesn't work through module imports - [#499]
  - Again this is a best-effort task.
- Completions don't cycle when <kbd>Tab</kbd> is pressed like in the ISE - [#25]
  - [Use the tab comletion settings in VSCode](https://docs.microsoft.com/en-us/powershell/scripting/components/vscode/how-to-replicate-the-ise-experience-in-vscode?view=powershell-6#tab-completion)
- My command that opens a dialog does nothing - [#410 (comment)]
  - Check that the dialog hasn't opened behind VSCode. This is a known
    [VSCode issue].
- PowerShell classes don't have proper reference/symbol support - [#3]
  - One of the blockers for this was that we still supported Windows PowerShell v3 and v4. However, we don't support v3 and v4 anymore so we can do this work but it's not on the roadmap at this time.
- Document formatting takes a long time - [#984]
  - Document formatting is provided by [PSScriptAnalyzer], but there
    may be opportunities to improve our integration with it in the
    [PowerShell Extension] too.

## Reporting an issue

If you experience a problem with the [PowerShell Extension]:

1. Search through [existing issues] on GitHub.
   In some circumstances, an issue may already be closed due to
   a fix being merged but not yet released - so be sure to quickly
   check closed issues as well.
2. Most features are provided by the client-agnostic [PowerShell Editor Services]
   backend project that the extension leverages, so it's also worth a
   [look there].
3. If you don't see the issue you're experiencing, please [open a new issue].

## Opening a new issue

If you experience an issue with the [PowerShell Extension] and can't find
an existing issue for it, [open an issue on us on GitHub].

You can also open an issue directly from VSCode by entering the
[Command Palette] with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
(<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> on macOS) and running the
`PowerShell: Upload Bug Report to GitHub` command.

When opening an issue, keep in mind:

- The fastest way to fixing a bug is reproducing it, and reproducing it
  is easier with [more information].
- The issue templates are designed to help you provide all the information
  needed to solve your issue
- As Free and Open Source Software, the [PowerShell Extension] thrives on
  the contributions of community members &mdash; if you're interested in
  [tackling an issue], we always accept contributions and will help you
  at every step.

## Reproducing the issue

To fix the issue, we need to be able to reproduce it.
To do that, we need:

- A small/minimal script or sequence of user steps that result in the problem occurring.
- A description of the behavior you are expecting.
- A description of the actual behavior that occurs.

In some cases, a GIF of the issue occuring is also very helpful.

When you open a new issue,
the GitHub issue template will have sections
to guide you through providing all of this information
as well as environment information discussed below.

## Providing information about your environment

For solving most issues, the following information is important to provide:

### Logs

Logs provide context for what was happening when the issue occurred.
**Note: You should skim through your logs for any sensitive information you would not like to share online**

- Before sending through logs, try and reproduce the issue with
  **log level set to Diagnostic**. You can set this
  in the [VSCode Settings] (<kbd>Ctrl</kbd>+<kbd>,</kbd>) with:

  ```json
  "powershell.developer.editorServicesLogLevel": "Diagnostic"
  ```

  After you have captured the issue with the log level turned up,
  you may want to return it (since verbose logging can use disk space):

  ```json
  "powershell.developer.editorServicesLogLevel": "Normal"
  ```

  Logs are located at

  ```powershell
  $HOME/.vscode[-insiders]/extensions/ms-vscode.powershell-<version>/logs/
  ```

  or if you're using the preview version of the extension

  ```powershell
  $HOME/.vscode[-insiders]/extensions/ms-vscode.powershell-preview-<version>/logs/
  ```

  For example:

  ```powershell
  $HOME/vscode/extensions/ms-vscode.powershell-2019.5.1/logs
  ```

- In VSCode you can open and read the logs directly from the [Command Palette]
  (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>)
  with `PowerShell: Open PowerShell Extension Logs Folder`.

> NOTE: Don't forget to also attach the [Language Server Protocol payload logs](#provide-language-server-protocol-payload-logs)!

- You can attach your logs to an issue by zipping them and drag/dropping
  them onto your open issue description in the browser.

- If you prefer to share your logs privately, you can send them to
  vscode-powershell@microsoft.com. Please still open an issue though
  so we can track the work &mdash; other users may have the same issue.

#### Provide Language Server Protocol payload logs

The PowerShell extension works mostly from sending and receiving messages from [PowerShell Editor Services](httos://github.com/PowerShell/PowerShellEditorServices).
In some cases, getting to the bottom of a bug will require looking at the payloads of these messages. To do this:

- Add the following setting to your settings file:

  ```json
  "powershell editor services.trace.server":"verbose"
  ```
  
> NOTE: While VSCode will not recognize and highlight it, it is a valid option and enables tracer logs on the server.

- Restart Visual Studio Code and reproduce the issue.

- Go into the "Output" panel (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd> or <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd>).

- In the drop down on the right, select "PowerShell Editor Services".

- Copy the entire contents of the Output panel and paste it into the GitHub issue in the browser.
At this point, you may delete the setting if you want.

- Again, if you prefer to share your logs privately, you can send them to
  vscode-powershell@microsoft.com. Please still open an issue though
  so we can track the work &mdash; other users may have the same issue.

### Visual Studio Code version

[Your VSCode version] can be obtained from the Integrated Console
or PowerShell like this:

```shell
code -v
```

If you are using VSCode Insiders, use this command:

```shell
code-insiders -v
```

You should get an output like:

```text
1.27.0
493869ee8e8a846b0855873886fc79d480d342de
x64
```

If VSCode is not on your path, you will get a message like

```text
code: The term 'code' is not recognized as the name of a cmdlet, ...
```

in this case, use the file menu in VSCode and choose `Help`>`About`
(or `Code`>`About Visual Studio Code` on macOS) to get version information.

### PowerShell extension version

[Your installed PowerShell Extension version] can similarly be found with:

```shell
code --list-extensions --show-versions
```

With VSCode Insiders:

```shell
code-insiders --list-extensions --show-versions
```

You should get an output like:

```text
DavidAnson.vscode-markdownlint@0.20.0
eamodio.gitlens@8.5.6
EditorConfig.EditorConfig@0.12.4
jchannon.csharpextensions@1.3.0
k--kato.docomment@0.1.2
ms-vscode.cpptools@0.18.1
ms-dotnettools.csharp@1.12.13
ms-vscode.PowerShell@2.0.0
twxs.cmake@0.0.17
vscodevim.vim@0.16.5
```

If VSCode isn't on your path use the [Command Palette]
(<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) to enter
`Extensions: Show Installed Extensions` and list your extensions.

### Editor Services version

To get the [PowerShell Editor Services] version, in the Integrated
Console, enter:

```powershell
> $psEditor.EditorServicesVersion
Major  Minor  Build  Revision
-----  -----  -----  --------
1      8      4      0
```

### PowerShell version table

You can get [your PowerShell version table] from the Integrated Console:

```powershell
> $PSVersionTable
Name                           Value
----                           -----
PSVersion                      6.1.0
PSEdition                      Core
GitCommitId                    6.1.0
OS                             Microsoft Windows 10.0.18242
Platform                       Win32NT
PSCompatibleVersions           {1.0, 2.0, 3.0, 4.0...}
PSRemotingProtocolVersion      2.3
SerializationVersion           1.1.0.1
WSManStackVersion              3.0
```

### Operating system information

- Windows - all needed information should already be in the `$PSVersionTable`
- macOS
  - Your macOS version (e.g. High Sierra 10.13.6)
- Linux
  - `uname -a`
  - Your distro and version (usually `lsb_release -a` is the best here)

### Note on security

If you believe there is a security vulnerability in the [PowerShell Extension]
(or in [PowerShell Editor Services]), it **must** be reported directly to
secure@microsoft.com to allow for [Coordinated Vulnerability Disclosure].
**Only** open an issue if secure@microsoft.com has confirmed that filing
an issue on GitHub is appropriate.

[Editor Syntax]: https://github.com/PowerShell/EditorSyntax
[PowerShell Editor Services]: https://github.com/PowerShell/PowerShellEditorServices
[PowerShell Extension]: https://github.com/PowerShell/vscode-powershell/
[PSScriptAnalyzer]: https://github.com/PowerShell/PSScriptAnalyzer

[Command Palette]: https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette
[Coordinated Vulnerability Disclosure]: https://technet.microsoft.com/security/dn467923
[custom host]: https://docs.microsoft.com/en-us/powershell/developer/hosting/custom-host-samples
[dynamic scope]: http://ig2600.blogspot.com/2010/01/powershell-is-dynamically-scoped-and.html
[existing issues]: https://github.com/PowerShell/vscode-powershell/issues
[formally undecidable]: https://en.wikipedia.org/wiki/Undecidable_problem
[lexical scope]: https://stackoverflow.com/questions/1047454/what-is-lexical-scope
[look there]: https://github.com/PowerShell/PowerShellEditorServices/issues
[more information]: #providing-information-about-your-environment
[open an issue]: https://github.com/PowerShell/vscode-powershell/issues/new/choose
[open a new issue]: #opening-a-new-issue
[open an issue there]: https://github.com/PowerShell/PSScriptAnalyzer/issues/new/choose
[open an issue on us on GitHub]: https://github.com/PowerShell/vscode-powershell/issues/new/choose
[Reporting Problems]: ../README.md#reporting-problems
[semantic highlighting]: https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide
[tackling an issue]: ./development.md
[v2021.2.2]: https://github.com/PowerShell/vscode-powershell/releases/tag/v2021.2.2
[v2021.5.1]: https://github.com/PowerShell/vscode-powershell/releases/tag/v2021.5.1
[VSCode issue]: https://github.com/Microsoft/vscode/issues/42356
[VSCode Settings]: https://code.visualstudio.com/docs/getstarted/settings
[will break this compatibility]: https://github.com/PowerShell/vscode-powershell/issues/1310
[word separators]: https://stackoverflow.com/questions/31632351/visual-studio-code-customizing-word-separators
[Your installed PowerShell Extension version]: https://code.visualstudio.com/docs/editor/extension-gallery#_list-installed-extensions
[your PowerShell version table]: http://www.powertheshell.com/topic/learnpowershell/firststeps/psversion/
[Your VSCode version]: https://code.visualstudio.com/docs/supporting/FAQ#_how-do-i-find-the-vs-code-version

[#3]: https://github.com/PowerShell/vscode-powershell/issues/3
[#25]: https://github.com/PowerShell/vscode-powershell/issues/25
[#140]: https://github.com/PowerShell/vscode-powershell/issues/140
[#261]: https://github.com/PowerShell/vscode-powershell/issues/261
[#410 (comment)]: https://github.com/PowerShell/vscode-powershell/issues/410#issuecomment-397531817
[#499]: https://github.com/PowerShell/vscode-powershell/issues/499
[#535]: https://github.com/PowerShell/vscode-powershell/issues/535
[#550]: https://github.com/PowerShell/vscode-powershell/issues/550
[#647]: https://github.com/PowerShell/vscode-powershell/issues/647
[#984]: https://github.com/PowerShell/vscode-powershell/issues/984
[#3221]: https://github.com/PowerShell/vscode-powershell/issues/3221#issuecomment-810563456
[#3295]: https://github.com/PowerShell/vscode-powershell/issues/3295
[#3378]: https://github.com/PowerShell/vscode-powershell/issues/3378
