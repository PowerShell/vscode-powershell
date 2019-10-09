/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from "assert";
import * as platform from "../src/platform";

function checkDefaultPowerShellPath(platformDetails, expectedPath) {
    const powerShellExeFinder = new platform.PowerShellExeFinder(platformDetails);
    test("returns correct default path", () => {
        let defaultPath: string;
        for (const pwshExe of powerShellExeFinder.enumeratePowerShellInstallations()) {
            defaultPath = pwshExe.exePath;
            break;
        }
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
            assert.equal(pwshExe.exePath, expectedPaths[i]);
            i++;
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
                "C:\\Program Files\\PowerShell\\6\\pwsh.exe");

            checkAvailableWindowsPowerShellPaths(
                platformDetails,
                [
                    {
                        displayName: platform.WindowsPowerShell64BitLabel,
                        exePath: platform.SysnativePowerShellPath,
                    },
                    {
                        displayName: platform.WindowsPowerShell32BitLabel,
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
                "C:\\Program Files\\PowerShell\\6\\pwsh.exe");

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
});
