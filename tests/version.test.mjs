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

test("the changelog states the versioning policy it is written against", () => {
    assert.match(changelog, /Semantic Versioning/);
});

test("the release tag scheme is v<version> everywhere it is written down", () => {
    // A release is an annotated git tag named v<version>. Four separate things
    // depend on that one convention: the workflow that publishes the release
    // triggers on the pattern, the tag ruleset protects the same pattern, this file
    // joins the prefix to package.json's version, and CONTRIBUTING.md tells a
    // maintainer what to type. Any one of them drifting means a tag that publishes
    // nothing, or publishes unprotected.
    const release = read(".github/workflows/release.yml");
    assert.match(release, /tags: \["v\*"\]/, 'release.yml must trigger on tags: ["v*"]');
    assert.match(
        release,
        /"v\$version" != "\$GITHUB_REF_NAME"/,
        "release.yml must compare the tag to v<package.json version>"
    );

    assert.match(
        read("CONTRIBUTING.md"),
        /git tag -s v\d+\.\d+\.\d+/,
        "CONTRIBUTING.md must document `git tag -s v<version>`"
    );

    // The rulesets live in docs/state/, which is deliberately untracked (it may
    // quote private probes), so this half only runs on a development machine. It
    // is the same pattern the workflow triggers on, and the signature requirement
    // here is why CONTRIBUTING.md spells the command with `-s`.
    try {
        const tags = JSON.parse(read("docs/state/ruleset-tags.json"));
        assert.deepEqual(tags.conditions.ref_name.include, ["refs/tags/v*"], "tag ruleset pattern");
        assert.ok(
            tags.rules.some(rule => rule.type === "required_signatures"),
            "the tag ruleset must require signed tags"
        );
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
});
