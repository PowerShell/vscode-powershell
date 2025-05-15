# It's easier to restore node/typescript than dotnet, which is why we use this as the base
FROM mcr.microsoft.com/devcontainers/dotnet:9.0

# Install VSCode which includes the library prereqs to run vscode-test
RUN <<SCRIPT
apt-get update
apt-get install -y software-properties-common apt-transport-https wget gpg
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /usr/share/keyrings/packages.microsoft.gpg
echo "deb [arch=amd64,arm64,armhf signed-by=/usr/share/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list
apt-get update
apt-get install -y code
apt-get clean
rm -rf /var/lib/apt/lists/*
SCRIPT
