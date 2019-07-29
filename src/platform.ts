/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import fs = require("fs");
import path = require("path");
import process = require("process");
import Settings = require("./settings");

const linuxExePath        = "/usr/bin/pwsh";
const linuxPreviewExePath = "/usr/bin/pwsh-preview";

const snapExePath         = "/snap/bin/pwsh";
const snapPreviewExePath  = "/snap/bin/pwsh-preview";

const macOSExePath        = "/usr/local/bin/pwsh";
const macOSPreviewExePath = "/usr/local/bin/pwsh-preview";

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

/**
 * Gets the default instance of PowerShell for the specified platform.
 * On Windows, the default version of PowerShell is "Windows PowerShell".
 * @param platformDetails Specifies information about the platform - primarily the operating system.
 * @param use32Bit On Windows, this boolean determines whether the 32-bit version of Windows PowerShell is returned.
 * @returns A string containing the path of the default version of PowerShell.
 */
export function getDefaultPowerShellPath(
    platformDetails: IPlatformDetails,
    use32Bit: boolean = false): string | null {

    let powerShellExePath;
    let psCoreInstallPath;

     // Find the path to the powershell executable based on the current platform
    // and the user's desire to run the x86 version of PowerShell
    if (platformDetails.operatingSystem === OperatingSystem.Windows) {
        if (use32Bit) {
            psCoreInstallPath =
                (platformDetails.isProcess64Bit ? process.env["ProgramFiles(x86)"] : process.env.ProgramFiles)
            + "\\PowerShell";
        } else {
            psCoreInstallPath =
                (platformDetails.isProcess64Bit ? process.env.ProgramFiles : process.env.ProgramW6432) + "\\PowerShell";
        }

        if (fs.existsSync(psCoreInstallPath)) {
            const arch = platformDetails.isProcess64Bit ? "(x64)" : "(x86)";
            const psCorePaths =
                fs.readdirSync(psCoreInstallPath)
                .map((item) => path.join(psCoreInstallPath, item))
                .filter((item) => {
                    const exePath = path.join(item, "pwsh.exe");
                    return fs.lstatSync(item).isDirectory() && fs.existsSync(exePath);
                })
                .map((item) => ({
                    versionName: `PowerShell Core ${path.parse(item).base} ${arch}`,
                    exePath: path.join(item, "pwsh.exe"),
                }));

            if (psCorePaths) {
                return powerShellExePath = psCorePaths[0].exePath;
            }
        }

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
        // Always default to the stable version of PowerShell (if installed) but handle case of only Preview installed
        powerShellExePath = macOSExePath;
        if (!fs.existsSync(macOSExePath) && fs.existsSync(macOSPreviewExePath)) {
            powerShellExePath = macOSPreviewExePath;
        }
    } else if (platformDetails.operatingSystem === OperatingSystem.Linux) {
        // Always default to the stable version of PowerShell (if installed) but handle case of only Preview installed
        // as well as the Snaps case - https://snapcraft.io/
        powerShellExePath = linuxExePath;
        if (!fs.existsSync(linuxExePath) && fs.existsSync(linuxPreviewExePath)) {
            powerShellExePath = linuxPreviewExePath;
        } else if (fs.existsSync(snapExePath)) {
            powerShellExePath = snapExePath;
        } else if (fs.existsSync(snapPreviewExePath)) {
            powerShellExePath = snapPreviewExePath;
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

/**
 * Gets a list of all available PowerShell instance on the specified platform.
 * @param platformDetails Specifies information about the platform - primarily the operating system.
 * @param sessionSettings Specifies the user/workspace settings. Additional PowerShell exe paths loaded from settings.
 * @returns An array of IPowerShellExeDetails objects with the PowerShell name & exe path for each instance found.
 */
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
                .map((item) => ({
                    versionName: `PowerShell Core ${path.parse(item).base} ${arch}`,
                    exePath: path.join(item, "pwsh.exe"),
                }));

            if (psCorePaths) {
                paths = paths.concat(psCorePaths);
            }
        }
    } else {
        // Handle Linux and macOS case
        let exePaths: string[];

        if (platformDetails.operatingSystem === OperatingSystem.Linux) {
            exePaths = [ linuxExePath, snapExePath, linuxPreviewExePath, snapPreviewExePath ];
        } else {
            exePaths = [ macOSExePath, macOSPreviewExePath ];
        }

        exePaths.forEach((exePath) => {
            if (fs.existsSync(exePath)) {
                paths.push({
                    versionName: "PowerShell Core" + (/-preview/.test(exePath) ? " Preview" : ""),
                    exePath,
                });
            }
        });
    }

    // When unit testing, we don't have session settings available to test, so skip reading this setting
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
