#!/usr/bin/env bash

# Let's quit on interrupt of subcommands
trap '
  trap - INT # restore default INT handler
  echo "Interrupted"
  kill -s INT "$$"
' INT

get_url() {
    fork=$2
    release=v6.0.0-beta.1
    echo "https://github.com/$fork/PowerShell/releases/download/$release/$1"
}

fork="PowerShell"
# Get OS specific asset ID and package name
case "$OSTYPE" in
    linux*)
        source /etc/os-release
        # Install curl and wget to download package
        case "$ID" in
            centos*)
                if ! hash curl 2>/dev/null; then
                    echo "curl not found, installing..."
                    sudo yum install -y curl
                fi

                package=powershell-6.0.0_beta.1-1.el7.centos.x86_64.rpm
                ;;
            ubuntu)
                if ! hash curl 2>/dev/null; then
                    echo "curl not found, installing..."
                    sudo apt-get install -y curl
                fi

                case "$VERSION_ID" in
                    14.04)
                        package=powershell_6.0.0-beta.1-1ubuntu1.14.04.1_amd64.deb
                        ;;
                    16.04)
                        package=powershell_6.0.0-beta.1-1ubuntu1.16.04.1_amd64.deb
                        ;;
                    *)
                        echo "Ubuntu $VERSION_ID is not supported!" >&2
                        exit 2
                esac
                ;;
            opensuse)
                if ! hash curl 2>/dev/null; then
                    echo "curl not found, installing..."
                    sudo zypper install -y curl
                fi


                case "$VERSION_ID" in
                    42.1)
                        # TODO during next release remove fork and fix package name
                        fork=TravisEz13
                        package=powershell-6.0.0_beta.1-1.suse.42.1.x86_64.rpm
                        ;;
                    *)
                        echo "OpenSUSE $VERSION_ID is not supported!" >&2
                        exit 2
                esac
                ;;
            *)
                echo "$NAME is not supported!" >&2
                exit 2
        esac
        ;;
    darwin*)
        # We don't check for curl as macOS should have a system version
        package=powershell-6.0.0-beta.1-osx.10.12-x64.pkg
        ;;
    *)
        echo "$OSTYPE is not supported!" >&2
        exit 2
        ;;
esac

curl -L -o "$package" $(get_url "$package" "$fork")

if [[ ! -r "$package" ]]; then
    echo "ERROR: $package failed to download! Aborting..." >&2
    exit 1
fi

# Installs PowerShell package
case "$OSTYPE" in
    linux*)
        source /etc/os-release
        # Install dependencies
        echo "Installing PowerShell with sudo..."
        case "$ID" in
            centos)
                # yum automatically resolves dependencies for local packages
                sudo yum install "./$package"
                ;;
            ubuntu)
                # dpkg does not automatically resolve dependencies, but spouts ugly errors
                sudo dpkg -i "./$package" &> /dev/null
                # Resolve dependencies
                sudo apt-get install -f
                ;;
            opensuse)
                # Install the Microsoft public key so that zypper trusts the package
                sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc
                # zypper automatically resolves dependencies for local packages
                sudo zypper --non-interactive install "./$package" &> /dev/null
                ;;
            *)
        esac
        ;;
    darwin*)
        echo "Installing $package with sudo ..."
        sudo installer -pkg "./$package" -target /
        ;;
esac

powershell -noprofile -c '"Congratulations! PowerShell is installed at $PSHOME"'
success=$?

if [[ "$success" != 0 ]]; then
    echo "ERROR: PowerShell failed to install!" >&2
    exit "$success"
fi