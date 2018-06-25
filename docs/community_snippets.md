# Awesome VSCode Snippets for PowerShell

> A curated list of awesome vscode snippets for PowerShell.

*Inspired by the [awesome](https://github.com/sindresorhus/awesome) lists, focusing on PowerShell snippets in VSCode*

[![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

## What are snippets

Code snippets are templates that make it easier to enter repeating code patterns, such as loops or conditional-statements. Check out the [VSCode documentation on snippets](https://code.visualstudio.com/docs/editor/userdefinedsnippets). It provides an overview and instructions on how to author snippets. It's really simple - just a little bit of JSON.

_To contribute, check out our [guide here](#contributing)._

## Table of contents

| Snippet name | Description |
| --------- | ---------|
| [AssertMock](#assert-mock) | _Creates assert mock Pester test_ |
| [AWSRegionDynamicParameter](#awsregiondynamicparameter) | _Creates a dynamic parameter of current AWS regions by @jbruett_ |
| [CalculatedProperty](#calculatedproperty) | _Create a calculated property for use in a select-object call by @corbob_ |
| [DataTable](#datatable) | _Creates a DataTable_ |
| [DateTimeWriteVerbose](#datetimewriteverbose) | _Write-Verbose with the time and date pre-pended to your message by @ThmsRynr_ |
| [Error-Terminating](#error-terminating) | _Create a full terminating error by @omniomi_ |
| [IfShouldProcess](#ifshouldprocess) | _Added If Should Process_ |
| [MaxColumnLengthinDataTable](#maxcolumnlengthindatatable) | _Gets the max length of string columns in datatables_ |
| [Parameter-Credential](#parameter-credential) | _Add a standard credential parameter to your function by @omniomi_ |
| [PesterTestForMandatoryParameter](#pestertestformandatoryparameter) | _Create Pester test for a mandatory parameter_ |
| [PesterTestForParameter](#pestertestforparameter) | _Create Pester test for parameter_ |
| [PSCustomObject](#pscustomobject) | _A simple PSCustomObject by @brettmillerb_ |
| [Region Block](#region-block) | _Region Block for organizing and folding of your code_ |

## Snippets

### Assert Mock

Creates Assert Mock for Pester Tests y @SQLDBAWithABeard

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

Creates a dynamic parameter of the current AWS regions.  Includes parameter validation.

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

### CalculatedProperty

Create calculated property for use in Select Statements

#### Snippet

```json
"Add Calculated Property": {
    "prefix": "cf",
    "body": [
        "@{'Name' = '$1' ; 'Expression' = {$2}}",
    ],
    "description": "Create calculated property for use in Select Statements"
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

### IfShouldProcess

Add If Should Process with easy tab inputs

#### Snippet

```json
"IfShouldProcess": {
    "prefix": "IfShouldProcess",
    "body": [
        "if ($$PSCmdlet.ShouldProcess(\"${1:The Item}\" , \"${2:The Change}\")) {",
        "\t# Place Code here",
        "}"
    ],
    "description": "Creates an if should process"
}
```

### MaxColumnLengthinDataTable

Takes a datatable object and iterates through it to get the max length of the string columns - useful for data loads into a SQL Server table with fixed column widths by @SQLDBAWithABeard

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

### Parameter-Credential

Add a `-Credential` parameter that supports a PSCredential object in a variable, `-Credential (Get-Credential)`, or `-Credential Username` (will prompt). Includes an empty PSCredential object as the default value but this is the first tabstop so pressing backspace after inserting the snippet removes it. by @omniomi

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

### PesterTestForMandatoryParameter

Quickly create a Pester Test for existence of a mandatory parameter by @SQLDBAWithABeard

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

Quickly create a Pester Test for existence of a parameter by @SQLDBAWithABeard

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

### PSCustomObject

A simple PSCustomObject by @brettmillerb. It has 4 properties that you can tab through to quickly fill in.

#### Snippet

```json
"PSCustomObject": {
    "prefix": "PSCustomObject",
    "body": [
        "[PSCustomObject]@{\r",
            "\t${item1} = ${Property1}\r",
            "\t${item2} = ${Property2}\r",
            "\t${item3} = ${Property3}\r",
            "\t${item4} = ${Property4}\r",
        "}"
    ],
    "description": "Creates a PSCustomObject"
}
```

### Region Block

Use the `#region` for organizing your code (including good code folding).

#### Snippet

```json
"Region Block": {
    "prefix": "#region",
    "body": [
        "#region ${1}",
        "$0",
        "#endregion"
    ],
    "description": "Region Block for organizing and folding of your code"
}
```

## Contributing

If you'd like to add a snippet to this list, [open a pull request](https://opensource.guide/how-to-contribute/#opening-a-pull-request) with the following changes:

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
