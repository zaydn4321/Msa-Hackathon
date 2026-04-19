import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const barrelPath = resolve(__dirname, "../api-zod/src/generated/types/index.ts");

let content = readFileSync(barrelPath, "utf-8");

// Fix duplicate exports that orval sometimes generates
const seen = new Set();
const lines = content.split("\n");
const deduped = lines.filter((line) => {
  if (!line.startsWith("export")) return true;
  if (seen.has(line)) return false;
  seen.add(line);
  return true;
});

writeFileSync(barrelPath, deduped.join("\n"), "utf-8");
console.log("Fixed zod barrel exports");
