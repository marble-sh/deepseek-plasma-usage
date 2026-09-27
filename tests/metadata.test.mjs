/*
    SPDX-License-Identifier: GPL-2.0-or-later

    metadata.json is the widget's manifest, and getting it wrong is not a crash: Plasma
    silently ignores a key it does not know, so a typo in `Id`, `Category`, `Icon` or a
    localized `Name[xx]` shows up as a widget that is missing from the list, or one
    whose name is untranslated, with nothing in any log.

    The checks here come from KDE's own documentation — Widget Properties for the
    `KPlugin` keys and the category list, Templates for a worked example of the same
    keys — and from the paths this repository actually uses. The cross-checks are the
    point: the plugin id appears in five places that have to agree, and a rename in one
    of them is exactly the kind of thing nothing else would catch.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

const metadata = JSON.parse(read("metadata.json"));
const plugin = metadata.KPlugin;

// KDE's documented category list, from
// https://develop.kde.org/docs/plasma/widget/properties/#category
const CATEGORIES = [
    "Accessibility",
    "Application Launchers",
    "Astronomy",
    "Date and Time",
    "Development Tools",
    "Education",
    "Environment and Weather",
    "Examples",
    "File System",
    "Fun and Games",
    "Graphics",
    "Language",
    "Mapping",
    "Multimedia",
    "Online Services",
    "System Information",
    "Utilities",
    "Windows and Tasks"
];

test("KPackageStructure and the KPlugin keys KDE documents are all present", () => {
    // "For a plasma widget, it should be Plasma/Applet."
    assert.equal(metadata.KPackageStructure, "Plasma/Applet");

    for (const key of ["Id", "Name", "Description", "Icon", "License", "Version", "Website", "BugReportUrl"]) {
        assert.ok(typeof plugin[key] === "string" && plugin[key].length > 0, `KPlugin.${key}`);
    }
    assert.equal(typeof plugin.EnabledByDefault, "boolean", "KPlugin.EnabledByDefault");
    assert.match(plugin.Website, /^https?:\/\//, "KPlugin.Website must be a URL");
    // What the widget's own "Report a bug" action opens. 13 of the 14 plasmoids
    // installed here set it, and without it that action goes nowhere.
    assert.match(plugin.BugReportUrl, /^https?:\/\//, "KPlugin.BugReportUrl must be a URL");
    assert.match(plugin.Version, /^\d+\.\d+\.\d+/, "KPlugin.Version");
});

test("the category is one KDE documents, since an unknown one is silently ignored", () => {
    assert.ok(CATEGORIES.includes(plugin.Category), `KPlugin.Category: ${plugin.Category}`);
});

test("authors carry a name, and the localised fields are well formed", () => {
    assert.ok(Array.isArray(plugin.Authors) && plugin.Authors.length > 0, "KPlugin.Authors");
    for (const author of plugin.Authors) {
        assert.ok(typeof author.Name === "string" && author.Name.length > 0, `author name: ${JSON.stringify(author)}`);
    }

    // KDE gets translated names and descriptions by adding `Name[xx]` keys beside the
    // untranslated ones, so the key has to name a locale and the value has to be a
    // non-empty string. A `Name[en_GB]` that merely repeats `Name` is legitimate: it is
    // how KDE records "this locale needs no translation".
    const localised = Object.keys(metadata.KPlugin).filter(key => /^(Name|Description)\[/.test(key));
    for (const key of localised) {
        assert.match(key, /^\w+\[[a-z]{2}(?:_[A-Z]{2})?\]$/, `locale-shaped key: ${key}`);
        assert.ok(plugin[key].length > 0, key);
    }
});

test("the plugin id agrees with every path that depends on it", () => {
    const id = plugin.Id;
    assert.match(id, /^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/, "the id is a reverse-DNS namespace");

    // The catalogue is looked up at runtime by filename, so the domain, the directory
    // and the directory name all have to match the id.
    assert.ok(read("translate/build.sh").includes(`DOMAIN=plasma_applet_${id}`), "translate/build.sh DOMAIN");
    assert.ok(read("install.sh").includes(`PLUGIN_ID=${id}`), "install.sh PLUGIN_ID");

    const locales = readdirSync(new URL("../contents/locale", import.meta.url));
    assert.ok(locales.length > 0, "there are compiled catalogues");
    for (const locale of locales) {
        const path = `contents/locale/${locale}/LC_MESSAGES/plasma_applet_${id}.mo`;
        assert.ok(existsSync(new URL("../" + path, import.meta.url)), path);
    }
});

test("every locale the widget ships has a description, not just every README", () => {
    // Two sets, because they are two different promises.
    //
    // The READMEs are the languages the project writes in, so each one gets the exact
    // locale: README.es-ES.md is Description[es_ES].
    const tags = readdirSync(new URL("..", import.meta.url))
        .map(name => /^README\.([A-Za-z]{2}(?:-[A-Za-z]{2})?)\.md$/.exec(name))
        .filter(Boolean)
        .map(match => match[1]);
    assert.ok(tags.length > 0, "there are translated READMEs to check against");
    for (const tag of tags) {
        const locale = tag.replace("-", "_");
        const value = plugin[`Description[${locale}]`];
        assert.ok(typeof value === "string" && value.trim().length > 0, `Description[${locale}], for README.${tag}.md`);
        // The English string under a translated key is not a translation, it is a
        // placeholder that hides the gap the same way an empty one does.
        assert.notEqual(value, plugin.Description, `Description[${locale}] still says the English text`);
    }

    // The catalogues are the locales the interface is translated into, and there are
    // more of those than there are READMEs: es_419, es_CL, ru_BY and the bare `fr`,
    // `id`, `hi` and `ru` among them. Qt resolves a locale by shortening it, so the
    // region-tagged ones are covered by their language -- es_CL by Description[es],
    // ru_BY by Description[ru] -- and one entry per language covers them all.
    // English is the base string rather than a translation, so en_IN is excluded.
    const catalogues = read("translate/LINGUAS")
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);
    assert.ok(catalogues.length > 1, "there are catalogues to check against");
    for (const locale of catalogues) {
        if (locale === "en" || locale.startsWith("en_")) {
            continue;
        }
        const language = locale.split("_")[0];
        const value = plugin[`Description[${locale}]`] || plugin[`Description[${language}]`];
        assert.ok(
            typeof value === "string" && value.trim().length > 0,
            `Description[${locale}] or Description[${language}], for catalogue ${locale}`
        );
        assert.notEqual(value, plugin.Description, `the description for ${locale} is still the English text`);
    }
});

test("the deprecated metadata.desktop form is not used beside metadata.json", () => {
    // "This key is however deprecated and desktop files will no longer be supported in
    // KF6." A second manifest in the older format is one Plasma may prefer.
    assert.ok(!existsSync(new URL("../metadata.desktop", import.meta.url)), "metadata.desktop must not exist");
    assert.ok(!("ServiceTypes" in metadata.KPlugin), "KPlugin.ServiceTypes is the deprecated spelling");
});
