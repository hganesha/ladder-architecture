import { writeFile } from "node:fs/promises";

const generatedIgnore = new URL("../src/wasm/pkg/.gitignore", import.meta.url);
await writeFile(generatedIgnore, "# Generated browser compiler artifacts are intentionally versioned.\n!*\n", "utf8");
