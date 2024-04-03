# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

param(
    [Parameter(Mandatory)]
    [semver]$Version,

    [Parameter(Mandatory)]
    [string]$Changes
)

git diff --staged --quiet --exit-code
if ($LASTEXITCODE -ne 0) {
    throw "There are staged changes in the repository. Please commit or reset them before running this script."
}

if ($Version.Major -ne $(Get-Date).Year) {
    throw "Major version should be the current year!"
}

if ($Version.PreReleaseLabel) {
    if ($Version.Minor % 2 -eq 0) {
        throw "Minor version must be odd for pre-release!"
    }
} else {
    if ($Version.Minor % 2 -ne 0) {
        throw "Minor version must be even for pre-release!"
    }
}

$v = "$($Version.Major).$($Version.Minor).$($Version.Patch)"

$Path = "package.json"
$f = Get-Content -Path $Path
# NOTE: The prefix regex match two spaces exactly to avoid matching
# nested objects in the file.
$f = $f -replace '^(?<prefix>  "version":\s+")(.+)(?<suffix>",)$', "`${prefix}${v}`${suffix}"

# TODO: Bring this back when the marketplace supports it.
# if ($Version.PreReleaseLabel) {
#     $icon = "media/PowerShell_Preview_Icon.png"
# } else {
#     $icon = "media/PowerShell_Icon.png"
# }
# $f = $f -replace '^(?<prefix>  "icon":\s+")(.+)(?<suffix>",)$', "`${prefix}${icon}`${suffix}"

# NOTE: This is not a "preview" extension even when the version is a pre-release.
$f | Set-Content -Path $Path
git add $Path

[xml]$PsesProps = Get-Content ../PowerShellEditorServices/PowerShellEditorServices.Common.props
$PsesVersion = $PsesProps.Project.PropertyGroup.VersionPrefix
$PsesSuffix = $PsesProps.Project.PropertyGroup.VersionSuffix
if ($PsesSuffix) { $PsesVersion += "-$PsesSuffix" }

$Path = "CHANGELOG.md"
$Changelog = Get-Content -Path $Path
@(
    $Changelog[0..1]
    "## v$Version"
    "### $([datetime]::Now.ToString('dddd, MMMM dd, yyyy'))"
    ""
    "With PowerShell Editor Services [v$PsesVersion](https://github.com/PowerShell/PowerShellEditorServices/releases/tag/v$PsesVersion)!"
    ""
    $Changes
    ""
    "See more details at the GitHub Release for [v$Version](https://github.com/PowerShell/vscode-powershell/releases/tag/v$Version)."
    ""
    $Changelog[2..$Changelog.Length]
) | Set-Content -Encoding utf8NoBOM -Path $Path
git add $Path

git commit --edit --message "v$($Version): $Changes"
