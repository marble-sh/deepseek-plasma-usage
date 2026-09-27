#!/usr/bin/env node
/*
    SPDX-FileCopyrightText: 2026 cassidy
    SPDX-License-Identifier: GPL-2.0-or-later

    Builds translate/<locale>.po from translate/template.pot and the translation
    tables in translate/messages/.

    The tables are the source of truth for our translations; the .po files are
    generated so they cannot drift from the pot. Anything that would make a
    catalogue subtly broken is a hard error here rather than a silent fallback
    to English at runtime:

      * a msgid in the pot with no translation (and no base catalogue),
      * a plural entry whose variant count disagrees with the locale's
        Plural-Forms,
      * a translation that drops or invents a %1-style placeholder.

    Usage: node translate/generate.mjs [--check]
      --check  do not write anything; exit non-zero if a .po would change.
*/
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const MESSAGES = join(DIR, "messages");
const checkOnly = process.argv.includes("--check");

// Read a file that may not exist. Checking with `existsSync` and then reading -- or
// worse, checking and then writing later -- is a time-of-check/time-of-use race, and
// CodeQL flags it as one. Treating ENOENT as "absent" is the same behaviour with no
// window between the two.
function readIfExists(file) {
    try {
        return readFileSync(file, "utf8");
    } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
    }
}

// Locales we ship, and how each is produced. `base` inherits another catalogue
// and applies its own `overrides`; `identity` uses the msgid as the msgstr
// (English variants). Pure aliases exist because Qt looks up <lang>_<REGION>
// and then bare <lang>, so the bare entries widen coverage for free.
//
// The Latin-American Spanish catalogues are aliases of es_419 on purpose: none
// of the current strings differ between them. If one ever does, give that
// locale its own `base` + `overrides` and it stops being a copy.
const LOCALES = {
    zh_CN: { language: "Chinese (Simplified)", nplurals: 1, plural: "0" },
    en_IN: { language: "English (India)", nplurals: 2, plural: "(n != 1)", identity: true },
    hi_IN: { language: "Hindi", nplurals: 2, plural: "(n != 1)" },
    id_ID: { language: "Indonesian", nplurals: 1, plural: "0" },
    fr_FR: { language: "French", nplurals: 2, plural: "(n > 1)" },
    ru_RU: { language: "Russian", nplurals: 3, plural: RU_PLURAL() },

    es_419: { language: "Spanish (Latin America)", nplurals: 2, plural: "(n != 1)" },
    es_ES: { base: "es_419" },
    es_CL: { base: "es_419" },
    es_AR: { base: "es_419" },
    es_MX: { base: "es_419" },
    es_CU: { base: "es_419" },

    ru_BY: { base: "ru_RU" },
    ru: { base: "ru_RU" },
    fr: { base: "fr_FR" },
    id: { base: "id_ID" },
    hi: { base: "hi_IN" }
};

function RU_PLURAL() {
    return "(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)";
}

const PLACEHOLDER = /%(\d+)/g;

function placeholders(text) {
    return (text.match(PLACEHOLDER) || []).slice().sort().join(",");
}

/* ------------------------------------------------------------ pot parsing */

function unquote(line) {
    const m = /^"(.*)"$/.exec(line);
    if (!m) {
        return null;
    }
    return m[1].replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function parsePot(text) {
    const entries = [];
    let current = null;
    let field = null;
    let header = "";

    for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();

        if (line === "") {
            if (current) {
                entries.push(current);
                current = null;
                field = null;
            }
            continue;
        }
        if (line.startsWith("#:")) {
            if (!current) {
                current = { refs: [], msgctxt: "", msgid: "", msgid_plural: "", msgstr: "" };
            }
            current.refs.push(line);
            continue;
        }
        if (line.startsWith("#")) {
            continue;
        }

        const assignment = /^([A-Za-z_][A-Za-z0-9_]*)(\[[^\]]*\])?\s+(.*)$/.exec(line);
        if (assignment) {
            const name = assignment[1];
            if (name === "msgctxt" || name === "msgid" || name === "msgid_plural") {
                if (!current) {
                    current = { refs: [], msgctxt: "", msgid: "", msgid_plural: "", msgstr: "" };
                }
                current[name] = unquote(assignment[3]) ?? "";
                field = name;
                continue;
            }
            if (name === "msgstr") {
                // The header (msgid "" with no continuation) carries the pot
                // metadata; remember it so our catalogues can mirror the
                // extraction date without churning on every rebuild.
                if (current && current.msgid === "" && current.msgid_plural === "") {
                    header = (unquote(assignment[3]) ?? "") + "\n";
                }
                field = null;
                continue;
            }
        }

        // Continuation of the previous assignment.
        const value = unquote(line);
        if (value === null) {
            continue;
        }
        if (field) {
            current[field] += value;
        } else if (current && current.msgid === "" && current.msgid_plural === "" && current.msgstr === "") {
            header += value + "\n";
        }
    }
    if (current) {
        entries.push(current);
    }

    const messages = entries
        .filter(e => e.msgid !== "" || e.msgctxt !== "")
        .map(e => ({
            refs: e.refs,
            msgctxt: e.msgctxt,
            msgid: e.msgid,
            msgid_plural: e.msgid_plural,
            key: (e.msgctxt ? `${e.msgctxt}\u0004` : "") + e.msgid + (e.msgid_plural ? `\u0000${e.msgid_plural}` : "")
        }));

    // Read the extraction date from the raw text: by this point the quotes have
    // been stripped from `header`. The value ends with a literal \n escape.
    const creation = /"POT-Creation-Date: (.*?)\\n"/.exec(text);
    return { messages, creationDate: creation ? creation[1] : "YEAR-MO-DA HO:MI+ZONE" };
}

/* ---------------------------------------------------- translation tables */

function readTable(locale) {
    const file = join(MESSAGES, `${locale}.json`);
    if (!existsSync(file)) {
        throw new Error(`missing translation table ${file}`);
    }
    return JSON.parse(readFileSync(file, "utf8"));
}

function resolve(locale, seen = []) {
    if (seen.includes(locale)) {
        throw new Error(`circular base chain: ${[...seen, locale].join(" -> ")}`);
    }
    const spec = LOCALES[locale];
    if (!spec) {
        throw new Error(`unknown locale ${locale}`);
    }
    if (spec.identity) {
        return { spec, strings: null };
    }
    if (spec.base) {
        const parent = resolve(spec.base, [...seen, locale]);
        const own = existsSync(join(MESSAGES, `${locale}.json`)) ? readTable(locale) : {};
        return {
            spec: { ...parent.spec, ...spec },
            strings: { ...parent.strings, ...(own.strings || {}), ...(own.overrides || {}) }
        };
    }
    const table = readTable(locale);
    return { spec, strings: table.strings || {} };
}

/* --------------------------------------------------------------- emitting */

function escapePo(text) {
    return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t");
}

function* quoted(value) {
    if (!value.includes("\n") && `x${value}`.length < 76) {
        yield `"${escapePo(value)}"`;
        return;
    }
    yield '""';
    for (const piece of value.split("\n")) {
        yield `"${escapePo(piece)}"`;
    }
}

function buildPo(locale, { messages, creationDate }) {
    const { spec, strings } = resolve(locale);
    const lines = [];

    lines.push(`# ${spec.language} translation of the DeepSeek Usage plasmoid.`);
    lines.push("# SPDX-FileCopyrightText: 2026 cassidy");
    lines.push("# SPDX-License-Identifier: GPL-2.0-or-later");
    lines.push("#");
    lines.push("# Unreviewed: generated without a native-speaker pass (see translate/README.md).");
    lines.push("#");
    lines.push('msgid ""');
    lines.push('msgstr ""');
    // PO header values must end in an escaped newline. Built with String.raw so
    // the backslash survives into the file no matter how this source is edited.
    const NL = String.raw`\n`;
    const header = [
        `Project-Id-Version: deepseek-usage${NL}`,
        `Report-Msgid-Bugs-To: ${NL}`,
        `POT-Creation-Date: ${creationDate}${NL}`,
        // Mirrors the extraction date on purpose: regeneration is then
        // byte-stable, so the committed .po files do not churn per rebuild.
        `PO-Revision-Date: ${creationDate}${NL}`,
        // No translation team or named translator exists yet; these are the
        // gettext placeholders for exactly that situation.
        `Last-Translator: Unreviewed machine translation${NL}`,
        `Language-Team: LANGUAGE <LL@li.org>${NL}`,
        `Language: ${locale}${NL}`,
        `MIME-Version: 1.0${NL}`,
        `Content-Type: text/plain; charset=UTF-8${NL}`,
        `Content-Transfer-Encoding: 8bit${NL}`,
        `Plural-Forms: nplurals=${spec.nplurals}; plural=${spec.plural};${NL}`,
        `X-Generator: translate/generate.mjs${NL}`
    ];
    for (const line of header) {
        lines.push(`"${line}"`);
    }

    let translated = 0;
    for (const message of messages) {
        const value = spec.identity ? null : strings[message.key];
        const isPlural = Boolean(message.msgid_plural);

        if (!spec.identity && value === undefined) {
            throw new Error(`${locale}: no translation for ${JSON.stringify(message.key)}`);
        }

        for (const ref of message.refs) {
            lines.push(ref);
        }
        if (message.msgctxt) {
            lines.push(`msgctxt ${[...quoted(message.msgctxt)][0]}`);
        }
        lines.push(`msgid ${[...quoted(message.msgid)].join("\n")}`);

        if (isPlural) {
            lines.push(`msgid_plural ${[...quoted(message.msgid_plural)].join("\n")}`);
            const variants = spec.identity ? [message.msgid, message.msgid_plural] : value;
            if (!Array.isArray(variants) || variants.length !== spec.nplurals) {
                throw new Error(
                    `${locale}: ${JSON.stringify(message.key)} needs ${spec.nplurals} plural variants, got ${
                        Array.isArray(variants) ? variants.length : typeof variants
                    }`
                );
            }
            const expected = placeholders(message.msgid);
            variants.forEach((variant, index) => {
                if (placeholders(variant) !== expected) {
                    throw new Error(
                        `${locale}: plural ${index} of ${JSON.stringify(message.key)} has placeholders ` +
                            `[${placeholders(variant)}] but the msgid has [${expected}]`
                    );
                }
                lines.push(`msgstr[${index}] ${[...quoted(variant)].join("\n")}`);
            });
        } else {
            const variant = spec.identity ? message.msgid : value;
            if (typeof variant !== "string") {
                throw new Error(`${locale}: ${JSON.stringify(message.key)} must map to a string`);
            }
            if (placeholders(variant) !== placeholders(message.msgid)) {
                throw new Error(
                    `${locale}: ${JSON.stringify(message.key)} has placeholders [${placeholders(variant)}] ` +
                        `but the msgid has [${placeholders(message.msgid)}]`
                );
            }
            lines.push(`msgstr ${[...quoted(variant)].join("\n")}`);
        }
        lines.push("");
        translated += 1;
    }

    return { text: lines.join("\n"), translated };
}

/* ------------------------------------------------------------------- main */

const potPath = join(DIR, "template.pot");
if (!existsSync(potPath)) {
    console.error("translate/generate.mjs: template.pot is missing — run translate/merge.sh first");
    process.exit(1);
}
const pot = parsePot(readFileSync(potPath, "utf8"));

const declared = readdirSync(MESSAGES)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(/\.json$/, ""));
const unknown = declared.filter(l => !LOCALES[l]);
if (unknown.length > 0) {
    console.error(`translate/generate.mjs: tables with no LOCALES entry: ${unknown.join(", ")}`);
    process.exit(1);
}

let failures = 0;
let totalStrings = 0;
for (const locale of Object.keys(LOCALES)) {
    const { text, translated } = buildPo(locale, pot);
    totalStrings += translated;
    const target = join(DIR, `${locale}.po`);
    const previous = readIfExists(target);

    if (previous === text) {
        console.log(`  ${locale}: unchanged (${translated}/${pot.messages.length})`);
        continue;
    }
    if (checkOnly) {
        console.error(`  ${locale}: OUT OF DATE (${translated}/${pot.messages.length})`);
        failures += 1;
        continue;
    }
    writeFileSync(target, text);
    console.log(`  ${locale}: ${previous === null ? "created" : "updated"} (${translated}/${pot.messages.length})`);
}

// Keep LINGUAS in step with the catalogue list rather than hand-maintaining it.
const linguasPath = join(DIR, "LINGUAS");
const linguas = `${Object.keys(LOCALES).sort().join("\n")}\n`;
const currentLinguas = readIfExists(linguasPath);
if (currentLinguas !== linguas) {
    if (checkOnly) {
        console.error("  LINGUAS: OUT OF DATE");
        failures += 1;
    } else {
        writeFileSync(linguasPath, linguas);
    }
}

if (checkOnly && failures > 0) {
    console.error(`translate/generate.mjs: ${failures} catalogue(s) out of date — run without --check`);
    process.exit(1);
}
console.log(
    `translate/generate.mjs: ${Object.keys(LOCALES).length} catalogues, ${pot.messages.length} strings each` +
        `, ${totalStrings} entries${checkOnly ? " (check only)" : ""}`
);
