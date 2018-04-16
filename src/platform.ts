/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import fs = require("fs");
import os = require("os");
import path = require("path");
import process = require("process");
import vscode = require("vscode");
import Settings = require("./settings");

export enum OperatingSystem {
    Unknown,
    Windows,
    MacOS,
    Linux,
}

export interface IPlatformDetails {
    operatingSystem: OperatingSystem;
    isOS64Bit: boolean;
    isProcess64Bit: boolean;
}

export interface IPowerShellExeDetails {
    versionName: string;
    exePath: string;
}

export function getPlatformDetails(): IPlatformDetails {
    let operatingSystem = OperatingSystem.Unknown;

    if (process.platform === "win32") {
        operatingSystem = OperatingSystem.Windows;
    } else if (process.platform === "darwin") {
        operatingSystem = OperatingSystem.MacOS;
    } else if (process.platform === "linux") {
        operatingSystem = OperatingSystem.Linux;
    }

    const isProcess64Bit = process.arch === "x64";

    return {
        operatingSystem,
        isOS64Bit: isProcess64Bit || process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432"),
        isProcess64Bit,
    };
}

export function getDefaultPowerShellPath(
    platformDetails: IPlatformDetails,
    use32Bit: boolean = false): string | null {

    let powerShellExePath;

    // Find the path to powershell.exe based on the current platform
    // and the user's desire to run the x86 version of PowerShell
    if (platformDetails.operatingSystem === OperatingSystem.Windows) {
        if (use32Bit) {
            powerShellExePath =
                platformDetails.isOS64Bit && platformDetails.isProcess64Bit
                    ? SysWow64PowerShellPath
                    : System32PowerShellPath;
        } else {
            powerShellExePath =
                !platformDetails.isOS64Bit || platformDetails.isProcess64Bit
                    ? System32PowerShellPath
                    : SysnativePowerShellPath;
        }
    } else if (platformDetails.operatingSystem === OperatingSystem.MacOS) {
        powerShellExePath = "/usr/local/bin/powershell";
        if (fs.existsSync("/usr/local/bin/pwsh")) {
            powerShellExePath = "/usr/local/bin/pwsh";
        }
    } else if (platformDetails.operatingSystem === OperatingSystem.Linux) {
        powerShellExePath = "/usr/bin/powershell";
        if (fs.existsSync("/usr/bin/pwsh")) {
            powerShellExePath = "/usr/bin/pwsh";
        }
    }

    return powerShellExePath;
}

export function getWindowsSystemPowerShellPath(systemFolderName: string) {
    return `${process.env.windir}\\${systemFolderName}\\WindowsPowerShell\\v1.0\\powershell.exe`;
}

export const System32PowerShellPath = getWindowsSystemPowerShellPath("System32");
export const SysnativePowerShellPath = getWindowsSystemPowerShellPath("Sysnative");
export const SysWow64PowerShellPath = getWindowsSystemPowerShellPath("SysWow64");

export const WindowsPowerShell64BitLabel = "Windows PowerShell (x64)";
export const WindowsPowerShell32BitLabel = "Windows PowerShell (x86)";

const powerShell64BitPathOn32Bit = SysnativePowerShellPath.toLocaleLowerCase();
const powerShell32BitPathOn64Bit = SysWow64PowerShellPath.toLocaleLowerCase();

export function fixWindowsPowerShellPath(powerShellExePath: string, platformDetails: IPlatformDetails): string {
    const lowerCasedPath = powerShellExePath.toLocaleLowerCase();

    if ((platformDetails.isProcess64Bit && (lowerCasedPath === powerShell64BitPathOn32Bit)) ||
        (!platformDetails.isProcess64Bit && (lowerCasedPath === powerShell32BitPathOn64Bit))) {
            return System32PowerShellPath;
    }

    // If the path doesn't need to be fixed, return the original
    return powerShellExePath;
}

export function getAvailablePowerShellExes(
    platformDetails: IPlatformDetails,
    sessionSettings: Settings.ISettings | undefined): IPowerShellExeDetails[] {

    let paths: IPowerShellExeDetails[] = [];

    if (platformDetails.operatingSystem === OperatingSystem.Windows) {
        if (platformDetails.isProcess64Bit) {
            paths.push({
                versionName: WindowsPowerShell64BitLabel,
                exePath: System32PowerShellPath,
            });

            paths.push({
                versionName: WindowsPowerShell32BitLabel,
                exePath: SysWow64PowerShellPath,
            });
        } else {
            if (platformDetails.isOS64Bit) {
                paths.push({
                    versionName: WindowsPowerShell64BitLabel,
                    exePath: SysnativePowerShellPath,
                });
            }

            paths.push({
                versionName: WindowsPowerShell32BitLabel,
                exePath: System32PowerShellPath,
            });
        }

        const psCoreInstallPath =
            (!platformDetails.isProcess64Bit ? process.env.ProgramW6432 : process.env.ProgramFiles) + "\\PowerShell";

        if (fs.existsSync(psCoreInstallPath)) {
            const arch = platformDetails.isProcess64Bit ? "(x64)" : "(x86)";
            const psCorePaths =
                fs.readdirSync(psCoreInstallPath)
                .map((item) => path.join(psCoreInstallPath, item))
                .filter((item) => {
                    const exePath = path.join(item, "pwsh.exe");
                    return fs.lstatSync(item).isDirectory() && fs.existsSync(exePath);
                })
                .map((item) => {
                    const exePath = path.join(item, "pwsh.exe");
                    return {
                        versionName: `PowerShell Core ${path.parse(item).base} ${arch}`,
                        exePath,
                    };
                });

            if (psCorePaths) {
                paths = paths.concat(psCorePaths);
            }
        }
    } else {
        // Handle Linux and macOS case
        paths.push({
            versionName: "PowerShell Core",
            exePath: this.getDefaultPowerShellPath(platformDetails),
        });
    }

    // When unit testing, we don't have session settings to test so skip reading this setting
    if (sessionSettings) {
        // Add additional PowerShell paths as configured in settings
        for (const additionalPowerShellExePath of sessionSettings.powerShellAdditionalExePaths) {
            paths.push({
                versionName: additionalPowerShellExePath.versionName,
                exePath: additionalPowerShellExePath.exePath,
            });
        }
    }

    return paths;
}
