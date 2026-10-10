import path from "node:path";
import { mkdir, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const srcDir = path.join(rootDir, "vibe_images");
const outDir = path.join(rootDir, "public", "images");

const JOBS = [
  { match: "hero-community", out: "hero-community.webp", width: 1920 },
  { match: "archetype-pengusaha", out: "wajah-pengusaha.webp", width: 840 },
  { match: "archetype-sosialita", out: "wajah-sosialita.webp", width: 840 },
  { match: "archetype-pekerja", out: "wajah-pekerja.webp", width: 840 },
  { match: "archetype-umkm", out: "wajah-umkm.webp", width: 840 },
  { match: "archetype-tradisional", out: "wajah-tradisional.webp", width: 840 },
];

const files = await readdir(srcDir);
await mkdir(outDir, { recursive: true });

for (const job of JOBS) {
  const source = files.find((file) => file.startsWith(job.match) && file.endsWith(".png"));
  if (!source) {
    console.error(`missing source for ${job.out}`);
    process.exitCode = 1;
    continue;
  }
  const input = path.join(srcDir, source);
  const output = path.join(outDir, job.out);
  await sharp(input)
    .resize({ width: job.width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(output);
  const before = (await stat(input)).size;
  const after = (await stat(output)).size;
  console.log(`${job.out}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`);
}
