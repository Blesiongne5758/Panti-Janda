// End-to-end signaling regression against the in-memory fixture server.
// Usage: start `npm run dev:function`, then run `node dev/e2e-call-renegotiation.mjs`.

const BASE = process.env.PANTI_API_URL ?? "http://127.0.0.1:8000/functions/v1/app";
let passed = 0;
let failed = 0;

async function call(action, payload = {}, token = null) {
  const headers = { "content-type": "application/json", accept: "application/json" };
  if (token) headers["x-app-session"] = token;
  const response = await fetch(BASE, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function login(email) {
  const result = await call("auth.login", { email, password: "rahasia123" });
  const token = result.body?.data?.token;
  if (result.status !== 200 || !token) throw new Error(`fixture login failed: ${email} (${result.status})`);
  const me = await call("auth.me", {}, token);
  const accountId = me.body?.data?.account?.id;
  if (me.status !== 200 || !accountId) throw new Error(`fixture auth.me failed: ${email} (${me.status})`);
  return { token, accountId };
}

const description = (type, sdp) => ({ type, sdp: `v=0\r\no=- ${sdp} 2 IN IP4 127.0.0.1\r\ns=fixture\r\nt=0 0\r\n` });
const sameCandidate = {
  candidate: "candidate:fixture 1 udp 2122260223 127.0.0.1 50000 typ host",
  sdpMid: "0",
  sdpMLineIndex: 0,
};

try {
  console.log("— login & initial audio call —");
  const caller = await login("wulan@contoh.id");
  const recipient = await login("dewi@contoh.id");
  const started = await call("call.start", {
    recipientAccountId: recipient.accountId,
    mode: "audio",
    offer: description("offer", "initial-offer"),
  }, caller.token);
  const callId = started.body?.data?.call?.id;
  check("audio call starts with one durable call ID", started.status === 200 && Boolean(callId));

  const incoming = await call("call.poll", {}, recipient.token);
  check("recipient receives incoming audio offer", incoming.status === 200 && incoming.body?.data?.incomingCall?.callId === callId);

  const initialAnswer = await call("call.answer", {
    callId,
    answer: description("answer", "initial-answer"),
  }, recipient.token);
  const initialPoll = await call("call.poll", { callId }, caller.token);
  check("initial answer makes the same call active", initialAnswer.status === 200 && initialPoll.body?.data?.call?.id === callId && initialPoll.body?.data?.call?.status === "active");

  const candidate0 = await call("call.candidate", { callId, revision: 0, candidate: sameCandidate }, caller.token);
  const candidate0Repeat = await call("call.candidate", { callId, revision: 0, candidate: sameCandidate }, caller.token);
  check("revision-0 ICE candidate is accepted and duplicate is idempotent", candidate0.status === 200 && candidate0Repeat.status === 200);

  console.log("— renegotiate audio to video without ending the call —");
  const offer1 = description("offer", "video-upgrade-offer");
  const upgrade = await call("call.renegotiate.offer", {
    callId,
    expectedRevision: 0,
    mode: "video",
    offer: offer1,
  }, caller.token);
  const duplicateUpgrade = await call("call.renegotiate.offer", {
    callId,
    expectedRevision: 0,
    mode: "video",
    offer: offer1,
  }, caller.token);
  const revision = upgrade.body?.data?.revision;
  check("upgrade offer creates revision 1 on the original call", upgrade.status === 200 && revision === 1 && duplicateUpgrade.status === 200 && duplicateUpgrade.body?.data?.revision === 1);

  const candidate1 = await call("call.candidate", { callId, revision: 1, candidate: sameCandidate }, caller.token);
  const recipientPoll = await call("call.poll", { callId }, recipient.token);
  const pending = recipientPoll.body?.data?.call?.renegotiation;
  const remoteCandidates = recipientPoll.body?.data?.call?.negotiationCandidates ?? [];
  check("recipient sees the pending video request on the same call ID", recipientPoll.status === 200 && recipientPoll.body?.data?.call?.id === callId && pending?.revision === 1 && pending?.mode === "video" && pending?.status === "pending");
  check("same ICE payload is retained once for each SDP revision", candidate1.status === 200 && [0, 1].every((wanted) => remoteCandidates.some((item) => item.revision === wanted && JSON.stringify(item.candidate) === JSON.stringify(sameCandidate))));

  const answer1 = await call("call.renegotiate.answer", {
    callId,
    revision: 1,
    answer: description("answer", "video-upgrade-answer"),
  }, recipient.token);
  const accepted = await call("call.poll", { callId }, caller.token);
  check("recipient accepts video and caller sees accepted mode on original call", answer1.status === 200 && accepted.body?.data?.call?.id === callId && accepted.body?.data?.call?.mode === "video" && accepted.body?.data?.call?.renegotiation?.status === "accepted");

  const staleOffer = await call("call.renegotiate.offer", {
    callId,
    expectedRevision: 0,
    mode: "video",
    offer: description("offer", "stale-offer"),
  }, caller.token);
  const futureCandidate = await call("call.candidate", { callId, revision: 99, candidate: { candidate: "future" } }, recipient.token);
  check("stale offer and unknown ICE revision are rejected as conflicts", staleOffer.status === 409 && futureCandidate.status === 409);

  const ended = await call("call.end", { callId, reason: "ended", duration: 8 }, caller.token);
  const endedPoll = await call("call.poll", { callId }, recipient.token);
  check("ordinary hang-up still ends the same video call", ended.status === 200 && endedPoll.body?.data?.call?.status === "ended");

  console.log("— reject video upgrade but keep audio alive —");
  const secondStart = await call("call.start", {
    recipientAccountId: recipient.accountId,
    mode: "audio",
    offer: description("offer", "second-audio-offer"),
  }, caller.token);
  const secondCallId = secondStart.body?.data?.call?.id;
  const secondAnswer = await call("call.answer", {
    callId: secondCallId,
    answer: description("answer", "second-audio-answer"),
  }, recipient.token);
  const secondUpgrade = await call("call.renegotiate.offer", {
    callId: secondCallId,
    expectedRevision: 0,
    mode: "video",
    offer: description("offer", "second-video-upgrade"),
  }, caller.token);
  const competingOffer = await call("call.renegotiate.offer", {
    callId: secondCallId,
    expectedRevision: 0,
    mode: "video",
    offer: description("offer", "competing-video-upgrade"),
  }, recipient.token);
  check("simultaneous upgrade request is rejected without creating another call", secondStart.status === 200 && Boolean(secondCallId) && secondAnswer.status === 200 && secondUpgrade.status === 200 && competingOffer.status === 409);

  const rejected = await call("call.renegotiate.reject", {
    callId: secondCallId,
    revision: 1,
  }, recipient.token);
  const stillAudio = await call("call.poll", { callId: secondCallId }, caller.token);
  check("declining upgrade leaves the call active in audio mode", rejected.status === 200 && stillAudio.body?.data?.call?.id === secondCallId && stillAudio.body?.data?.call?.status === "active" && stillAudio.body?.data?.call?.mode === "audio" && stillAudio.body?.data?.call?.renegotiation?.status === "rejected");

  await call("call.end", { callId: secondCallId, reason: "ended", duration: 2 }, caller.token);
} catch (error) {
  failed += 1;
  console.error(`FAIL  test setup or request — ${error instanceof Error ? error.message : String(error)}`);
  console.error("Ensure `npm run dev:function` is running with a fresh fixture server.");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
