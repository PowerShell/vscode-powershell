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
    $ModuleName = (Get-Item $PSScriptRoot\*.psd1)[0].BaseName

    # Path to the release notes file.  Set to $null if the release notes reside in the manifest file.
    $ReleaseNotesPath = "$PSScriptRoot\ReleaseNotes.md"

    # The directory used to publish the module from.  If you are using Git, the
    # $PublishDir should be ignored if it is under the workspace directory.
    $PublishDir = "$PSScriptRoot\Release\$ModuleName"

    # The following items will not be copied to the $PublishDir.
    # Add items that should not be published with the module.
    $Exclude = @(
        'Release',
        'Tests',
        '.git*',
        '.vscode',
        # The next three files are unique to this examples dir.
        'DebugTest.ps1',
        'Stop*.ps1',
        'Readme.md',
        (Split-Path $PSCommandPath -Leaf)
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

Task PublishImpl -depends Test -requiredVariables PublishDir, EncryptedApiKeyPath {
    $NuGetApiKey = Get-NuGetApiKey $NuGetApiKey $EncryptedApiKeyPath

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

    Publish-Module @publishParams -WhatIf
}

Task Test -depends Build {
    Import-Module Pester
    Invoke-Pester $PSScriptRoot
}

Task Build -depends Clean -requiredVariables PublishDir, Exclude, ModuleName {
    Copy-Item $PSScriptRoot\* -Destination $PublishDir -Recurse -Exclude $Exclude

    # Get contents of the ReleaseNotes file and update the copied module manifest file
    # with the release notes.
    # DO NOT USE UNTIL UPDATE-MODULEMANIFEST IS FIXED - HORRIBLY BROKEN RIGHT NOW.
    # if ($ReleaseNotesPath) {
    #     $releaseNotes = @(Get-Content $ReleaseNotesPath)
    #     Update-ModuleManifest -Path $PublishDir\${ModuleName}.psd1 -ReleaseNotes $releaseNotes
    # }
}

Task Clean -depends Init -requiredVariables PublishDir {
    # Sanity check the dir we are about to "clean".  If $PublishDir were to
    # inadvertently get set to $null, the Remove-Item commmand removes the
    # contents of \*.  That's a bad day.  Ask me how I know?  :-(
    if ($PublishDir.Contains($PSScriptRoot)) {
        Remove-Item $PublishDir\* -Recurse -Force
    }
}

Task Init -requiredVariables PublishDir {
   if (!(Test-Path $PublishDir)) {
       $null = New-Item $PublishDir -ItemType Directory
   }
}

Task StoreKey -requiredVariables EncryptedApiKeyPath {
    if (Test-Path $EncryptedApiKeyPath) {
        Remove-Item $EncryptedApiKeyPath
    }

    $null = Get-NuGetApiKey $NuGetApiKey $EncryptedApiKeyPath
    "The NuGetApiKey has been stored in $EncryptedApiKeyPath"
}

Task ShowKey -requiredVariables EncryptedApiKeyPath {
    $NuGetApiKey = Get-NuGetApiKey $NuGetApiKey $EncryptedApiKeyPath
    "The stored NuGetApiKey is: $NuGetApiKey"
}

Task ? -description 'Lists the available tasks' {
    "Available tasks:"
    $psake.context.Peek().tasks.Keys | Sort
}

###############################################################################
# Helper functions
###############################################################################
function Get-NuGetApiKey($NuGetApiKey, $EncryptedApiKeyPath) {
    $storedKey = $null
    if (!$NuGetApiKey) {
        if (Test-Path $EncryptedApiKeyPath) {
            $storedKey = Import-Clixml $EncryptedApiKeyPath | ConvertTo-SecureString
            $cred = New-Object -TypeName PSCredential -ArgumentList 'kh',$storedKey
            $NuGetApiKey = $cred.GetNetworkCredential().Password
            Write-Verbose "Retrieved encrypted NuGetApiKey from $EncryptedApiKeyPath"
        }
        else {
            $cred = Get-Credential -Message "Enter your NuGet API Key in the password field" -UserName "user"
            $apiKeySS = $cred.Password
            $NuGetApiKey = $cred.GetNetworkCredential().Password
        }
    }

    if (!$storedKey) {
        # Store encrypted NuGet API key to use for future invocations
        if (!$apiKeySS) {
            $apiKeySS = ConvertTo-SecureString -String $NuGetApiKey -AsPlainText -Force
        }

        $parentDir = Split-Path $EncryptedApiKeyPath -Parent
        if (!(Test-Path -Path $parentDir)) {
            $null = New-Item -Path $parentDir -ItemType Directory
        }

        $apiKeySS | ConvertFrom-SecureString | Export-Clixml $EncryptedApiKeyPath
        Write-Verbose "Stored encrypted NuGetApiKey to $EncryptedApiKeyPath"
    }

    $NuGetApiKey
}
