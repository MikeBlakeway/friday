import { access, mkdir, readFile, writeFile } from "node:fs/promises";
export async function pathExists(filePath) {
    try {
        await access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
export async function ensureDir(dirPath) {
    await mkdir(dirPath, { recursive: true });
}
export async function writeFileIfMissing(filePath, content) {
    try {
        await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
        return "created";
    }
    catch (error) {
        const isAlreadyExists = error instanceof Error && "code" in error && error.code === "EEXIST";
        if (isAlreadyExists) {
            return "skipped";
        }
        throw error;
    }
}
export async function readTextFile(filePath) {
    return readFile(filePath, { encoding: "utf8" });
}
