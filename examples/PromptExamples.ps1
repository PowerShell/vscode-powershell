<# ------ Input Prompts ------ #>

$fields = @(
    New-Object "System.Management.Automation.Host.FieldDescription" "Input"
    New-Object "System.Management.Automation.Host.FieldDescription" "Input List"
)
$fields[1].SetParameterType([int[]])

$host.UI.Prompt("Caption", "Message", $fields)

Get-Credential
Get-Credential -Message "Test!"
Get-Credential -UserName "myuser" -Message "Password stealer"

$host.UI.PromptForCredential("Caption", "Message", $null, $null, [System.Management.Automation.PSCredentialTypes]::Default, [System.Management.Automation.PSCredentialUIOptions]::Default) 
$host.UI.PromptForCredential("Caption", "Message", "testuser", $null, [System.Management.Automation.PSCredentialTypes]::Default, [System.Management.Automation.PSCredentialUIOptions]::Default) 

Read-Host -AsSecureString
Read-Host -Prompt "Enter a secure string" -AsSecureString

$field = New-Object "System.Management.Automation.Host.FieldDescription" "SecureString"
$field.SetParameterType([SecureString])
$host.UI.Prompt("Caption", "Message", $field)

$field = New-Object "System.Management.Automation.Host.FieldDescription" "PSCredential"
$field.SetParameterType([PSCredential])
$host.UI.Prompt("Caption", "Message", $field)

<# ------ Choice Prompts ------ #>

$choices = @(
    New-Object "System.Management.Automation.Host.ChoiceDescription" "&Apple", "Apple"
    New-Object "System.Management.Automation.Host.ChoiceDescription" "&Banana", "Banana"
    New-Object "System.Management.Automation.Host.ChoiceDescription" "&Orange", "Orange"
)

# Single-choice prompt
$host.UI.PromptForChoice("Choose a fruit", "You may choose one", $choices, 1)

# Multi-choice prompt
$host.UI.PromptForChoice("Choose a fruit", "You may choose more than one", $choices, [int[]]@(0, 2))