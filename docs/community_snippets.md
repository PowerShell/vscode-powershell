# Awesome VSCode Snippets for PowerShell

> A curated list of awesome vscode snippets for PowerShell.

*Inspired by the [awesome](https://github.com/sindresorhus/awesome) lists, focusing on PowerShell snippets in VSCode*

[![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

## What are snippets

Code snippets are templates that make it easier to enter repeating code patterns, such as loops or conditional-statements. Check out the [VSCode documentation on snippets](https://code.visualstudio.com/docs/editor/userdefinedsnippets). It provides an overview and instructions on how to author snippets. It's really simple - just a little bit of JSON.

_To contribute, check out our [guide here](#contributing)._

## Table of contents

| Table of Contents |
|:------------------|
| [AWSRegionDynamicParameter](#awsregiondynamicparameter): _Creates a dynamic parameter of current AWS regions by @jbruett_ |
| [CalculatedProperty](#calculatedproperty): _Create a calculated property for use in a select-object call by @corbob_ |
| [DateTimeWriteVerbose](#datetimewriteverbose): _Write-Verbose with the time and date pre-pended to your message by @ThmsRynr_ |
| [Parameter-Credential](#parameter-credential): _Add a standard credential parameter to your function by @omniomi_ |
| [PSCustomObject](#pscustomobject): _A simple PSCustomObject by @brettmillerb_ |

## Snippets

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

## Contributing

If you'd like to add a snippet to this list, [open a pull request](https://opensource.guide/how-to-contribute/#opening-a-pull-request) with the following changes:

### Table of contents

You need to add an item to the table of contents. The addition should follow the *alpha ordering* of the list.
The ToC item template looks like this:

```md
| [Name of snippet](link to header of your snippet): _some short description_ |
```

An example looks like this (NOTE: all lowercase link):

```md
| [PSCustomObject](#pscustomobject): _A simple PSCustomObject_ |
```

which will show up in the ToC like this:

| Table of Contents |
|:------------------|
| [PSCustomObject](#pscustomobject): _A simple PSCustomObject_ |

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
