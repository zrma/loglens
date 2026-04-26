import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const assetsDir = fileURLToPath(new URL("dist/assets/", root));
const maxJsChunkBytes = 500 * 1024;

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!existsSync(assetsDir)) {
  fail("dist/assets is missing. Run pnpm build before pnpm check:bundle.");
} else {
  const jsChunks = readdirSync(assetsDir)
    .filter((fileName) => fileName.endsWith(".js") && !fileName.endsWith(".map"))
    .map((fileName) => {
      const path = join(assetsDir, fileName);
      return {
        fileName,
        size: statSync(path).size,
      };
    })
    .sort((left, right) => right.size - left.size || left.fileName.localeCompare(right.fileName));

  if (jsChunks.length === 0) {
    fail("dist/assets does not contain any JavaScript chunks.");
  }

  const oversizedChunks = jsChunks.filter((chunk) => chunk.size > maxJsChunkBytes);

  for (const chunk of jsChunks) {
    const status = chunk.size > maxJsChunkBytes ? "not ok" : "ok";
    console.log(`${status} - ${chunk.fileName} ${formatKiB(chunk.size)} / ${formatKiB(maxJsChunkBytes)}`);
  }

  if (oversizedChunks.length > 0) {
    fail(`JavaScript chunk size budget exceeded: ${oversizedChunks.map((chunk) => chunk.fileName).join(", ")}`);
  }
}
