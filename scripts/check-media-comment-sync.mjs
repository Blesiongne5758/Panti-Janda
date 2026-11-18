import { readFile } from "node:fs/promises";

const files = [
  "functions/handler.mjs",
  "supabase/functions/app/handler.mjs",
];
const startMarker = "async function mediaComment(ctx) {";
const endMarker = "\nasync function mediaShare(ctx) {";

async function mediaCommentSection(path) {
  const source = await readFile(path, "utf8");
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`${path} is missing a mediaComment section boundary`);
  }
  return source.slice(start, end).trim();
}

const [fixture, production] = await Promise.all(files.map(mediaCommentSection));
if (fixture !== production) {
  throw new Error("Fixture and deployed mediaComment handlers have drifted");
}
if (
  !fixture.includes('.from("media_posts").select("id,account_id")') ||
  !fixture.includes('.from("media_post_comments").insert(') ||
  !fixture.includes('"media_comment"') ||
  !fixture.includes("#/feed?post=${postId}")
) {
  throw new Error("mediaComment must validate the post, insert the comment, and notify its owner");
}
console.log("Feed mediaComment handlers match and notify the post owner.");
