// Local dev server mock for testing without Supabase
// Run with: node functions/dev-server.mjs

import { createServer } from "node:http";

const PORT = 8000;

// Mock accounts database
const accounts = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    email: "admin@panti.local",
    name: "Admin Panti",
    role: "admin",
    status: "active",
    is_janda: false,
    password_hash: await hashPassword("admin123"),
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    email: "user@panti.local",
    name: "User Test",
    role: "kades",
    status: "active",
    is_janda: false,
    password_hash: await hashPassword("user123"),
    created_at: new Date().toISOString(),
  },
];

// Mock sessions
const sessions = new Map();

// Mock media posts
const mediaPosts = [
  {
    id: "media_1",
    account_id: "00000000-0000-0000-0000-000000000002",
    author_name: "User Test",
    author_photo: null,
    author_tier: "wonder_woman",
    type: "photo",
    media_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
    caption: "Pemandangan indah saat perjalanan ke pantai",
    likes: [],
    comments: [],
    shares: 0,
    duration: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "media_2",
    account_id: "00000000-0000-0000-0000-000000000001",
    author_name: "Admin Panti",
    author_photo: null,
    author_tier: "high_society",
    type: "video",
    media_url: "https://www.w3schools.com/html/mov_bbb.mp4",
    caption: "Video pendek kegiatan komunitas hari ini",
    likes: ["00000000-0000-0000-0000-000000000002"],
    comments: [
      {
        id: "comment_1",
        post_id: "media_2",
        account_id: "00000000-0000-0000-0000-000000000002",
        author_name: "User Test",
        author_photo: null,
        body: "Kegiatan yang sangat bermanfaat!",
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
    ],
    shares: 2,
    duration: 6,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

// Mock marketplace listings
const marketplaceListings = [
  {
    id: "listing_1",
    seller_profile_id: "00000000-0000-0000-0000-000000000002",
    seller_name: "User Test",
    seller_photo: null,
    seller_city: "Jakarta",
    kind: "barang",
    title: "Kue Kering Homemade",
    description: "Kue kering buatan rumah, cocok untuk hadiah dan acara keluarga. Tersedia berbagai rasa.",
    price: 85000,
    category: "makanan",
    photos: ["https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600"],
    status: "active",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "listing_2",
    seller_profile_id: "00000000-0000-0000-0000-000000000001",
    seller_name: "Admin Panti",
    seller_photo: null,
    seller_city: "Bandung",
    kind: "jasa",
    title: "Jasa Desain Grafis",
    description: "Menerima jasa desain logo, banner, dan materi promosi untuk UMKM.",
    price: 250000,
    category: "jasa",
    photos: ["https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600"],
    status: "active",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

// Mock APP_SETTINGS
const APP_SETTINGS = {
  payment: {
    enabled: false,
    midtransServerKey: "",
    midtransClientKey: "",
    midtransEnvironment: "sandbox",
  },
  shipping: {
    enabled: true,
    providers: [{ id: "jne", name: "JNE", enabled: true }],
  },
  subscription: {
    prices: {
      sosialita: 500000,
      high_society: 1000000,
      the_ceo: 2000000,
    },
  },
  academy: {
    enabled: true,
    title: "Akademi Panti",
    description: "Pelatihan untuk anggota",
    schedule: "Setiap Sabtu",
    location: "Online",
    modules: [],
  },
  trading: {
    enabled: true,
    title: "Belajar Trading",
    description: "Pelatihan trading untuk anggota",
    schedule: "Setiap Minggu",
    location: "Online",
    modules: [],
  },
  links: {
    enabled: true,
    items: [],
  },
  liveTrading: {
    enabled: true,
    provider: "tradingview",
    tradingViewWidgetId: "",
    tradingViewSymbol: "IDX:IHSG",
    tradingViewInterval: "1D",
    tradingViewTheme: "light",
    apiKey: "",
    apiBaseUrl: "",
    symbols: [{ id: "1", symbol: "IDX:IHSG", label: "IHSG", enabled: true }],
    refreshInterval: 5000,
  },
  metaTrader5: {
    enabled: false,
    broker: "",
    server: "",
    login: "",
    password: "",
    accountType: "demo",
    leverage: 100,
    balance: 10000,
    currency: "USD",
    allowedSymbols: ["EURUSD", "GBPUSD"],
    riskManagement: {
      maxLotSize: 1.0,
      maxOpenPositions: 5,
      stopLossPips: 50,
      takeProfitPips: 100,
      dailyLossLimit: 500,
    },
  },
  aiTradingAgent: {
    enabled: false,
    name: "AI Agent",
    description: "AI trading assistant",
    model: "gpt-4",
    strategy: "momentum",
    riskLevel: "medium",
    maxDailyTrades: 10,
    minConfidence: 0.7,
    autoExecute: false,
    notifyOnTrade: true,
    parameters: {
      lookbackPeriod: 14,
      entryThreshold: 0.7,
      exitThreshold: 0.3,
      positionSizePercent: 10,
    },
    allowedMarkets: ["forex", "crypto"],
    schedule: {
      enabled: false,
      startHour: 9,
      endHour: 17,
      timezone: "Asia/Jakarta",
    },
  },
  coinSettings: {
    purchaseMethods: [],
    withdrawMethods: [],
    conversionRate: 1000,
    fees: {
      adminFeePercent: 0,
      withdrawFeePercent: 0,
      minWithdrawCoins: 0,
    },
  },
  blockchainApi: {
    enabled: false,
    apiBaseUrl: "",
    apiKey: "",
    network: "",
    contractAddress: "",
    chainId: "",
    rpcUrl: "",
    webhookSecret: "",
    platformWallet: "",
    gasLimit: 21000,
    confirmations: 1,
  },
  trialAccounts: {
    enabled: false,
    accountsPerTier: 2,
    password: "trial12345",
  },
};

const TRIAL_TIERS = [
  { role: "wonder_woman", label: "Wonder Woman", isMember: true },
  { role: "sosialita", label: "Sosialita", isMember: true },
  { role: "high_society", label: "High Society", isMember: true },
  { role: "the_ceo", label: "The CEO", isMember: true },
  { role: "kades", label: "Kepala Desa", isMember: false },
  { role: "gubernur", label: "Gubernur", isMember: false },
  { role: "panglima", label: "Panglima", isMember: false },
  { role: "presiden", label: "Presiden", isMember: false },
];

function trialEmail(tier, index) {
  return `trial.${tier}.${index}@panti.test`;
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password, hash) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

function createSession(accountId) {
  const token = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  sessions.set(token, {
    id: sessionId,
    account_id: accountId,
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
  return { token, sessionId };
}

function getSession(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function publicAccount(account) {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    status: account.status,
    is_janda: account.is_janda,
    created_at: account.created_at,
  };
}

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-app-session");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const data = JSON.parse(body);
      const action = data.action;
      const token = req.headers["x-app-session"];

      let response;

      switch (action) {
        case "auth.login": {
          const { email, password } = data;
          const account = accounts.find((a) => a.email === email);
          if (!account) {
            response = { ok: false, error: "invalid_credentials" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          if (!(await verifyPassword(password, account.password_hash))) {
            response = { ok: false, error: "invalid_credentials" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          if (account.status !== "active") {
            response = { ok: false, error: "account_suspended" };
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const session = createSession(account.id);
          response = {
            ok: true,
            data: {
              token: session.token,
              account: publicAccount(account),
              profile: null,
            },
          };
          break;
        }

        case "auth.me": {
          if (!token) {
            response = { ok: false, error: "not_authenticated" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const session = getSession(token);
          if (!session) {
            response = { ok: false, error: "access_denied" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const account = accounts.find((a) => a.id === session.account_id);
          if (!account) {
            response = { ok: false, error: "not_found" };
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          response = {
            ok: true,
            data: {
              account: publicAccount(account),
              profile: null,
            },
          };
          break;
        }

        case "auth.logout": {
          if (token) {
            sessions.delete(token);
          }
          response = { ok: true, data: { loggedOut: true } };
          break;
        }

        case "home.summary": {
          response = {
            ok: true,
            data: {
              profiles: [],
              programs: [],
              events: [],
              stats: { verifiedMembers: 0, programs: 0, members: accounts.length },
              paymentEnabled: false,
            },
          };
          break;
        }

        case "liveTrading.settings": {
          response = {
            ok: true,
            data: {
              liveTrading: {
                enabled: true,
                provider: "twelvedata",
                tradingViewWidgetId: "",
                tradingViewSymbol: "IDX:IHSG",
                tradingViewInterval: "15",
                tradingViewTheme: "light",
                apiKey: "39cdbd541ed04eda9475e517d01ff3d6",
                apiBaseUrl: "https://api.twelvedata.com",
                symbols: [
                  { id: "sym1", symbol: "AAPL", label: "Apple", enabled: true },
                  { id: "sym2", symbol: "GOOGL", label: "Google", enabled: true },
                  { id: "sym3", symbol: "MSFT", label: "Microsoft", enabled: true },
                  { id: "sym4", symbol: "BTC/USD", label: "Bitcoin", enabled: true },
                  { id: "sym5", symbol: "ETH/USD", label: "Ethereum", enabled: true },
                  { id: "sym6", symbol: "EUR/USD", label: "EUR/USD", enabled: true },
                  { id: "sym7", symbol: "XAU/USD", label: "Emas", enabled: true },
                ],
                refreshInterval: 10,
              },
            },
          };
          break;
        }

        case "admin.stats": {
          const byRole = {};
          for (const a of accounts) {
            byRole[a.role] = (byRole[a.role] || 0) + 1;
          }
          response = {
            ok: true,
            data: {
              accounts: { total: accounts.length, byRole },
              pendingProfiles: 0,
              openReports: 0,
              donationTotal: 0,
              paymentEnabled: false,
            },
          };
          break;
        }

        case "admin.accounts.list": {
          response = {
            ok: true,
            data: {
              items: accounts.map((a) => ({
                id: a.id,
                email: a.email,
                name: a.name,
                displayName: a.name,
                nickname: a.name,
                role: a.role,
                tier: a.role === "admin" ? null : a.role,
                status: a.status,
                is_janda: a.is_janda,
                level: a.level ?? 1,
                xp: a.xp ?? 0,
                created_at: a.created_at,
                createdAt: a.created_at,
              })),
            },
          };
          break;
        }

        case "admin.profiles.pending": {
          response = { ok: true, data: { items: [] } };
          break;
        }

        case "admin.profiles.review": {
          response = { ok: true, data: { success: true } };
          break;
        }

        case "admin.accounts.setRole": {
          const acc = accounts.find((a) => a.id === data.id);
          if (acc) acc.role = data.role;
          response = { ok: true, data: { success: true } };
          break;
        }

        case "admin.accounts.setStatus": {
          const acc = accounts.find((a) => a.id === data.id);
          if (acc) acc.status = data.status;
          response = { ok: true, data: { success: true } };
          break;
        }

        case "admin.reports.list": {
          response = { ok: true, data: { items: [] } };
          break;
        }

        case "admin.reports.resolve": {
          response = { ok: true, data: { success: true } };
          break;
        }

        case "donations.list": {
          response = { ok: true, data: { items: [] } };
          break;
        }

        case "admin.settings.get": {
          response = { ok: true, data: { settings: APP_SETTINGS } };
          break;
        }

        case "admin.settings.update": {
          if (data.settings) {
            for (const [key, value] of Object.entries(data.settings)) {
              if (key in APP_SETTINGS) {
                APP_SETTINGS[key] = { ...APP_SETTINGS[key], ...value };
              }
            }
          }
          response = { ok: true, data: { settings: APP_SETTINGS } };
          break;
        }

        case "admin.trial.status": {
          const trialAccounts = accounts.filter((a) => a.email.startsWith("trial.") && a.email.endsWith("@panti.test"));
          const byTier = {};
          for (const a of trialAccounts) {
            const parts = a.email.split(".");
            const tier = parts[1];
            if (!byTier[tier]) byTier[tier] = [];
            byTier[tier].push({ id: a.id, email: a.email, display_name: a.name });
          }
          response = { ok: true, data: { total: trialAccounts.length, byTier } };
          break;
        }

        case "admin.trial.create": {
          const count = APP_SETTINGS.trialAccounts.accountsPerTier;
          const created = [];
          for (const tier of TRIAL_TIERS) {
            for (let i = 1; i <= count; i++) {
              const mail = trialEmail(tier.role, i);
              const existing = accounts.find((a) => a.email === mail);
              if (existing) {
                created.push({ email: mail, role: tier.role, skipped: true });
                continue;
              }
              const newAccount = {
                id: crypto.randomUUID(),
                email: mail,
                name: `Trial ${tier.label} #${i}`,
                role: tier.role,
                status: "active",
                is_janda: false,
                password_hash: await hashPassword(APP_SETTINGS.trialAccounts.password),
                level: 1,
                xp: 0,
                created_at: new Date().toISOString(),
              };
              accounts.push(newAccount);
              created.push({ email: mail, role: tier.role, skipped: false });
            }
          }
          APP_SETTINGS.trialAccounts.enabled = true;
          response = { ok: true, data: { created: created.length, items: created } };
          break;
        }

        case "notifications.list": {
          response = { ok: true, data: { items: [], unreadCount: 0 } };
          break;
        }

        case "notifications.markRead": {
          response = { ok: true, data: { success: true } };
          break;
        }

        case "admin.trial.delete": {
          const trialIds = accounts
            .filter((a) => a.email.startsWith("trial.") && a.email.endsWith("@panti.test"))
            .map((a) => a.id);
          for (let i = accounts.length - 1; i >= 0; i--) {
            if (trialIds.includes(accounts[i].id)) {
              accounts.splice(i, 1);
            }
          }
          APP_SETTINGS.trialAccounts.enabled = false;
          response = { ok: true, data: { deleted: trialIds.length } };
          break;
        }

        case "media.feed": {
          const sorted = [...mediaPosts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          response = {
            ok: true,
            data: {
              items: sorted.map((p) => ({
                id: p.id,
                accountId: p.account_id,
                authorName: p.author_name,
                authorPhoto: p.author_photo,
                authorTier: p.author_tier,
                type: p.type,
                mediaUrl: p.media_url,
                caption: p.caption,
                likes: p.likes,
                comments: p.comments,
                shares: p.shares,
                duration: p.duration,
                createdAt: p.created_at,
              })),
            },
          };
          break;
        }

        case "media.userPosts": {
          const { accountId } = data;
          if (!accountId) {
            response = { ok: false, error: "invalid_input" };
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const userPosts = mediaPosts
            .filter((p) => p.account_id === accountId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map((p) => ({
              id: p.id,
              accountId: p.account_id,
              authorName: p.author_name,
              authorPhoto: p.author_photo,
              authorTier: p.author_tier,
              type: p.type,
              mediaUrl: p.media_url,
              caption: p.caption,
              likes: p.likes,
              comments: p.comments,
              shares: p.shares,
              duration: p.duration,
              createdAt: p.created_at,
            }));
          response = { ok: true, data: { items: userPosts } };
          break;
        }

        case "media.create": {
          if (!token) {
            response = { ok: false, error: "not_authenticated" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const session = getSession(token);
          if (!session) {
            response = { ok: false, error: "access_denied" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const account = accounts.find((a) => a.id === session.account_id);
          if (!account) {
            response = { ok: false, error: "account_not_found" };
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const { type, mediaUrl, caption, duration } = data;
          if (!type || !mediaUrl || (type !== "photo" && type !== "video")) {
            response = { ok: false, error: "invalid_input" };
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          if (type === "video" && duration && duration > 6) {
            response = { ok: false, error: "video_too_long" };
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const newPost = {
            id: `media_${Date.now()}`,
            account_id: account.id,
            author_name: account.name,
            author_photo: null,
            author_tier: "wonder_woman",
            type,
            media_url: mediaUrl,
            caption: caption || null,
            likes: [],
            comments: [],
            shares: 0,
            duration: type === "video" ? duration || 6 : null,
            created_at: new Date().toISOString(),
          };
          mediaPosts.push(newPost);
          response = {
            ok: true,
            data: {
              post: {
                id: newPost.id,
                accountId: newPost.account_id,
                authorName: newPost.author_name,
                authorPhoto: newPost.author_photo,
                authorTier: newPost.author_tier,
                type: newPost.type,
                mediaUrl: newPost.media_url,
                caption: newPost.caption,
                likes: newPost.likes,
                comments: newPost.comments,
                shares: newPost.shares,
                duration: newPost.duration,
                createdAt: newPost.created_at,
              },
            },
          };
          break;
        }

        case "media.like": {
          if (!token) {
            response = { ok: false, error: "not_authenticated" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const session = getSession(token);
          if (!session) {
            response = { ok: false, error: "access_denied" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const { postId } = data;
          const post = mediaPosts.find((p) => p.id === postId);
          if (!post) {
            response = { ok: false, error: "post_not_found" };
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const likeIndex = post.likes.indexOf(session.account_id);
          if (likeIndex >= 0) {
            post.likes.splice(likeIndex, 1);
          } else {
            post.likes.push(session.account_id);
          }
          response = { ok: true, data: { likes: post.likes } };
          break;
        }

        case "media.comment": {
          if (!token) {
            response = { ok: false, error: "not_authenticated" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const session = getSession(token);
          if (!session) {
            response = { ok: false, error: "access_denied" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const account = accounts.find((a) => a.id === session.account_id);
          if (!account) {
            response = { ok: false, error: "account_not_found" };
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const { postId, body } = data;
          if (!postId || !body) {
            response = { ok: false, error: "invalid_input" };
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const post = mediaPosts.find((p) => p.id === postId);
          if (!post) {
            response = { ok: false, error: "post_not_found" };
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const newComment = {
            id: `comment_${Date.now()}`,
            post_id: postId,
            account_id: account.id,
            author_name: account.name,
            author_photo: null,
            body,
            created_at: new Date().toISOString(),
          };
          post.comments.push(newComment);
          response = {
            ok: true,
            data: {
              comment: {
                id: newComment.id,
                postId: newComment.post_id,
                accountId: newComment.account_id,
                authorName: newComment.author_name,
                authorPhoto: newComment.author_photo,
                body: newComment.body,
                createdAt: newComment.created_at,
              },
            },
          };
          break;
        }

        case "media.share": {
          const { postId } = data;
          const post = mediaPosts.find((p) => p.id === postId);
          if (!post) {
            response = { ok: false, error: "post_not_found" };
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          post.shares += 1;
          response = { ok: true, data: { shares: post.shares } };
          break;
        }

        case "media.delete": {
          if (!token) {
            response = { ok: false, error: "not_authenticated" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const session = getSession(token);
          if (!session) {
            response = { ok: false, error: "access_denied" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const { postId } = data;
          const postIndex = mediaPosts.findIndex((p) => p.id === postId && p.account_id === session.account_id);
          if (postIndex < 0) {
            response = { ok: false, error: "post_not_found" };
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          mediaPosts.splice(postIndex, 1);
          response = { ok: true, data: { deleted: true } };
          break;
        }

        case "marketplace.list": {
          const { kind, category } = data;
          let filtered = [...marketplaceListings];
          if (kind) filtered = filtered.filter((l) => l.kind === kind);
          if (category) filtered = filtered.filter((l) => l.category === category);
          const sorted = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          response = {
            ok: true,
            data: {
              items: sorted.map((l) => ({
                id: l.id,
                sellerProfileId: l.seller_profile_id,
                sellerName: l.seller_name,
                sellerPhoto: l.seller_photo,
                sellerCity: l.seller_city,
                kind: l.kind,
                title: l.title,
                description: l.description,
                price: l.price,
                category: l.category,
                photos: l.photos,
                status: l.status,
                createdAt: l.created_at,
                updatedAt: l.updated_at,
              })),
            },
          };
          break;
        }

        case "marketplace.get": {
          const { id } = data;
          if (!id) {
            response = { ok: false, error: "invalid_input" };
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const listing = marketplaceListings.find((l) => l.id === id);
          if (!listing) {
            response = { ok: false, error: "not_found" };
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          response = {
            ok: true,
            data: {
              listing: {
                id: listing.id,
                sellerProfileId: listing.seller_profile_id,
                sellerName: listing.seller_name,
                sellerPhoto: listing.seller_photo,
                sellerCity: listing.seller_city,
                kind: listing.kind,
                title: listing.title,
                description: listing.description,
                price: listing.price,
                category: listing.category,
                photos: listing.photos,
                status: listing.status,
                createdAt: listing.created_at,
                updatedAt: listing.updated_at,
              },
              sellerWhatsapp: null,
            },
          };
          break;
        }

        case "marketplace.create": {
          if (!token) {
            response = { ok: false, error: "not_authenticated" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const session = getSession(token);
          if (!session) {
            response = { ok: false, error: "access_denied" };
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const { kind, category, title, description, price, photos } = data;
          if (!kind || !category || !title) {
            response = { ok: false, error: "invalid_input" };
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
          const account = accounts.find((a) => a.id === session.account_id);
          const newListing = {
            id: `listing_${Date.now()}`,
            seller_profile_id: session.account_id,
            seller_name: account?.display_name || account?.nickname || "Anggota",
            seller_photo: account?.photo_data || null,
            seller_city: account?.city || null,
            kind,
            title,
            description: description || null,
            price: price || null,
            category,
            photos: Array.isArray(photos) ? photos : [],
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          marketplaceListings.push(newListing);
          response = {
            ok: true,
            data: {
              listing: {
                id: newListing.id,
                sellerProfileId: newListing.seller_profile_id,
                sellerName: newListing.seller_name,
                sellerPhoto: newListing.seller_photo,
                sellerCity: newListing.seller_city,
                kind: newListing.kind,
                title: newListing.title,
                description: newListing.description,
                price: newListing.price,
                category: newListing.category,
                photos: newListing.photos,
                status: newListing.status,
                createdAt: newListing.created_at,
                updatedAt: newListing.updated_at,
              },
            },
          };
          break;
        }

        default: {
          console.error(`[dev-server] Unknown action: ${action}`);
          response = { ok: false, error: "invalid_action" };
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response));
          return;
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "server_error" }));
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`✓ Mock backend running at http://127.0.0.1:${PORT}`);
  console.log(`\nTest accounts:`);
  console.log(`  admin@panti.local / admin123 (admin)`);
  console.log(`  user@panti.local / user123 (user)\n`);
});
