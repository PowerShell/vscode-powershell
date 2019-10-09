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

const WinPS64BitPathOn32Bit = SysnativePowerShellPath.toLocaleLowerCase();
const WinPS32BitPathOn64Bit = SysWow64PowerShellPath.toLocaleLowerCase();

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

export interface IPossiblePowerShellExe extends IPowerShellExeDetails {
    readonly exists: boolean;
    readonly is32Bit: boolean;
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

export class PowerShellExeFinder {
    private readonly platformDetails: IPlatformDetails;

    // PowerShell 6+ installation
    private stablePwshExeVal: Lazy<IPossiblePowerShellExe>;
    private previewPwshExeVal: Lazy<IPossiblePowerShellExe>;

    // 32-bit PowerShell 6+ installation
    private stable32BitPwshExeVal: Lazy<IPossiblePowerShellExe>;
    private preview32BitPwshExeVal: Lazy<IPossiblePowerShellExe>;

    // .NET Global Tool pwsh installation
    private dotnetGlobalToolExeVal: Lazy<IPossiblePowerShellExe>;

    // MSIX/UWP installation
    private msixExeVal: Lazy<IPossiblePowerShellExe>;

    // Snap pwsh installations on Linux
    private stableSnapExeVal: Lazy<IPossiblePowerShellExe>;
    private previewSnapExeVal: Lazy<IPossiblePowerShellExe>;

    // Windows PowerShell installations
    private sys32WinPSExeVal: Lazy<IPossiblePowerShellExe>;
    private sysWow64WinPSExeVal: Lazy<IPossiblePowerShellExe>;
    private sysNativeWinPSExeVal: Lazy<IPossiblePowerShellExe>;

    private additionalPSExeSettings: Iterable<Settings.IPowerShellAdditionalExePathSettings>;

    constructor(
        platformDetails: IPlatformDetails,
        additionalPowerShellExes?: Iterable<Settings.IPowerShellAdditionalExePathSettings>) {

        this.platformDetails = platformDetails;
        this.additionalPSExeSettings = additionalPowerShellExes || [];

        this.stablePwshExeVal = new Lazy(() => this.findPSCoreStable());
        this.stable32BitPwshExeVal = new Lazy(() => this.findPSCore32BitStable());
        this.preview32BitPwshExeVal = new Lazy(() => this.findPSCore32BitPreview());
        this.previewPwshExeVal = new Lazy(() => this.findPSCorePreview());
        this.dotnetGlobalToolExeVal = new Lazy(() => this.findPSCoreDotnetGlobalTool());
        this.msixExeVal = new Lazy(() => this.findPSCoreMsix());
        this.stableSnapExeVal = new Lazy(() => this.findPSCoreStableSnap());
        this.previewSnapExeVal = new Lazy(() => this.findPSCorePreviewSnap());
        this.sys32WinPSExeVal = new Lazy(() => this.findSys32WinPS());
        this.sysWow64WinPSExeVal = new Lazy(() => this.findSysWow64WinPS());
        this.sysNativeWinPSExeVal = new Lazy(() => this.findSysNativeWinPS());
    }

    public *enumeratePowerShellInstallations(): Iterable<IPowerShellExeDetails> {
        for (const defaultPwsh of this.enumerateDefaultPowerShellInstallations()) {
            if (defaultPwsh && defaultPwsh.exists) {
                yield defaultPwsh;
            }
        }

        for (const additionalPwsh of this.enumerateAdditionalPowerShellInstallations()) {
            if (additionalPwsh && additionalPwsh.exists) {
                yield additionalPwsh;
            }
        }
    }

    public *enumerateDefaultPowerShellInstallations(): Iterable<IPossiblePowerShellExe> {
        // Find PSCore stable first
        if (this.pwshStable) {
            yield this.pwshStable;
        }

        switch (this.platformDetails.operatingSystem) {
            case OperatingSystem.Windows:
                // Windows may have a 32-bit pwsh.exe
                if (this.pwsh32Stable) {
                    yield this.pwsh32Stable;
                }
                // Also look for the MSIX/UWP installation
                yield this.pwshMsix;
                break;

            case OperatingSystem.Linux:
                // On Linux, find the snap
                yield this.pwshSnapStable;
                break;
        }

        // Look for the .NET global tool
        yield this.pwshDotnetGlobalTool;

        // Look for PSCore preview
        if (this.pwshPreview) {
            yield this.pwshPreview;
        }

        switch (this.platformDetails.operatingSystem) {
            // On Linux, there might be a preview snap
            case OperatingSystem.Linux:
                yield this.pwshSnapPreview;
                break;

            // Finally, on Windows, get Windows PowerShell
            case OperatingSystem.Windows:
                if (this.pwsh32Preview) {
                    yield this.pwsh32Preview;
                }
                // Get the natural Windows PowerShell for the process bitness
                yield this.sys32WinPS;

                if (this.platformDetails.isProcess64Bit) {
                    // If this is a 64-bit process (which must be on a 64-bit OS),
                    // look for a 32-bit in SysWoW WinPS as well
                    yield this.sysWoW64WinPS;
                } else if (this.platformDetails.isOS64Bit) {
                    // If this is a 32-bit process on a 64-bit operating system,
                    // look for the the system-native 64-bit WinPS too
                    yield this.sysnativeWinPS;
                }
                break;
        }
    }

    public *enumerateAdditionalPowerShellInstallations(): Iterable<IPossiblePowerShellExe> {
        for (const additionalPwshSetting of this.additionalPSExeSettings) {
            yield this.findAdditionalPwshExe(additionalPwshSetting);
        }
    }

    public get pwshStable(): IPossiblePowerShellExe {
        return this.stablePwshExeVal.value;
    }

    public get pwshPreview(): IPossiblePowerShellExe {
        return this.previewPwshExeVal.value;
    }

    public get pwsh32Stable(): IPossiblePowerShellExe {
        return this.stable32BitPwshExeVal.value;
    }

    public get pwsh32Preview(): IPossiblePowerShellExe {
        return this.preview32BitPwshExeVal.value;
    }

    public get pwshMsix(): IPossiblePowerShellExe {
        return this.msixExeVal.value;
    }

    public get pwshSnapStable(): IPossiblePowerShellExe {
        return this.stableSnapExeVal.value;
    }

    public get pwshSnapPreview(): IPossiblePowerShellExe {
        return this.previewSnapExeVal.value;
    }

    public get pwshDotnetGlobalTool(): IPossiblePowerShellExe {
        return this.dotnetGlobalToolExeVal.value;
    }

    public get sys32WinPS(): IPossiblePowerShellExe {
        return this.sys32WinPSExeVal.value;
    }

    public get sysWoW64WinPS(): IPossiblePowerShellExe {
        return this.sysWow64WinPSExeVal.value;
    }

    public get sysnativeWinPS(): IPossiblePowerShellExe {
        return this.sysNativeWinPSExeVal.value;
    }

    private findAdditionalPwshExe(additionalPwshSetting: Settings.IPowerShellAdditionalExePathSettings) {
        return new PSCoreExe(
            additionalPwshSetting.exePath,
            additionalPwshSetting.versionName);
    }

    private findPSCoreStable(): IPossiblePowerShellExe {
        switch (this.platformDetails.operatingSystem) {
            case OperatingSystem.Linux:
                return new PSCoreExe(LinuxExePath, "PowerShell (x64)");

            case OperatingSystem.MacOS:
                return new PSCoreExe(MacOSExePath, "PowerShell (x64)");

            case OperatingSystem.Windows:
                return this.findPSCoreWindows();
        }
    }

    private findPSCorePreview(): IPossiblePowerShellExe {
        switch (this.platformDetails.operatingSystem) {
            case OperatingSystem.Linux:
                return new PSCoreExe(LinuxPreviewExePath, "PowerShell Preview (x64)");

            case OperatingSystem.MacOS:
                return new PSCoreExe(MacOSPreviewExePath, "PowerShell Preview (x64)");

            case OperatingSystem.Windows:
                return this.findPSCoreWindows({ findPreview: true });
        }
    }

    private findPSCore32BitStable(): IPossiblePowerShellExe {
        return this.findPSCoreWindows({ use32Bit: true });
    }

    private findPSCore32BitPreview(): IPossiblePowerShellExe {
        return this.findPSCoreWindows({ use32Bit: true });
    }

    // Search for PS 6/7 under "%ProgramFiles%\PowerShell\<major-version>[-preview]\pwsh.exe"
    private findPSCoreWindows(options?: { use32Bit?: boolean, findPreview?: boolean }): IPossiblePowerShellExe {

        const use32Bit: boolean = options && options.use32Bit;

        const programFilesPath: string = use32Bit
            ? process.env["ProgramFiles(x86)"]
            : process.env.ProgramFiles;

        // Path to "%ProgramFiles%\PowerShell"
        const psCoreInstallDirPath: string = path.join(programFilesPath, "PowerShell");

        // Make sure it exists and is a directory
        if (!(fs.existsSync(psCoreInstallDirPath) && fs.lstatSync(psCoreInstallDirPath).isDirectory())) {
            return undefined;
        }

        // Look for folders that match the number[-preview] scheme
        for (const item of fs.readdirSync(psCoreInstallDirPath)) {
            if (options && options.findPreview) {
                // Look for something like "7-preview"
                const dashIndex = item.indexOf("-");
                if (dashIndex <= 0 || !parseInt(item.substring(0, dashIndex), 10) || item.substring(dashIndex + 1) !== "preview") {
                    continue;
                }
            } else {
                // Look for something like "6"
                if (!parseInt(item, 10)) {
                    continue;
                }
            }

            const pwshName = use32Bit
                ? "PowerShell (x86)"
                : "PowerShell (x64)";

            const exePath = path.join(psCoreInstallDirPath, item, "pwsh.exe");
            return new PSCoreExe(exePath, pwshName, { is32Bit: use32Bit });
        }

        // This method may not find any installation
        // Callers should be aware of this
        return undefined;
    }

    private findPSCoreDotnetGlobalTool(): IPossiblePowerShellExe {
        const exeName: string = this.platformDetails.operatingSystem === OperatingSystem.Windows
            ? "pwsh.exe"
            : "pwsh";

        const dotnetGlobalToolExePath: string = path.join(os.homedir(), ".dotnet", "tools", exeName);

        return new PSCoreExe(dotnetGlobalToolExePath, ".NET Core PowerShell Global Tool");
    }

    private findPSCoreMsix(): IPossiblePowerShellExe {
        const winPSPath: string = this.findSys32WinPS().exePath;
        const msixDir: string = child_process.execFileSync(winPSPath, ["-c", "(Get-AppxPackage -Name Microsoft.PowerShell).InstallLocation"])
            .toString()
            .trim();

        const msixExePath = path.join(msixDir, "pwsh.exe");
        return new PSCoreExe(msixExePath, "PowerShell MSIX");
    }

    private findPSCoreStableSnap(): IPossiblePowerShellExe {
        return new PSCoreExe(SnapExePath, "PowerShell Snap");
    }

    private findPSCorePreviewSnap(): IPossiblePowerShellExe {
        return new PSCoreExe(SnapExePath, "PowerShell Preview Snap");
    }

    private findSys32WinPS(): IPossiblePowerShellExe {
        const displayName: string = this.platformDetails.isOS64Bit
            ? WindowsPowerShell64BitLabel
            : WindowsPowerShell32BitLabel;

        return new WinPSExe(
            System32PowerShellPath,
            displayName,
            { knownToExist: true, is32Bit: !this.platformDetails.isOS64Bit });
    }

    private findSysWow64WinPS(): IPossiblePowerShellExe {
        return new WinPSExe(WinPS32BitPathOn64Bit, WindowsPowerShell64BitLabel);
    }

    private findSysNativeWinPS(): IPossiblePowerShellExe {
        return new WinPSExe(
            WinPS64BitPathOn32Bit,
            WindowsPowerShell32BitLabel,
            { knownToExist: true, is32Bit: true });
    }
}

export function getWindowsSystemPowerShellPath(systemFolderName: string) {
    return `${process.env.windir}\\${systemFolderName}\\WindowsPowerShell\\v1.0\\powershell.exe`;
}

export function fixWindowsPowerShellPath(powerShellExePath: string, platformDetails: IPlatformDetails): string {
    const lowerCasedPath = powerShellExePath.toLocaleLowerCase();

    if ((platformDetails.isProcess64Bit && (lowerCasedPath === WinPS64BitPathOn32Bit)) ||
        (!platformDetails.isProcess64Bit && (lowerCasedPath === WinPS32BitPathOn64Bit))) {
            return System32PowerShellPath;
    }

    // If the path doesn't need to be fixed, return the original
    return powerShellExePath;
}

abstract class PossiblePowerShellExe implements IPossiblePowerShellExe {
    private readonly pathToExe: string;
    private readonly installationName: string;
    private readonly is32BitExe: boolean;

    private knownToExist: boolean = undefined;

    constructor(
        pathToExe: string,
        installationName: string,
        options?: { knownToExist?: boolean, is32Bit?: boolean }) {

        this.pathToExe = pathToExe;
        this.installationName = installationName;

        if (options) {

            if (options.knownToExist) {
                this.knownToExist = options.knownToExist;
            }

            options.is32Bit = !!options.is32Bit;
        }
    }

    abstract get version(): string;

    get is32Bit(): boolean {
        return this.is32BitExe;
    }

    get exePath(): string {
        return this.pathToExe;
    }

    get exists(): boolean {
        if (this.knownToExist === undefined) {
            this.knownToExist = fs.existsSync(this.exePath);
        }
        return this.knownToExist;
    }

    get displayName(): string {
        return this.installationName;
    }
}

class WinPSExe extends PossiblePowerShellExe {
    private psVersion: string;

    get version(): string {
        if (!this.psVersion) {
            this.psVersion = child_process.execFileSync(this.exePath, ["-c", "$PSVersionTable.PSVersion.ToString()"]);
        }
        return this.psVersion;
    }
}

class PSCoreExe extends PossiblePowerShellExe {
    private psVersion: string;

    get version(): string {
        if (!this.psVersion) {
            this.psVersion = child_process.execFileSync(this.exePath, ["-v"]);
        }
        return this.psVersion;
    }
}

class Lazy<T> {
    private readonly factory: () => T;
    private constructed: boolean;
    private underlyingValue: T;

    constructor(factory: () => T) {
        this.constructed = false;
        this.underlyingValue = undefined;
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
