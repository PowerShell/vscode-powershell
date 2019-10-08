/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as child_process from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import * as Settings from "./settings";

export const System32PowerShellPath = getWindowsSystemPowerShellPath("System32");
export const SysnativePowerShellPath = getWindowsSystemPowerShellPath("Sysnative");
export const SysWow64PowerShellPath = getWindowsSystemPowerShellPath("SysWow64");

export const WindowsPowerShell64BitLabel = "Windows PowerShell (x64)";
export const WindowsPowerShell32BitLabel = "Windows PowerShell (x86)";

const powerShell64BitPathOn32Bit = SysnativePowerShellPath.toLocaleLowerCase();
const powerShell32BitPathOn64Bit = SysWow64PowerShellPath.toLocaleLowerCase();

const dotnetGlobalToolExePath = path.join(os.homedir(), ".dotnet", "tools", "pwsh.exe");

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

export class PowerShellNotFoundError extends Error {
    public readonly powershellPath: string;

    constructor(powershellPath: string) {
        super(`Unable to find PowerShell installation at path '${powershellPath}'`);
        this.powershellPath = powershellPath;
    }
}

/**
 * Gets the default instance of PowerShell for the specified platform,
 * depending on the operating system and the bitness required.
 * If a stable PowerShell Core installation can be found, this will be preferred.
 * @param platformDetails Specifies information about the platform - primarily the operating system.
 * @param use32Bit On Windows, this boolean determines whether the 32-bit version of Windows PowerShell is returned.
 * @returns A string containing the path of the default version of PowerShell.
 */
export function getDefaultPowerShellPath(
    platformDetails: IPlatformDetails,
    use32Bit: boolean = false): string | null {

    let pwshPath: string;
    for (pwshPath of enumeratePowerShellInstallationPaths(platformDetails, use32Bit)) {
        // TODO: check if the file is executable (complicated stat logic...)
        if (fs.existsSync(pwshPath)) {
            return pwshPath;
        }
    }

    throw new PowerShellNotFoundError(pwshPath);
}

export function getWindowsSystemPowerShellPath(systemFolderName: string) {
    return `${process.env.windir}\\${systemFolderName}\\WindowsPowerShell\\v1.0\\powershell.exe`;
}

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
                    versionName: `PowerShell ${path.parse(item).base} ${arch}`,
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
                    versionName: "PowerShell" + (/-preview/.test(exePath) ? " Preview" : ""),
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

function enumeratePowerShellInstallationPaths(
    platformDetails: IPlatformDetails,
    use32Bit: boolean): Iterable<string> {

    switch (platformDetails.operatingSystem) {
        case OperatingSystem.Windows:
            return enumeratePowerShellInstallationPathsForWindows(platformDetails, use32Bit);

        case OperatingSystem.MacOS:
            return enumeratePowerShellInstallationPathsForMacOS();

        case OperatingSystem.Linux:
            return enumeratePowerShellInstallationPathsForLinux();

        default:
            return [];
    }
}

function *enumeratePowerShellInstallationPathsForWindows(
    platformDetails: IPlatformDetails,
    use32Bit: boolean): Iterable<string> {
        let psCoreInstallDirPath: string;

        if (use32Bit) {
            psCoreInstallDirPath = platformDetails.isProcess64Bit
                ? process.env["ProgramFiles(x86)"]
                : process.env.ProgramFiles;
        } else {
            psCoreInstallDirPath = platformDetails.isProcess64Bit
                ? process.env.ProgramFiles
                : process.env.ProgramW6432;
        }

        psCoreInstallDirPath = path.join(psCoreInstallDirPath, "PowerShell");

        // Search for PS 6/7 paths
        // These look like "%ProgramFiles%\PowerShell\<major-version>\pwsh.exe"
        if (fs.existsSync(psCoreInstallDirPath) && fs.lstatSync(psCoreInstallDirPath).isDirectory()) {
            for (const item of fs.readdirSync(psCoreInstallDirPath)) {
                if (parseInt(item, 10)) {
                    yield path.join(psCoreInstallDirPath, item, "pwsh.exe");
                }
            }
        }

        // Now try the MSIX path
        yield getPowerShellMsixPath(platformDetails, use32Bit);

        // Now try the .NET global tool pwsh.exe
        yield dotnetGlobalToolExePath;

        // Finally find Windows PowerShell, which should always succeed (so don't look for pwsh-preview.exe)
        yield getWindowsPowerShellPath(platformDetails, use32Bit);
}

function *enumeratePowerShellInstallationPathsForMacOS(): Iterable<string> {
    yield macOSExePath;
    yield dotnetGlobalToolExePath;
    yield macOSPreviewExePath;
}

function *enumeratePowerShellInstallationPathsForLinux(): Iterable<string> {
    yield linuxExePath;
    yield snapExePath;
    yield dotnetGlobalToolExePath;
    yield linuxPreviewExePath;
    yield snapPreviewExePath;
}

function getWindowsPowerShellPath(platformDetails: IPlatformDetails, use32Bit: boolean): string {
    if (use32Bit) {
        return platformDetails.isProcess64Bit && platformDetails.isOS64Bit
            ? powerShell32BitPathOn64Bit
            : System32PowerShellPath;
    }

    return platformDetails.isProcess64Bit && platformDetails.isOS64Bit
        ? System32PowerShellPath
        : powerShell64BitPathOn32Bit;
}

function getPowerShellMsixPath(platformDetails: IPlatformDetails, use32Bit: boolean): string {
    const winPSPath = getWindowsPowerShellPath(platformDetails, use32Bit);
    const msixDir = child_process.execSync(`"${winPSPath}" -Command "(Get-AppxPackage -Name Microsoft.PowerShell).InstallLocation"`)
        .toString("utf8")
        .trim();

    return path.join(msixDir, "pwsh.exe");
}
