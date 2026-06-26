import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeFileIfMissing } from "../../src/core/fileSystem.js";

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dirPath = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dirPath);
  return dirPath;
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("writeFileIfMissing", () => {
  it("creates a missing file", async () => {
    const root = await createTempDir("friday-file-system-");
    const filePath = path.join(root, "notes.md");

    const result = await writeFileIfMissing(filePath, "first version");
    const content = await readFile(filePath, { encoding: "utf8" });

    expect(result).toBe("created");
    expect(content).toBe("first version");
  });

  it("returns skipped and does not overwrite an existing file", async () => {
    const root = await createTempDir("friday-file-system-");
    const filePath = path.join(root, "notes.md");
    await writeFile(filePath, "original content", { encoding: "utf8" });

    const result = await writeFileIfMissing(filePath, "replacement content");
    const content = await readFile(filePath, { encoding: "utf8" });

    expect(result).toBe("skipped");
    expect(content).toBe("original content");
  });
});