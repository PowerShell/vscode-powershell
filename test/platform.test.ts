/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from "assert";
import mockFS = require("mock-fs");
import FileSystem = require("mock-fs/lib/filesystem");
import * as path from "path";
import * as sinon from "sinon";
import * as platform from "../src/platform";

/**
 * Describes a platform on which the PowerShell extension should work,
 * including the test conditions (filesystem, environment variables).
 */
interface ITestPlatform {
    name: string;
    platformDetails: platform.IPlatformDetails;
    filesystem: FileSystem.DirectoryItems;
    environmentVars?: Record<string, string>;
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

let msixAppDir = null;
let pwshMsixPath = null;
let pwshPreviewMsixPath = null;
if (process.platform === "win32") {
    msixAppDir = path.join(process.env.LOCALAPPDATA, "Microsoft", "WindowsApps");
    pwshMsixPath = path.join(msixAppDir, "Microsoft.PowerShell_8wekyb3d8bbwe", "pwsh.exe");
    pwshPreviewMsixPath = path.join(msixAppDir, "Microsoft.PowerShellPreview_8wekyb3d8bbwe", "pwsh.exe");

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
                },
                {
                    exePath: "C:\\Program Files (x86)\\PowerShell\\6\\pwsh.exe",
                    displayName: "PowerShell (x86)",
                },
                {
                    exePath: pwshMsixPath,
                    displayName: "PowerShell (Store)",
                },
                {
                    exePath: "C:\\Program Files\\PowerShell\\7-preview\\pwsh.exe",
                    displayName: "PowerShell Preview (x64)",
                },
                {
                    exePath: pwshPreviewMsixPath,
                    displayName: "PowerShell Preview (Store)",
                },
                {
                    exePath: "C:\\Program Files (x86)\\PowerShell\\7-preview\\pwsh.exe",
                    displayName: "PowerShell Preview (x86)",
                },
                {
                    exePath: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x64)",
                },
                {
                    exePath: "C:\\WINDOWS\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x86)",
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
                "C:\\WINDOWS\\SysWOW64\\WindowsPowerShell\\v1.0": {
                    "powershell.exe": "",
                },
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
                },
                {
                    exePath: "C:\\WINDOWS\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x86)",
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
                },
                {
                    exePath: "C:\\Program Files\\PowerShell\\6\\pwsh.exe",
                    displayName: "PowerShell (x64)",
                },
                {
                    exePath: pwshMsixPath,
                    displayName: "PowerShell (Store)",
                },
                {
                    exePath: "C:\\Program Files (x86)\\PowerShell\\7-preview\\pwsh.exe",
                    displayName: "PowerShell Preview (x86)",
                },
                {
                    exePath: pwshPreviewMsixPath,
                    displayName: "PowerShell Preview (Store)",
                },
                {
                    exePath: "C:\\Program Files\\PowerShell\\7-preview\\pwsh.exe",
                    displayName: "PowerShell Preview (x64)",
                },
                {
                    exePath: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x86)",
                },
                {
                    exePath: "C:\\WINDOWS\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x64)",
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
                },
                {
                    exePath: "C:\\WINDOWS\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x64)",
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
                },
                {
                    exePath: pwshMsixPath,
                    displayName: "PowerShell (Store)",
                },
                {
                    exePath: "C:\\Program Files (x86)\\PowerShell\\7-preview\\pwsh.exe",
                    displayName: "PowerShell Preview (x86)",
                },
                {
                    exePath: pwshPreviewMsixPath,
                    displayName: "PowerShell Preview (Store)",
                },
                {
                    exePath: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                    displayName: "Windows PowerShell (x86)",
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
                },
            ],
            filesystem: {
                "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0": {
                    "powershell.exe": "",
                },
            },
        },
    ];
} else {
    successTestCases = [
        {
            name: "Linux (all installations)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Linux,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            expectedPowerShellSequence: [
                { exePath: "/usr/bin/pwsh", displayName: "PowerShell" },
                { exePath: "/snap/bin/pwsh", displayName: "PowerShell Snap" },
                { exePath: "/usr/bin/pwsh-preview", displayName: "PowerShell Preview" },
                { exePath: "/snap/bin/pwsh-preview", displayName: "PowerShell Preview Snap" },
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
            },
        },
        {
            name: "MacOS (all installations)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.MacOS,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            expectedPowerShellSequence: [
                { exePath: "/usr/local/bin/pwsh", displayName: "PowerShell" },
                { exePath: "/usr/local/bin/pwsh-preview", displayName: "PowerShell Preview" },
            ],
            filesystem: {
                "/usr/local/bin": {
                    "pwsh": "",
                    "pwsh-preview": "",
                },
            },
        },
        {
            name: "Linux (stable only)",
            platformDetails: {
                operatingSystem: platform.OperatingSystem.Linux,
                isOS64Bit: true,
                isProcess64Bit: true,
            },
            expectedPowerShellSequence: [
                { exePath: "/usr/bin/pwsh", displayName: "PowerShell" },
            ],
            filesystem: {
                "/usr/bin": {
                    pwsh: "",
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
            expectedPowerShellSequence: [
                { exePath: "/snap/bin/pwsh", displayName: "PowerShell Snap" },
            ],
            filesystem: {
                "/snap/bin": {
                    pwsh: "",
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
            expectedPowerShellSequence: [
                { exePath: "/usr/local/bin/pwsh", displayName: "PowerShell" },
            ],
            filesystem: {
                "/usr/local/bin": {
                    pwsh: "",
                },
            },
        },
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
        filesystem: {},
    },
    {
        name: "MacOS (no PowerShell)",
        platformDetails: {
            operatingSystem: platform.OperatingSystem.MacOS,
            isOS64Bit: true,
            isProcess64Bit: true,
        },
        filesystem: {},
    },
];

function setupTestEnvironment(testPlatform: ITestPlatform) {
    mockFS(testPlatform.filesystem);

    if (testPlatform.environmentVars) {
        for (const envVar of Object.keys(testPlatform.environmentVars)) {
            sinon.stub(process.env, envVar).value(testPlatform.environmentVars[envVar]);
        }
    }
}

suite("Platform module", () => {
    suite("PlatformDetails", () => {
        const platformDetails: platform.IPlatformDetails = platform.getPlatformDetails();
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
                    process.arch === "x64",
                    "Windows process bitness should match process arch");
                assert.strictEqual(
                    platformDetails.isOS64Bit,
                    !!(platformDetails.isProcess64Bit || process.env.ProgramW6432),
                    "Windows OS arch should match process bitness unless 64-bit env var set");
                return;

            default:
                assert.fail("Tests run on unsupported platform");
        }
    });

    suite("Default PowerShell installation", () => {
        teardown(() => {
            sinon.restore();
            mockFS.restore();
        });

        for (const testPlatform of successTestCases) {
            test(`Default PowerShell path on ${testPlatform.name}`, () => {
                setupTestEnvironment(testPlatform);

                const powerShellExeFinder = new platform.PowerShellExeFinder(testPlatform.platformDetails);

                const defaultPowerShell = powerShellExeFinder.getFirstAvailablePowerShellInstallation();
                const expectedPowerShell = testPlatform.expectedPowerShellSequence[0];

                assert.strictEqual(defaultPowerShell.exePath, expectedPowerShell.exePath);
                assert.strictEqual(defaultPowerShell.displayName, expectedPowerShell.displayName);
            });
        }

        for (const testPlatform of errorTestCases) {
            test(`Extension startup fails gracefully on ${testPlatform.name}`, () => {
                setupTestEnvironment(testPlatform);

                const powerShellExeFinder = new platform.PowerShellExeFinder(testPlatform.platformDetails);

                const defaultPowerShell = powerShellExeFinder.getFirstAvailablePowerShellInstallation();
                assert.strictEqual(defaultPowerShell, undefined);
            });
        }
    });

    suite("Expected PowerShell installation list", () => {
        teardown(() => {
            sinon.restore();
            mockFS.restore();
        });

        for (const testPlatform of successTestCases) {
            test(`PowerShell installation list on ${testPlatform.name}`, () => {
                setupTestEnvironment(testPlatform);

                const powerShellExeFinder = new platform.PowerShellExeFinder(testPlatform.platformDetails);

                const foundPowerShells = powerShellExeFinder.getAllAvailablePowerShellInstallations();

                for (let i = 0; i < testPlatform.expectedPowerShellSequence.length; i++) {
                    const foundPowerShell = foundPowerShells[i];
                    const expectedPowerShell = testPlatform.expectedPowerShellSequence[i];

                    assert.strictEqual(foundPowerShell && foundPowerShell.exePath, expectedPowerShell.exePath);
                    assert.strictEqual(foundPowerShell && foundPowerShell.displayName, expectedPowerShell.displayName);
                }

                assert.strictEqual(
                    foundPowerShells.length,
                    testPlatform.expectedPowerShellSequence.length,
                    "Number of expected PowerShells found does not match");
            });
        }

        for (const testPlatform of errorTestCases) {
            test(`Extension startup fails gracefully on ${testPlatform.name}`, () => {
                setupTestEnvironment(testPlatform);

                const powerShellExeFinder = new platform.PowerShellExeFinder(testPlatform.platformDetails);

                const foundPowerShells = powerShellExeFinder.getAllAvailablePowerShellInstallations();
                assert.strictEqual(foundPowerShells.length, 0);
            });
        }
    });
});
