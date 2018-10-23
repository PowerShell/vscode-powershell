---
name: Script analysis or formatting bug report 🚦🖌️
about: Script analysis and formatting are provided by PSScriptAnalyzer. Before submitting a script analysis or formatting issue, check to see whether the issue lies with PSScriptAnalyzer or with the VSCode PowerShell extension.

---

<!--

Before submitting a formatting or script analysis issue,
please check the relevant PSScriptAnalyzer command in a PowerShell console *outside* of VSCode.

Script analysis issues:
```powershell
Invoke-ScriptAnalyzer -Path './path/to/your/script.ps1'
```

Formatting issues:
```powershell
Get-Content -Raw './path/to/your/script.ps1' | Invoke-Formatter
```

If the problem occurs in the console, please submit a new issue with [PSScriptAnalyzer](https://github.com/powershell/PSScriptAnalyzer/issues).

If it does not occur in the console, it may be a PowerShell extension bug -- please open an issue here.

(For information on using the PSScriptAnalyzer module, see [here](https://github.com/PowerShell/PSScriptAnalyzer#usage))

-->
