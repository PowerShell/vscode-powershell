# Configuring VSCode and PowerShell to prevent encoding bugs

## TL;DR - I have weird `â€“` characters in my script and just want to fix it

Your VSCode is set to encode files as UTF-8 with no BOM,
but your PowerShell is set to read them as Windows-1252.

In your VSCode configuration (<kbd>Ctrl</kbd>+<kbd>,</kbd>), set:

```json
"files.encoding": "utf8bom"
```

Then make sure that any files you are working on are encoded in UTF-8 with a BOM.

If you want more information, read on.

## Introduction

In this document, you will find information on:

- What's meant by "encoding" and why you need to configure it
- What some common encoding problems look like
- How VSCode, PowerShell and the PowerShell extension depend on encodings
- Why you might choose one encoding over another
- How to configure VSCode and PowerShell to make encoding work
- Some other components you might need to configure to stop encoding issues from occurring.

## Why configuring your encoding is important

VSCode, being a text editor, manages the interface between
a human entering strings of characters into a buffer on the screen
and reading/writing blocks of bytes to the filesystem.
When VSCode saves a buffer (a file you have open) to the filesystem,
it chooses a text encoding to do this.

When PowerShell runs a file,
it similarly has to convert from bytes to chars
to reconstruct a file into a PowerShell program.
(This process of parsing a PowerShell script goes:
*bytes* -> *characters* -> *tokens* -> *abstract syntax tree* -> *execution*.)

Since VSCode writes to the file system and PowerShell reads from the filesystem,
this means they need to communicate using the same encoding,
so that the characters written by VSCode are
the same as the characters read by PowerShell.

Both VSCode and PowerShell are installed with a sensible default encoding configuration,
but especially in older PowerShell versions,
the most sensible encoding to use has changed since the default was configured,
and VSCode's default sometimes conflicts with PowerShell's.

In order to ensure you have no problems using PowerShell or the PowerShell extension in
VSCode, you will need to configure your VSCode and PowerShell settings properly.

## Why you might hit encoding issues, and how to tell if you have

Encoding problems arise because the encoding of VSCode or your script
file does not match the expected encoding of PowerShell,
and there is no way for Powershell to determine the encoding of the file automatically.

You're much more likely to hit encoding problems if you're using characters
not in the [7-bit ASCII character set](https://ascii.cl/),
such as accented latin characters (e.g. `É`, `ü`),
or non-latin characters like Cyrillic (`Д`, `Ц`) or Han Chinese (`脚`, `本`).

Common reasons for encoding issues are:

- The encodings of VSCode and PowerShell have not been changed from their defaults.
  For PowerShell 5.1 and below, the default encoding is different from VSCode's.
- Another editor has opened and overwritten the file in a new encoding.
  This often happens with the ISE.
- The file is checked into source control (like git) in a different encoding
  to what VSCode or PowerShell expects. This can happen when coworkers edit
  files with an editor with a different encoding configuration.

### Tell-tale signs of encoding issues

Often encoding errors present themselves are parse errors in scripts.

If you find strange character sequences occurring in your script,
you can look them up in [this handy reference](https://www.i18nqa.com/debug/utf8-debug.html),
which often confirms a UTF-8/Windows-1252 encoding problem.

In the example below, an en-dash (&ndash;) appears as the characters `â€“`:

```text
Send-MailMessage : A positional parameter cannot be found that accepts argument 'Testing FuseMail SMTP...'.
At C:\Users\<User>\<OneDrive>\Development\PowerShell\Scripts\Send-EmailUsingSmtpRelay.ps1:6 char:1
+ Send-MailMessage â€“From $from â€“To $recipient1 â€“Subject $subject  ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidArgument: (:) [Send-MailMessage], ParameterBindingException
    + FullyQualifiedErrorId : PositionalParameterNotFound,Microsoft.PowerShell.Commands.SendMailMessage
```

This is because VSCode encodes the character '&ndash;' in UTF-8 as the bytes `0xE2 0x80 0x93`.
When these bytes are decoded as Windows-1252, they are interpreted as the characters `â€“`.

Some character sequences that might be evidence of an encoding configuration problem are:

- `â€“` instead of `–`
- `â€”` instead of `—`
- `Ã„2` instead of `Ä`
- `Â` instead of ` `  (a space)
- `Ã©` instead of `é`

## The PowerShell extension and encodings

The PowerShell extension interacts with scripts in a number of ways:

1. When scripts are executed directly in the Integrated Console,
   they are read off the filesystem by PowerShell directly.
   This means that if PowerShell's encoding differs from VSCode's, something may go wrong here.
2. When scripts are edited in VSCode, the contents are sent by VSCode to the extension,
   meaning it's not possible for the extension to get the wrong encoding of a file
   (the [Language Server Protocol] mandates this file content be transferred in UTF-8).
3. When a script being edited in VSCode references another script that is not also open in VSCode,
   the extension falls back to loading that script's content from the file system.
   This load will detect a BOM, but defaults to UTF-8.

It's only in the 1st and 3rd scenarios that a problem may arise.

### Why can't the extension detect encodings and do the right thing?

The extension will perform BOM detection, and in those cases does do the right thing.

The problem occurs when assuming the encoding of BOM-less formats (like [UTF-8] with no BOM and [Windows-1252]).
In these cases, the extension has to settle on an encoding,
and currently just assumes UTF-8 rather than more complex logic.

The extension [does not have access (read or write) to VSCode' encoding settings](https://github.com/Microsoft/vscode/issues/824),
and instead tries to have a sane default - the same as VSCode's.

However, despite being loaded into PowerShell, the extension also can't control PowerShell's encoding
easily (PowerShell's encoding settings are fragmented, and can be changed back at any time in the Integrated Console).

These factors mean the PowerShell extension relies on the user to configure the encoding instead.

## Choosing the right encoding

To solve encoding issues, you need to choose a common text encoding that
you can encode all your PowerShell scripts in that everything you use will understand.

**The encoding most likely to work easily with VSCode, all versions of PowerShell
and most (especially Windows-based) applications is UTF-8 with a [byte-order mark] (BOM)**.

**However**, choosing an encoding is a question of what platforms and applications
will be reading and writing your text/PowerShell scripts.

On Windows, many applications have long used [Windows-1252],
although many .NET applications use [UTF-16]
(the Windows world often calls this "Unicode", a term that now [refers to a broader standard](https://en.wikipedia.org/wiki/Unicode)).

In the Linux world and on the web, [UTF-8] is now the dominant encoding.

Unicode encodings (the "UTF"s) also have the concept of a [byte-order mark] (BOM),
which may occur at the beginning of text to
tell a decoder what encoding the text is in and, in the case of
multibyte encodings, the [endianness](https://en.wikipedia.org/wiki/Endianness) of the encoding.
BOMs are also designed to be bytes that rarely occur in non-Unicode text,
allowing a reasonable guess that text is Unicode when a BOM is present.

BOMs are optional and their adoption has not caught on in the Linux world,
due to a dependable convention of UTF-8 being used everywhere.
This means that most Linux applications presume that text input is encoded in UTF-8.
While many Linux applications will recognise and correctly handle a BOM,
a number do not, leading to artifacts in text manipulated with those applications.

**Therefore**:

- If you work primarily with Windows applications and Windows PowerShell,
  you should prefer an encoding like UTF-8 with BOM or UTF-16.
- If you work across platforms, you should prefer UTF-8 with BOM.
- If you work mainly in Linux-associated contexts, you should prefer UTF-8 without BOM.
- Windows-1252 and latin-1 are essentially legacy encodings that you should avoid if possible.
  However, some older Windows applications may depend on them.
- It's also worth noting that script signing [is encoding-dependent](https://github.com/PowerShell/PowerShell/issues/3466),
  meaning a change of encoding on a signed script will require resigning.

## Configuring VSCode

VSCode's default encoding is UTF-8 without BOM.

To set [VSCode's encoding](https://code.visualstudio.com/docs/editor/codebasics#_file-encoding-support),
go to the VSCode settings (<kbd>Ctrl</kbd>+<kbd>,</kbd>)
and set the `"files.encoding"` setting:

```json
"files.encoding": "utf8bom"
```

Some possible values are:

- `"utf8"`: [UTF-8] without BOM
- `"utf8bom"`: [UTF-8] with BOM
- `"utf16le"`: Little endian [UTF-16]
- `"utf16be"`: Big endian [UTF-16]
- `"windows1252"`: [Windows-1252]

You should get a dropdown for this in the GUI view,
or completions for it in the JSON view.

You can also add the following to autodetect encoding when possible:

```json
"files.autoGuessEncoding": true
```

## Configuring PowerShell

PowerShell's default encoding varies depending on version:

- In PowerShell 6+, the default encoding is [UTF-8] without BOM on all platforms.
- In Windows PowerShell, the default encoding is usually [Windows-1252],
  an extension of [latin-1]
  (also known as ISO 8859-1).

In PowerShell 5+ you can find your default encoding with this:

```powershell
[psobject].Assembly.GetTypes() | ? { $_.Name -eq 'ClrFacade'} | % { $_.GetMethod('GetDefaultEncoding', [System.Reflection.BindingFlags]'nonpublic,static').Invoke($null, @()) }
```

It's not strictly possible to force PowerShell to use an input encoding,
and PowerShell 5.1 and below always default to [Windows-1252] when there is no BOM.
For interoperability reasons then, it's best to save scripts you wish to
evaluate in PowerShell 5.1 and below in a Unicode format with a BOM.

If want to configure PowerShell to use a given encoding more generally,
this is possible to do for some aspects with profile settings.
See:

- [@mklement0]'s [answer about PowerShell encoding on StackOverflow](https://stackoverflow.com/a/40098904).
- [@rkeithhill]'s [blog post about dealing with BOM-less UTF-8 input in PowerShell](https://rkeithhill.wordpress.com/2010/05/26/handling-native-exe-output-encoding-in-utf8-with-no-bom/).

## What else you might need to configure for encoding

Any other tools you have that touch PowerShell scripts may:

1. Be affected by your encoding choices, or
2. *Worse*, re-encode your scripts in another encoding.

### Scripts

Scripts on the file system may need re-encoding to your new chosen encoding.
To do this with VSCode, you can open the file and [save it again with the new encoding](https://stackoverflow.com/a/40365121).

If you need to re-encode multiple files, [this PowerShell snippet on StackOverflow may help](https://stackoverflow.com/a/1681610).

### The PowerShell Integrated Scripting Environment (ISE)

If you also edit scripts using the PowerShell ISE,
you will need to synchronize your encoding settings there.

The ISE should honor a BOM, but it is [also possible to use reflection to set the encoding](https://bensonxion.wordpress.com/2012/04/25/powershell-ise-default-saveas-encoding/).
Note that this would not be persisted between startups.

### Source control software

While some source control tools (like git) ignore encodings (git just tracks the bytes),
others (like TFS or Mercurial) may not, and even some git-based tools rely on decoding text.

When this is the case, make sure you:

- Configure the text encoding in your source control to match VSCode's.
- Ensure all your files are checked into source control in the relevant encoding.
- Be wary of changes to the encoding received through source control.
  A key sign of this is a diff where nothing seems to have changed
  (because bytes have but characters have not).

### Collaborators' environments

On top of configuring source control,
ensure that your collaborators on any files you share
(through source control, a file share or any other way)
don't have settings that will override your encoding by re-encoding PowerShell files.

### Other programs

Any other program that reads or writes a PowerShell script may re-encode it.

Some examples are:

- The clipboard (copying and pasting a script). This is common in scenarios like:
  - Copying a script into a VM
  - Copying a script out of an email or webpage
  - Copying a script into or out of an MS Word or PowerPoint document
- Other text editors, such as:
  - Notepad
  - vim
  - Any other PowerShell script editor
- Text editing utilities, like:
  - `Get-Content`/`Set-Content`/`Out-File`
  - PowerShell redirection operators like `>` and `>>`
  - `sed`/`awk`
- File transfer programs, like:
  - A web browser, when downloading scripts
  - A file share

Some of the above deal in bytes rather than text,
but others offer encoding configurations.
In those cases where you need to configure an encoding,
you will need to make it the same as your editor encoding to prevent bugs.

## Other resources on encoding in PowerShell

There are a few other nice posts on encoding
and configuring encoding in PowerShell that are worth a read:

- [@mklement0]'s [summary of PowerShell encoding on StackOverflow](https://stackoverflow.com/questions/40098771/changing-powershells-default-output-encoding-to-utf-8)
- Previous issues opened on vscode-PowerShell for encoding problems:
  - [#1308](https://github.com/PowerShell/vscode-powershell/issues/1308)
  - [#1628](https://github.com/PowerShell/vscode-powershell/issues/1628)
  - [#1680](https://github.com/PowerShell/vscode-powershell/issues/1680)
  - [#1744](https://github.com/PowerShell/vscode-powershell/issues/1744)
  - [#1751](https://github.com/PowerShell/vscode-powershell/issues/1751)
- [The classic *Joel on Software* writeup about Unicode](https://www.joelonsoftware.com/2003/10/08/the-absolute-minimum-every-software-developer-absolutely-positively-must-know-about-unicode-and-character-sets-no-excuses/)

[@mklement0]: https://github.com/mklement0
[@rkeithhill]: https://github.com/rkeithhill
[Windows-1252]: https://en.wikipedia.org/wiki/Byte_order_mark
[latin-1]: https://en.wikipedia.org/wiki/ISO/IEC_8859-1
[UTF-8]: https://en.wikipedia.org/wiki/UTF-8
[byte-order mark]: https://en.wikipedia.org/wiki/Byte_order_mark
[UTF-16]: https://en.wikipedia.org/wiki/UTF-16
[Language Server Protocol]: https://microsoft.github.io/language-server-protocol/