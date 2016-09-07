# Troubleshooting PowerShell Extension Issues

This document contains troubleshooting steps for commonly reported issues when using the
PowerShell extension for Visual Studio Code.

## Mac OS X

### 1. PowerShell IntelliSense does not work, can't debug scripts

The most common problem when the PowerShell extension doesn't work on Mac OS X is that
OpenSSL is not installed.  You can check for the installation of OpenSSL by looking for
the following two files:

```
/usr/local/lib/libcrypto.1.0.0.dylib
/usr/local/lib/libssl.1.0.0.dylib
```

The extension should check for these files and direct you to this documentation if you
do not have OpenSSL installed.

#### Installing OpenSSL via Homebrew

You can use [Homebrew](http://brew.sh) to easily install OpenSSL.  First, install Homebrew and then run the following command:

```
brew install openssl
```

After installation, the libraries of interest must be symlinked to `/usr/local/lib`; e.g. (adjust the version numbers as needed and also note that /usr/local/lib may not already exist and may need to be created before symlinking):

```
ln -s /usr/local/Cellar/openssl/1.0.2h_1/lib/libcrypto.1.0.0.dylib /usr/local/lib/libcrypto.1.0.0.dylib
ln -s /usr/local/Cellar/openssl/1.0.2h_1/lib/libssl.1.0.0.dylib /usr/local/lib/libssl.1.0.0.dylib
```

Restart VS Code after completing the installation and verify that the extension is working correctly.

#### Installing OpenSSL via MacPorts

If you prefer to use [MacPorts](https://www.macports.org/), you can run the following command to install OpenSSL:

```
sudo port install openssl
```

You will need to take an additional step once installation completes:

```
sudo ln -s /opt/local/lib/libcrypto.1.0.0.dylib /usr/local/lib/
sudo ln -s /opt/local/lib/libssl.1.0.0.dylib /usr/local/lib/
```

Thanks to [@MarlonRodriguez](https://github.com/MarlonRodriguez) for the tip!

Restart VS Code after completing the installation and verify that the extension is working correctly.
