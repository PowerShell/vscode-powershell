---
name: interactive-extension-testing
description: >
    Guide for setting up the multi-root PowerShell VS Code extension/PSES dev
    workspace. Use when asked to open the dev workspace, interactively test the
    extension, set up PSES for F5 debugging, or open pwsh-extension-dev workspace.
---

# Interactive Extension Testing

Read [.github/copilot-instructions.md](../../../.github/copilot-instructions.md)
"Build, Lint, and Test" and "PSES and Cross-Repo Work" first — this skill only
adds the worktree setup details for hands-on F5 testing.

Use this when the goal is to open `pwsh-extension-dev.code-workspace` and run
**F5 → Launch Extension** against a locally-built PowerShellEditorServices (PSES).

## Prerequisites

- Follow `.github/copilot-instructions.md` for the repository build dependencies and the
  `modules/` symlink model.
- Confirm these commands are available: `pwsh`, `dotnet`, `code`, and the PowerShell
  `InvokeBuild` module.
- Have a PSES checkout that can be used as `<pses-checkout>`.

## Setup

1. **Build PSES first.** In `<pses-checkout>`, run the PSES build task (for example,
   `Invoke-Build Build`) so `<pses-checkout>/module/PowerShellEditorServices/bin`
   exists. Without that directory, the extension `Build` task in
   `vscode-powershell.build.ps1` asserts `Extension requires PSES`.
2. **Ensure the workspace can resolve the Server root.** The workspace defines
   `Client` as `<extension-repo>` and `Server` as `../PowerShellEditorServices`, so a
   worktree parent may need a sibling link:

    ```sh
    ln -s <pses-checkout> <extension-repo-parent>/PowerShellEditorServices
    ```

3. **Ensure the extension can load the runtime PSES module.** `modules/` is gitignored
   and should point at the built PSES module directory:

    ```sh
    ln -s <pses-checkout>/module <extension-repo>/modules
    ```

    In a normal sibling clone, `Invoke-Build RestoreEditorServices` in
    `vscode-powershell.build.ps1` creates this `modules` link and builds PSES. In a
    worktree or fresh checkout, create the sibling link first if `Get-EditorServicesPath`
    cannot resolve `../PowerShellEditorServices/PowerShellEditorServices.build.ps1`.

4. **Open the dev workspace:**

    ```sh
    cd <extension-repo>
    code pwsh-extension-dev.code-workspace
    ```

5. **Launch interactively.** In VS Code, use **F5 → Launch Extension**. The workspace
   also defines `Launch Extension - Temp Profile`; see `pwsh-extension-dev.code-workspace`
   for the current launch/task wiring.

## Verify

```sh
cd <extension-repo>
readlink modules
test -d modules/PowerShellEditorServices/bin
```

Then confirm F5 starts the extension host and attaches to PSES.

## Cleanup

Both links are reversible and not under version control: `modules` is gitignored, and the
sibling `PowerShellEditorServices` link lives outside `<extension-repo>`. Cleanup is just:

```sh
rm <extension-repo>/modules
rm <extension-repo-parent>/PowerShellEditorServices
```

## How It Resolves

Use `pwsh-extension-dev.code-workspace` as the source of truth for roots and launch
configs. Use `Get-EditorServicesPath`, `RestoreEditorServices`, and `Build` in
`vscode-powershell.build.ps1` as the source of truth for how the extension locates,
links, builds, and asserts the local PSES module.
