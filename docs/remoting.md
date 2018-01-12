# PowerShell Remote Editing and Debugging in VSCode

For those of you that were familiar with the ISE, you may recall that you were able to use run `psedit file.ps1` from the integrated console to open files - local or remote - right in the ISE.

As it turns out, this feature is also availible out of the box in the PowerShell extension for VSCode. This guide will show you how to do it.

## Prerequisites

This guide assumes that you have:

* a remote resource (ex: a VM, a container) that you have access to
* PowerShell running on it and the host machine
* VSCode and the PowerShell extension for VSCode

NOTE:

This works on Windows PowerShell and the cross-platform version, [PowerShell Core](https://github.com/powershell/powershell).

This also works when connecting to a remote machine via WinRM, PowerShell Direct, or SSH. If you want to use SSH, but are using Windows, check out the Win32 version of SSH [here](https://github.com/PowerShell/Win32-OpenSSH)!

## Let's go

In this section, I will walk through remote editing and debugging from my MacBook Pro, to an Ubuntu VM running in Azure. I might not be using Windows, but **the process is identical**.

### Local file editing with psedit

With the PowerShell extension for VSCode started and the PowerShell Integrated Console opened, we can type `psedit foo.ps1` to open the local foo.ps1 file right in the editor.

![psedit foo.ps1 works locally](assets/pseditlocal.png)

NOTE: foo.ps1 must already exist.

From there, we can:

add breakpoints to the gutter
![adding breakpoint to gutter](assets/addbreakpoints.png)

and hit F5 to debug the PowerShell script.
![debugging the PowerShell local script](assets/debugging.png)

While debugging, you can interact with the debug console, check out the variables in the scope on the left, and all the other standard debugging tools.

### Remote file editing with psedit

Now let's get into remote file editing and debugging. The steps are nearly the same, there's just one thing we need to do first - enter our PowerShell session to the remote server.

There's a cmdlet for that. It's called `Enter-PSSession`.

The watered down explaination of the cmdlet is:

* `Enter-PSSession -ComputerName foo` starts a session via WinRM
* `Enter-PSSession -ContainerId foo` and `Enter-PSSession -VmId foo` start a session via PowerShell Direct
* `Enter-PSSession -HostName foo` starts a session via SSH

For more info on `Enter-PSSession`, check out the docs [here](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/enter-pssession?view=powershell-6).

Since I will be remoting from macOS to an Ubuntu VM in Azure, I will use SSH for this.

First, in the Integrated Console, let's run our Enter-PSSession. You will know that you're in the session because `[something]` will show up to the left of your prompt.

NOTE: I've blacked out the IP address.

![The call to Enter-PSSession](assets/enterpssession.png)

From there, we can do the exact steps as if we were editing a local script.

1. Run `psedit test.ps1` to open the remote `test.ps1` file
![psedit the test.ps1 file](assets/pseditremote.png)
2. Edit the file/set breakpoints
![edit and set breakpoints](assets/addbreakpointremote.png)
3. Start debugging the remote file

![debugging the remote file](assets/debuggingremote.png)

That's all there is to it! We hope that this helped clear up any questions about remote debugging and editing PowerShell in VSCode.

If you have any problems, feel free to open issues [on the GitHub repo](http://github.com/powershell/vscode-powershell).