# Awesome VSCode Snippets for PowerShell

> A curated list of awesome vscode snippets for PowerShell.

*Inspired by the [awesome](https://github.com/sindresorhus/awesome) lists, focusing on PowerShell snippets in VSCode*

## What are snippets

Code snippets are templates that make it easier to enter repeating code patterns, such as loops or conditional-statements. Check out the [VSCode documentation on snippets](https://code.visualstudio.com/docs/editor/userdefinedsnippets). It provides an overview and instructions on how to author snippets. It's really simple - just a little bit of JSON.

## How to contribute

Check out our [guide here](#contributing).

## Table of contents

* Soon...

## Snippets

### Soon

## Contributing

If you'd like to add a snippet to this list, [open a pull request](https://opensource.guide/how-to-contribute/#opening-a-pull-request) with the following changes:

### Table of context

You need to add an item to the table of context. The addition should follow the alpha ordering of the list.
The ToC item template looks like this:

```md
*[Name of snippet](link to header of your snippet): _some short description_
```

An example looks like this (NOTE: all lowercase link):

```md
*[PSCustomObject](#pscustomobject): _A simple PSCustomObject_
```

which will show up in the ToC like this:

* [PSCustomObject](#pscustomobject): _A simple PSCustomObject_

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
