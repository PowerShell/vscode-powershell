# Copilot Instructions for vscode-powershell

## Updating NPM Packages

- Read [docs/development.md](../docs/development.md) "Tracking Upstream Dependencies" first
- Dependencies are split: `dependencies` + `devDependencies` for build, `optionalDependencies` for lint/test
- Remember to use `npm install --include=optional` since we also need to update lint and test dependencies
- The `.npmrc` uses an Azure Artifacts mirror; read its comments for authentication instructions
- After updating, verify: `npm run compile` (build), `npm run lint` (lint), `npm audit` (security)
- The ESLint packages (`eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`) should be updated together
- Fix any new lint warnings from updates to ESLint
- Use `npm audit` to identify vulnerabilities
- Do not use `npm audit fix --force` when a vulnerability is in a transitive dependency, instead add an `overrides` entry
