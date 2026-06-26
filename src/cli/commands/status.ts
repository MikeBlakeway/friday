import { getFridayProjectStatus } from "../../core/getFridayProjectStatus.js";

export async function runStatusCommand(options: {
  projectRoot: string;
}): Promise<void> {
  const status = await getFridayProjectStatus(options.projectRoot);

  console.log(`Project root: ${status.projectRoot}`);

  if (!status.hasFridayProjectDir) {
    console.log("Friday memory: not initialized");
    console.log("");
    console.log("This project does not have a .friday directory yet.");
    console.log("Run the following command to initialize Friday memory:");
    console.log("");
    console.log("  friday init");
    return;
  }

  console.log(`Friday memory: initialized (${status.fridayProjectDirPath})`);
  console.log("");
  console.log("Expected memory files:");

  for (const fileStatus of status.files) {
    const marker = fileStatus.exists ? "✓" : "✗";
    console.log(`  ${marker} .friday/${fileStatus.fileName}`);
  }
}