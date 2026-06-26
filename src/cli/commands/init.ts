import path from "node:path";

import { ensureDir, writeFileIfMissing } from "../../core/fileSystem.js";
import {
	FRIDAY_PROJECT_DIR,
	FRIDAY_PROJECT_FILES,
	type FridayProjectFile,
} from "../../core/fridayProject.js";
import { getProjectTemplate } from "../../core/projectTemplates.js";

export async function runInitCommand(options: {
	projectRoot: string;
}): Promise<void> {
	const fridayDirPath = path.join(options.projectRoot, FRIDAY_PROJECT_DIR);

	await ensureDir(fridayDirPath);

	const created: FridayProjectFile[] = [];
	const skipped: FridayProjectFile[] = [];

	for (const fileName of FRIDAY_PROJECT_FILES) {
		const filePath = path.join(fridayDirPath, fileName);
		const result = await writeFileIfMissing(filePath, getProjectTemplate(fileName));

		if (result === "created") {
			created.push(fileName);
		} else {
			skipped.push(fileName);
		}
	}

	console.log(`Project root: ${options.projectRoot}`);
	console.log(`Friday memory directory: ${fridayDirPath}`);
	console.log("");

	console.log("Created files:");
	if (created.length === 0) {
		console.log("  (none)");
	} else {
		for (const fileName of created) {
			console.log(`  + .friday/${fileName}`);
		}
	}

	console.log("");
	console.log("Skipped files (already existed):");
	if (skipped.length === 0) {
		console.log("  (none)");
	} else {
		for (const fileName of skipped) {
			console.log(`  - .friday/${fileName}`);
		}
	}

	console.log("");
	console.log("Next steps: run \"friday status\" and start filling in your .friday memory files.");
}
