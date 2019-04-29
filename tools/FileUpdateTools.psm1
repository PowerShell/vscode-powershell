# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

function ReplaceStringSegment
{
    [OutputType([string])]
    param(
        [Parameter(Mandatory)]
        [string]
        $String,

        [Parameter(Mandatory)]
        [string]
        $NewSegment,

        [Parameter(Mandatory)]
        [int]
        $StartIndex,

        [Parameter(Mandatory)]
        [int]
        $EndIndex,

        [switch]
        $AutoIndent
    )

    if ($AutoIndent)
    {
        $indentBuilder = [System.Text.StringBuilder]::new()
        $indentIdx = $StartIndex - 1
        $currChar = $String[$indentIdx]
        while ($currChar -ne "`n")
        {
            $null = $indentBuilder.Append($currChar)
            $indentIdx--
            $currChar = $String[$indentIdx]
        }
        $indent = $indentBuilder.ToString()
    }
    else
    {
        $indent = ''
    }

    $newStringBuilder = [System.Text.StringBuilder]::new()
    $null = $newStringBuilder.Append($String.Substring(0, $StartIndex))

    $segmentLines = $NewSegment.Split("`n")

    $null = $newStringBuilder.Append($segmentLines[0])
    for ($i = 1; $i -lt $segmentLines.Length; $i++)
    {
        $null = $newStringBuilder.Append("`n").Append($indent).Append($segmentLines[$i])
    }

    $null = $newStringBuilder.Append($String.Substring($EndIndex))

    return $newStringBuilder.ToString()
}

function GetStringOffsetFromSpan
{
    [OutputType([int])]
    param(
        [Parameter()]
        [string]
        $String,

        [Parameter()]
        [int]
        $EndLine,

        [Parameter()]
        [int]
        $StartLine = 1,

        [Parameter()]
        [int]
        $Column = 0,

        [Parameter()]
        [int]
        $InitialOffset = 0
    )

    $lfChar = 0xA

    $idx = $InitialOffset
    $spanLines = $EndLine - $StartLine
    for ($i = 0; $i -lt $spanLines; $i++)
    {
        $idx = $String.IndexOf($lfChar, $idx + 1)

        if ($idx -lt 0)
        {
            return $idx
        }
    }

    return $idx + $Column
}

function ConvertToJToken
{
    param(
        [Parameter()]
        $Object
    )

    if ($null -eq $Object)
    {
        return [Newtonsoft.Json.Linq.JValue]::CreateNull()
    }

    if ($Object -is [pscustomobject])
    {
        $jObject = [Newtonsoft.Json.Linq.JObject]::new()
        foreach ($field in $Object)
        {
            $jObject.Add($field, $Object.$field)
        }
        return $jObject
    }

    if ($Object -is [version])
    {
        return [Newtonsoft.Json.Linq.JToken]::new($Object.ToString())
    }

    return (,[Newtonsoft.Json.Linq.JToken]::FromObject($Object))
}

function ConvertToIndentedJson
{
    param(
        [Parameter(Position=0)]
        $Object,

        [Parameter()]
        [int]
        $IndentWidth = 4,

        [Parameter()]
        [char]
        $IndentChar = ' '
    )

    # Convert the object to a JToken
    $jObject = ConvertToJToken $Object

    # Reformat the entry with tab-based indentation, like the existing file
    $stringBuilder = [System.Text.StringBuilder]::new()
    try
    {
        $stringWriter = [System.IO.StringWriter]::new($stringBuilder)
        $jsonWriter = [Newtonsoft.Json.JsonTextWriter]::new($stringWriter)
        $jsonWriter.Indentation = $IndentWidth
        $jsonWriter.IndentChar = $IndentChar
        $jsonWriter.Formatting = 'Indented'
        $null = $jObject.WriteTo($jsonWriter)
    }
    finally
    {
        $jsonWriter.Dispose()
        $stringWriter.Dispose()
    }
    return $stringBuilder.ToString().Replace([System.Environment]::NewLine, "`r`n")
}

function SetFileContent
{
    param(
        [Parameter(Mandatory, Position=0)]
        [string]
        $FilePath,

        [Parameter(Mandatory, Position=1)]
        [string]
        $Value,

        [Parameter()]
        $Encoding = ([System.Text.UTF8Encoding]::new(<# BOM #> $false))
    )

    $FilePath = $PSCmdlet.GetUnresolvedProviderPathFromPSPath($FilePath)
    [System.IO.File]::WriteAllText($FilePath, $Value, $Encoding)
}