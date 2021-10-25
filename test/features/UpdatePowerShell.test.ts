// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import { GitHubReleaseInformation } from "../../src/features/UpdatePowerShell";

describe("UpdatePowerShell feature", function () {
    it("Gets the latest version", async function () {
        const release: GitHubReleaseInformation = await GitHubReleaseInformation.FetchLatestRelease(false);
        assert.strictEqual(release.isPreview, false, "expected to not be preview.");
        assert.strictEqual(
            release.version.prerelease.length === 0, true, "expected to not have preview in version.");
        assert.strictEqual(release.assets.length > 0, true, "expected to have assets.");
    });

    it("Gets the latest preview version", async function () {
        const release: GitHubReleaseInformation = await GitHubReleaseInformation.FetchLatestRelease(true);
        assert.strictEqual(release.isPreview, true, "expected to be preview.");
        assert.strictEqual(release.version.prerelease.length > 0, true, "expected to have preview in version.");
        assert.strictEqual(release.assets.length > 0, true, "expected to have assets.");
    });
});
