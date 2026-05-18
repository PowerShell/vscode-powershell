---
name: release
description: >
    Guide for preparing a release of the PowerShell VS Code extension. Use when
    asked to prepare a release, update the version, or create a release PR.
---

# Release Process

Read [docs/development.md](../../../docs/development.md) "Creating a Release" and "Versioning"
first — this skill only adds the agent-specific deltas.

Memory entries this skill depends on (load before starting):

- **`release infrastructure`** — ADO org, project, and pipeline IDs.
- **`release maintainers`** — the GitHub PR reviewer and the ADO release approver (two
  different people).

PSES leads the extension at every step: its module is embedded in the signed extension
build, so its release must land before the corresponding vscode-powershell action.

## Phase 1 — Prep

1. **Sync `main`** in both `../PowerShellEditorServices` and `vscode-powershell`:
   `git checkout main && git pull --ff-only origin main`.
2. **Propose version + summary.** In each repo run
   `git log --oneline $(git describe --tags --abbrev=0)..HEAD`, summarize user-visible
   changes, apply the rules from docs/development.md "Versioning", and confirm both
   versions and one-line summaries with the user before continuing.

## Phase 2 — GitHub release PRs

3. **Run `updateVersion.ps1`** in PSES first, then vscode-powershell:

    ```sh
    git checkout -B release
    pwsh -NoProfile -c '$env:GIT_EDITOR="true"; ./tools/updateVersion.ps1 -Version "<version>" -Changes "<summary>"'
    ```

4. **Push and open PRs.** `git push origin release`, then open a PR to `main` via the
   GitHub MCP `create_pull_request` tool. Title is the commit subject
   (`v<version>: <summary>`). DM the GitHub PR reviewer on Teams with both PR links.
5. **Enable auto-squash-merge** on both PRs:
   `gh pr merge --repo <owner>/<repo> <number> --squash --auto`.
6. **Wait for both PRs to merge** (`gh pr view ... --json state,statusCheckRollup`).
   Don't busy-loop — check, report, pause if it'll be a while.

## Phase 3 — Mirror to ADO

7. **Sync `main` and push to ADO `upstream`** in both repos (PSES first). The verify
   step must print the release commit subject (`v<version>: <summary>`); if it doesn't,
   the PR hasn't merged yet — stop and wait.

    ```sh
    git checkout main && git pull --ff-only origin main
    git log -1 --format=%s
    git push ado HEAD:upstream
    ```

8. **Open `upstream → main` PRs in ADO** with auto-complete enabled. The current `ado`
   MCP server doesn't reach our org, so use `az` (org/project from memory). Title is
   always `Integrate upstream changes`. Use **merge commit** (preserves GitHub history)
   and keep the `upstream` branch (re-pushed every release):

    ```sh
    az repos pr create --org <org> --project <project> --repository <repo> \
      --source-branch upstream --target-branch main \
      --title "Integrate upstream changes" --description "Integrate v<version> from GitHub upstream."
    az repos pr update --org <org> --id <pr-id> \
      --auto-complete true --squash false --delete-source-branch false
    ```

    DM the ADO release approver on Teams with both ADO PR links.

9. **Wait for both ADO PRs to complete**
   (`az repos pr show --org <org> --id <pr-id> --query status` returns `completed`).
   Auto-complete merges them once policy checks pass; phase 4 builds against
   `refs/heads/main` and will produce the wrong version if main hasn't been updated yet.

## Phase 4 — Signed pipelines

Each pipeline pauses at a manual approval stage before publishing. Notify the user
when each one reaches it. Use a detached watcher (`az pipelines runs show --id
<run-id>`) so polling survives across turns.

10. **Queue the PSES pipeline** on `refs/heads/main` with template parameters
    `Release=True OfficialBuild=True`. Notify the user when it reaches the approval
    stage, then wait for `result == succeeded`. On success the pipeline creates a
    draft GitHub Release in PSES.
11. **Queue the vscode-powershell pipeline** the same way. Notify the user at its
    approval stage. On success the pipeline creates a draft GitHub Release in
    vscode-powershell _and_ publishes the extension to the VS Code marketplace.

## Phase 5 — Publish GitHub releases (manual)

12. For each draft GitHub Release (PSES and vscode-powershell), populate the body via
    `gh release edit v<version> --repo <owner>/<repo> --generate-notes`. Send the user
    links to both drafts for review; they publish them manually. The marketplace push
    already happened in step 11.
