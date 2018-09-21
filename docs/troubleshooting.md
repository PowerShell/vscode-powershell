# Troubleshooting PowerShell Extension Issues

This document contains troubleshooting steps for commonly reported issues when using the
[PowerShell Extension] for Visual Studio Code.

## Script Analysis is Reporting False Errors

Script analysis is provided by the [PSScriptAnalyzer] project on GitHub.
Please [open an issue there] if you are getting fault script diagnostics
(red and green squiggly lines under PowerShell in scripts).

## Problems with Syntax Highlighting

PowerShell syntax highlighting is not performed by the [PowerShell Extension].
Instead syntax highlighting for VSCode, Atom, SublimeText and even GitHub is
provided by the [Editor Syntax] repository on GitHub. Please open any
[syntax highlighting issues there].

## Known Issues in the Extension

- Highlighting/completions/command history don't work as I expect in the
  Integrated Console - [#535]
  - The Integrated Console implements a [custom host]
    to work with VSCode, making it incompatible with
    [PSReadLine] (the module providing these features in regular PowerShell).
- Command history is not preserved when debugging in the Integrated Console -
  [#550]
  - This feature is also provided by [PSReadLine].
- Intellisense is slow - [#647]
  - This is a known issue that we've been chipping away at. There doesn't seem
    to be any one performance drain, but we've been trying to incrementally
    improve performance bit-by-bit everywhere.
- Variable renaming doesn't work properly - [#261]
  - PowerShell's usage of [dynamic scope] rather than [lexical scope]
    makes it [formally undecidable] to statically rename variables correctly
    (the only way to know for sure which `$x`s refer to the same variable is to
    run the PowerShell script).
    However, like with many features, we attempt a best effort.
- "Go to Definition" doesn't work through module imports - [#499]
  - Again this is a best-effort task.
- Completions don't cycle when <kbd>Tab</kbd> is pressed like in the ISE - [#25]
  - VSCode itself provides the user experience for completions, and they
    currently don't allow us to customize this.
- My command that opens a dialog does nothing - [#410 (comment)]
  - Check that the dialog hasn't opened behind VSCode. This is a known
    [VSCode issue].
- PowerShell classes don't have proper reference/symbol support - [#3]
  - To maintain compatibility with PowerShell v3/v4 we use an older
    PowerShell parsing API that does not support classes. A future version
    of the [PowerShell Extension] [will break this compatibility] to support
    classes, among other things.
- Document formatting takes a long time - [#984]
  - Document formatting is provided by [PSScriptAnalyzer], but there
    may be opportunities to improve our integration with it in the
    [PowerShell Extension] too.
- `Write-Progress` doesn't output to the console - [#140]

## Reporting an Issue

If you experience a problem with the [PowerShell Extension]:

1. Search through [existing issues] on GitHub.
   In some circumstances, an issue may already be closed due to
   a fix being merged but not yet released - so be sure to quickly
   check closed issues as well.
2. Most features are provided by the client-agnostic [PowerShell Editor Services]
   backend project that the extension leverages, so it's also worth a
   [look there].
3. If you don't see the issue you're experiencing, please [open a new issue].

## Opening a New Issue

If you experience an issue with the [PowerShell Extension] and can't find
an existing issue for it, [open an issue on us on GitHub].

You can also open an issue directly from VSCode by entering the
[Command Palette] with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
(<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) and running the
`PowerShell: Upload Bug Report to GitHub` command.

When opening an issue, keep in mind:

- The fastest way to fixing a bug is reproducing it, and reproducing it
  is easier with [more information].
- The issue templates are designed to help you provide all the information
  needed to solve your issue
- As Free and Open Source Software, the [PowerShell Extension] thrives on
  the contributions of community members &mdash; if you're interested in
  [tackling an issue], we always accept contributions and will help you
  through the entire process.

## Providing Information About Your Environment

For solving most issues, the following information is important to provide:

- Logs, which provide context for what was happening when the issue occurred
  - Before sending through logs, try and reproduce the issue with
    **log level set to Verbose** or **Diagnostic**. You can set this
    in the [VSCode Settings] (<kbd>Ctrl</kbd>+<kbd>,</kbd>) with:
    ```json
    "powershell.developer.editorServicesLogLevel": "Verbose"
    ```
    or for diagnostic logging:
    ```json
    "powershell.developer.editorServicesLogLevel": "Diagnostic"
    ```
    After you have captured the issue with the log level turned up,
    you may want to return it (since verbose logging can use disk space):
    ```json
    "powershell.developer.editorServicesLogLevel": "Normal"
    ```
  - Logs are located at
    ```powershell
    $HOME/.vscode[-insiders]/extensions/ms-vscode.powershell-<version>/logs/
    ```
    For example:

    ```powershell
    $HOME/vscode/extensions/ms-vscode.powershell-1.8.4/logs
    ```
  - In VSCode you can open and read the logs directly from the [Command Palette]
    (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>)
    with `PowerShell: Open PowerShell Extension Logs Folder`.
  - You can attach your logs to an issue by zipping them and drag/dropping
    them onto your open issue description in the browser.
  - If you prefer to share your logs privately, you can send them to
    vscode-powershell@microsoft.com. Please still open an issue though
    so we can track the work &mdash; other users may have the same issue.

- [Your VSCode version], obtained from the Integrated Console
  or PowerShell like this:

  ```shell
  code -v
  ```

  If you are using VSCode Insiders, use this command:

  ```shell
  code-insiders -v
  ```

  If VSCode is not on your path, you will get a message like

  ```text
  code: The term 'code' is not recognized as the name of a cmdlet, ...
  ```

  in this case, use the file menu in VSCode and choose `Help`>`About`
  (or `Code`>`About Visual Studio Code` on macOS) to get version information.

- [Your installed PowerShell Extension version]:

  ```shell
  code --list-extensions --show-versions
  ```

  With VSCode Insiders:

  ```shell
  code-insiders --list-extensions --show-versions
  ```

  If VSCode isn't on your path use the [Command Palette]
  (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) to enter
  `Extensions: Show Installed Extensions` and list your extensions.

- [Your PowerShell version table], which you can get
  from the Integrated Console:

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

- Operating System Information
  - Windows
    - Your Windows version (e.g. 10)
  - macOS
    - Your macOS version (e.g. High Sierra 10.13.6)
  - Linux
    - `uname -a`
    - Your distro and version (usually `lsb_release -a` is the best here)

### Note on Security

If you believe there is a security vulnerability in the [PowerShell Extension]
(or in [PowerShell Editor Services]), it **must** be reported directly to
secure@microsoft.com to allow for [Coordinated Vulnerability Disclosure].
**Only** open an issue if secure@microsoft.com has confirmed that filing
an issue on GitHub is appropriate.

[Editor Syntax]: https://github.com/PowerShell/EditorSyntax
[PSScriptAnalyzer]: https://github.com/PowerShell/PSScriptAnalyzer
[PSReadLine]: https://github.com/lzybkr/PSReadLine
[PowerShell Editor Services]: https://github.com/PowerShell/PowerShellEditorServices
[PowerShell Extension]: https:github.com/PowerShell/vscode-powershell

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
[syntax highlighting issues there]: https://github.com/PowerShell/EditorSyntax/issues/new
[tackling an issue]:./development.md
[VSCode issue]: https://github.com/Microsoft/vscode/issues/42356
[VSCode Settings]: https://code.visualstudio.com/docs/getstarted/settings
[will break this compatibility]: https://github.com/PowerShell/vscode-powershell/issues/1310
[Your installed PowerShell Extension version]: https://code.visualstudio.com/docs/editor/extension-gallery#_list-installed-extensions
[Your PowerShell version table]: http://www.powertheshell.com/topic/learnpowershell/firststeps/psversion/
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