// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import mockFS = require("mock-fs");
import FileSystem = require("mock-fs/lib/filesystem");
import * as os from "os";
import * as path from "path";
import rewire = require("rewire");
import * as sinon from "sinon";
import * as platform from "../../src/platform";
import * as fs from "fs"; // NOTE: Necessary for mock-fs.
import * as vscode from "vscode";
import { stripQuotePair } from "../../src/utils";

// We have to rewire the platform module so that mock-fs can be used, as it
// overrides the fs module but not the vscode.workspace.fs module.
const platformMock = rewire("../../src/platform");

// eslint-disable-next-line @typescript-eslint/require-await
async function fakeCheckIfFileExists(targetPath: string | vscode.Uri): Promise<boolean> {
    try {
        const stat = fs.lstatSync(targetPath instanceof vscode.Uri ? targetPath.fsPath : targetPath);
        return stat.isFile();
    } catch {
        return false;
    }
}

// eslint-disable-next-line @typescript-eslint/require-await
async function fakeCheckIfDirectoryExists(targetPath: string | vscode.Uri): Promise<boolean> {
    try {
        const stat = fs.lstatSync(targetPath instanceof vscode.Uri ? targetPath.fsPath : targetPath);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

// eslint-disable-next-line @typescript-eslint/require-await
async function fakeReadDirectory(targetPath: string | vscode.Uri): Promise<string[]> {
    return fs.readdirSync(targetPath instanceof vscode.Uri ? targetPath.fsPath : targetPath);
}

const utilsMock = {
    checkIfFileExists: fakeCheckIfFileExists,
    checkIfDirectoryExists: fakeCheckIfDirectoryExists,
    readDirectory: fakeReadDirectory,
    stripQuotePair: stripQuotePair
};

platformMock.__set__("utils", utilsMock);

/**
 * Describes a platform on which the PowerShell extension should work,
 * including the test conditions (filesystem, environment variables).
 */
interface ITestPlatform {
    name: string;
    platformDetails: platform.IPlatformDetails;
    filesystem: FileSystem.DirectoryItems;
    environmentVars: Record<string, string>;
}

/**
 * A platform where the extension should find a PowerShell,
 * including the sequence of PowerShell installations that should be found.
 * The expected default PowerShell is the first installation.
 */
interface ITestPlatformSuccessCase extends ITestPlatform {
    expectedPowerShellSequence: platform.IPowerShellExeDetails[];
}

// Platform configurations where we expect to find a set of PowerShells
let successTestCases: ITestPlatformSuccessCase[];

// Platform configurations for testing the powerShellAdditionalExePaths setting
let additionalPowerShellExes: Record<string, string>;
let successAdditionalTestCases: ITestPlatformSuccessCase[];

if (process.platform === "win32") {
    const msixAppDir = path.join(process.env.LOCALAPPDATA!, "Microsoft", "WindowsApps");
    const pwshMsixPath = path.join(msixAppDir, "Microsoft.PowerShell_8wekyb3d8bbwe", "pwsh.exe");
    const pwshPreviewMsixPath = path.join(msixAppDir, "Microsoft.PowerShellPreview_8wekyb3d8bbwe", "pwsh.exe");
    const pwshDailyDir = path.join(process.env.LOCALAPPDATA!, "Microsoft", "powershell-daily");
    const pwshDailyPath = path.join(pwshDailyDir, "pwsh.exe");

    successTestCases = [
        {
            name: "Windows 64-bit, 64-bit VSCode (all installations)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Windows,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            environmentVars: {
                "ProgramFiles": "C:\\Program Files",
                "ProgramFiles(x86)": "C:\\Program Files (x86)",
                "windir": "C:\\WINDOWS",
            },
            expectedPowerShellSequence: [
                {
                    exePath: "C:\\Program Files\\PowerShell\\6\\pwsh.exe",
                    displayName: "PowerShell (x64)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\Program Files (x86)\\PowerShell\\6\\pwsh.exe",
                    displayName: "PowerShell (x86)",
                    supportsProperArguments: true
                },
                {
                    exePath: pwshMsixPath,
                    displayName: "PowerShell (Store)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\Program Files\\PowerShell\\7-preview\\pwsh.exe",
                    displayName: "PowerShell Preview (x64)",
                    supportsProperArguments: true
                },
                {
                    exePath: pwshPreviewMsixPath,
                    displayName: "PowerShell Preview (Store)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\Program Files (x86)\\PowerShell\\7-preview\\pwsh.exe",
                    displayName: "PowerShell Preview (x86)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x64)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\WINDOWS\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x86)",
                    supportsProperArguments: true
                },
                {
                    exePath: pwshDailyPath,
                    displayName: "PowerShell Daily",
                    supportsProperArguments: true
                }
            ],
            filesystem: {
                "C:\\Program Files\\PowerShell": {
                    "6": {
                        "pwsh.exe": "",
                    },
                    "7-preview": {
                        "pwsh.exe": "",
                    },
                },
                "C:\\Program Files (x86)\\PowerShell": {
                    "6": {
                        "pwsh.exe": "",
                    },
                    "7-preview": {
                        "pwsh.exe": "",
                    },
                },
                [msixAppDir]: {
                    "Microsoft.PowerShell_8wekyb3d8bbwe": {
                        "pwsh.exe": "",
                    },
                    "Microsoft.PowerShellPreview_8wekyb3d8bbwe": {
                        "pwsh.exe": "",
                    },
                },
                "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0": {
                    "powershell.exe": "",
                },
                "C:\\WINDOWS\\SysWOW64\\WindowsPowerShell\\v1.0": {
                    "powershell.exe": "",
                },
                [pwshDailyDir]: {
                    "pwsh.exe": "",
                }
            },
        },
        {
            name: "Windows 64-bit, 64-bit VSCode (only Windows PowerShell)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Windows,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            environmentVars: {
                "ProgramFiles": "C:\\Program Files",
                "ProgramFiles(x86)": "C:\\Program Files (x86)",
                "windir": "C:\\WINDOWS",
            },
            expectedPowerShellSequence: [
                {
                    exePath: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x64)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\WINDOWS\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x86)",
                    supportsProperArguments: true
                },
            ],
            filesystem: {
                "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0": {
                    "powershell.exe": "",
                },
                "C:\\WINDOWS\\SysWOW64\\WindowsPowerShell\\v1.0": {
                    "powershell.exe": "",
                },
            },
        },
        {
            name: "Windows 64-bit, 32-bit VSCode (all installations)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Windows,
                isOS64Bit: true,
                isProcess64Bit: false,
            },
            environmentVars: {
                "ProgramFiles": "C:\\Program Files (x86)",
                "ProgramFiles(x86)": "C:\\Program Files (x86)",
                "windir": "C:\\WINDOWS",
            },
            expectedPowerShellSequence: [
                {
                    exePath: "C:\\Program Files (x86)\\PowerShell\\6\\pwsh.exe",
                    displayName: "PowerShell (x86)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\Program Files\\PowerShell\\6\\pwsh.exe",
                    displayName: "PowerShell (x64)",
                    supportsProperArguments: true
                },
                {
                    exePath: pwshMsixPath,
                    displayName: "PowerShell (Store)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\Program Files (x86)\\PowerShell\\7-preview\\pwsh.exe",
                    displayName: "PowerShell Preview (x86)",
                    supportsProperArguments: true
                },
                {
                    exePath: pwshPreviewMsixPath,
                    displayName: "PowerShell Preview (Store)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\Program Files\\PowerShell\\7-preview\\pwsh.exe",
                    displayName: "PowerShell Preview (x64)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x86)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\WINDOWS\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x64)",
                    supportsProperArguments: true
                },
            ],
            filesystem: {
                "C:\\Program Files\\PowerShell": {
                    "6": {
                        "pwsh.exe": "",
                    },
                    "7-preview": {
                        "pwsh.exe": "",
                    },
                },
                "C:\\Program Files (x86)\\PowerShell": {
                    "6": {
                        "pwsh.exe": "",
                    },
                    "7-preview": {
                        "pwsh.exe": "",
                    },
                },
                [msixAppDir]: {
                    "Microsoft.PowerShell_8wekyb3d8bbwe": {
                        "pwsh.exe": "",
                    },
                    "Microsoft.PowerShellPreview_8wekyb3d8bbwe": {
                        "pwsh.exe": "",
                    },
                },
                "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0": {
                    "powershell.exe": "",
                },
                "C:\\WINDOWS\\Sysnative\\WindowsPowerShell\\v1.0": {
                    "powershell.exe": "",
                },
            },
        },
        {
            name: "Windows 64-bit, 32-bit VSCode (Windows PowerShell only)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Windows,
                isOS64Bit: true,
                isProcess64Bit: false,
            },
            environmentVars: {
                "ProgramFiles": "C:\\Program Files (x86)",
                "ProgramFiles(x86)": "C:\\Program Files (x86)",
                "windir": "C:\\WINDOWS",
            },
            expectedPowerShellSequence: [
                {
                    exePath: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x86)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\WINDOWS\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x64)",
                    supportsProperArguments: true
                },
            ],
            filesystem: {
                "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0": {
                    "powershell.exe": "",
                },
                "C:\\WINDOWS\\Sysnative\\WindowsPowerShell\\v1.0": {
                    "powershell.exe": "",
                },
            },
        },
        {
            name: "Windows 32-bit, 32-bit VSCode (all installations)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Windows,
                isOS64Bit: false,
                isProcess64Bit: false,
            },
            environmentVars: {
                "ProgramFiles": "C:\\Program Files (x86)",
                "ProgramFiles(x86)": "C:\\Program Files (x86)",
                "windir": "C:\\WINDOWS",
            },
            expectedPowerShellSequence: [
                {
                    exePath: "C:\\Program Files (x86)\\PowerShell\\6\\pwsh.exe",
                    displayName: "PowerShell (x86)",
                    supportsProperArguments: true
                },
                {
                    exePath: pwshMsixPath,
                    displayName: "PowerShell (Store)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\Program Files (x86)\\PowerShell\\7-preview\\pwsh.exe",
                    displayName: "PowerShell Preview (x86)",
                    supportsProperArguments: true
                },
                {
                    exePath: pwshPreviewMsixPath,
                    displayName: "PowerShell Preview (Store)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x86)",
                    supportsProperArguments: true
                },
            ],
            filesystem: {
                "C:\\Program Files (x86)\\PowerShell": {
                    "6": {
                        "pwsh.exe": "",
                    },
                    "7-preview": {
                        "pwsh.exe": "",
                    },
                },
                [msixAppDir]: {
                    "Microsoft.PowerShell_8wekyb3d8bbwe": {
                        "pwsh.exe": "",
                    },
                    "Microsoft.PowerShellPreview_8wekyb3d8bbwe": {
                        "pwsh.exe": "",
                    },
                },
                "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0": {
                    "powershell.exe": "",
                },
            },
        },
        {
            name: "Windows 32-bit, 32-bit VSCode (Windows PowerShell only)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Windows,
                isOS64Bit: false,
                isProcess64Bit: false,
            },
            environmentVars: {
                "ProgramFiles": "C:\\Program Files (x86)",
                "ProgramFiles(x86)": "C:\\Program Files (x86)",
                "windir": "C:\\WINDOWS",
            },
            expectedPowerShellSequence: [
                {
                    exePath: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x86)",
                    supportsProperArguments: true
                },
            ],
            filesystem: {
                "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0": {
                    "powershell.exe": "",
                },
            },
        },
        {
            name: "Windows (dotnet)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Windows,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            environmentVars: {
                "USERNAME": "test",
                "USERPROFILE": "C:\\Users\\test",
                "ProgramFiles": "C:\\Program Files",
                "ProgramFiles(x86)": "C:\\Program Files (x86)",
                "windir": "C:\\WINDOWS",
            },
            expectedPowerShellSequence: [
                {
                    exePath: "C:\\Users\\test\\.dotnet\\tools\\pwsh.exe",
                    displayName: ".NET Core PowerShell Global Tool",
                    supportsProperArguments: false
                },
                {
                    exePath: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x64)",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\WINDOWS\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x86)",
                    supportsProperArguments: true
                },
            ],
            filesystem: {
                "C:\\Users\\test\\.dotnet\\tools": {
                    "pwsh.exe": "",
                },
            },
        },
    ];

    additionalPowerShellExes = {
        "pwsh": "C:\\Users\\test\\pwsh\\pwsh.exe",
        "pwsh-tilde": "~\\pwsh\\pwsh.exe",
        "pwsh-no-exe": "C:\\Users\\test\\pwsh\\pwsh",
        "pwsh-folder": "C:\\Users\\test\\pwsh\\",
        "pwsh-folder-no-slash": "C:\\Users\\test\\pwsh",
        "pwsh-single-quotes": "'C:\\Users\\test\\pwsh\\pwsh.exe'",
        "pwsh-double-quotes": "\"C:\\Users\\test\\pwsh\\pwsh.exe\"",
    };

    successAdditionalTestCases = [
        {
            name: "Windows (Additional PowerShell Executables)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Windows,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            environmentVars: {
                "USERNAME": "test",
                "USERPROFILE": "C:\\Users\\test",
            },
            expectedPowerShellSequence: [
                {
                    exePath: "C:\\Users\\test\\pwsh\\pwsh.exe",
                    displayName: "pwsh",
                    supportsProperArguments: true
                },
                {
                    exePath: path.join(os.homedir(), "pwsh", "pwsh.exe"),
                    displayName: "pwsh-tilde",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\Users\\test\\pwsh\\pwsh.exe",
                    displayName: "pwsh-no-exe",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\Users\\test\\pwsh\\pwsh.exe",
                    displayName: "pwsh-folder",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\Users\\test\\pwsh\\pwsh.exe",
                    displayName: "pwsh-folder-no-slash",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\Users\\test\\pwsh\\pwsh.exe",
                    displayName: "pwsh-single-quotes",
                    supportsProperArguments: true
                },
                {
                    exePath: "C:\\Users\\test\\pwsh\\pwsh.exe",
                    displayName: "pwsh-double-quotes",
                    supportsProperArguments: true
                },
            ],
            filesystem: {
                "C:\\Users\\test\\pwsh": {
                    "pwsh.exe": "",
                },
                [path.join(os.homedir(), "pwsh")]: {
                    "pwsh.exe": "",
                }
            },
        }
    ];
} else {
    const pwshDailyDir = path.join(os.homedir(), ".powershell-daily");

    successTestCases = [
        {
            name: "Linux (all installations)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Linux,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            environmentVars: {},
            expectedPowerShellSequence: [
                {
                    exePath: "/usr/bin/pwsh",
                    displayName: "PowerShell",
                    supportsProperArguments: true
                },
                {
                    exePath: "/snap/bin/pwsh",
                    displayName: "PowerShell Snap",
                    supportsProperArguments: true
                },
                {
                    exePath: "/usr/bin/pwsh-preview",
                    displayName: "PowerShell Preview",
                    supportsProperArguments: true
                },
                {
                    exePath: "/snap/bin/pwsh-preview",
                    displayName: "PowerShell Preview Snap",
                    supportsProperArguments: true
                },
                {
                    exePath: path.join(pwshDailyDir, "pwsh"),
                    displayName: "PowerShell Daily",
                    supportsProperArguments: true
                }
            ],
            filesystem: {
                "/usr/bin": {
                    "pwsh": "",
                    "pwsh-preview": "",
                },
                "/snap/bin": {
                    "pwsh": "",
                    "pwsh-preview": "",
                },
                [pwshDailyDir]: {
                    "pwsh": ""
                }
            },
        },
        {
            name: "MacOS (all installations)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.MacOS,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            environmentVars: {},
            expectedPowerShellSequence: [
                {
                    exePath: "/usr/local/bin/pwsh",
                    displayName: "PowerShell",
                    supportsProperArguments: true
                },
                {
                    exePath: "/usr/local/bin/pwsh-preview",
                    displayName: "PowerShell Preview",
                    supportsProperArguments: true
                },
                {
                    exePath: path.join(pwshDailyDir, "pwsh"),
                    displayName: "PowerShell Daily",
                    supportsProperArguments: true
                }
            ],
            filesystem: {
                "/usr/local/bin": {
                    "pwsh": "",
                    "pwsh-preview": "",
                },
                [pwshDailyDir]: {
                    "pwsh": ""
                }
            },
        },
        {
            name: "Linux (stable only)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Linux,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            environmentVars: {},
            expectedPowerShellSequence: [
                {
                    exePath: "/usr/bin/pwsh",
                    displayName: "PowerShell",
                    supportsProperArguments: true
                },
            ],
            filesystem: {
                "/usr/bin": {
                    "pwsh": "",
                },
            },
        },
        {
            name: "Linux (stable snap only)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Linux,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            environmentVars: {},
            expectedPowerShellSequence: [
                {
                    exePath: "/snap/bin/pwsh",
                    displayName: "PowerShell Snap",
                    supportsProperArguments: true
                },
            ],
            filesystem: {
                "/snap/bin": {
                    "pwsh": "",
                },
            },
        },
        {
            name: "MacOS (stable only)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.MacOS,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            environmentVars: {},
            expectedPowerShellSequence: [
                {
                    exePath: "/usr/local/bin/pwsh",
                    displayName: "PowerShell",
                    supportsProperArguments: true
                },
            ],
            filesystem: {
                "/usr/local/bin": {
                    "pwsh": "",
                },
            },
        },
        {
            name: "MacOS (dotnet)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.MacOS,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            environmentVars: {
                "USER": "test",
                "HOME": "/Users/test",
            },
            expectedPowerShellSequence: [
                {
                    exePath: "/Users/test/.dotnet/tools/pwsh",
                    displayName: ".NET Core PowerShell Global Tool",
                    supportsProperArguments: false
                },
            ],
            filesystem: {
                "/Users/test/.dotnet/tools": {
                    "pwsh": "",
                },
            },
        },
        {
            name: "Linux (dotnet)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Linux,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            environmentVars: {
                "USER": "test",
                "HOME": "/home/test",
            },
            expectedPowerShellSequence: [
                {
                    exePath: "/home/test/.dotnet/tools/pwsh",
                    displayName: ".NET Core PowerShell Global Tool",
                    supportsProperArguments: false
                },
            ],
            filesystem: {
                "/home/test/.dotnet/tools": {
                    "pwsh": "",
                },
            },
        },
    ];

    additionalPowerShellExes = {
        "pwsh": "/home/test/bin/pwsh",
        "pwsh-tilde": "~/bin/pwsh",
        "pwsh-folder": "/home/test/bin/",
        "pwsh-folder-no-slash": "/home/test/bin",
        "pwsh-single-quotes": "'/home/test/bin/pwsh'",
        "pwsh-double-quotes": "\"/home/test/bin/pwsh\"",
    };

    successAdditionalTestCases = [
        {
            name: "Linux/macOS (Additional PowerShell Executables)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Linux,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            environmentVars: {
                "USER": "test",
                "HOME": "/home/test",
            },
            expectedPowerShellSequence: [
                {
                    exePath: "/home/test/bin/pwsh",
                    displayName: "pwsh",
                    supportsProperArguments: true
                },
                {
                    // untildify ignores the HOME mock so this is platform-dependent
                    exePath: path.join(os.homedir(), "bin", "pwsh"),
                    displayName: "pwsh-tilde",
                    supportsProperArguments: true
                },
                {
                    exePath: "/home/test/bin/pwsh",
                    displayName: "pwsh-folder",
                    supportsProperArguments: true
                },
                {
                    exePath: "/home/test/bin/pwsh",
                    displayName: "pwsh-folder-no-slash",
                    supportsProperArguments: true
                },
                {
                    exePath: "/home/test/bin/pwsh",
                    displayName: "pwsh-single-quotes",
                    supportsProperArguments: true
                },
                {
                    exePath: "/home/test/bin/pwsh",
                    displayName: "pwsh-double-quotes",
                    supportsProperArguments: true
                },
            ],
            filesystem: {
                "/home/test/bin": {
                    "pwsh": "",
                },
                [path.join(os.homedir(), "bin")]: {
                    "pwsh": "",
                }
            },
        }
    ];
}

const errorTestCases: ITestPlatform[] = [
    {
        name: "Linux (no PowerShell)",
        platformDetails: {
            operatingSystem: platform.OperatingSystem.Linux,
            isOS64Bit: true,
            isProcess64Bit: true,
        },
        environmentVars: {},
        filesystem: {},
    },
    {
        name: "MacOS (no PowerShell)",
        platformDetails: {
            operatingSystem: platform.OperatingSystem.MacOS,
            isOS64Bit: true,
            isProcess64Bit: true,
        },
        environmentVars: {},
        filesystem: {},
    },
];

function setupTestEnvironment(testPlatform: ITestPlatform): void {
    mockFS(testPlatform.filesystem);

    for (const envVar of Object.keys(testPlatform.environmentVars)) {
        sinon.stub(process.env, envVar).value(testPlatform.environmentVars[envVar]);
    }
}

describe("Platform module", function () {
    it("Gets the correct platform details", function () {
        const platformDetails: platform.IPlatformDetails = platformMock.getPlatformDetails();
        switch (process.platform) {
        case "darwin":
            assert.strictEqual(
                platformDetails.operatingSystem,
                platform.OperatingSystem.MacOS,
                "Platform details operating system should be MacOS");
            assert.strictEqual(
                platformDetails.isProcess64Bit,
                true,
                "VSCode on darwin should be 64-bit");
            assert.strictEqual(
                platformDetails.isOS64Bit,
                true,
                "Darwin is 64-bit only");
            break;

        case "linux":
            assert.strictEqual(
                platformDetails.operatingSystem,
                platform.OperatingSystem.Linux,
                "Platform details operating system should be Linux");
            assert.strictEqual(
                platformDetails.isProcess64Bit,
                true,
                "Only 64-bit VSCode supported on Linux");
            assert.strictEqual(
                platformDetails.isOS64Bit,
                true,
                "Only 64-bit Linux supported by PowerShell");
            return;

        case "win32":
            assert.strictEqual(
                platformDetails.operatingSystem,
                platform.OperatingSystem.Windows,
                "Platform details operating system should be Windows");
            assert.strictEqual(
                platformDetails.isProcess64Bit,
                process.arch === "x64" || process.arch === "arm64",
                "Windows process bitness should match process arch");
            assert.strictEqual(
                platformDetails.isOS64Bit,
                !!(platformDetails.isProcess64Bit || process.env.ProgramW6432),
                "Windows OS arch should match process bitness unless 64-bit env var set");
            return;

        default:
            assert.fail("This platform is unsupported");
        }
    });

    describe("Default PowerShell installation", function () {
        afterEach(function () {
            sinon.restore();
            mockFS.restore();
        });

        for (const testPlatform of successTestCases) {
            it(`Finds it on ${testPlatform.name}`, async function () {
                setupTestEnvironment(testPlatform);

                const powerShellExeFinder = new platformMock.PowerShellExeFinder(testPlatform.platformDetails);

                const defaultPowerShell = await powerShellExeFinder.getFirstAvailablePowerShellInstallation();
                const expectedPowerShell = testPlatform.expectedPowerShellSequence[0];

                assert.strictEqual(defaultPowerShell.exePath, expectedPowerShell.exePath);
                assert.strictEqual(defaultPowerShell.displayName, expectedPowerShell.displayName);
                assert.strictEqual(defaultPowerShell.supportsProperArguments, expectedPowerShell.supportsProperArguments);
            });
        }

        for (const testPlatform of errorTestCases) {
            it(`Fails gracefully on ${testPlatform.name}`, async function () {
                setupTestEnvironment(testPlatform);

                const powerShellExeFinder = new platformMock.PowerShellExeFinder(testPlatform.platformDetails);

                const defaultPowerShell = await powerShellExeFinder.getFirstAvailablePowerShellInstallation();
                assert.strictEqual(defaultPowerShell, undefined);
            });
        }
    });

    describe("Expected PowerShell installation list", function () {
        afterEach(function () {
            sinon.restore();
            mockFS.restore();
        });

        for (const testPlatform of successTestCases) {
            it(`Finds them on ${testPlatform.name}`, async function () {
                setupTestEnvironment(testPlatform);

                const powerShellExeFinder = new platformMock.PowerShellExeFinder(testPlatform.platformDetails);

                const foundPowerShells = await powerShellExeFinder.getAllAvailablePowerShellInstallations();

                for (let i = 0; i < testPlatform.expectedPowerShellSequence.length; i++) {
                    const foundPowerShell = foundPowerShells[i];
                    const expectedPowerShell = testPlatform.expectedPowerShellSequence[i];

                    assert.strictEqual(foundPowerShell?.exePath, expectedPowerShell.exePath);
                    assert.strictEqual(foundPowerShell?.displayName, expectedPowerShell.displayName);
                    assert.strictEqual(foundPowerShell?.supportsProperArguments, expectedPowerShell.supportsProperArguments);
                }

                assert.strictEqual(
                    foundPowerShells.length,
                    testPlatform.expectedPowerShellSequence.length,
                    "Number of expected PowerShells found does not match");
            });
        }

        for (const testPlatform of errorTestCases) {
            it(`Fails gracefully on ${testPlatform.name}`, async function () {
                setupTestEnvironment(testPlatform);

                const powerShellExeFinder = new platformMock.PowerShellExeFinder(testPlatform.platformDetails);

                const foundPowerShells = await powerShellExeFinder.getAllAvailablePowerShellInstallations();
                assert.strictEqual(foundPowerShells.length, 0);
            });
        }
    });

    describe("Windows PowerShell path fix", function () {
        afterEach(function () {
            sinon.restore();
            mockFS.restore();
        });

        for (const testPlatform of successTestCases
            .filter((tp) => tp.platformDetails.operatingSystem === platform.OperatingSystem.Windows)) {

            it(`Corrects the Windows PowerShell path on ${testPlatform.name}`, function () {
                setupTestEnvironment(testPlatform);

                function getWinPSPath(systemDir: string): string {
                    return path.join(
                        testPlatform.environmentVars.windir,
                        systemDir,
                        "WindowsPowerShell",
                        "v1.0",
                        "powershell.exe");
                }

                const winPSPath = getWinPSPath("System32");

                let altWinPSPath;
                if (testPlatform.platformDetails.isProcess64Bit) {
                    altWinPSPath = getWinPSPath("SysWOW64");
                } else if (testPlatform.platformDetails.isOS64Bit) {
                    altWinPSPath = getWinPSPath("Sysnative");
                } else {
                    altWinPSPath = null;
                }

                const powerShellExeFinder = new platformMock.PowerShellExeFinder(testPlatform.platformDetails);

                assert.strictEqual(powerShellExeFinder.fixWindowsPowerShellPath(winPSPath), winPSPath);

                if (altWinPSPath) {
                    assert.strictEqual(powerShellExeFinder.fixWindowsPowerShellPath(altWinPSPath), winPSPath);
                }
            });
        }
    });

    describe("PowerShell executables from 'powerShellAdditionalExePaths' are found", function () {
        afterEach(function () {
            sinon.restore();
            mockFS.restore();
        });

        for (const testPlatform of successAdditionalTestCases) {
            it(`Guesses for ${testPlatform.name}`, async function () {
                setupTestEnvironment(testPlatform);

                const powerShellExeFinder = new platformMock.PowerShellExeFinder(testPlatform.platformDetails, additionalPowerShellExes);

                let i = 0;
                for await (const additionalPwsh of powerShellExeFinder.enumerateAdditionalPowerShellInstallations()) {
                    const expectedPowerShell = testPlatform.expectedPowerShellSequence[i];
                    i++;

                    assert.strictEqual(additionalPwsh.exePath, expectedPowerShell.exePath);
                    assert.strictEqual(additionalPwsh.displayName, expectedPowerShell.displayName);
                }
            });
        }
    });
});
