"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
async function readFile(path) {
    try {
        const content = await (0, promises_1.readFile)(path, "utf8");
        return { path, ok: true, lines: content.split("\n") };
    }
    catch (e) {
        return { path, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}
async function readAll(paths) {
    const ans = await Promise.allSettled(paths.map((path) => readFile(path)));
    return ans;
}
