/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as child_process from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import * as Settings from "./settings";

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
 * Class to lazily find installed PowerShell executables on a machine.
 * When given a list of additional PowerShell executables,
 * this will also surface those at the end of the list.
 */
export class PowerShellExeFinder {
    // This is required, since parseInt("7-preview") will return 7.
    private static IntRegex: RegExp = /^\d+$/;

    private readonly platformDetails: IPlatformDetails;

    // PSCore version table
    private readonly pwshWindowsInstallationsVal:
        Lazy<{ stable: IPossiblePowerShellExe, preview: IPossiblePowerShellExe }>;
    private readonly pwshAlternateBitnessWindowsInstallationsVal:
        Lazy<{ stable: IPossiblePowerShellExe, preview: IPossiblePowerShellExe }>;

    // PowerShell 6+ installation
    private readonly stablePwshExeVal: Lazy<IPossiblePowerShellExe>;
    private readonly previewPwshExeVal: Lazy<IPossiblePowerShellExe>;

    // 32-bit PowerShell 6+ installation
    private readonly stableAlternateBitnessPwshExeVal: Lazy<IPossiblePowerShellExe>;
    private readonly previewAlternateBitnessPwshExeVal: Lazy<IPossiblePowerShellExe>;

    // .NET Global Tool pwsh installation
    private readonly dotnetGlobalToolExeVal: Lazy<IPossiblePowerShellExe>;

    // MSIX/UWP installation
    private readonly msixExeVal: Lazy<IPossiblePowerShellExe>;

    // Snap pwsh installations on Linux
    private readonly stableSnapExeVal: Lazy<IPossiblePowerShellExe>;
    private readonly previewSnapExeVal: Lazy<IPossiblePowerShellExe>;

    // Windows PowerShell installations
    private readonly winPSExeVal: Lazy<IPossiblePowerShellExe>;
    private readonly alternateBitnessWinPSExeVal: Lazy<IPossiblePowerShellExe>;

    // Additional configured PowerShells
    private readonly additionalPSExeSettings: Iterable<Settings.IPowerShellAdditionalExePathSettings>;

    /**
     * Create a new PowerShellFinder object to discover PowerShell installations.
     * @param platformDetails Information about the machine we are running on.
     * @param additionalPowerShellExes Additional PowerShell installations as configured in the settings.
     */
    constructor(
        platformDetails?: IPlatformDetails,
        additionalPowerShellExes?: Iterable<Settings.IPowerShellAdditionalExePathSettings>) {

        this.platformDetails = platformDetails || getPlatformDetails();
        this.additionalPSExeSettings = additionalPowerShellExes || [];

        this.pwshWindowsInstallationsVal = new Lazy(() => this.findPSCoreWindowsInstallations());
        this.pwshAlternateBitnessWindowsInstallationsVal = new Lazy(
            () => this.findPSCoreWindowsInstallations({ findNonNativeBitness: true }));

        this.stablePwshExeVal                  = new Lazy(() => this.findPSCoreStable());
        this.stableAlternateBitnessPwshExeVal  = new Lazy(() => this.findPSCoreAlternateBitnessStable());
        this.previewAlternateBitnessPwshExeVal = new Lazy(() => this.findPSCoreAlternateBitnessPreview());
        this.previewPwshExeVal                 = new Lazy(() => this.findPSCorePreview());
        this.dotnetGlobalToolExeVal            = new Lazy(() => this.findPSCoreDotnetGlobalTool());
        this.msixExeVal                        = new Lazy(() => this.findPSCoreMsix());
        this.stableSnapExeVal                  = new Lazy(() => this.findPSCoreStableSnap());
        this.previewSnapExeVal                 = new Lazy(() => this.findPSCorePreviewSnap());
        this.winPSExeVal                       = new Lazy(() => this.findWinPS());
        this.alternateBitnessWinPSExeVal       = new Lazy(() => this.findWinPS({ findNonNativeBitness: true }));
    }

    /**
     * The stable PowerShell 6+ installation.
     * May be null if the installation directory is not present.
     */
    private get pwshStable(): IPossiblePowerShellExe {
        return this.stablePwshExeVal.value;
    }

    /**
     * The preview PowerShell 6+ installation.
     * May be null if the installation directory is not present.
     */
    private get pwshPreview(): IPossiblePowerShellExe {
        return this.previewPwshExeVal.value;
    }

    /**
     * The stable non-process-native bitness PowerShell 6+ installation.
     * This means 32-bit in a 64-bit process, and vice versa.
     * May be null if the installation directory is not present
     */
    private get pwshAlternateBitnessStable(): IPossiblePowerShellExe {
        return this.stableAlternateBitnessPwshExeVal.value;
    }

    /**
     * The preview non-process-native bitness PowerShell 6+ installation.
     * This means 32-bit in a 64-bit process, and vice versa.
     * May be null if the installation directory is not present.
     */
    private get pwshAlternateBitnessPreview(): IPossiblePowerShellExe {
        return this.previewAlternateBitnessPwshExeVal.value;
    }

    /**
     * PowerShell 6+ installation from an MSIX (through the Windows store).
     * May be null if the AppX package is not found.
     */
    private get pwshMsix(): IPossiblePowerShellExe {
        return this.msixExeVal.value;
    }

    /**
     * PowerShell 6+ stable Snap installation on Linux.
     */
    private get pwshSnapStable(): IPossiblePowerShellExe {
        return this.stableSnapExeVal.value;
    }

    /**
     * PowerShell 6+ preview Snap installation on Linux.
     */
    private get pwshSnapPreview(): IPossiblePowerShellExe {
        return this.previewSnapExeVal.value;
    }

    /**
     * PowerShell 6+ .NET Core global tool installation.
     */
    private get pwshDotnetGlobalTool(): IPossiblePowerShellExe {
        return this.dotnetGlobalToolExeVal.value;
    }

    /**
     * The Windows PowerShell installation under the %windir%\System32 folder.
     * This always exists.
     */
    private get winPS(): IPossiblePowerShellExe {
        return this.winPSExeVal.value;
    }

    /**
     * On 64-bit Windows, refers to the Windows PowerShell installation
     * not native to the current process' bitness.
     */
    private get alternateBitnessWinPS(): IPossiblePowerShellExe {
        return this.alternateBitnessWinPSExeVal.value;
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
        const lowerConfiguredPath = configuredPowerShellPath.toLocaleLowerCase();
        const lowerAltWinPSPath = this.alternateBitnessWinPS.exePath.toLocaleLowerCase();

        if (lowerConfiguredPath === lowerAltWinPSPath) {
            return this.winPS.exePath;
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
            if (defaultPwsh && defaultPwsh.exists) {
                yield defaultPwsh;
            }
        }

        // Also show any additionally configured PowerShells
        // These may be duplicates of the default installations, but given a different name.
        for (const additionalPwsh of this.enumerateAdditionalPowerShellInstallations()) {
            if (additionalPwsh && additionalPwsh.exists) {
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
        if (this.pwshStable) {
            yield this.pwshStable;
        }

        switch (this.platformDetails.operatingSystem) {
            case OperatingSystem.Windows:
                // Windows may have a 32-bit pwsh.exe
                if (this.pwshAlternateBitnessStable) {
                    yield this.pwshAlternateBitnessStable;
                }
                // Also look for the MSIX/UWP installation
                if (this.pwshMsix) {
                    yield this.pwshMsix;
                }
                break;

            case OperatingSystem.Linux:
                // On Linux, find the snap
                yield this.pwshSnapStable;
                break;
        }

        // TODO:
        // Enable this when the global tool has been updated
        // to support proper argument passing.
        // Currently it cannot take startup arguments to start PSES with.
        //
        // Look for the .NET global tool
        // yield this.pwshDotnetGlobalTool;

        // Look for PSCore preview
        if (this.pwshPreview) {
            yield this.pwshPreview;
        }

        switch (this.platformDetails.operatingSystem) {
            // On Linux, there might be a preview snap
            case OperatingSystem.Linux:
                yield this.pwshSnapPreview;
                break;

            case OperatingSystem.Windows:
                // Look for pwsh-preview with the opposite bitness
                if (this.pwshAlternateBitnessPreview) {
                    yield this.pwshAlternateBitnessPreview;
                }

                // Finally, get Windows PowerShell

                // Get the natural Windows PowerShell for the process bitness
                yield this.winPS;

                if (this.alternateBitnessWinPS) {
                    yield this.alternateBitnessWinPS;
                }

                break;
        }
    }

    /**
     * Iterates through the configured additonal PowerShell executable locations,
     * without checking for their existence.
     */
    private *enumerateAdditionalPowerShellInstallations(): Iterable<IPossiblePowerShellExe> {
        for (const additionalPwshSetting of this.additionalPSExeSettings) {
            yield this.findAdditionalPwshExe(additionalPwshSetting);
        }
    }

    private findPSCoreWindowsInstallations(options?: { findNonNativeBitness?: boolean }):
            { stable: IPossiblePowerShellExe | null, preview: IPossiblePowerShellExe | null } | null {

        const programFilesPath: string = this.getProgramFilesPath(
            { useAlternateBitness: options && options.findNonNativeBitness });

        const powerShellInstallBaseDir = path.join(programFilesPath, "PowerShell");

        // Ensure the base directory exists
        if (!(fs.existsSync(powerShellInstallBaseDir) && fs.lstatSync(powerShellInstallBaseDir).isDirectory())) {
            return null;
        }

        let highestSeenStableNumber: number = -1;
        let stablePath: string = null;
        let highestSeenPreviewNumber: number = -1;
        let previewPath: string = null;
        for (const item of fs.readdirSync(powerShellInstallBaseDir)) {

            // Search for a directory like "6" or "7" first
            if (item.match(PowerShellExeFinder.IntRegex)) {
                const currentStable = parseInt(item, 10);

                // We may have already picked up a higher version
                if (currentStable <= highestSeenStableNumber) {
                    continue;
                }

                // If the directory exists, but not pwsh.exe, just keep looking through dirs
                const stableExePath = path.join(powerShellInstallBaseDir, item, "pwsh.exe");
                if (!fs.existsSync(stableExePath)) {
                    continue;
                }

                stablePath = stableExePath;
                highestSeenStableNumber = currentStable;
                continue;
            }

            // Now look for something like "7-preview"

            // Preview dirs all have dashes in them
            const dashIndex = item.indexOf("-");
            if (dashIndex < 0) {
                continue;
            }

            // Verify that the part before the dash is an integer
            const intPart: string = item.substring(0, dashIndex);
            if (!intPart.match(PowerShellExeFinder.IntRegex)) {
                continue;
            }

            // Weed out non preview dirs or versions lower than the one we've already seen
            const currentPreview = parseInt(intPart, 10);
            if (currentPreview <= highestSeenPreviewNumber || item.substring(dashIndex + 1) !== "preview") {
                continue;
            }

            // Now look for the file
            const previewExePath = path.join(powerShellInstallBaseDir, item, "pwsh.exe");
            if (!fs.existsSync(previewExePath)) {
                continue;
            }

            previewPath = previewExePath;
            highestSeenPreviewNumber = currentPreview;
        }

        const bitness: string = programFilesPath.includes("x86")
            ? "(x86)"
            : "(x64)";

        return {
            stable: stablePath && new PSCoreExe(stablePath, `PowerShell ${bitness}`, { knownToExist: true }),
            preview: previewPath && new PSCoreExe(previewPath, `PowerShell Preview ${bitness}`, { knownToExist: true }),
        };
    }

    private getProgramFilesPath(options?: { useAlternateBitness?: boolean }): string | null {
        if (!options || !options.useAlternateBitness) {
            return process.env.ProgramFiles;
        }

        if (this.platformDetails.isProcess64Bit) {
            return process.env["ProgramFiles(x86)"];
        }

        if (this.platformDetails.isOS64Bit) {
            return process.env.ProgramW6432;
        }

        // We're a 32-bit process on 32-bit Windows, there is no other Program Files dir
        return null;
    }

    private getSystem32Path(options?: { useAlternateBitness?: boolean }): string | null {
        const windir: string = process.env.windir;

        if (!options || !options.useAlternateBitness) {
            return path.join(windir, "System32");
        }

        if (this.platformDetails.isProcess64Bit) {
            return path.join(windir, "SysWOW64");
        }

        if (this.platformDetails.isOS64Bit) {
            return path.join(windir, "Sysnative");
        }

        // We're on a 32-bit Windows, so no alternate bitness
        return null;
    }

    private findAdditionalPwshExe(additionalPwshSetting: Settings.IPowerShellAdditionalExePathSettings) {
        return new PSCoreExe(
            additionalPwshSetting.exePath,
            additionalPwshSetting.versionName);
    }

    private findPSCoreStable(): IPossiblePowerShellExe {
        switch (this.platformDetails.operatingSystem) {
            case OperatingSystem.Linux:
                return new PSCoreExe(LinuxExePath, "PowerShell");

            case OperatingSystem.MacOS:
                return new PSCoreExe(MacOSExePath, "PowerShell");

            case OperatingSystem.Windows:
                return this.pwshWindowsInstallationsVal.value
                    && this.pwshWindowsInstallationsVal.value.stable;
        }
    }

    private findPSCorePreview(): IPossiblePowerShellExe {
        switch (this.platformDetails.operatingSystem) {
            case OperatingSystem.Linux:
                return new PSCoreExe(LinuxPreviewExePath, "PowerShell Preview");

            case OperatingSystem.MacOS:
                return new PSCoreExe(MacOSPreviewExePath, "PowerShell Preview");

            case OperatingSystem.Windows:
                return this.pwshWindowsInstallationsVal.value
                    && this.pwshWindowsInstallationsVal.value.preview;
        }
    }

    private findPSCoreAlternateBitnessStable(): IPossiblePowerShellExe {
        return this.pwshAlternateBitnessWindowsInstallationsVal.value
            && this.pwshAlternateBitnessWindowsInstallationsVal.value.stable;
    }

    private findPSCoreAlternateBitnessPreview(): IPossiblePowerShellExe {
        return this.pwshAlternateBitnessWindowsInstallationsVal.value
            && this.pwshAlternateBitnessWindowsInstallationsVal.value.preview;
    }

    private findPSCoreDotnetGlobalTool(): IPossiblePowerShellExe {
        const exeName: string = this.platformDetails.operatingSystem === OperatingSystem.Windows
            ? "pwsh.exe"
            : "pwsh";

        const dotnetGlobalToolExePath: string = path.join(os.homedir(), ".dotnet", "tools", exeName);

        return new PSCoreExe(dotnetGlobalToolExePath, ".NET Core PowerShell Global Tool");
    }

    private findPSCoreMsix(): IPossiblePowerShellExe {
        const winPSPath: string = this.findWinPS().exePath;
        const msixDir: string = child_process.execFileSync(winPSPath, ["-c", "(Get-AppxPackage -Name Microsoft.PowerShell).InstallLocation"])
            .toString()
            .trim();

        if (!msixDir) {
            return null;
        }

        const msixExePath = path.join(msixDir, "pwsh.exe");
        return new PSCoreExe(msixExePath, "PowerShell MSIX");
    }

    private findPSCoreStableSnap(): IPossiblePowerShellExe {
        return new PSCoreExe(SnapExePath, "PowerShell Snap");
    }

    private findPSCorePreviewSnap(): IPossiblePowerShellExe {
        return new PSCoreExe(SnapPreviewExePath, "PowerShell Preview Snap");
    }

    private findWinPS(options?: { findNonNativeBitness: boolean }): IPossiblePowerShellExe {
        const useAlternateBitness: boolean = options && options.findNonNativeBitness;

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

        return new WinPSExe(winPSPath, displayName, { knownToExist: !useAlternateBitness });
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

interface IPossiblePowerShellExe extends IPowerShellExeDetails {
    readonly exists: boolean;
}

abstract class PossiblePowerShellExe implements IPossiblePowerShellExe {
    protected readonly lazyVersion: Lazy<string>;

    private readonly pathToExe: string;
    private readonly installationName: string;
    private readonly existsCheck: Lazy<boolean> = null;

    constructor(
        pathToExe: string,
        installationName: string,
        options?: { knownToExist?: boolean }) {

        this.pathToExe = pathToExe;
        this.installationName = installationName;

        this.existsCheck = new Lazy(() => (options && options.knownToExist) || fs.existsSync(this.exePath));
        this.lazyVersion = new Lazy(() => this.findVersion());
    }

    get version(): string {
        return this.lazyVersion.value;
    }

    get exePath(): string {
        return this.pathToExe;
    }

    get exists(): boolean {
        return this.existsCheck.value;
    }

    get displayName(): string {
        return this.installationName;
    }

    protected abstract findVersion(): string;
}

class WinPSExe extends PossiblePowerShellExe {
    protected findVersion(): string {
        return child_process.execFileSync(this.exePath, ["-c", "$PSVersionTable.PSVersion.ToString()"]);
    }
}

class PSCoreExe extends PossiblePowerShellExe {
    protected findVersion(): string {
        const versionLine = child_process.execFileSync(this.exePath, ["-v"]);
        const spaceIndex = versionLine.indexOf(" ");
        return versionLine.substring(spaceIndex + 1);
    }
}

class Lazy<T> {
    private readonly factory: () => T;
    private constructed: boolean;
    private underlyingValue: T;

    constructor(factory: () => T) {
        this.constructed = false;
        this.underlyingValue = null;
        this.factory = factory;
    }

    public get value() {
        if (!this.constructed) {
            this.constructed = true;
            this.underlyingValue = this.factory();
        }
        return this.underlyingValue;
    }
}
