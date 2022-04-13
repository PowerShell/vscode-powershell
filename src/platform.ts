// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as child_process from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import { IPowerShellAdditionalExePathSettings } from "./settings";

const WindowsPowerShell64BitLabel = "Windows PowerShell (x64)";
const WindowsPowerShell32BitLabel = "Windows PowerShell (x86)";

const LinuxExePath        = "/usr/bin/pwsh";
const LinuxPreviewExePath = "/usr/bin/pwsh-preview";

const SnapExePath         = "/snap/bin/pwsh";
const SnapPreviewExePath  = "/snap/bin/pwsh-preview";

const MacOSExePath        = "/usr/local/bin/pwsh";
const MacOSPreviewExePath = "/usr/local/bin/pwsh-preview";

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
    readonly displayName: string;
    readonly exePath: string;
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

    const isProcess64Bit = (process.arch === "x64" || process.arch === "arm64");

    return {
        operatingSystem,
        isOS64Bit: isProcess64Bit || process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432"),
        isProcess64Bit,
    };
}

/**
 * Class to lazily find installed PowerShell executables on a machine.
 * When given a list of additional PowerShell executables,
 * this will also surface those at the end of the list.
 */
export class PowerShellExeFinder {
    // This is required, since parseInt("7-preview") will return 7.
    private static IntRegex: RegExp = /^\d+$/;

    private static PwshMsixRegex: RegExp = /^Microsoft.PowerShell_.*/;

    private static PwshPreviewMsixRegex: RegExp = /^Microsoft.PowerShellPreview_.*/;

    // The platform details descriptor for the platform we're on
    private readonly platformDetails: IPlatformDetails;

    // Additional configured PowerShells
    private readonly additionalPSExeSettings: IPowerShellAdditionalExePathSettings;

    private winPS: IPossiblePowerShellExe;

    private alternateBitnessWinPS: IPossiblePowerShellExe;

    /**
     * Create a new PowerShellFinder object to discover PowerShell installations.
     * @param platformDetails Information about the machine we are running on.
     * @param additionalPowerShellExes Additional PowerShell installations as configured in the settings.
     */
    constructor(
        platformDetails?: IPlatformDetails,
        additionalPowerShellExes?: IPowerShellAdditionalExePathSettings) {

        this.platformDetails = platformDetails || getPlatformDetails();
        this.additionalPSExeSettings = additionalPowerShellExes || {};
    }

    /**
     * Returns the first available PowerShell executable found in the search order.
     */
    public getFirstAvailablePowerShellInstallation(): IPowerShellExeDetails {
        for (const pwsh of this.enumeratePowerShellInstallations()) {
            return pwsh;
        }
    }

    /**
     * Get an array of all PowerShell executables found when searching for PowerShell installations.
     */
    public getAllAvailablePowerShellInstallations(): IPowerShellExeDetails[] {
        return Array.from(this.enumeratePowerShellInstallations());
    }

    /**
     * Fixes PowerShell paths when Windows PowerShell is set to the non-native bitness.
     * @param configuredPowerShellPath the PowerShell path configured by the user.
     */
    public fixWindowsPowerShellPath(configuredPowerShellPath: string): string {
        const altWinPS = this.findWinPS({ useAlternateBitness: true });

        if (!altWinPS) {
            return configuredPowerShellPath;
        }

        const lowerAltWinPSPath = altWinPS.exePath.toLocaleLowerCase();
        const lowerConfiguredPath = configuredPowerShellPath.toLocaleLowerCase();

        if (lowerConfiguredPath === lowerAltWinPSPath) {
            return this.findWinPS().exePath;
        }

        return configuredPowerShellPath;
    }

    /**
     * Iterates through PowerShell installations on the machine according
     * to configuration passed in through the constructor.
     * PowerShell items returned by this object are verified
     * to exist on the filesystem.
     */
    public *enumeratePowerShellInstallations(): Iterable<IPowerShellExeDetails> {
        // Get the default PowerShell installations first
        for (const defaultPwsh of this.enumerateDefaultPowerShellInstallations()) {
            if (defaultPwsh && defaultPwsh.exists()) {
                yield defaultPwsh;
            }
        }

        // Also show any additionally configured PowerShells
        // These may be duplicates of the default installations, but given a different name.
        for (const additionalPwsh of this.enumerateAdditionalPowerShellInstallations()) {
            if (additionalPwsh && additionalPwsh.exists()) {
                yield additionalPwsh;
            }
        }
    }

    /**
     * Iterates through all the possible well-known PowerShell installations on a machine.
     * Returned values may not exist, but come with an .exists property
     * which will check whether the executable exists.
     */
    private *enumerateDefaultPowerShellInstallations(): Iterable<IPossiblePowerShellExe> {
        // Find PSCore stable first
        yield this.findPSCoreStable();

        switch (this.platformDetails.operatingSystem) {
            case OperatingSystem.Linux:
                // On Linux, find the snap
                yield this.findPSCoreStableSnap();
                break;

            case OperatingSystem.Windows:
                // Windows may have a 32-bit pwsh.exe
                yield this.findPSCoreWindowsInstallation({ useAlternateBitness: true });

                // Also look for the MSIX/UWP installation
                yield this.findPSCoreMsix();

                break;
        }

        // Look for the .NET global tool
        // Some older versions of PowerShell have a bug in this where startup will fail,
        // but this is fixed in newer versions
        yield this.findPSCoreDotnetGlobalTool();

        // Look for PSCore preview
        yield this.findPSCorePreview();

        switch (this.platformDetails.operatingSystem) {
            // On Linux, there might be a preview snap
            case OperatingSystem.Linux:
                yield this.findPSCorePreviewSnap();
                break;

            case OperatingSystem.Windows:
                // Find a preview MSIX
                yield this.findPSCoreMsix({ findPreview: true });

                // Look for pwsh-preview with the opposite bitness
                yield this.findPSCoreWindowsInstallation({ useAlternateBitness: true, findPreview: true });

                // Finally, get Windows PowerShell

                // Get the natural Windows PowerShell for the process bitness
                yield this.findWinPS();

                // Get the alternate bitness Windows PowerShell
                yield this.findWinPS({ useAlternateBitness: true });

                break;
        }
    }

    /**
     * Iterates through the configured additonal PowerShell executable locations,
     * without checking for their existence.
     */
    private *enumerateAdditionalPowerShellInstallations(): Iterable<IPossiblePowerShellExe> {
        for (const versionName in this.additionalPSExeSettings) {
            if (Object.prototype.hasOwnProperty.call(this.additionalPSExeSettings, versionName)) {
                const exePath = this.additionalPSExeSettings[versionName];
                if (exePath) {
                    yield new PossiblePowerShellExe(exePath, versionName);
                }
            }
        }
    }

    private findPSCoreStable(): IPossiblePowerShellExe {
        switch (this.platformDetails.operatingSystem) {
            case OperatingSystem.Linux:
                return new PossiblePowerShellExe(LinuxExePath, "PowerShell");

            case OperatingSystem.MacOS:
                return new PossiblePowerShellExe(MacOSExePath, "PowerShell");

            case OperatingSystem.Windows:
                return this.findPSCoreWindowsInstallation();
        }
    }

    private findPSCorePreview(): IPossiblePowerShellExe {
        switch (this.platformDetails.operatingSystem) {
            case OperatingSystem.Linux:
                return new PossiblePowerShellExe(LinuxPreviewExePath, "PowerShell Preview");

            case OperatingSystem.MacOS:
                return new PossiblePowerShellExe(MacOSPreviewExePath, "PowerShell Preview");

            case OperatingSystem.Windows:
                return this.findPSCoreWindowsInstallation({ findPreview: true });
        }
    }

    private findPSCoreDotnetGlobalTool(): IPossiblePowerShellExe {
        const exeName: string = this.platformDetails.operatingSystem === OperatingSystem.Windows
            ? "pwsh.exe"
            : "pwsh";

        const dotnetGlobalToolExePath: string = path.join(os.homedir(), ".dotnet", "tools", exeName);

        return new PossiblePowerShellExe(dotnetGlobalToolExePath, ".NET Core PowerShell Global Tool");
    }

    private findPSCoreMsix({ findPreview }: { findPreview?: boolean } = {}): IPossiblePowerShellExe {
        // We can't proceed if there's no LOCALAPPDATA path
        if (!process.env.LOCALAPPDATA) {
            return null;
        }

        // Find the base directory for MSIX application exe shortcuts
        const msixAppDir = path.join(process.env.LOCALAPPDATA, "Microsoft", "WindowsApps");

        if (!fileExistsSync(msixAppDir)) {
            return null;
        }

        // Define whether we're looking for the preview or the stable
        const { pwshMsixDirRegex, pwshMsixName } = findPreview
            ? { pwshMsixDirRegex: PowerShellExeFinder.PwshPreviewMsixRegex, pwshMsixName: "PowerShell Preview (Store)" }
            : { pwshMsixDirRegex: PowerShellExeFinder.PwshMsixRegex, pwshMsixName: "PowerShell (Store)" };

        // We should find only one such application, so return on the first one
        for (const subdir of fs.readdirSync(msixAppDir)) {
            if (pwshMsixDirRegex.test(subdir)) {
                const pwshMsixPath = path.join(msixAppDir, subdir, "pwsh.exe");
                return new PossiblePowerShellExe(pwshMsixPath, pwshMsixName);
            }
        }

        // If we find nothing, return null
        return null;
    }

    private findPSCoreStableSnap(): IPossiblePowerShellExe {
        return new PossiblePowerShellExe(SnapExePath, "PowerShell Snap");
    }

    private findPSCorePreviewSnap(): IPossiblePowerShellExe {
        return new PossiblePowerShellExe(SnapPreviewExePath, "PowerShell Preview Snap");
    }

    private findPSCoreWindowsInstallation(
        { useAlternateBitness = false, findPreview = false }:
            { useAlternateBitness?: boolean; findPreview?: boolean } = {}): IPossiblePowerShellExe {

        const programFilesPath: string = this.getProgramFilesPath({ useAlternateBitness });

        if (!programFilesPath) {
            return null;
        }

        const powerShellInstallBaseDir = path.join(programFilesPath, "PowerShell");

        // Ensure the base directory exists
        try {
            const powerShellInstallBaseDirLStat = fs.lstatSync(powerShellInstallBaseDir);
            if (!powerShellInstallBaseDirLStat.isDirectory())
            {
                return null;
            }
        } catch {
            return null;
        }

        let highestSeenVersion: number = -1;
        let pwshExePath: string = null;
        for (const item of fs.readdirSync(powerShellInstallBaseDir)) {

            let currentVersion: number = -1;
            if (findPreview) {
                // We are looking for something like "7-preview"

                // Preview dirs all have dashes in them
                const dashIndex = item.indexOf("-");
                if (dashIndex < 0) {
                    continue;
                }

                // Verify that the part before the dash is an integer
                const intPart: string = item.substring(0, dashIndex);
                if (!PowerShellExeFinder.IntRegex.test(intPart)) {
                    continue;
                }

                // Verify that the part after the dash is "preview"
                if (item.substring(dashIndex + 1) !== "preview") {
                    continue;
                }

                currentVersion = parseInt(intPart, 10);
            } else {
                // Search for a directory like "6" or "7"
                if (!PowerShellExeFinder.IntRegex.test(item)) {
                    continue;
                }

                currentVersion = parseInt(item, 10);
            }

            // Ensure we haven't already seen a higher version
            if (currentVersion <= highestSeenVersion) {
                continue;
            }

            // Now look for the file
            const exePath = path.join(powerShellInstallBaseDir, item, "pwsh.exe");
            if (!fs.existsSync(exePath)) {
                continue;
            }

            pwshExePath = exePath;
            highestSeenVersion = currentVersion;
        }

        if (!pwshExePath) {
            return null;
        }

        const bitness: string = programFilesPath.includes("x86")
            ? "(x86)"
            : "(x64)";

        const preview: string = findPreview ? " Preview" : "";

        return new PossiblePowerShellExe(pwshExePath, `PowerShell${preview} ${bitness}`);
    }

    private findWinPS({ useAlternateBitness = false }: { useAlternateBitness?: boolean } = {}): IPossiblePowerShellExe {

        // 32-bit OSes only have one WinPS on them
        if (!this.platformDetails.isOS64Bit && useAlternateBitness) {
            return null;
        }

        let winPS = useAlternateBitness ? this.alternateBitnessWinPS : this.winPS;
        if (winPS === undefined) {
            const systemFolderPath: string = this.getSystem32Path({ useAlternateBitness });

            const winPSPath = path.join(systemFolderPath, "WindowsPowerShell", "v1.0", "powershell.exe");

            let displayName: string;
            if (this.platformDetails.isProcess64Bit) {
                displayName = useAlternateBitness
                    ? WindowsPowerShell32BitLabel
                    : WindowsPowerShell64BitLabel;
            } else if (this.platformDetails.isOS64Bit) {
                displayName = useAlternateBitness
                    ? WindowsPowerShell64BitLabel
                    : WindowsPowerShell32BitLabel;
            } else {
                displayName = WindowsPowerShell32BitLabel;
            }

            winPS = new PossiblePowerShellExe(winPSPath, displayName, { knownToExist: true });

            if (useAlternateBitness) {
                this.alternateBitnessWinPS = winPS;
            } else {
                this.winPS = winPS;
            }
        }

        return winPS;
    }

    private getProgramFilesPath(
        { useAlternateBitness = false }: { useAlternateBitness?: boolean } = {}): string | null {

        if (!useAlternateBitness) {
            // Just use the native system bitness
            return process.env.ProgramFiles;
        }

        // We might be a 64-bit process looking for 32-bit program files
        if (this.platformDetails.isProcess64Bit) {
            return process.env["ProgramFiles(x86)"];
        }

        // We might be a 32-bit process looking for 64-bit program files
        if (this.platformDetails.isOS64Bit) {
            return process.env.ProgramW6432;
        }

        // We're a 32-bit process on 32-bit Windows, there is no other Program Files dir
        return null;
    }

    private getSystem32Path({ useAlternateBitness = false }: { useAlternateBitness?: boolean } = {}): string | null {
        const windir: string = process.env.windir;

        if (!useAlternateBitness) {
            // Just use the native system bitness
            return path.join(windir, "System32");
        }

        // We might be a 64-bit process looking for 32-bit system32
        if (this.platformDetails.isProcess64Bit) {
            return path.join(windir, "SysWOW64");
        }

        // We might be a 32-bit process looking for 64-bit system32
        if (this.platformDetails.isOS64Bit) {
            return path.join(windir, "Sysnative");
        }

        // We're on a 32-bit Windows, so no alternate bitness
        return null;
    }
}

export function getWindowsSystemPowerShellPath(systemFolderName: string) {
    return path.join(
        process.env.windir,
        systemFolderName,
        "WindowsPowerShell",
        "v1.0",
        "powershell.exe");
}

function fileExistsSync(filePath: string): boolean {
    try {
        // This will throw if the path does not exist,
        // and otherwise returns a value that we don't care about
        fs.lstatSync(filePath);
        return true;
    } catch {
        return false;
    }
}

interface IPossiblePowerShellExe extends IPowerShellExeDetails {
    exists(): boolean;
}

class PossiblePowerShellExe implements IPossiblePowerShellExe {
    public readonly exePath: string;
    public readonly displayName: string;

    private knownToExist: boolean;

    constructor(
        pathToExe: string,
        installationName: string,
        { knownToExist = false }: { knownToExist?: boolean } = {}) {

        this.exePath = pathToExe;
        this.displayName = installationName;
        this.knownToExist = knownToExist || undefined;
    }

    public exists(): boolean {
        if (this.knownToExist === undefined) {
            this.knownToExist = fileExistsSync(this.exePath);
        }
        return this.knownToExist;
    }
}
