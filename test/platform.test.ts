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
            "winddir": "C:\\WINDOWS",
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
            "winddir": "C:\\WINDOWS",
        },
        expectedPowerShellSequence: [
            { exePath: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", displayName: "Windows PowerShell (x64)" },
            { exePath: "C:\\WINDOWS\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe", displayName: "Windows PowerShell (x86)" },
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
            "ProgramFiles": "C:\\Program Files",
            "ProgramFiles(x86)": "C:\\Program Files (x86)",
            "winddir": "C:\\WINDOWS",
        },
        expectedPowerShellSequence: [
            { exePath: "C:\\Program Files (x86)\\PowerShell\\6\\pwsh.exe", displayName: "PowerShell (x86)" },
            { exePath: "C:\\Program Files\\PowerShell\\6\\pwsh.exe", displayName: "PowerShell (x64)" },
            {
                exePath:
                    "C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7.0.0.4_neutral__8wekyb3d8bbwe\\pwsh.exe",
                displayName: "PowerShell MSIX",
            },
            { exePath: "C:\\Program Files (x86)\\PowerShell\\7-preview\\pwsh.exe", displayName: "PowerShell Preview (x86)" },
            { exePath: "C:\\Program Files\\PowerShell\\7-preview\\pwsh.exe", displayName: "PowerShell Preview (x64)" },
            { exePath: "C:\\WINDOWS\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe", displayName: "Windows PowerShell (x86)" },
            { exePath: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", displayName: "Windows PowerShell (x64)" },
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
            "C:\\WINDOWS\\Sysnative\\WindowsPowerShell\\v1.0": {
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
