import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const publicDir = path.join(projectRoot, "public");

const filesToCopy = [
  "mundial2026-typsa_1200x630px.jpg",
];

fs.mkdirSync(distDir, { recursive: true });

for (const filename of filesToCopy) {
  const from = path.join(publicDir, filename);
  const to = path.join(distDir, filename);

  if (!fs.existsSync(from)) {
    console.warn(`[postbuild] Missing file: ${from}`);
    continue;
  }

  fs.copyFileSync(from, to);
  console.log(`[postbuild] Copied: ${filename}`);
}
