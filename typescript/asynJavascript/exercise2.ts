import { readFile as fsReadFile } from "node:fs/promises";

type FileResult =
    | { path: string; ok: true; lines: string[] }
    | { path: string; ok: false; error: string };

async function readFile(path: string): Promise<FileResult>{
    try {
        const content = await fsReadFile(path, "utf8");
        return { path, ok: true, lines: content.split("\n") };
    } catch (e) {
        return { path, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}
async function readAll(paths: string[]): Promise<FileResult[]>{
    const ans = await Promise.allSettled(paths.map((path) => readFile(path)));
    return ans;
}