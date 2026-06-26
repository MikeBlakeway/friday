import path from "node:path";
import { pathExists } from "./fileSystem.js";
import { FRIDAY_PROJECT_DIR, FRIDAY_PROJECT_FILES, } from "./fridayProject.js";
export async function getFridayProjectStatus(projectRoot) {
    const fridayProjectDirPath = path.join(projectRoot, FRIDAY_PROJECT_DIR);
    const hasFridayProjectDir = await pathExists(fridayProjectDirPath);
    const files = await Promise.all(FRIDAY_PROJECT_FILES.map(async (fileName) => {
        const filePath = path.join(fridayProjectDirPath, fileName);
        const exists = await pathExists(filePath);
        return {
            fileName,
            filePath,
            exists,
        };
    }));
    return {
        projectRoot,
        fridayProjectDirPath,
        hasFridayProjectDir,
        files,
    };
}
