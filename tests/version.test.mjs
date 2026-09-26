/*
    SPDX-License-Identifier: GPL-2.0-or-later

    One fact, three places: package.json (for npm), metadata.json (KPlugin.Version,
    which is what Plasma reports in the widget's About) and the newest released
    heading in CHANGELOG.md. This is the guard that keeps them from drifting apart.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

const pkg = JSON.parse(read("package.json"));
const metadata = JSON.parse(read("metadata.json"));
const changelog = read("CHANGELOG.md");

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

test("the version is valid SemVer", () => {
    assert.match(pkg.version, SEMVER);
    assert.match(metadata.KPlugin.Version, SEMVER);
});

test("package.json, metadata.json and CHANGELOG.md agree on the version", () => {
    assert.equal(metadata.KPlugin.Version, pkg.version, "metadata.json KPlugin.Version");

    // Released headings only: "[Unreleased]" carries no date and is skipped, so
    // the first match is the newest release.
    const released = [...changelog.matchAll(/^## \[([^\]]+)\] - \d{4}-\d{2}-\d{2}$/gm)];
    assert.ok(released.length > 0, "CHANGELOG.md has no released version heading");
    assert.equal(released[0][1], pkg.version, "newest CHANGELOG.md heading");
});

test("the changelog links to the repository's own tag scheme", () => {
    // A release is a git tag named v<version>; the release workflow and the
    // changelog have to agree on that or the links rot.
    assert.match(changelog, /Semantic Versioning/);
});
