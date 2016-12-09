# Troubleshooting PowerShell Extension Issues

This document contains troubleshooting steps for commonly reported issues when using the
PowerShell extension for Visual Studio Code.

## macOS (OS X)

### 1. PowerShell IntelliSense does not work, can't debug scripts

The most common problem when the PowerShell extension doesn't work on macOS is that
OpenSSL is not installed.  You can check for the installation of OpenSSL by looking for
the following files:

If installed using Homebrew:

```
/usr/local/opt/openssl/lib/libcrypto.1.0.0.dylib
/usr/local/opt/openssl/lib/libssl.1.0.0.dylib
```

If installed by some other means:

```
/usr/local/lib/libcrypto.1.0.0.dylib
/usr/local/lib/libssl.1.0.0.dylib
```

The extension should check for these files and direct you to this documentation if you
do not have OpenSSL installed.

#### Installing OpenSSL via Homebrew

We **highly recommend** that you use [Homebrew](http://brew.sh) to install OpenSSL.  The PowerShell distribution for macOS
has built-in support for Homebrew's OpenSSL library paths.  If you install with Homebrew, you will avoid
[security concerns](https://github.com/PowerShell/PowerShell/blob/master/docs/installation/linux.md#openssl)
around creating symbolic links in your `/usr/local/lib` path which are needed when using other means of installation.

First, install Homebrew and then run the following command:

```
brew install openssl
```

Restart VS Code after completing the installation and verify that the extension is working correctly.

#### Installing OpenSSL via MacPorts

If you prefer to use [MacPorts](https://www.macports.org/), you can run the following command to install OpenSSL:

```
sudo port install openssl
```

You will need to take an additional step once installation completes:

```
sudo ln -s /opt/local/lib/libcrypto.1.0.0.dylib /usr/local/lib/libcrypto.1.0.0.dylib
sudo ln -s /opt/local/lib/libssl.1.0.0.dylib /usr/local/lib/libssl.1.0.0.dylib
```

Thanks to [@MarlonRodriguez](https://github.com/MarlonRodriguez) for the tip!

Restart VS Code after completing the installation and verify that the extension is working correctly.
