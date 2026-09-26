/*
    Loads the widget's plain-script JS modules (no ES `export`) into a fresh
    vm context so they can be unit-tested with node:test.
*/
import { readFileSync } from "node:fs";
import vm from "node:vm";

export function load(relPath) {
    const src = readFileSync(new URL("../" + relPath, import.meta.url), "utf8");
    const ctx = vm.createContext({});
    vm.runInContext(src, ctx, { filename: relPath });
    return ctx;
}
