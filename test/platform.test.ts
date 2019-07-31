/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from "assert";
import * as platform from "../src/platform";

function checkDefaultPowerShellPath(platformDetails, expectedPath) {
    test("returns correct default path", () => {
        assert.equal(
            platform.getDefaultPowerShellPath(platformDetails),
            expectedPath);
    });
}

function checkAvailableWindowsPowerShellPaths(
    platformDetails: platform.IPlatformDetails,
    expectedPaths: platform.IPowerShellExeDetails[]) {
    test("correctly enumerates available Windows PowerShell paths", () => {

        // The system may return PowerShell Core paths so only
        // enumerate the first list items.
        const enumeratedPaths = platform.getAvailablePowerShellExes(platformDetails, undefined);
        for (let i; i < expectedPaths.length; i++) {
            assert.equal(enumeratedPaths[i], expectedPaths[i]);
        }
    });
}

function checkFixedWindowsPowerShellpath(platformDetails, inputPath, expectedPath) {
    test("fixes incorrect Windows PowerShell Sys* path", () => {
        assert.equal(
            platform.fixWindowsPowerShellPath(inputPath, platformDetails),
            expectedPath);
    });
}

suite("Platform module", () => {
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
                        versionName: platform.WindowsPowerShell64BitLabel,
                        exePath: platform.System32PowerShellPath,
                    },
                    {
                        versionName: platform.WindowsPowerShell32BitLabel,
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
                platform.getAvailablePowerShellExes(platformDetails, undefined).filter((psPath) => (psPath.versionName)
                === "PowerShell Core 6 (x86)")[0].exePath);

            checkAvailableWindowsPowerShellPaths(
                platformDetails,
                [
                    {
                        versionName: platform.WindowsPowerShell64BitLabel,
                        exePath: platform.SysnativePowerShellPath,
                    },
                    {
                        versionName: platform.WindowsPowerShell32BitLabel,
                        exePath: platform.System32PowerShellPath,
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
                platform.getAvailablePowerShellExes(platformDetails, undefined).filter((psPath) => (psPath.versionName)
                === "PowerShell Core 6")[0].exePath);

            checkAvailableWindowsPowerShellPaths(
                platformDetails,
                [
                    {
                        versionName: platform.WindowsPowerShell32BitLabel,
                        exePath: platform.System32PowerShellPath,
                    },
                ]);
        });
    }
});
