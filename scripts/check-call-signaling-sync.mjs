import { readFile } from "node:fs/promises";

const files = [
  "functions/handler.mjs",
  "supabase/functions/app/handler.mjs",
];
const startMarker = "// ---------- voice & video calling";
const endMarker = "// ---------- programs ----------";

async function signalingSection(path) {
  const source = await readFile(path, "utf8");
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`${path} is missing a WebRTC signaling section boundary`);
  }
  return source.slice(start, end);
}

const [local, production] = await Promise.all(files.map(signalingSection));
if (local !== production) {
  throw new Error("Local and deployed WebRTC signaling handlers have drifted");
}
if (!local.includes("callSignalRpc") || local.includes("activeCalls = new Map()")) {
  throw new Error("The shared WebRTC signaling section is not database-backed");
}
console.log("WebRTC signaling handlers match and use durable database signaling.");
