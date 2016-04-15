##############################################################################
# PREVIEW VERSION OF PSAKE SCRIPT FOR MODULE BUILD & PUBLISH TO THE PSGALLERY
##############################################################################
#
# We are hoping to add support for publishing modules to the PowerShell gallery
# and private repositories in a future release of this extension.  This is an
# early look at the approach we are considering which is to supply a
# PSake-based script that will:
#
# 1. Create a directory from which to publish your module.
# 2. Copy the appropriate module files to that directory excluding items like
#    the .vscode directory, Pester tests, etc. These are configurable in Build.ps1.
# 3. Verify all existing Pester tests pass.
# 4. Publish the module to the desired repository (defaulting to the PSGallery).
#
# Requirements: PSake.  If you don't have this module installed use the following
# command to install it:
#
# PS C:\> Install-Module PSake -Scope CurrentUser
#
##############################################################################
# This is a PSake script that supports the following tasks:
# clean, build, test and publish.  The default task is build.
#
# The publish task uses the Publish-Module command to publish
# to either the PowerShell Gallery (the default) or you can change
# the $Repository property to the name of an alternate repository.
#
# The test task invokes Pester to run any Pester tests in your
# workspace folder. Name your test scripts <TestName>.Tests.ps1
# and Pester will find and run the tests contained in the files.
#
# You can run this build script directly using the invoke-psake
# command which will execute the build task.  This task "builds"
# a temporary folder from which the module can be published.
#
# PS C:\> invoke-psake build.ps1
#
# You can run your Pester tests (if any) by running the following command.
#
# PS C:\> invoke-psake build.ps1 -taskList test
#
# You can execute the publish task with the following command. Note that
# the publish task will run the test task first. The Pester tests must pass
# before the publish task will run.  The first time you run the publish
# command, you will be prompted to enter your PowerShell Gallery NuGetApiKey.
# After entering the key, it is encrypted and stored so you will not have to
# enter it again.
#
# PS C:\> invoke-psake build.ps1 -taskList publish
#
# You can verify the stored and encrypted NuGetApiKey by running the following
# command. This will display your NuGetApiKey in plain text!
#
# PS C:\> invoke-psake build.ps1 -taskList showKey
#
# You can store a new NuGetApiKey with this command. You can leave off
# the -properties parameter and you'll be prompted for the key.
#
# PS C:\> invoke-psake build.ps1 -taskList storeKey -properties @{NuGetApiKey='test123'}
#

###############################################################################
# Customize these properties for your module.
###############################################################################
Properties {
    # The name of your module should match the basename of the PSD1 file.
    $ModuleName = (Get-Item $PSScriptRoot\*.psd1 |
                   Foreach-Object {$null = Test-ModuleManifest -Path $_ -ErrorAction SilentlyContinue; if ($?) {$_}})[0].BaseName

    # Path to the release notes file.  Set to $null if the release notes reside in the manifest file.
    $ReleaseNotesPath = "$PSScriptRoot\ReleaseNotes.md"

    # The directory used to publish the module from.  If you are using Git, the
    # $PublishRootDir should be ignored if it is under the workspace directory.
    $PublishRootDir = "$PSScriptRoot\Release"
    $PublishDir     = "$PublishRootDir\$ModuleName"

    # The following items will not be copied to the $PublishDir.
    # Add items that should not be published with the module.
    $Exclude = @(
        (Split-Path $PSCommandPath -Leaf),
        'Release',
        'Tests',
        '.git*',
        '.vscode',
        # These files are unique to this examples dir.
        'DebugTest.ps1',
        'PSScriptAnalyzerSettings.psd1',
        'Readme.md',
        'Stop*.ps1'
    )

    # Name of the repository you wish to publish to. Default repo is the PSGallery.
    $PublishRepository = $null

    # Your NuGet API key for the PSGallery.  Leave it as $null and the first time
    # you publish you will be prompted to enter your API key.  The build will
    # store the key encrypted in a file, so that on subsequent publishes you
    # will no longer be prompted for the API key.
    $NuGetApiKey = $null
    $EncryptedApiKeyPath = "$env:LOCALAPPDATA\vscode-powershell\NuGetApiKey.clixml"
}

###############################################################################
# Customize these tasks for performing operations before and/or after publish.
###############################################################################
Task PrePublish {
}

Task PostPublish {
}

###############################################################################
# Core task implementations - this possibly "could" ship as part of the
# vscode-powershell extension and then get dot sourced into this file.
###############################################################################
Task default -depends Build

Task Publish -depends Test, PrePublish, PublishImpl, PostPublish {
}

Task PublishImpl -depends Test -requiredVariables EncryptedApiKeyPath, PublishDir {
    if ($NuGetApiKey) {
        "Using script embedded NuGetApiKey"
    }
    elseif (Test-Path -LiteralPath $EncryptedApiKeyPath) {
        $NuGetApiKey = LoadAndUnencryptNuGetApiKey $EncryptedApiKeyPath
        "Using stored NuGetApiKey"
    }
    else {
        $cred = PromptUserForNuGetApiKeyCredential -DestinationPath $EncryptedApiKeyPath
        $NuGetApiKey = $cred.GetNetworkCredential().Password
        "The NuGetApiKey has been stored in $EncryptedApiKeyPath"
    }

    $publishParams = @{
        Path        = $PublishDir
        NuGetApiKey = $NuGetApiKey
    }

    if ($PublishRepository) {
        $publishParams['Repository'] = $PublishRepository
    }

    # Consider not using -ReleaseNotes parameter when Update-ModuleManifest has been fixed.
    if ($ReleaseNotesPath) {
        $publishParams['ReleaseNotes'] = @(Get-Content $ReleaseNotesPath)
    }

    "Calling Publish-Module..."
    Publish-Module @publishParams -WhatIf
}

Task Test -depends Build {
    Import-Module Pester
    Invoke-Pester $PSScriptRoot
}

Task Build -depends Clean, Init -requiredVariables PublishDir, Exclude, ModuleName {
    Copy-Item -Path $PSScriptRoot\* -Destination $PublishDir -Recurse -Exclude $Exclude

    # Get contents of the ReleaseNotes file and update the copied module manifest file
    # with the release notes.
    # DO NOT USE UNTIL UPDATE-MODULEMANIFEST IS FIXED - DOES NOT HANDLE SINGLE QUOTES CORRECTLY.
    # if ($ReleaseNotesPath) {
    #     $releaseNotes = @(Get-Content $ReleaseNotesPath)
    #     Update-ModuleManifest -Path $PublishDir\${ModuleName}.psd1 -ReleaseNotes $releaseNotes
    # }
}

Task Clean -requiredVariables PublishRootDir {
    # Sanity check the dir we are about to "clean".  If $PublishRootDir were to
    # inadvertently get set to $null, the Remove-Item commmand removes the
    # contents of \*.  That's a bad day.  Ask me how I know?  :-(
    if ((Test-Path $PublishRootDir) -and $PublishRootDir.Contains($PSScriptRoot)) {
        Remove-Item $PublishRootDir\* -Recurse -Force
    }
}

Task Init -requiredVariables PublishDir {
    if (!(Test-Path $PublishDir)) {
        $null = New-Item $PublishDir -ItemType Directory
    }
}

Task RemoveKey -requiredVariables EncryptedApiKeyPath {
    if (Test-Path -LiteralPath $EncryptedApiKeyPath) {
        Remove-Item -LiteralPath $EncryptedApiKeyPath
    }
}

Task StoreKey -requiredVariables EncryptedApiKeyPath {
    $nuGetApiKeyCred = PromptUserForNuGetApiKeyCredential -DestinationPath $EncryptedApiKeyPath
    "The NuGetApiKey has been stored in $EncryptedApiKeyPath"
}

Task ShowKey -requiredVariables EncryptedApiKeyPath {
    if ($NuGetApiKey) {
        "The embedded (partial) NuGetApiKey is: $($NuGetApiKey[0..7])"
    }
    else {
        $NuGetApiKey = LoadAndUnencryptNuGetApiKey -Path $EncryptedApiKeyPath
        "The stored (partial) NuGetApiKey is: $($NuGetApiKey[0..7])"
    }

    "To see the full key, use the task 'ShowFullKey'"
}

Task ShowFullKey -requiredVariables EncryptedApiKeyPath {
    if ($NuGetApiKey) {
        "The embedded NuGetApiKey is: $NuGetApiKey"
    }
    else {
        $NuGetApiKey = LoadAndUnencryptNuGetApiKey -Path $EncryptedApiKeyPath
        "The stored NuGetApiKey is: $NuGetApiKey"
    }
}

Task ? -description 'Lists the available tasks' {
    "Available tasks:"
    $PSake.Context.Peek().Tasks.Keys | Sort-Object
}

###############################################################################
# Helper functions
###############################################################################
function PromptUserForNuGetApiKeyCredential {
    [Diagnostics.CodeAnalysis.SuppressMessage("PSProvideDefaultParameterValue", '')]
    param(
        [Parameter()]
        [ValidateNotNullOrEmpty()]
        [string]
        $DestinationPath
    )

    $message = "Enter your NuGet API Key in the password field (or nothing, this isn't used yet in the preview)"
    $nuGetApiKeyCred = Get-Credential -Message $message -UserName "ignored"

    if ($DestinationPath) {
        EncryptAndSaveNuGetApiKey -NuGetApiKeySecureString $nuGetApiKeyCred.Password -Path $DestinationPath
    }

    $nuGetApiKeyCred
}

function EncryptAndSaveNuGetApiKey {
    [Diagnostics.CodeAnalysis.SuppressMessage("PSAvoidUsingConvertToSecureStringWithPlainText", '')]
    [Diagnostics.CodeAnalysis.SuppressMessage("PSProvideDefaultParameterValue", '')]
    param(
        [Parameter(Mandatory, ParameterSetName='SecureString')]
        [ValidateNotNull()]
        [SecureString]
        $NuGetApiKeySecureString,

        [Parameter(Mandatory, ParameterSetName='PlainText')]
        [ValidateNotNullOrEmpty()]
        [string]
        $NuGetApiKey,

        [Parameter(Mandatory)]
        $Path
    )

    if ($PSCmdlet.ParameterSetName -eq 'PlainText') {
        $NuGetApiKeySecureString = ConvertTo-SecureString -String $NuGetApiKey -AsPlainText -Force
    }

    $parentDir = Split-Path $Path -Parent
    if (!(Test-Path -LiteralPath $parentDir)) {
        $null = New-Item -Path $parentDir -ItemType Directory
    }
    elseif (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path
    }

    $NuGetApiKeySecureString | ConvertFrom-SecureString | Export-Clixml $Path
    Write-Verbose "The NuGetApiKey has been encrypted and saved to $Path"
}

function LoadAndUnencryptNuGetApiKey {
    [Diagnostics.CodeAnalysis.SuppressMessage("PSProvideDefaultParameterValue", '')]
    param(
        [Parameter(Mandatory)]
        [ValidateNotNullOrEmpty()]
        [string]
        $Path
    )

    $storedKey = Import-Clixml $Path | ConvertTo-SecureString
    $cred = New-Object -TypeName PSCredential -ArgumentList 'jpgr',$storedKey
    $cred.GetNetworkCredential().Password
    Write-Verbose "The NuGetApiKey has been loaded and unencrypted from $Path"
}
