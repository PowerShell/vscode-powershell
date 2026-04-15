---
name: release
description: >
    Guide for preparing a release of the PowerShell VS Code extension. Use when
    asked to prepare a release, update the version, or create a release PR.
---

# Release Process

Read [docs/development.md](../../../docs/development.md) "Creating a Release" and "Versioning" sections first.

## Agent-Actionable Steps (1–2)

1. Use `./tools/updateVersion.ps1 -Version "<version>" -Changes "<summary>"` in both repos
   (PSES first, then vscode-powershell). The script validates even/odd rules, updates
   `package.json` version, prepends a changelog entry (auto-including the PSES version from
   `../PowerShellEditorServices`), and creates a commit.
2. Push to an ephemeral `release` branch and open a PR to `main` on GitHub.

## Manual Steps (3–4)

These require Azure DevOps access and cannot be performed by an agent:

3. After merge, push `main` to the Azure DevOps remote (`ado HEAD:upstream`) to trigger signing pipelines.
4. Download and test assets from draft GitHub Releases, then publish.
