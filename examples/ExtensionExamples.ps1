# Instructions: select the entire file and hit F8 to
# load the extensions.  To see the list of registered
# extensions and run them, hit Ctrl+Shift+P, type 'addi'
# and run the "Show additional commands from PowerShell modules"
# command.  A quick pick list will appear with all 3
# extensions registered.  Selecting one of them will launch it.

function Invoke-MyCommand {
    Write-Output "My command's function was executed!"
}

# Registering a command for an existing function

Register-EditorCommand -Verbose `
   -Name "MyModule.MyCommandWithFunction" `
   -DisplayName "My command with function" `
   -Function Invoke-MyCommand

# Registering a command to run a ScriptBlock

Register-EditorCommand -Verbose `
   -Name "MyModule.MyCommandWithScriptBlock" `
   -DisplayName "My command with script block" `
   -ScriptBlock { Write-Output "My command's script block was executed!" }

# A real command example:

function Invoke-MyEdit([Microsoft.PowerShell.EditorServices.Extensions.EditorContext]$context) {

    # Insert text at pre-defined position

    $context.CurrentFile.InsertText(
        "`r`n# I was inserted by PowerShell code!`r`nGet-Process -Name chrome`r`n",
        35, 1);

    # TRY THIS ALSO, comment out the above 4 lines and uncomment the below

    # # Insert text at cursor position

    # $context.CurrentFile.InsertText(
    #     "Get-Process -Name chrome",
    #     $context.CursorPosition);
}

# After registering this command, you only need to re-evaluate the
# Invoke-MyEdit command when you've made changes to its code.  The
# registration of the command persists.

Register-EditorCommand -Verbose `
   -Name "MyModule.MyEditCommand" `
   -DisplayName "Apply my edit!" `
   -Function Invoke-MyEdit `
   -SuppressOutput
