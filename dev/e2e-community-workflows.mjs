// Community workflow integration test against the in-memory fixture only.
// Usage: npm run dev:function, then node dev/e2e-community-workflows.mjs
const BASE = process.env.PANTI_API_URL ?? "http://127.0.0.1:8000/functions/v1/app";
let passed = 0;
let failed = 0;

async function call(action, payload = {}, token = null, handler = "fixture") {
  const headers = { "content-type": "application/json", accept: "application/json" };
  if (token) headers["x-app-session"] = token;
  const endpoint = new URL(BASE);
  if (handler === "production") endpoint.searchParams.set("handler", "production");
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ action, ...payload }) });
  return { status: response.status, body: await response.json().catch(() => null) };
}
function check(label, condition, detail = "") {
  if (condition) { passed += 1; console.log(`  ok  ${label}`); }
  else { failed += 1; console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`); }
}
async function login(email) {
  const result = await call("auth.login", { email, password: "rahasia123" });
  const token = result.body?.data?.token;
  if (result.status !== 200 || !token) throw new Error(`fixture login failed for ${email}`);
  const me = await call("auth.me", {}, token);
  return { token, accountId: me.body?.data?.account?.id };
}

try {
  const employer = await login("wulan@contoh.id");
  const candidate = await login("budi@contoh.id");
  const other = await login("dewi@contoh.id");

  console.log("— referral registration —");
  const before = await call("referral.mine", {}, employer.token);
  const code = before.body?.data?.code;
  const initialCount = before.body?.data?.referralCount;
  const uniqueEmail = `fixture-ref-${Date.now()}@local.test`;
  const registered = await call("auth.register", {
    kind: "public", email: uniqueEmail, password: "fixturepass123", displayName: "Referral Test", referralCode: code,
  });
  const after = await call("referral.mine", {}, employer.token);
  check("registration accepts the sharer code and records one attribution", Boolean(code) && registered.status === 200 && after.body?.data?.referralCount === initialCount + 1,
    `before=${before.status}/${JSON.stringify(before.body)}; registered=${registered.status}/${registered.body?.error ?? "ok"}; after=${JSON.stringify(after.body)}`);
  const invalidCode = await call("auth.register", {
    kind: "public", email: `fixture-invalid-${Date.now()}@local.test`, password: "fixturepass123", displayName: "Invalid Referral", referralCode: "NOT-A-CODE",
  });
  check("invalid referral code is rejected before account registration", invalidCode.status === 400);

  console.log("— job listing and private applications —");
  const created = await call("learning.jobs.create", {
    title: `Test job ${Date.now()}`, company: "Fixture Employer", description: "A synthetic test listing for the local workflow suite.",
    jobType: "full_time", remote: true, requirements: "Fixture-only candidate", salaryMin: 1000, salaryMax: 2000,
  }, employer.token);
  const jobId = created.body?.data?.job?.id;
  check("authenticated employer can publish a job listing", created.status === 200 && Boolean(jobId));
  const applied = await call("learning.jobs.apply", { jobId, coverLetter: "Synthetic candidate application." }, candidate.token);
  check("candidate can apply to an active listing", applied.status === 200 && applied.body?.data?.applied === true);
  const candidateApps = await call("learning.jobs.myApplications", {}, candidate.token);
  check("candidate sees only own application and its listing", candidateApps.status === 200 && candidateApps.body?.data?.items?.some((item) => item.jobId === jobId && item.company === "Fixture Employer"),
    `status=${candidateApps.status}; items=${JSON.stringify(candidateApps.body?.data?.items ?? candidateApps.body)}`);
  const employerApps = await call("learning.jobs.applications", { jobId }, employer.token);
  check("listing owner can review submitted applications", employerApps.status === 200 && employerApps.body?.data?.items?.some((item) => item.candidateAccountId === candidate.accountId));
  const forbiddenApps = await call("learning.jobs.applications", { jobId }, other.token);
  check("non-owner cannot read a listing's applications", forbiddenApps.status === 404);
  const statusUpdate = await call("learning.jobs.applicationStatus", {
    applicationId: employerApps.body?.data?.items?.[0]?.id, status: "reviewing",
  }, employer.token);
  const candidateRefresh = await call("learning.jobs.myApplications", {}, candidate.token);
  check("candidate sees employer's updated application status", statusUpdate.status === 200 && candidateRefresh.body?.data?.items?.some((item) => item.jobId === jobId && item.status === "reviewing"),
    `update=${statusUpdate.status}/${statusUpdate.body?.error ?? "ok"}; items=${JSON.stringify(candidateRefresh.body?.data?.items ?? candidateRefresh.body)}`);

  console.log("— scheduled online interview room and video authorization —");
  const interviewStart = new Date(Date.now() + 15 * 60_000);
  interviewStart.setSeconds(0, 0);
  const interviewEnd = new Date(interviewStart.getTime() + 30 * 60_000);
  const scheduledInterview = await call("job.interviews.schedule", {
    applicationId: employerApps.body?.data?.items?.find((item) => item.candidateAccountId === candidate.accountId)?.id,
    mode: "online", scheduledStart: interviewStart.toISOString(), scheduledEnd: interviewEnd.toISOString(), timezone: "Asia/Jakarta", note: "Fixture-only interview",
  }, employer.token);
  const interviewId = scheduledInterview.body?.data?.interview?.id;
  const interviewAlert = await call("notifications.list", {}, candidate.token);
  const candidateInterviewList = await call("job.interviews.list", {}, candidate.token);
  const unauthorizedInterview = await call("job.interviews.get", { id: interviewId }, other.token);
  const authorizedJoin = await call("job.interviews.join", { id: interviewId }, candidate.token);
  check("both interview participants see the scheduled online interview and a stranger cannot read it", scheduledInterview.status === 200 && candidateInterviewList.body?.data?.items?.some((item) => item.id === interviewId && item.mode === "online") && unauthorizedInterview.status === 404,
    `schedule=${scheduledInterview.status}; candidate=${candidateInterviewList.status}; stranger=${unauthorizedInterview.status}`);
  check("candidate receives an interview notification linked to the interview room", interviewAlert.body?.data?.items?.some((item) => item.type === "job_interview" && item.link === `#/lowongan/wawancara/${interviewId}`),
    `notifications=${JSON.stringify(interviewAlert.body?.data?.items?.filter((item) => item.type === "job_interview"))}`);
  const onsiteJob = await call("learning.jobs.create", {
    title: `Fixture onsite interview ${Date.now()}`, company: "Fixture Employer", description: "Synthetic onsite interview test.", jobType: "full_time", remote: false,
  }, employer.token);
  const onsiteJobId = onsiteJob.body?.data?.job?.id;
  const onsiteApplication = onsiteJobId ? await call("learning.jobs.apply", { jobId: onsiteJobId, coverLetter: "Synthetic onsite candidate." }, candidate.token) : null;
  const onsiteApps = onsiteJobId ? await call("learning.jobs.applications", { jobId: onsiteJobId }, employer.token) : null;
  const onsiteApplicationId = onsiteApps?.body?.data?.items?.find((item) => item.candidateAccountId === candidate.accountId)?.id;
  const onsiteStart = new Date(Date.now() + 24 * 60 * 60_000); onsiteStart.setSeconds(0, 0);
  const onsiteEnd = new Date(onsiteStart.getTime() + 30 * 60_000);
  const onsiteWithoutLocation = onsiteApplicationId ? await call("job.interviews.schedule", {
    applicationId: onsiteApplicationId, mode: "onsite", scheduledStart: onsiteStart.toISOString(), scheduledEnd: onsiteEnd.toISOString(), timezone: "Asia/Jakarta",
  }, employer.token) : null;
  const onsiteInterview = onsiteApplicationId ? await call("job.interviews.schedule", {
    applicationId: onsiteApplicationId, mode: "onsite", scheduledStart: onsiteStart.toISOString(), scheduledEnd: onsiteEnd.toISOString(), timezone: "Asia/Jakarta", location: "Kantor Fixture, Jakarta",
  }, employer.token) : null;
  const candidateInterviewsAfterOnsite = await call("job.interviews.list", {}, candidate.token);
  check("onsite interview requires a location and the scheduled venue is visible to the candidate", onsiteJob.status === 200 && onsiteApplication?.status === 200 && onsiteWithoutLocation?.status === 400 && onsiteInterview?.status === 200 && candidateInterviewsAfterOnsite.body?.data?.items?.some((item) => item.id === onsiteInterview.body?.data?.interview?.id && item.mode === "onsite" && item.location === "Kantor Fixture, Jakarta"),
    `job=${onsiteJob.status}; apply=${onsiteApplication?.status ?? "not-run"}; missingLocation=${onsiteWithoutLocation?.status ?? "not-run"}; schedule=${onsiteInterview?.status ?? "not-run"}`);
  check("scheduled candidate can join the room only inside the interview window", authorizedJoin.status === 200 && authorizedJoin.body?.data?.authorized === true && authorizedJoin.body?.data?.recipientAccountId === employer.accountId,
    `join=${authorizedJoin.status}/${authorizedJoin.body?.error ?? "ok"}`);
  const candidateAgenda = await call("calendar.agenda", { month: interviewStart.toISOString().slice(0, 7) }, candidate.token);
  const employerAgenda = await call("calendar.agenda", { month: interviewStart.toISOString().slice(0, 7) }, employer.token);
  const interviewCalendarLink = `/lowongan/wawancara/${interviewId}`;
  check("online interview appears in both participants' calendars with a room link", candidateAgenda.body?.data?.items?.some((item) => item.id === `wawancara:${interviewId}` && item.link === interviewCalendarLink) && employerAgenda.body?.data?.items?.some((item) => item.id === `wawancara:${interviewId}` && item.link === interviewCalendarLink),
    `candidate=${JSON.stringify(candidateAgenda.body?.data?.items?.filter((item) => item.id === `wawancara:${interviewId}`))}; employer=${JSON.stringify(employerAgenda.body?.data?.items?.filter((item) => item.id === `wawancara:${interviewId}`))}`);
  const interviewOffer = { type: "offer", sdp: "v=0\r\no=- fixture-interview 2 IN IP4 127.0.0.1\r\ns=fixture\r\nt=0 0\r\n" };
  const validInterviewCall = await call("call.start", { recipientAccountId: employer.accountId, mode: "video", interviewId, offer: interviewOffer }, candidate.token);
  const interviewIncoming = await call("call.poll", {}, employer.token);
  const strangerInterviewCall = await call("call.start", { recipientAccountId: candidate.accountId, mode: "video", interviewId, offer: interviewOffer }, other.token);
  const audioInterviewCall = await call("call.start", { recipientAccountId: employer.accountId, mode: "audio", interviewId, offer: { ...interviewOffer, type: "offer" } }, candidate.token);
  check("video call is linked to the interview and carries its ID to the invited participant", validInterviewCall.status === 200 && interviewIncoming.body?.data?.incomingCall?.interviewId === interviewId,
    `start=${validInterviewCall.status}/${validInterviewCall.body?.error ?? "ok"}; incoming=${JSON.stringify(interviewIncoming.body?.data?.incomingCall ?? interviewIncoming.body)}`);
  check("server rejects interview signaling from a stranger and rejects audio mode", strangerInterviewCall.status === 403 && audioInterviewCall.status === 400,
    `stranger=${strangerInterviewCall.status}; audio=${audioInterviewCall.status}`);
  const interviewCallId = validInterviewCall.body?.data?.call?.id ?? validInterviewCall.body?.data?.callId ?? validInterviewCall.body?.data?.id;
  const endedInterviewCall = interviewCallId ? await call("call.end", { callId: interviewCallId, reason: "ended", duration: 0 }, candidate.token) : null;
  check("fixture interview call is ended after signaling assertions", endedInterviewCall?.status === 200,
    `callId=${interviewCallId ?? "missing"}; status=${endedInterviewCall?.status ?? "not-run"}`);

  console.log("— E-Sport sponsors, onsite venue, committee, and private chat —");
  const games = await call("esport.games.list", {}, employer.token);
  const game = games.body?.data?.items?.find((item) => item.active !== false);
  const missingVenue = await call("esport.tournaments.create", {
    gameId: game?.id, title: `Fixture onsite ${Date.now()}`, format: "single_elim", status: "draft", competitionMode: "onsite",
  }, employer.token);
  check("onsite competition requires a venue name and address", Boolean(game?.id) && missingVenue.status === 400,
    `games=${games.status}; create=${missingVenue.status}/${missingVenue.body?.error ?? "ok"}`);
  const onlineTournament = await call("esport.tournaments.create", {
    gameId: game?.id, title: `Fixture online ${Date.now()}`, format: "single_elim", status: "draft", competitionMode: "online",
  }, employer.token);
  check("online competition can be created without onsite venue fields", onlineTournament.status === 200,
    `create=${onlineTournament.status}/${onlineTournament.body?.error ?? "ok"}`);
  const tournamentCreated = await call("esport.tournaments.create", {
    gameId: game?.id, title: `Fixture E-Sport ${Date.now()}`, format: "single_elim", status: "draft", competitionMode: "onsite",
    venueName: "Arena Fixture", venueAddress: "Alamat sintetis, Jakarta", maxTeams: 8,
  }, employer.token);
  const tournamentId = tournamentCreated.body?.data?.tournament?.id ?? tournamentCreated.body?.data?.id;
  const tournamentView = tournamentId ? await call("esport.tournaments.get", { id: tournamentId }, candidate.token) : null;
  check("employer creates an onsite competition and its venue is exposed", tournamentCreated.status === 200 && Boolean(tournamentId) && tournamentView?.status === 200 && tournamentView.body?.data?.tournament?.competitionMode === "onsite" && tournamentView.body?.data?.tournament?.venueName === "Arena Fixture" && tournamentView.body?.data?.tournament?.venueAddress === "Alamat sintetis, Jakarta",
    `create=${tournamentCreated.status}/${tournamentCreated.body?.error ?? "ok"}; detail=${JSON.stringify(tournamentView?.body?.data?.tournament ? { mode: tournamentView.body.data.tournament.competitionMode, venue: tournamentView.body.data.tournament.venueName, address: tournamentView.body.data.tournament.venueAddress } : tournamentView?.body)}`);
  const sponsorSave = tournamentId ? await call("esport.sponsors.save", {
    id: tournamentId, sponsors: [
      { name: "Sponsor Utama Fixture", logoUrl: "https://example.test/sponsor.svg", websiteUrl: "https://example.test", isPrimary: true },
      { name: "Sponsor Pendukung Fixture", isPrimary: false },
    ],
  }, employer.token) : null;
  const sponsorList = tournamentId ? await call("esport.sponsors.list", { id: tournamentId }, candidate.token) : null;
  check("manager saves sponsor roster and public list marks a single primary banner", sponsorSave?.status === 200 && sponsorList?.status === 200 && sponsorList.body?.data?.items?.length === 2 && sponsorList.body?.data?.items?.filter((item) => item.isPrimary).length === 1 && sponsorList.body?.data?.items?.some((item) => item.isPrimary && item.logoUrl),
    `save=${sponsorSave?.status ?? "not-run"}; sponsors=${JSON.stringify(sponsorList?.body?.data?.items ?? sponsorList?.body)}`);
  const unauthorizedSponsorSave = tournamentId ? await call("esport.sponsors.save", { id: tournamentId, sponsors: [] }, other.token) : null;
  check("a non-manager cannot modify tournament sponsors", unauthorizedSponsorSave?.status === 403,
    `status=${unauthorizedSponsorSave?.status ?? "not-run"}`);
  const assigned = tournamentId ? await call("esport.committee.assign", { id: tournamentId, accountId: candidate.accountId, role: "Operator streaming" }, employer.token) : null;
  const staffList = tournamentId ? await call("esport.committee.list", { id: tournamentId }, employer.token) : null;
  const staffAccess = staffList?.body?.data?.groupId ? await call("groups.get", { id: staffList.body.data.groupId }, candidate.token) : null;
  const staffMessages = staffList?.body?.data?.groupId ? await call("groups.messages", { id: staffList.body.data.groupId }, candidate.token) : null;
  check("manager assigns a named competition role and creates a private committee chat", assigned?.status === 200 && staffList?.body?.data?.items?.some((item) => item.accountId === candidate.accountId && item.role === "Operator streaming") && staffAccess?.status === 200 && staffMessages?.status === 200,
    `assign=${assigned?.status ?? "not-run"}; staff=${JSON.stringify(staffList?.body?.data?.items ?? staffList?.body)}; group=${staffAccess?.status ?? "not-run"}`);
  const groupId = staffList?.body?.data?.groupId;
  const groupMarker = `committee-receipt-${Date.now()}`;
  const groupSent = groupId ? await call("groups.send", { id: groupId, body: groupMarker }, candidate.token) : null;
  const groupUnread = groupId ? await call("groups.messages", { id: groupId }, candidate.token) : null;
  const groupUnreadStatus = groupUnread?.body?.data?.items?.find((item) => item.body === groupMarker)?.readStatus;
  check("group message starts with a one-check receipt while another committee member has not read it", groupSent?.status === 200 && groupUnreadStatus === "sent",
    `send=${groupSent?.status ?? "not-run"}; receipt=${groupUnreadStatus ?? "missing"}`);
  const committeeRead = groupId ? await call("groups.messages", { id: groupId, active: true }, employer.token) : null;
  const groupRead = groupId ? await call("groups.messages", { id: groupId }, candidate.token) : null;
  const groupReadStatus = groupRead?.body?.data?.items?.find((item) => item.body === groupMarker)?.readStatus;
  check("group message changes to a two-check receipt after the other committee member reads it", committeeRead?.status === 200 && groupReadStatus === "read",
    `read=${committeeRead?.status ?? "not-run"}; receipt=${groupReadStatus ?? "missing"}`);
  const outsiderGroup = staffList?.body?.data?.groupId ? await call("groups.get", { id: staffList.body.data.groupId }, other.token) : null;
  const outsiderMessages = staffList?.body?.data?.groupId ? await call("groups.messages", { id: staffList.body.data.groupId }, other.token) : null;
  check("a non-committee user cannot open the group deep link or read its messages", outsiderGroup?.status === 404 && outsiderMessages?.status === 403,
    `group=${outsiderGroup?.status ?? "not-run"}; messages=${outsiderMessages?.status ?? "not-run"}`);
  const unauthorizedAssignment = tournamentId ? await call("esport.committee.assign", { id: tournamentId, accountId: other.accountId, role: "Wasit" }, other.token) : null;
  check("non-manager cannot alter committee assignments", unauthorizedAssignment?.status === 403,
    `status=${unauthorizedAssignment?.status ?? "not-run"}`);

  console.log("— marketplace orders and seller notification —");
  const products = await call("marketplace.list", { kind: "barang" }, candidate.token);
  const product = products.body?.data?.items?.find((item) => item.title === "Kue Kering Nastar & Kastengel");
  check("fixture exposes an active product listing for order test", products.status === 200 && Boolean(product?.id));
  const orderCreated = await call("marketplace.orders.create", { listingId: product?.id, quantity: 2, message: "Fixture-only order" }, candidate.token);
  const orderId = orderCreated.body?.data?.order?.id;
  check("buyer can place a pending order without online payment", orderCreated.status === 200 && Boolean(orderId) && orderCreated.body?.data?.paymentRequired === false);
  const buyerOrders = await call("marketplace.orders.list", {}, candidate.token);
  check("buyer can see the order in personal order history", buyerOrders.body?.data?.items?.some((item) => item.id === orderId && item.direction === "buyer"));
  const sellerOrders = await call("marketplace.orders.list", {}, other.token);
  check("product owner can see incoming order", sellerOrders.body?.data?.items?.some((item) => item.id === orderId && item.direction === "seller"));
  const sellerNotifications = await call("notifications.list", {}, other.token);
  check("incoming order notifies seller with a deep link", sellerNotifications.body?.data?.items?.some((item) => item.type === "marketplace_order" && item.link === `#/marketplace/orders?order=${orderId}`));
  const orderUpdate = await call("marketplace.orders.update", { id: orderId, status: "confirmed" }, other.token);
  const refreshedBuyerOrders = await call("marketplace.orders.list", {}, candidate.token);
  check("seller can confirm order and buyer sees updated status", orderUpdate.status === 200 && refreshedBuyerOrders.body?.data?.items?.some((item) => item.id === orderId && item.status === "confirmed"));

  console.log("— feed like/comment notifications —");
  const mediaPost = await call("media.create", { type: "photo", mediaUrl: "https://example.test/fixture-feed.jpg", caption: `Synthetic feed post ${Date.now()}` }, candidate.token);
  const postId = mediaPost.body?.data?.post?.id;
  const likedPost = postId ? await call("media.like", { postId }, employer.token) : null;
  const commentedPost = postId ? await call("media.comment", { postId, body: "Fixture-only comment" }, employer.token) : null;
  const feedNotifications = await call("notifications.list", {}, candidate.token);
  check("new like and comment notify the post owner with a post deep link", mediaPost.status === 200 && likedPost?.status === 200 && commentedPost?.status === 200 && feedNotifications.body?.data?.items?.some((item) => item.type === "media_like" && item.link === `#/feed?post=${postId}`) && feedNotifications.body?.data?.items?.some((item) => item.type === "media_comment" && item.link === `#/feed?post=${postId}`),
    `create=${mediaPost.status}; like=${likedPost?.status ?? "not-run"}; comment=${commentedPost?.status ?? "not-run"}; notifications=${JSON.stringify(feedNotifications.body?.data?.items?.filter((item) => item.link === `#/feed?post=${postId}`))}`);
  const productionPost = await call("media.create", { type: "photo", mediaUrl: "https://example.test/production-handler-feed.jpg", caption: `Synthetic production feed post ${Date.now()}` }, candidate.token);
  const productionPostId = productionPost.body?.data?.post?.id;
  const productionComment = productionPostId ? await call("media.comment", { postId: productionPostId, body: "Production-handler fixture comment" }, employer.token, "production") : null;
  const productionNotifications = await call("notifications.list", {}, candidate.token, "production");
  check("production handler notifies the post owner after a feed comment", productionPost.status === 200 && productionComment?.status === 200 && productionNotifications.body?.data?.items?.some((item) => item.type === "media_comment" && item.link === `#/feed?post=${productionPostId}`),
    `post=${productionPost.status}; comment=${productionComment?.status ?? "not-run"}; notifications=${JSON.stringify(productionNotifications.body?.data?.items?.filter((item) => item.type === "media_comment" && item.link === `#/feed?post=${productionPostId}`))}`);
  if (postId) await call("media.like", { postId }, candidate.token);
  const beforeUnlike = await call("notifications.list", {}, candidate.token);
  if (postId) await call("media.like", { postId }, employer.token);
  const afterUnlike = await call("notifications.list", {}, candidate.token);
  const linkNotificationsBefore = beforeUnlike.body?.data?.items?.filter((item) => item.link === `#/feed?post=${postId}` && item.type === "media_like").length;
  const linkNotificationsAfter = afterUnlike.body?.data?.items?.filter((item) => item.link === `#/feed?post=${postId}` && item.type === "media_like").length;
  check("self-like and unlike do not create duplicate like notifications", postId && linkNotificationsBefore === 1 && linkNotificationsAfter === linkNotificationsBefore,
    `before=${linkNotificationsBefore}; after=${linkNotificationsAfter}`);

  console.log("— direct-message read receipts —");
  const friendRequest = await call("friends.request", { targetAccountId: candidate.accountId }, employer.token);
  const friendAccept = await call("friends.respond", { targetAccountId: employer.accountId, decision: "accept" }, candidate.token);
  check("fixture accounts are connected before receipt test", friendRequest.status === 200 && friendAccept.status === 200,
    `request=${friendRequest.status}; accept=${friendAccept.status}`);
  const marker = `receipt-fixture-${Date.now()}`;
  const sent = await call("chat.send", { withAccountId: candidate.accountId, body: marker }, employer.token);
  const messageId = sent.body?.data?.message?.id;
  const senderUnread = await call("chat.thread", { withAccountId: candidate.accountId }, employer.token);
  const initialReceipt = senderUnread.body?.data?.items?.find((item) => item.id === messageId)?.readStatus;
  check("new DM has a one-check unread receipt for its sender", sent.status === 200 && initialReceipt === "sent",
    `send=${sent.status}/${sent.body?.error ?? "ok"}; receipt=${initialReceipt}`);
  const recipientRead = await call("chat.thread", { withAccountId: employer.accountId, active: true }, candidate.token);
  const senderRead = await call("chat.thread", { withAccountId: candidate.accountId }, employer.token);
  const finalReceipt = senderRead.body?.data?.items?.find((item) => item.id === messageId)?.readStatus;
  check("active recipient read changes sender receipt to two-check status", recipientRead.status === 200 && finalReceipt === "read",
    `read=${recipientRead.status}/${recipientRead.body?.error ?? "ok"}; received=${JSON.stringify(recipientRead.body?.data?.items?.map((item) => ({ id: item.id, from: item.senderAccountId })))}; receipt=${finalReceipt}`);
} catch (error) {
  failed += 1;
  console.error(`FAIL  fixture setup or request — ${error instanceof Error ? error.message : String(error)}`);
  console.error("Ensure the in-memory fixture is running via `npm run dev:function`.");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
