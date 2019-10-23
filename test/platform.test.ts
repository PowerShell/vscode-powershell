/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from "assert";
import * as child_process from "child_process";
import * as fs from "fs";
import mockFS = require("mock-fs");
import FileSystem = require("mock-fs/lib/filesystem");
import * as sinon from "sinon";
import * as platform from "../src/platform";

function checkDefaultPowerShellPath(
    platformDetails: platform.IPlatformDetails,
    expectedPath: string) {
    const powerShellExeFinder = new platform.PowerShellExeFinder(platformDetails);
    test("returns correct default path", () => {
        const defaultPath = powerShellExeFinder.getFirstAvailablePowerShellInstallation().exePath;
        assert.equal(defaultPath, expectedPath);
    });
}

function checkAvailableWindowsPowerShellPaths(
    platformDetails: platform.IPlatformDetails,
    expectedPaths: platform.IPowerShellExeDetails[]) {

    const pwshExeFinder = new platform.PowerShellExeFinder(platformDetails);

    test("correctly enumerates available Windows PowerShell paths", () => {

        // The system may return PowerShell Core paths so only
        // enumerate the first list items.
        let i = 0;
        for (const pwshExe of pwshExeFinder.enumeratePowerShellInstallations()) {
            assert.equal(pwshExe.displayName, expectedPaths[i].displayName);
            assert.equal(pwshExe.exePath.toLowerCase(), expectedPaths[i].exePath.toLowerCase());
            i++;
        }
    });
}

function checkFixedWindowsPowerShellpath(
    platformDetails: platform.IPlatformDetails,
    inputPath: string,
    expectedPath: string) {
    test("fixes incorrect Windows PowerShell Sys* path", () => {
        assert.equal(
            platform.fixWindowsPowerShellPath(inputPath, platformDetails),
            expectedPath);
    });
}

interface ITestPlatform {
    name: string;
    platformDetails: platform.IPlatformDetails;
    expectedPowerShellSequence: platform.IPowerShellExeDetails[];
    filesystem: FileSystem.DirectoryItems;
    environmentVars?: Record<string, string>;
}

const testPlatforms: ITestPlatform[] = [
    {
        name: "Linux (all installations)",
        platformDetails: {
            operatingSystem: platform.OperatingSystem.Linux,
            isOS64Bit: true,
            isProcess64Bit: true,
        },
        expectedPowerShellSequence: [
            { exePath: "/usr/bin/pwsh", displayName: "PowerShell (x64)" },
            { exePath: "/snap/bin/pwsh", displayName: "PowerShell Snap" },
            { exePath: "/usr/bin/pwsh-preview", displayName: "PowerShell Preview (x64)" },
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
            { exePath: "/usr/local/bin/pwsh", displayName: "PowerShell (x64)" },
            { exePath: "/usr/local/bin/pwsh-preview", displayName: "PowerShell Preview (x64)" },
        ],
        filesystem: {
            "/usr/local/bin": {
                "pwsh": "",
                "pwsh-preview": "",
            },
        },
    },
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
        },
        expectedPowerShellSequence: [
            { exePath: "C:\\Program Files\\PowerShell\\6\\pwsh.exe", displayName: "PowerShell (x64)" },
            { exePath: "C:\\Program Files (x86)\\PowerShell\\6\\pwsh.exe", displayName: "PowerShell (x86)" },
            {
                exePath:
                    "C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7.0.0.4_neutral__8wekyb3d8bbwe\\pwsh.exe",
                displayName: "PowerShell MSIX",
            },
            { exePath: "C:\\Program Files\\PowerShell\\7-preview\\pwsh.exe", displayName: "PowerShell Preview (x64)" },
            { exePath: "C:\\Program Files (x86)\\PowerShell\\7-preview\\pwsh.exe", displayName: "PowerShell Preview (x86)" },
            { exePath: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", displayName: "Windows PowerShell (x64)" },
            { exePath: "C:\\WINDOWS\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe", displayName: "Windows PowerShell (x86)" },
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
            "C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7.0.0.4_neutral__8wekyb3d8bbwe": {
                "pwsh.exe": "",
            },
            "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0": {
                "powershell.exe": "",
            },
            "C:\\WINDOWS\\SysWOW64\\WindowsPowerShell\\v1.0": {
                "powershell.exe": "",
            },
        },
    },
];

suite("Platform module", () => {
    let tempEnv: NodeJS.ProcessEnv;

    suite("PlatformDetails", () => {
        const platformDetails: platform.IPlatformDetails = platform.getPlatformDetails();
        switch (process.platform) {
            case "darwin":
                assert.equal(platformDetails.operatingSystem, platform.OperatingSystem.MacOS);
                assert.equal(platformDetails.isProcess64Bit, true);
                assert.equal(platformDetails.isOS64Bit, true);

            case "linux":
                assert.equal(platformDetails.operatingSystem, platform.OperatingSystem.Linux);
                assert.equal(platformDetails.isProcess64Bit, true);
                assert.equal(platformDetails.isOS64Bit, true);
                return;

            case "win32":
                assert.equal(platformDetails.operatingSystem, platform.OperatingSystem.Windows);
                assert.equal(platformDetails.isProcess64Bit, process.arch === "x64");
                assert.equal(platformDetails.isOS64Bit, !!(platformDetails.isProcess64Bit || process.env.ProgramW6432));
                return;

            default:
                assert.fail("Tests run on unsupported platform");
        }
    });

    suite("Default PowerShell installation", () => {
        setup(() => {
            tempEnv = Object.assign({}, process.env);
        });

        teardown(() => {
            process.env = tempEnv;
            sinon.restore();
            mockFS.restore();
        });

        for (const testPlatform of testPlatforms) {
            test(`Default PowerShell path on ${testPlatform.name}`, () => {
                mockFS(testPlatform.filesystem);

                // The type inference here is wrong, so we need typescript to ignore it
                // @ts-ignore
                sinon.stub(child_process, "execFileSync").callsFake((procName, args?, options?) => {
                    if (!procName.includes("powershell")) {
                        return child_process.execFileSync(procName, args, options);
                    }

                    return "C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7.0.0.4_neutral__8wekyb3d8bbwe";
                });

                if (testPlatform.environmentVars) {
                    for (const envVar of Object.keys(testPlatform.environmentVars)) {
                        process.env[envVar] = testPlatform.environmentVars[envVar];
                    }
                }

                const powerShellExeFinder = new platform.PowerShellExeFinder(testPlatform.platformDetails);

                const defaultPowerShell = powerShellExeFinder.getFirstAvailablePowerShellInstallation();
                const expectedPowerShell = testPlatform.expectedPowerShellSequence[0];

                assert.strictEqual(defaultPowerShell.exePath, expectedPowerShell.exePath);
                assert.strictEqual(defaultPowerShell.displayName, expectedPowerShell.displayName);
            });
        }
    });

    suite("Expected PowerShell installation list", () => {
        setup(() => {
            tempEnv = Object.assign({}, process.env);
        });

        teardown(() => {
            process.env = tempEnv;
            sinon.restore();
            mockFS.restore();
        });

        for (const testPlatform of testPlatforms) {
            test(`PowerShell installation list on ${testPlatform.name}`, () => {
                mockFS(testPlatform.filesystem);

                // The type inference here is wrong, so we need typescript to ignore it
                // @ts-ignore
                sinon.stub(child_process, "execFileSync").callsFake((procName, args?, options?) => {
                    if (!procName.includes("powershell")) {
                        return child_process.execFileSync(procName, args, options);
                    }

                    return "C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7.0.0.4_neutral__8wekyb3d8bbwe";
                });

                if (testPlatform.environmentVars) {
                    for (const envVar of Object.keys(testPlatform.environmentVars)) {
                        process.env[envVar] = testPlatform.environmentVars[envVar];
                    }
                }

                const powerShellExeFinder = new platform.PowerShellExeFinder(testPlatform.platformDetails);

                const foundPowerShells = powerShellExeFinder.getAllAvailablePowerShellInstallations();

                for (let i = 0; i < testPlatform.expectedPowerShellSequence.length; i++) {
                    const foundPowerShell = foundPowerShells[i];
                    const expectedPowerShell = testPlatform.expectedPowerShellSequence[i];

                    assert.strictEqual(foundPowerShell && foundPowerShell.exePath, expectedPowerShell.exePath);
                    assert.strictEqual(foundPowerShell && foundPowerShell.displayName, expectedPowerShell.displayName);
                }

                assert.strictEqual(foundPowerShells.length, testPlatform.expectedPowerShellSequence.length);
            });
        }
    });
});

/*
    if (process.platform === "win32") {
        suite("64-bit Windows, 64-bit VS Code", () => {
            const platformDetails: platform.IPlatformDetails = {
                operatingSystem: platform.OperatingSystem.Windows,
                isOS64Bit: true,
                isProcess64Bit: true,
            };

            checkDefaultPowerShellPath(
                platformDetails,
                platform.System32PowerShellPath);

            checkAvailableWindowsPowerShellPaths(
                platformDetails,
                [
                    {
                        displayName: platform.WindowsPowerShell64BitLabel,
                        exePath: platform.System32PowerShellPath,
                    },
                    {
                        displayName: platform.WindowsPowerShell32BitLabel,
                        exePath: platform.SysWow64PowerShellPath,
                    },
                ]);

            checkFixedWindowsPowerShellpath(
                platformDetails,
                platform.SysnativePowerShellPath,
                platform.System32PowerShellPath);
        });

        suite("64-bit Windows, 32-bit VS Code", () => {
            const platformDetails: platform.IPlatformDetails = {
                operatingSystem: platform.OperatingSystem.Windows,
                isOS64Bit: true,
                isProcess64Bit: false,
            };

            checkDefaultPowerShellPath(
                platformDetails,
                platform.System32PowerShellPath);

            checkAvailableWindowsPowerShellPaths(
                platformDetails,
                [
                    {
                        displayName: platform.WindowsPowerShell32BitLabel,
                        exePath: platform.System32PowerShellPath,
                    },
                    {
                        displayName: platform.WindowsPowerShell64BitLabel,
                        exePath: platform.SysnativePowerShellPath,
                    },
                ]);

            checkFixedWindowsPowerShellpath(
                platformDetails,
                platform.SysWow64PowerShellPath,
                platform.System32PowerShellPath);
        });

        suite("32-bit Windows, 32-bit VS Code", () => {
            const platformDetails: platform.IPlatformDetails = {
                operatingSystem: platform.OperatingSystem.Windows,
                isOS64Bit: false,
                isProcess64Bit: false,
            };

            checkDefaultPowerShellPath(
                platformDetails,
                platform.System32PowerShellPath);

            checkAvailableWindowsPowerShellPaths(
                platformDetails,
                [
                    {
                        displayName: platform.WindowsPowerShell32BitLabel,
                        exePath: platform.System32PowerShellPath,
                    },
                ]);
        });
    }

    if (process.platform === "darwin") {
        suite("macOS", () => {
            const platformDetails: platform.IPlatformDetails = {
                operatingSystem: platform.OperatingSystem.MacOS,
                isOS64Bit: true,
                isProcess64Bit: true,
            };

            checkDefaultPowerShellPath(
                platformDetails,
                "/usr/local/bin/pwsh");
        });
    }

    if (process.platform === "linux") {
        suite("linux", () => {
            const platformDetails: platform.IPlatformDetails = {
                operatingSystem: platform.OperatingSystem.Linux,
                isOS64Bit: true,
                isProcess64Bit: true,
            };

            checkDefaultPowerShellPath(
                platformDetails,
                "/usr/bin/pwsh");
        });
    }
});
*/
