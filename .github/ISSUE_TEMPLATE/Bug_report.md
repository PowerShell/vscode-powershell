---
name: Bug report 🐛
about: Report errors or unexpected behavior 🤔

---

<!--

BEFORE SUBMITTING A NEW ISSUE, PLEASE READ THE TROUBLESHOOTING DOCS!
https://github.com/PowerShell/vscode-powershell/tree/master/docs/troubleshooting.md

IMPORTANT: you can generate a bug report directly from the
PowerShell extension in Visual Studio Code by selecting
"PowerShell: Upload Bug Report to GitHub" from the command palette.

The more repro details you can provide, along with a zip
of the log files from your session, the better the chances
are for a quick resolution.

You may also want to record a GIF of the bug occurring and
attach it here by dropping the file into the description body.

-->

### System Details

<!--
To help diagnose your issue, the following details are helpful:
- Operating system name and version
- VS Code version
- PowerShell extension version
- Output from `$PSVersionTable`

To get this information, run the following expression in your Integrated Console and paste the output here inside the backticks below:

& {"### VSCode version: $(code -v)"; "`n### VSCode extensions:`n$(code --list-extensions --show-versions | Out-String)"; "`n### PSES version: $($pseditor.EditorServicesVersion)"; "`n### PowerShell version:`n$($PSVersionTable | Out-String)"}


If you are running VSCode Insiders, use this expression instead (and paste the result inside the backticks):

& {"### VSCode version: $(code-insiders -v)"; "`n### VSCode extensions:`n$(code-insiders --list-extensions --show-versions | Out-String)"; "`n### PSES version: $($pseditor.EditorServicesVersion)"; "`n### PowerShell version:`n$($PSVersionTable | Out-String)"}

-->

<!-- PowerShell output from above goes here -->
System Details Output
```

```

### Issue Description

I am experiencing a problem with...

#### Expected Behaviour

-- Description of what *should* be happening --

#### Actual Behaviour

-- Description of what actually happens --

### Attached Logs

Follow the instructions in the [troubleshooting docs](https://github.com/PowerShell/vscode-powershell/blob/master/docs/troubleshooting.md#logs)
about capturing and sending logs.
