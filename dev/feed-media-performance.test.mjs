import assert from "node:assert/strict";
import test from "node:test";
import { handleApp as sourceHandler } from "../functions/handler.mjs";
import { handleApp as deployedHandler } from "../supabase/functions/app/handler.mjs";

const authorId = "11111111-1111-4111-8111-111111111111";
const postIds = [
  "22222222-2222-4222-8222-222222222221",
  "22222222-2222-4222-8222-222222222222",
  "22222222-2222-4222-8222-222222222223",
];
const legacyImage = `data:image/jpeg;base64,${"A".repeat(400_000)}`;
const legacyVideo = `data:video/mp4;base64,${"B".repeat(400_000)}`;

const rows = {
  app_settings: [],
  media_posts: [
    { id: postIds[0], account_id: authorId, type: "photo", media_url: legacyImage, caption: "legacy image", duration: null, share_count: 0, created_at: "2026-11-18T12:00:00.000Z" },
    { id: postIds[1], account_id: authorId, type: "video", media_url: legacyVideo, caption: "legacy video", duration: 5, share_count: 0, created_at: "2026-11-18T11:00:00.000Z" },
    { id: postIds[2], account_id: authorId, type: "photo", media_url: "https://cdn.example.test/feed/photo.jpg", caption: "remote image", duration: null, share_count: 0, created_at: "2026-11-18T10:00:00.000Z" },
  ],
  media_post_likes: [],
  media_post_comments: [],
  accounts: [{ id: authorId, display_name: "Test account" }],
  profiles: [{ id: "33333333-3333-4333-8333-333333333333", account_id: authorId, nickname: "Test account", tier: "wonder_woman", photo_data: null }],
};

function makeSupabase() {
  return { from(table) { return new Query(rows[table] ?? []); } };
}

class Query {
  constructor(source) {
    this.source = source;
    this.columns = "*";
    this.filters = [];
    this.orders = [];
    this.maxRows = Infinity;
  }

  select(columns = "*") { this.columns = columns; return this; }
  eq(column, value) { this.filters.push((row) => row[column] === value); return this; }
  in(column, values) { this.filters.push((row) => values.includes(row[column])); return this; }
  lt(column, value) { this.filters.push((row) => row[column] < value); return this; }
  or() { return this; }
  order(column, { ascending = true } = {}) { this.orders.push([column, ascending]); return this; }
  limit(value) { this.maxRows = value; return this; }

  async maybeSingle() {
    const { data, error } = this.execute();
    return { data: data[0] ?? null, error };
  }

  async single() {
    const { data, error } = this.execute();
    return { data: data[0] ?? null, error };
  }

  then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); }

  execute() {
    let result = this.source.filter((row) => this.filters.every((filter) => filter(row)));
    for (const [column, ascending] of [...this.orders].reverse()) {
      result = [...result].sort((a, b) => {
        const comparison = a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0;
        return ascending ? comparison : -comparison;
      });
    }
    result = result.slice(0, this.maxRows);
    if (this.columns !== "*") {
      const columns = this.columns.split(",").map((column) => column.trim());
      result = result.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])));
    }
    return { data: result, error: null };
  }
}

async function invoke(action, fields = {}, handler = sourceHandler) {
  const response = await handler({
    request: new Request("https://app.example.test/functions/v1/app", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...fields }),
    }),
    supabase: makeSupabase(),
  });
  return response.json();
}

test("Feed metadata stays small when legacy images and videos are stored inline", async () => {
  const response = await invoke("media.feed", { limit: 20 });
  assert.equal(response.ok, true);
  assert.equal(response.data.items.length, 3);
  const metadataBytes = Buffer.byteLength(JSON.stringify(response));
  const mediaInclusiveResponse = await invoke("media.userPosts", { accountId: authorId });
  const mediaInclusiveBytes = Buffer.byteLength(JSON.stringify(mediaInclusiveResponse));
  assert.ok(metadataBytes < 32_000, "Feed metadata response should not embed legacy image/video payloads");
  assert.ok(metadataBytes < mediaInclusiveBytes * 0.02, "Feed metadata should be at least 98% smaller than the inline-media fixture");
  console.log(`Feed fixture response: ${metadataBytes} B metadata vs ${mediaInclusiveBytes} B with inline media`);
  assert.deepEqual(response.data.items.map((item) => item.mediaDeferred), [true, true, true]);
  assert.ok(response.data.items.every((item) => item.mediaUrl === ""));
});

test("Feed asset endpoint retrieves only the requested post media", async () => {
  const response = await invoke("media.asset", { postId: postIds[0] });
  assert.equal(response.ok, true);
  assert.equal(response.data.mediaUrl, legacyImage);
  assert.ok(JSON.stringify(response).length < legacyImage.length + 256);
});

test("deployed Supabase handler matches the Feed payload contract", async () => {
  const sourceResponse = await invoke("media.feed", { limit: 20 }, sourceHandler);
  const deployedResponse = await invoke("media.feed", { limit: 20 }, deployedHandler);
  assert.deepEqual(deployedResponse, sourceResponse);
});

test("profile post lists retain their existing media URLs", async () => {
  const response = await invoke("media.userPosts", { accountId: authorId });
  assert.equal(response.ok, true);
  assert.equal(response.data.items[0].mediaUrl, legacyImage);
  assert.equal(response.data.items[0].mediaDeferred, false);
});

test("Feed asset endpoint rejects unknown post IDs", async () => {
  const response = await invoke("media.asset", { postId: "44444444-4444-4444-8444-444444444444" });
  assert.equal(response.ok, false);
  assert.equal(response.error, "not_found");
});
