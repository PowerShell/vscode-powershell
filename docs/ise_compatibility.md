# ISE Compatibility

While the PowerShell extension for VSCode does not seek
100% compatibility/reproduction of features in the PowerShell ISE,
there are features in place to make the VSCode experience more natural
for users of the ISE.

This document tries to list settings you can configure in VSCode
to make the user experience a bit more familiar compared to the ISE.

## Key bindings

| Function                     | ISE Binding                  | VSCode Binding                              |
| ----------------             | -----------                  | --------------                              |
| Interrupt and break debugger | <kbd>Ctrl</kbd>+<kbd>B</kbd> | <kbd>F6</kbd>                               |
| Execute current line         |                              | <kbd>F8</kbd>                               |
| List available snippets      |                              | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>J</kbd> |

## Tab-completion

To enable more ISE-like tab-completion, add this setting:

```json
"editor.tabCompletion": "on"
```

This is a setting added directly to VSCode (rather than in the extension),
so its behavior is determined by VSCode directly and cannot be changed by the extension.

## No focus on console when executing

To keep the focus in the editor when you execute with <kbd>F8</kbd>:

```json
"powershell.integratedConsole.focusConsoleOnExecute": false
```

The default is `true` for accessibility purposes.

## Do not start integrated console on startup

To stop the integrated console on startup, set:

```json
"powershell.integratedConsole.showOnStartup": false
```

Note that the background PowerShell process will still start,
since that provides intellisense, script analysis, symbol navigation, etc.
But the console will not be shown.

## Colorscheme

There are a number of ISE themes available for VSCode
to make the editor look much more like the ISE.

In the Command Palette (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>)
type `theme` to get `Preferences: Color Theme` and press <kbd>Enter</kbd>.
In the drop down list, select `PowerShell ISE`.

## Show-Command

Thanks to the work of [@corbob](https://github.com/corbob),
the PowerShell extension has its own command explorer.

In the Command Palette (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>),
enter `PowerShell Command Explorer` and press <kbd>Enter</kbd>.

## Open in the ISE

If, after everything, you want to open a file in the ISE,
you can use <kbd>Shift</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd>.

## Other resources

- 4sysops has [a great article](https://4sysops.com/archives/make-visual-studio-code-look-and-behave-like-powershell-ise/)
  on configuring VSCode to be more like the ISE.

## More settings

If you know of more ways to make VSCode feel more familiar
for ISE users, please contribute to this doc.
If there's a compatibility configuration you're looking for,
but you can't find any way to enable it,
please [open an issue](https://github.com/PowerShell/vscode-powershell/issues/new/choose)
and ask away!

We are always happy to accept PRs and contributions as well!