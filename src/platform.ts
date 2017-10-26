/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import fs = require('fs');
import os = require('os');
import path = require('path');
import vscode = require('vscode');
import process = require('process');
import Settings = require('./settings');

export enum OperatingSystem {
    Unknown,
    Windows,
    MacOS,
    Linux
}

export interface PlatformDetails {
    operatingSystem: OperatingSystem
    isOS64Bit: boolean
    isProcess64Bit: boolean
}

export interface PowerShellExeDetails {
    versionName: string;
    exePath: string;
}

export function getPlatformDetails(): PlatformDetails {
    var operatingSystem = OperatingSystem.Unknown;

    if (process.platform === "win32") {
        operatingSystem = OperatingSystem.Windows;
    }
    else if (process.platform === "darwin") {
        operatingSystem = OperatingSystem.MacOS;
    }
    else if (process.platform === "linux") {
        operatingSystem = OperatingSystem.Linux;
    }

    let isProcess64Bit = process.arch === "x64";

    return {
        operatingSystem: operatingSystem,
        isOS64Bit: isProcess64Bit || process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432'),
        isProcess64Bit: isProcess64Bit
    }
}

export function getDefaultPowerShellPath(
    platformDetails: PlatformDetails,
    use32Bit: boolean = false): string | null {

    var powerShellExePath = undefined;

    // Find the path to powershell.exe based on the current platform
    // and the user's desire to run the x86 version of PowerShell
    if (platformDetails.operatingSystem == OperatingSystem.Windows) {
        if (use32Bit) {
            powerShellExePath =
                platformDetails.isOS64Bit && platformDetails.isProcess64Bit
                    ? SysWow64PowerShellPath
                    : System32PowerShellPath
        }
        else {
            powerShellExePath =
                !platformDetails.isOS64Bit || platformDetails.isProcess64Bit
                    ? System32PowerShellPath
                    : SysnativePowerShellPath
        }
    }
    else if (platformDetails.operatingSystem == OperatingSystem.MacOS) {
        powerShellExePath = "/usr/local/bin/powershell";
        if (fs.existsSync("/usr/loca/bin/pwsh")) {
            powerShellExePath = "/usr/local/bin/pwsh";
        }
    }
    else if (platformDetails.operatingSystem == OperatingSystem.Linux) {
        powerShellExePath = "/usr/bin/powershell";
        if (fs.existsSync("/usr/bin/pwsh")) {
            powerShellExePath = "/usr/bin/pwsh";
        }
    }

    return powerShellExePath;
}

export function getWindowsSystemPowerShellPath(systemFolderName: string) {
    return `${process.env.windir}\\${systemFolderName}\\WindowsPowerShell\\v1.0\\powershell.exe`
}

export const System32PowerShellPath = getWindowsSystemPowerShellPath('System32');
export const SysnativePowerShellPath = getWindowsSystemPowerShellPath('Sysnative');
export const SysWow64PowerShellPath = getWindowsSystemPowerShellPath('SysWow64');

export const WindowsPowerShell64BitLabel = "Windows PowerShell (x64)";
export const WindowsPowerShell32BitLabel = "Windows PowerShell (x86)";

const powerShell64BitPathOn32Bit = SysnativePowerShellPath.toLocaleLowerCase();
const powerShell32BitPathOn64Bit = SysWow64PowerShellPath.toLocaleLowerCase();

export function fixWindowsPowerShellPath(powerShellExePath: string, platformDetails: PlatformDetails): string {
    let lowerCasedPath = powerShellExePath.toLocaleLowerCase();

    if ((platformDetails.isProcess64Bit && (lowerCasedPath === powerShell64BitPathOn32Bit)) ||
        (!platformDetails.isProcess64Bit && (lowerCasedPath === powerShell32BitPathOn64Bit))) {
            return System32PowerShellPath;
    }

    // If the path doesn't need to be fixed, return the original
    return powerShellExePath;
}

export function getAvailablePowerShellExes(platformDetails: PlatformDetails): PowerShellExeDetails[] {

    var paths: PowerShellExeDetails[] = [];

    if (platformDetails.operatingSystem === OperatingSystem.Windows) {
        const psCoreInstallPath =
            (!platformDetails.isProcess64Bit ? process.env.ProgramW6432 : process.env.ProgramFiles) + '\\PowerShell';

        if (platformDetails.isProcess64Bit) {
            paths.push({
                versionName: WindowsPowerShell64BitLabel,
                exePath: System32PowerShellPath
            })

            paths.push({
                versionName: WindowsPowerShell32BitLabel,
                exePath: SysWow64PowerShellPath
            })
        }
        else {
            if (platformDetails.isOS64Bit) {
                paths.push({
                    versionName: WindowsPowerShell64BitLabel,
                    exePath: SysnativePowerShellPath
                })
            }

            paths.push({
                versionName: WindowsPowerShell32BitLabel,
                exePath: System32PowerShellPath
            })
        }

        if (fs.existsSync(psCoreInstallPath)) {
            var psCorePaths =
                fs.readdirSync(psCoreInstallPath)
                .map(item => path.join(psCoreInstallPath, item))
                .filter(item => fs.lstatSync(item).isDirectory())
                .map(item => {
                    let exePath = path.join(item, "pwsh.exe");
                    if (!fs.existsSync(exePath)) {
                        exePath = path.join(item, "powershell.exe");
                    }

                    return {
                        versionName: `PowerShell Core ${path.parse(item).base}`,
                        exePath: exePath
                    };
                });

            if (psCorePaths) {
                paths = paths.concat(psCorePaths);
            }
        }
    }
    else {

        paths.push({
            versionName: "PowerShell Core",
            exePath: this.getDefaultPowerShellPath(platformDetails)
        });
    }

    return paths;
}
