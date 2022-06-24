# Awesome VSCode Snippets for PowerShell

> A curated list of awesome vscode snippets for PowerShell.

_Inspired by the [awesome](https://github.com/sindresorhus/awesome) lists, focusing on PowerShell snippets in VSCode_

[![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

## What are snippets

Code snippets are templates that make it easier to enter repeating code patterns, such as loops or conditional-statements.
The list of snippets below is not integrated into the extension. However, instead, users can add them to their own, custom snippets file.
Check out the [VSCode documentation on snippets](https://code.visualstudio.com/docs/editor/userdefinedsnippets). It provides an overview and instructions on how to author snippets. It's really simple - just a little bit of JSON.

_To contribute, check out our [guide here](#contributing)._

## Table of contents

| Snippet name | Description |
| --------- | ---------|
| [AssertMock](#assertmock) | _Creates assert mock Pester test_ |
| [AWSRegionDynamicParameter](#awsregiondynamicparameter) | _Creates a dynamic parameter of current AWS regions by @jbruett_ |
| [DataTable](#datatable) | _Creates a DataTable_ |
| [DateTimeWriteVerbose](#datetimewriteverbose) | _Write-Verbose with the time and date pre-pended to your message by @ThmsRynr_ |
| [DSC](#dsc) | __DSC snippets previously bundled in extension__ |
| [Examples](#examples) | __Examples previously bundled in extension__ |
| [Error-Terminating](#error-terminating) | _Create a full terminating error by @omniomi_ |
| [Exchange Online Connection](#exchange-online-connection) | _Create a connection to Exchange Online by @vmsilvamolina_ |
| [HTML header](#html-header) | _Add HTML header with the style tag by @vmsilvamolina_ |
| [MaxColumnLengthinDataTable](#maxcolumnlengthindatatable) | _Gets the max length of string columns in datatables_ |
| [New Azure Resource Group](#new-azure-resource-group) | _Create an Azure Resource group by @vmsilvamolina_ |
| [Parameter-Credential](#parameter-credential) | _Add a standard credential parameter to your function by @omniomi_ |
| [Pester](#pester) | __Pester snippets previously bundled in extension__ |
| [PesterTestForMandatoryParameter](#pestertestformandatoryparameter) | _Create Pester test for a mandatory parameter_ |
| [PesterTestForParameter](#pestertestforparameter) | _Create Pester test for parameter_ |
| [Send-MailMessage](#send-mailmessage) | _Send an mail message with the most common parameters by @fullenw1_ |

## Snippets

### AssertMock

Creates Assert Mock for Pester Tests by @SQLDBAWithABeard.

#### Snippet

```json
"AssertMock": {
    "prefix": "AssertMock",
    "body": [
        "$$assertMockParams = @{",
            "\t'CommandName' = '${1:Command}'",
            "\t'Times'       = ${2:1}",
            "\t'Exactly'     = $$true",
        "}",
        "Assert-MockCalled @assertMockParams"
    ],
    "description": "AssertMock snippet for Pestering"
}
```

### AWSRegionDynamicParameter

Creates a dynamic parameter of the current AWS regions. Includes parameter validation.

#### Snippet

```json
"AWSRegionDynamicParam": {
    "prefix": "aws_region",
    "body": [
        "DynamicParam {",
            "\t$ParamDictionary = New-Object System.Management.Automation.RuntimeDefinedParameterDictionary",
            "\t$CR_ParamName = 'Region'",
            "\t$CR_AttributeCollection = New-Object System.Collections.ObjectModel.Collection[System.Attribute]",
            "\t$CR_Attribute = New-Object System.Management.Automation.ParameterAttribute",
            "\t$CR_Attribute.HelpMessage = 'List all the regions to be included in the document'",
            "\t$CR_Attribute.Mandatory = $true",
            "\t$CR_Attribute.ValueFromPipelineByPropertyName = $true",
            "\t$CR_AttributeCollection.add($CR_Attribute)",
            "\t$CR_intRegions = Get-AWSRegion -IncludeChina | Select-Object -ExpandProperty Region",
            "\t$CR_intRegions += Get-AWSRegion -IncludeGovCloud | Select-Object -ExpandProperty Region",
            "\t$CR_intRegions = $CR_intRegions | Select-Object -Unique",
            "\t$CR_ValidateSetAttribute = New-Object System.Management.Automation.ValidateSetAttribute($CR_intRegions)",
            "\t$CR_AttributeCollection.add($CR_ValidateSetAttribute)",
            "\t$CR_Param = New-Object System.Management.Automation.RuntimeDefinedParameter($CR_ParamName, [String[]],$CR_AttributeCollection)",
            "\t$ParamDictionary.Add($CR_ParamName, $CR_Param)",
            "\treturn $paramDictionary",
        "\t}"
    ],
    "description": "A dynamic parameter that builds a list of AWS regions"
}
```

### DataTable

Quickly create a Data Table object by @SQLDBAWithABeard.

#### Snippet

```json
"DataTable": {
    "prefix": "DataTable",
    "body": [
        "# Create DataTable Object",
        "$$table = New-Object system.Data.DataTable $$TableName",

        "\r# Create Columns",
        "$$col1 = New-Object system.Data.DataColumn NAME1,([string])",
        "$$col2 = New-Object system.Data.DataColumn NAME2,([decimal])",

        "\r#Add the Columns to the table",
        "$$table.columns.add($$col1)",
        "$$table.columns.add($$col2)",

        "\r# Create a new Row",
        "$$row = $$table.NewRow() ",

        "\r# Add values to new row",
        "$$row.Name1 = 'VALUE'",
        "$$row.NAME2 = 'VALUE'",

        "\r#Add new row to table",
        "$$table.Rows.Add($$row)"
    ],
    "description": "Creates a Data Table Object"
}
```

### DateTimeWriteVerbose

Quickly add a `Write-Verbose` with the current date and time inserted before the message you're going to write to the verbose stream, by @ThmsRynr.

#### Snippet

```json
"DateTimeWriteVerbose": {
    "prefix": "dtwv",
    "body": [
        "Write-Verbose \"[$(Get-Date -format G)] ${1:message}\"$0"
    ],
    "description": "Pre-pend datetime for Write-Verbose"
}
```

### DSC

DSC snippets migrated from the extension.

```json
{
  "DSC Ensure Enum": {
    "prefix": "DSC Ensure enum",
    "description": "DSC Ensure enum definition snippet",
    "body": [
      "enum Ensure {",
      "\tAbsent",
      "\tPresent",
      "}",
      "$0"
    ]
  },
  "DSC Resource Provider (class-based)": {
    "prefix": "DSC resource provider (class-based)",
    "description": "Class-based DSC resource provider snippet",
    "body": [
      "[DscResource()]",
      "class ${ResourceName:NameOfResource} {",
      "\t[DscProperty(Key)]",
      "\t[string] $${PropertyName:KeyName}",
      "\t",
      "\t# Gets the resource's current state.",
      "\t[${ResourceName:NameOfResource}] Get() {",
      "\t\t${0:$TM_SELECTED_TEXT}",
      "\t\treturn \\$this",
      "\t}",
      "\t",
      "\t# Sets the desired state of the resource.",
      "\t[void] Set() {",
      "\t\t",
      "\t}",
      "\t",
      "\t# Tests if the resource is in the desired state.",
      "\t[bool] Test() {",
      "\t\t",
      "\t}",
      "}"
    ]
  },
  "DSC Resource Provider (function-based)": {
    "prefix": "DSC resource provider (function-based)",
    "description": "Function-based DSC resource provider snippet",
    "body": [
      "function Get-TargetResource {",
      "\tparam (",
      "\t)",
      "\t",
      "\t${0:$TM_SELECTED_TEXT}",
      "}",
      "function Set-TargetResource {",
      "\tparam (",
      "\t)",
      "\t",
      "}",
      "function Test-TargetResource {",
      "\tparam (",
      "\t)",
      "\t",
      "}"
    ]
  },
}
```

### Examples

Example snippets migrated from the extension.

```json
{
  "Example-Class": {
    "prefix": "ex-class",
    "description": "Example: class snippet with a constructor, property and a method",
    "body": [
      "class ${1:MyClass} {",
      "\t# Property: Holds name",
      "\t[String] \\$Name",
      "",
      "\t# Constructor: Creates a new MyClass object, with the specified name",
      "\t${1:MyClass}([String] \\$NewName) {",
      "\t\t# Set name for ${1:MyClass}",
      "\t\t\\$this.Name = \\$NewName",
      "\t}",
      "",
      "\t# Method: Method that changes \\$Name to the default name",
      "\t[void] ChangeNameToDefault() {",
      "\t\t\\$this.Name = \"DefaultName\"",
      "\t}",
      "}"
    ]
  },
  "Example-Cmdlet": {
    "prefix": "ex-cmdlet",
    "description": "Example: script cmdlet snippet with all attributes and inline help fields",
    "body": [
      "<#",
      ".SYNOPSIS",
      "\tShort description",
      ".DESCRIPTION",
      "\tLong description",
      ".EXAMPLE",
      "\tExample of how to use this cmdlet",
      ".EXAMPLE",
      "\tAnother example of how to use this cmdlet",
      ".INPUTS",
      "\tInputs to this cmdlet (if any)",
      ".OUTPUTS",
      "\tOutput from this cmdlet (if any)",
      ".NOTES",
      "\tGeneral notes",
      ".COMPONENT",
      "\tThe component this cmdlet belongs to",
      ".ROLE",
      "\tThe role this cmdlet belongs to",
      ".FUNCTIONALITY",
      "\tThe functionality that best describes this cmdlet",
      "#>",
      "function ${name:Verb-Noun} {",
      "\t[CmdletBinding(DefaultParameterSetName='Parameter Set 1',",
      "\t               SupportsShouldProcess=\\$true,",
      "\t               PositionalBinding=\\$false,",
      "\t               HelpUri = 'http://www.microsoft.com/',",
      "\t               ConfirmImpact='Medium')]",
      "\t[Alias()]",
      "\t[OutputType([String])]",
      "\tParam (",
      "\t\t# Param1 help description",
      "\t\t[Parameter(Mandatory=\\$true,",
      "\t\t           Position=0,",
      "\t\t           ValueFromPipeline=\\$true,",
      "\t\t           ValueFromPipelineByPropertyName=\\$true,",
      "\t\t           ValueFromRemainingArguments=\\$false, ",
      "\t\t           ParameterSetName='Parameter Set 1')]",
      "\t\t[ValidateNotNull()]",
      "\t\t[ValidateNotNullOrEmpty()]",
      "\t\t[ValidateCount(0,5)]",
      "\t\t[ValidateSet(\"sun\", \"moon\", \"earth\")]",
      "\t\t[Alias(\"p1\")] ",
      "\t\t\\$Param1,",
      "\t\t",
      "\t\t# Param2 help description",
      "\t\t[Parameter(ParameterSetName='Parameter Set 1')]",
      "\t\t[AllowNull()]",
      "\t\t[AllowEmptyCollection()]",
      "\t\t[AllowEmptyString()]",
      "\t\t[ValidateScript({\\$true})]",
      "\t\t[ValidateRange(0,5)]",
      "\t\t[int]",
      "\t\t\\$Param2,",
      "\t\t",
      "\t\t# Param3 help description",
      "\t\t[Parameter(ParameterSetName='Another Parameter Set')]",
      "\t\t[ValidatePattern(\"[a-z]*\")]",
      "\t\t[ValidateLength(0,15)]",
      "\t\t[String]",
      "\t\t\\$Param3",
      "\t)",
      "\t",
      "\tbegin {",
      "\t}",
      "\t",
      "\tprocess {",
      "\t\tif (\\$pscmdlet.ShouldProcess(\"Target\", \"Operation\")) {",
      "\t\t\t$0",
      "\t\t}",
      "\t}",
      "\t",
      "\tend {",
      "\t}",
      "}"
    ]
  },
  "Example-DSC Configuration": {
    "prefix": "ex-DSC config",
    "description": "Example: DSC configuration snippet that uses built-in resource providers",
    "body": [
      "configuration Name {",
      "\t# One can evaluate expressions to get the node list",
      "\t# E.g: \\$AllNodes.Where(\"Role -eq Web\").NodeName",
      "\tnode (\"Node1\",\"Node2\",\"Node3\")",
      "\t{",
      "\t\t# Call Resource Provider",
      "\t\t# E.g: WindowsFeature, File",
      "\t\tWindowsFeature FriendlyName",
      "\t\t{",
      "\t\t\tEnsure = \"Present\"",
      "\t\t\tName = \"Feature Name\"",
      "\t\t}",
      "",
      "\t\tFile FriendlyName",
      "\t\t{",
      "\t\t\tEnsure = \"Present\"",
      "\t\t\tSourcePath = \\$SourcePath",
      "\t\t\tDestinationPath = \\$DestinationPath",
      "\t\t\tType = \"Directory\"",
      "\t\t\tDependsOn = \"[WindowsFeature]FriendlyName\"",
      "\t\t}",
      "\t}",
      "}"
    ]
  },
  "Example-DSC Resource Provider (class-based)": {
    "prefix": "ex-DSC resource provider (class-based)",
    "description": "Example: class-based DSC resource provider snippet",
    "body": [
      "# Defines the values for the resource's Ensure property.",
      "enum Ensure {",
      "\t# The resource must be absent.",
      "\tAbsent",
      "\t# The resource must be present.",
      "\tPresent",
      "}",
      "",
      "# [DscResource()] indicates the class is a DSC resource.",
      "[DscResource()]",
      "class NameOfResource {",
      "\t# A DSC resource must define at least one key property.",
      "\t[DscProperty(Key)]",
      "\t[string] \\$P1",
      "\t",
      "\t# Mandatory indicates the property is required and DSC will guarantee it is set.",
      "\t[DscProperty(Mandatory)]",
      "\t[Ensure] \\$P2",
      "\t",
      "\t# NotConfigurable properties return additional information about the state of the resource.",
      "\t# For example, a Get() method might return the date a resource was last modified.",
      "\t# NOTE: These properties are only used by the Get() method and cannot be set in configuration.",
      "\t[DscProperty(NotConfigurable)]",
      "\t[Nullable[datetime]] \\$P3",
      "\t",
      "\t[DscProperty()]",
      "\t[ValidateSet(\"val1\", \"val2\")]",
      "\t[string] \\$P4",
      "\t",
      "\t# Gets the resource's current state.",
      "\t[NameOfResource] Get() {",
      "\t\t# NotConfigurable properties are set in the Get method.",
      "\t\t\\$this.P3 = something",
      "\t\t# Return this instance or construct a new instance.",
      "\t\treturn \\$this",
      "\t}",
      "\t",
      "\t# Sets the desired state of the resource.",
      "\t[void] Set() {",
      "\t}",
      "\t",
      "\t# Tests if the resource is in the desired state.",
      "\t[bool] Test() {",
      "\t\t return \\$true",
      "\t}",
      "}"
    ]
  },
  "Example-DSC Resource Provider (function based)": {
    "prefix": "ex-DSC resource provider (function based)",
    "description": "Example: function-based DSC resource provider snippet",
    "body": [
      "function Get-TargetResource {",
      "\t# TODO: Add parameters here",
      "\t# Make sure to use the same parameters for",
      "\t# Get-TargetResource, Set-TargetResource, and Test-TargetResource",
      "\tparam (",
      "\t)",
      "}",
      "function Set-TargetResource {",
      "\t# TODO: Add parameters here",
      "\t# Make sure to use the same parameters for",
      "\t# Get-TargetResource, Set-TargetResource, and Test-TargetResource",
      "\tparam (",
      "\t)",
      "}",
      "function Test-TargetResource {",
      "\t# TODO: Add parameters here",
      "\t# Make sure to use the same parameters for",
      "\t# Get-TargetResource, Set-TargetResource, and Test-TargetResource",
      "\tparam (",
      "\t)",
      "}"
    ]
  },
  "Example-Path Processing for No Wildcards Allowed": {
    "prefix": "ex-path processing for no wildcards allowed",
    "description": "Example: processing non-wildcard paths that must exist (for use in process block). See parameter-path snippets.",
    "body": [
      "# Modify [CmdletBinding()] to [CmdletBinding(SupportsShouldProcess=\\$true)]",
      "\\$paths = @()",
      "foreach (\\$aPath in \\$Path) {",
      "\tif (!(Test-Path -LiteralPath \\$aPath)) {",
      "\t\t\\$ex = New-Object System.Management.Automation.ItemNotFoundException \"Cannot find path '\\$aPath' because it does not exist.\"",
      "\t\t\\$category = [System.Management.Automation.ErrorCategory]::ObjectNotFound",
      "\t\t\\$errRecord = New-Object System.Management.Automation.ErrorRecord \\$ex,'PathNotFound',\\$category,\\$aPath",
      "\t\t\\$psCmdlet.WriteError(\\$errRecord)",
      "\t\tcontinue",
      "\t}",
      "",
      "\t# Resolve any relative paths",
      "\t\\$paths += \\$psCmdlet.SessionState.Path.GetUnresolvedProviderPathFromPSPath(\\$aPath)",
      "}",
      "",
      "foreach (\\$aPath in \\$paths) {",
      "\tif (\\$pscmdlet.ShouldProcess(\\$aPath, 'Operation')) {",
      "\t\t# Process each path",
      "\t\t$0",
      "\t}",
      "}"
    ]
  },
  "Example-Path Processing for Non-Existing Paths": {
    "prefix": "ex-path processing for non-existing paths",
    "description": "Example: processing non-existing paths typically used in New-* commands (for use in process block). See parameter-path snippet.",
    "body": [
      "# Modify [CmdletBinding()] to [CmdletBinding(SupportsShouldProcess=\\$true)]",
      "\\$paths = @()",
      "foreach (\\$aPath in \\$Path) {",
      "\t# Resolve any relative paths",
      "\t\\$paths += \\$psCmdlet.SessionState.Path.GetUnresolvedProviderPathFromPSPath(\\$aPath)",
      "}",
      "",
      "foreach (\\$aPath in \\$paths) {",
      "\tif (\\$pscmdlet.ShouldProcess(\\$aPath, 'Operation')) {",
      "\t\t# Process each path",
      "\t\t$0",
      "\t}",
      "}"
    ]
  },
  "Example-Path Processing for Wildcards Allowed": {
    "prefix": "ex-path processing for wildcards allowed",
    "description": "Example: processing wildcard paths that must exist (for use in process block). See parameter-path-wildcards and parameter-literalpath snippets.",
    "body": [
      "# Modify [CmdletBinding()] to [CmdletBinding(SupportsShouldProcess=\\$true, DefaultParameterSetName='Path')]",
      "\\$paths = @()",
      "if (\\$psCmdlet.ParameterSetName -eq 'Path') {",
      "\tforeach (\\$aPath in \\$Path) {",
      "\t\tif (!(Test-Path -Path \\$aPath)) {",
      "\t\t\t\\$ex = New-Object System.Management.Automation.ItemNotFoundException \"Cannot find path '\\$aPath' because it does not exist.\"",
      "\t\t\t\\$category = [System.Management.Automation.ErrorCategory]::ObjectNotFound",
      "\t\t\t\\$errRecord = New-Object System.Management.Automation.ErrorRecord \\$ex,'PathNotFound',\\$category,\\$aPath",
      "\t\t\t\\$psCmdlet.WriteError(\\$errRecord)",
      "\t\t\tcontinue",
      "\t\t}",
      "\t",
      "\t\t# Resolve any wildcards that might be in the path",
      "\t\t\\$provider = \\$null",
      "\t\t\\$paths += \\$psCmdlet.SessionState.Path.GetResolvedProviderPathFromPSPath(\\$aPath, [ref]\\$provider)",
      "\t}",
      "}",
      "else {",
      "\tforeach (\\$aPath in \\$LiteralPath) {",
      "\t\tif (!(Test-Path -LiteralPath \\$aPath)) {",
      "\t\t\t\\$ex = New-Object System.Management.Automation.ItemNotFoundException \"Cannot find path '\\$aPath' because it does not exist.\"",
      "\t\t\t\\$category = [System.Management.Automation.ErrorCategory]::ObjectNotFound",
      "\t\t\t\\$errRecord = New-Object System.Management.Automation.ErrorRecord \\$ex,'PathNotFound',\\$category,\\$aPath",
      "\t\t\t\\$psCmdlet.WriteError(\\$errRecord)",
      "\t\t\tcontinue",
      "\t\t}",
      "\t",
      "\t\t# Resolve any relative paths",
      "\t\t\\$paths += \\$psCmdlet.SessionState.Path.GetUnresolvedProviderPathFromPSPath(\\$aPath)",
      "\t}",
      "}",
      "",
      "foreach (\\$aPath in \\$paths) {",
      "\tif (\\$pscmdlet.ShouldProcess(\\$aPath, 'Operation')) {",
      "\t\t# Process each path",
      "\t\t$0",
      "\t}",
      "}"
    ]
  },
  "Example-Splatting": {
    "prefix": "ex-splat",
    "description": "Example: PowerShell splatting technique snippet",
    "body": [
      "\\$Params = @{",
      "\tModule = '*'",
      "\tVerb = 'Get'",
      "}",
      "Get-Command @Params"
    ]
  },
  "Example-Switch": {
    "prefix": "ex-switch",
    "description": "Example: switch statement snippet",
    "body": [
      "switch (${variable:\\$x})",
      "{",
      "\t'${val:value1}' { $1 }",
      "\t{\\$_ -in 'A','B','C'} {}",
      "\t'value3' {}",
      "\tDefault {}",
      "}"
    ]
  },
}
```

### Error-Terminating

Quickly add a fully defined error record and throw. by @omniomi

#### Snippet

```json
"Throw Terminating Error": {
    "prefix": "error-terminating",
    "body": [
        "\\$Exception     = New-Object ${1:System.ArgumentException} (\"${2:Invalid argument provided.}\")\r",
        "\\$ErrorCategory = [System.Management.Automation.ErrorCategory]::${3:InvalidArgument}\r",
        "# Exception, ErrorId as [string], Category, and TargetObject (e.g. the parameter that was invalid)\r",
        "\\$ErrorRecord   = New-Object System.Management.Automation.ErrorRecord(\\$Exception, '${4:InvalidArgument}', \\$ErrorCategory, ${5:\\$null})\r",
        "\\$PSCmdlet.ThrowTerminatingError(\\$ErrorRecord)"
    ],
    "description": "Throw a full terminating error."
}
```


### Exchange Online Connection

Connect to Exchange Online, by @vmsilvamolina.

#### Snippet

```json
"Exchange Online Connection": {
    "prefix": "ex-ExchangeOnlineConnection",
    "body": [
        "#Set Execution Policy",
	"Set-ExecutionPolicy RemoteSigned -Scope Process",
	"#Define credential",
	"\\$UserCredential = Get-Credential",
	"# Create the session",
	"\\$Session = New-PSSession -ConfigurationName Microsoft.Exchange -ConnectionUri https://outlook.office365.com/powershell-liveid/ -Credential \\$UserCredential -Authentication Basic -AllowRedirection",
	"Import-PSSession \\$Session -DisableNameChecking"
    ],
    "description": "Connect to Exchange Online"
}
```

### HTML header

Add HTML header to a variable with the style tag (for css).

#### Snippet

```json
"HtML header": {
    "prefix": "ex-AddHTMLheader",
    "body": [
        "#HTML file and styles",
	"\\$htmlHeader = @\"",
	"<!doctype html\">",
	"<html lang=\"e\">",
	"<head>",
	"<meta charset=\"UTF-8\">",
	"<title>${1:Title}</title>",
	"<style type=\"text/css\">",
	"body {",
	"}",
	"</style>",
	"</head>",
	"\"@"
    ],
    "description": "Add HTML header section"
}
```

### MaxColumnLengthinDataTable

Takes a datatable object and iterates through it to get the max length of the string columns - useful for data loads into a SQL Server table with fixed column widths by @SQLDBAWithABeard.

#### Snippet

```json
"Max Length of Datatable": {
    "prefix": "Max Length of Datatable",
    "body": [
        "$$columns = ($$datatable | Get-Member -MemberType Property).Name",
        "foreach($$column in $$Columns) {",
        "\t$$max = 0",
        "\tforeach ($$a in $$datatable){",
        "\t\tif($$max -lt $$a.$$column.length){",
        "\t\t\t$$max = $$a.$$column.length",
        "\t\t}",
        "\t}",
        "\tWrite-Output \"$$column max length is $$max\"",
        "}"
    ],
    "description": "Takes a datatable object and iterates through it to get the max length of the string columns - useful for data loads"
}
```

### New Azure Resource Group

Create a Resource Group on Azure, by @vmsilvamolina.

#### Snippet

```json
"New Azure Resource Group": {
    "prefix": "ex-New-AzureRmResourceGroup",
    "body": [
        "#New Resource Group",
        "New-AzureRmResourceGroup -ResourceGroupName \"${1:ResourceGroup}\" -Location \"${2:EastUS}\""
    ],
    "description": "Create an Azure Resource Group"
}
```

### Parameter-Credential

Add a `-Credential` parameter that supports a PSCredential object in a variable, `-Credential (Get-Credential)`, or `-Credential Username` (will prompt). Includes an empty PSCredential object as the default value but this is the first tabstop so pressing backspace after inserting the snippet removes it, by @omniomi.

#### Snippet

```json
"Parameter-Credential": {
    "prefix": "parameter-credential",
    "body": [
        "# Specifies the user account credentials to use when performing this task.\r",
        "[Parameter()]\r",
        "[ValidateNotNull()]\r",
        "[System.Management.Automation.PSCredential]\r",
        "[System.Management.Automation.Credential()]\r",
        "$$Credential${1: = [System.Management.Automation.PSCredential]::Empty}"
    ],
    "description": "Parameter declaration snippet for a Credential parameter."
}
```

### Pester

Pester snippets migrated from the extension.

```json
{
  "PesterContext": {
    "prefix": "Context-Pester",
    "description": "Pester - Context block",
    "body": [
      "Context \"${1:ContextName}\" {",
      "\t${0:$TM_SELECTED_TEXT}",
      "}"
    ]
  },
  "PesterContextIt": {
    "prefix": "Context-It-Pester",
    "description": "Pester - Context block with nested It block",
    "body": [
      "Context \"${1:ContextName}\" {",
      "\tIt \"${2:ItName}\" {",
      "\t\t${3:${TM_SELECTED_TEXT:Assertion}}",
      "\t}$0",
      "}"
    ]
  },
  "PesterDescribeBlock": {
    "prefix": "Describe-Pester",
    "description": "Pester Describe block",
    "body": [
      "Describe \"${1:DescribeName}\" {",
      "\t${0:TM_SELECTED_TEXT}",
      "}"
    ]
  },
  "PesterDescribeContextIt": {
    "prefix": "Describe-Context-It-Pester",
    "description": "Pester Describe block with nested Context & It blocks",
    "body": [
      "Describe \"${1:DescribeName}\" {",
      "\tContext \"${2:ContextName}\" {",
      "\t\tIt \"${3:ItName}\" {",
      "\t\t\t${4:${TM_SELECTED_TEXT:Assertion}}",
      "\t\t}$0",
      "\t}",
      "}"
    ]
  },
  "PesterIt": {
    "prefix": "It-Pester",
    "description": "Pester - It block",
    "body": [
      "It \"${1:ItName}\" {",
      "\t${2:${TM_SELECTED_TEXT:Assertion}}",
      "}$0"
    ]
  }
}
```

### PesterTestForMandatoryParameter

Quickly create a Pester Test for existence of a mandatory parameter by @SQLDBAWithABeard.

#### Snippet

```json
"Pester for Mandatory Parameter": {
    "prefix": "mandatoryParamPester",
    "body": [
        "It \"${1:FunctionName} Should have a mandatory parameter ${2:ParameterName}\" {",
        "\t(Get-Command ${1:FunctionName}).Parameters['${2:ParameterName}'].Attributes.Mandatory | Should -BeTrue",
        "}"
    ],
    "description": "Pester Test for Parameter"
}
```

### PesterTestForParameter

Quickly create a Pester Test for existence of a parameter by @SQLDBAWithABeard.

#### Snippet

```json
"Pester for Parameter": {
    "prefix": "Param Pester",
    "body": [
        "It \"${1:FunctionName} Should have a parameter ${2:ParameterName}\" {",
        "\t(Get-Command ${1:FunctionName}).Parameters['${2:ParameterName}'].Count | Should -Be 1",
        "}"
    ],
    "description": "Pester Test for Parameter"
}
```

### Send-MailMessage

Add the Send-MailMessage cmdlet with the most common parameters in a hashtable for splatting, by @fullenw1.

#### Snippet

```json
"ex-Send-MailMessage": {
	"prefix": "ex-Send-MailMessage",
	"body": [
		"$$Params = @{",
		"    'SmtpServer'  = 'smtp.mycompany.com'",
		"    'Port'        = 25",
		"    'Priority'    = 'Normal'",
		"    'From'        = 'sender@mycompany.com'",
		"    'To'          = 'mainrecipient@mycompany.com'",
		"    'Cc'          = 'copyrecipient@mycompany.com'",
		"    'Bcc'         = 'hiddenrecipient@mycompany.com'",
		"    'Subject'     = 'Mail title'",
		"    'Body'        = 'This is the content of my mail'",
		"    'BodyAsHtml'  = $$false",
		"    'Attachments' = 'c:\\MyFile.txt'",
		"}",
		"Send-MailMessage @Params"
	],
	"description": "Send a mail message"
}
```

## Contributing

To optimize snippet usability and discoverability for end users we will only ship snippets in the extension which we believe meet the following requirements:

- Must be broadly applicable to most PowerShell extension users
- Must be substantially different from existing snippets or intellisense
- Must not violate any intellectual property rights

If your snippet does not meet these requirements but would still be useful to customers we will include it in our list of [Awesome Community Snippets](https://github.com/PowerShell/vscode-powershell/blob/main/docs/community_snippets.md). Additionally, snippet creators can publish snippet libraries as standalone extensions in the [VSCode Marketplace](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

If you'd like a snippet to be considered for addition to the list, [open a pull request](https://opensource.guide/how-to-contribute/#opening-a-pull-request) with the following changes:

### Table of contents

You need to add an item to the table of contents. The addition should follow the *alpha ordering* of the list.
The ToC item template looks like this:

```md
| [Name of snippet](link to header of your snippet) | _some short description_ |
```

An example looks like this (NOTE: all lowercase link):

```md
| [PSCustomObject](#pscustomobject) |  _A simple PSCustomObject_ |
```

which will show up in the ToC like this:

| Snippet Name | Description |
|--------- | ---------|
| [PSCustomObject](#pscustomobject) | _A simple PSCustomObject_ |

### Body

You need to also add an item to the body in alpha order. The body item template looks like this:

    ### Name of snippet

    Enter your description here. It can be the same as the ToC or a longer version.

    #### Snippet

    ```json
    {
        "Put your":"snippet here",
        "indent it":"properly"
    }
    ```

An example looks like this:

    ### PSCustomObject

    A simple PSCustomObject.

    #### Snippet

    ```json
    "PSCustomObject": {
        "prefix": "PSCustomObject",
        "body": [
            "[PSCustomObject]@{",
            "\t${1:Name} = ${2:Value}",
            "}"
        ],
        "description": "Creates a PSCustomObject"
    }
    ```

which will show up in the body like this:

### PSCustomObject

A simple PSCustomObject. Note, this snippet ships with the PowerShell extension.

#### Snippet

```json
"PSCustomObject": {
    "prefix": "PSCustomObject",
    "body": [
        "[PSCustomObject]@{",
        "\t${1:Name} = ${2:Value}",
        "}"
    ],
    "description": "Creates a PSCustomObject"
}
```
