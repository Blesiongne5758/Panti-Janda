export type Role = "public" | "wonder_woman" | "sosialita" | "high_society" | "the_ceo" | "kades" | "walikota" | "gubernur" | "panglima" | "presiden" | "ceo" | "sultan" | "admin";
export type WidowRole = "wonder_woman" | "sosialita" | "high_society" | "the_ceo";
export type PublicRole = "kades" | "walikota" | "gubernur" | "panglima" | "presiden" | "ceo" | "sultan";
export type VerificationDocType = "ktp" | "pengadilan";
export type AccountStatus = "active" | "suspended";
export type ProfileStatus = "pending" | "rejected" | "verified" | "suspended";
export type Audience = "umum" | "anggota" | "undangan";
export type ProgramCategory = "akademi" | "pelatihan" | "seminar" | "penempatan_kerja";
export type SupportType = "dana" | "jasa" | "barang";
export type DonationStatus = "pending" | "settled" | "challenge" | "failed" | "refunded";

export interface Account {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  displayName: string | null;
  level: number;
  xp: number;
}

export interface VerificationDoc {
  type: VerificationDocType;
  fileName: string | null;
  dataUrl: string;
}

export interface BankInfo {
  bankName: string;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
}

export interface Profile {
  id: string;
  accountId: string;
  nickname: string;
  tier: WidowRole;
  city: string | null;
  age: number | null;
  dependents: number | null;
  employmentStatus: string | null;
  skills: string[];
  trainings: string[];
  needsTarget: string | null;
  mainTarget: string | null;
  interests: string[];
  bio: string | null;
  fundingInfo: string | null;
  photoData: string | null;
  education: string | null;
  insurance: string | null;
  simClasses: string[];
  passport: boolean | null;
  status: ProfileStatus;
  rejectReason: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Only present on the member's own profile or in admin verification responses.
  fullName?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  verificationDoc?: VerificationDoc | null;
  bank?: BankInfo | null;
  heightCm?: number | null;
  weightKg?: number | null;
  birthPlace?: string | null;
  birthDate?: string | null;
}

export interface SessionResult {
  token: string;
  account: Account;
  profile: Profile | null;
  bootstrap?: boolean;
}

export interface HomeSummary {
  profiles: Profile[];
  programs: ProgramItem[];
  events: EventItem[];
  stats: { verifiedMembers: number; programs: number; members: number };
  paymentEnabled: boolean;
}

export interface ProfileDetail {
  profile: Profile;
  support: { donationTotal: number; pledgeCount: number; updateCount: number };
  paymentEnabled: boolean;
  follow: { followerCount: number; viewerFollows: boolean };
}

export interface FollowItem {
  accountId: string;
  nickname: string;
  tier: WidowRole;
  photoData: string | null;
  followedAt: string;
}

export interface FollowsMine {
  items: FollowItem[];
  followerCount: number;
}

export interface ChatContact {
  accountId: string;
  profileId: string | null;
  nickname: string;
  tier: WidowRole;
  photoData: string | null;
  status: ProfileStatus;
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null;
}

export interface ChatMessage {
  id: string;
  threadKind: "dm" | "group";
  senderAccountId: string;
  senderName: string;
  senderPhoto: string | null;
  recipientAccountId: string | null;
  groupId: string | null;
  body: string;
  createdAt: string;
}

export interface ChatThread {
  contact: { accountId: string; profileId: string | null; nickname: string; tier: WidowRole; photoData: string | null };
  items: ChatMessage[];
}

export interface UpdateItem {
  id: string;
  profileId: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface CommentItem {
  id: string;
  updateId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface PledgeItem {
  id: string;
  profileId: string | null;
  supporterName: string;
  contact: string | null;
  supportType: SupportType;
  amount: number | null;
  message: string | null;
  status: string;
  createdAt: string;
}

export interface DonationItem {
  id: string;
  profileId: string;
  orderId: string;
  grossAmount: number;
  supporterName: string;
  status: DonationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  audience: Audience;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  fundingTarget: number | null;
  ticketPrice: number | null;
  groupId: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  goingCount: number;
  myRsvp: string | null;
  invited: boolean;
  isCommittee: boolean;
  creatorName: string | null;
}

export interface EventCommittee {
  id: string;
  accountId: string;
  accountName: string;
  accountPhoto: string | null;
  role: string;
}

export interface EventTicket {
  id: string;
  code: string;
  ticketType: string;
  price: number;
  paymentStatus: string | null;
  status: string;
}

export interface EventDetail {
  event: EventItem & {
    attendees: string[];
    invited: string[];
    committees: EventCommittee[];
    isCreator: boolean;
    isCommittee: boolean;
    myTicket: EventTicket | null;
    attendanceCount: number;
  };
}

export interface KpiSummary {
  totalPoints: number;
  level: number;
  levelTitle: string;
  nextLevelPoints: number | null;
  nextLevelTitle: string | null;
  recentLogs: KpiLog[];
  xpToNextLevel: number | null;
  currentLevelXp: number;
}

export interface KpiLog {
  id: string;
  sourceType: string;
  sourceId: string;
  points: number;
  createdAt: string;
}

export interface Badge {
  id: string;
  badgeType: string;
  label: string;
  tier: number;
  awardedAt: string;
}

export interface GroupItem {
  id: string;
  name: string;
  description: string | null;
  audienceMinRole: WidowRole;
  capacity: number | null;
  createdBy: string;
  createdAt: string;
  memberCount: number;
  joined: boolean;
}

export interface GroupDetail {
  group: GroupItem & { members: string[] };
}

export interface ProgramItem {
  id: string;
  title: string;
  category: ProgramCategory;
  description: string | null;
  schedule: string | null;
  seats: number | null;
  status: string;
  createdBy: string;
  createdAt: string;
  participantCount: number;
  joined: boolean;
  creatorName: string | null;
}

export interface AdminStats {
  accounts: { total: number; byRole: Record<string, number> };
  pendingProfiles: number;
  openReports: number;
  donationTotal: number;
  paymentEnabled: boolean;
}

export interface AdminAccount extends Account {
  createdAt: string;
  nickname: string | null;
  tier: WidowRole | null;
}

export interface ReportItem {
  id: string;
  targetType: "profile" | "update" | "comment";
  targetId: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
}

export type CampaignStatus = "open" | "closed" | "completed";

export interface Campaign {
  id: string;
  profileId: string;
  title: string;
  description: string;
  targetAmount: number;
  collectedAmount: number;
  deadline: string | null;
  status: CampaignStatus;
  creatorName: string;
  creatorPhoto: string | null;
  createdAt: string;
  donorCount: number;
}

export interface CampaignDetail extends Campaign {
  donations: CampaignDonation[];
}

export interface CampaignDonation {
  id: string;
  supporterName: string;
  amount: number;
  message: string | null;
  status: DonationStatus;
  createdAt: string;
}

export type NotificationType = "follow" | "message" | "donation" | "verification";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actorName: string | null;
  actorPhoto: string | null;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export type BusinessStatus = "draft" | "pending" | "approved" | "rejected";

export type SubscriptionStatus = "pending" | "active" | "cancelled" | "expired";
export type SubscriptionTier = "sosialita" | "high_society" | "the_ceo";

export interface Subscription {
  id: string;
  accountId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  monthlyAmount: number;
  startedAt: string;
  expiresAt: string;
  cancelledAt: string | null;
  orderId: string | null;
  createdAt: string;
}

export interface RabItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface BusinessItem {
  id: string;
  profileId: string;
  businessType: string;
  title: string;
  description: string | null;
  capitalNeeded: number;
  status: BusinessStatus;
  rejectReason: string | null;
  creatorName: string;
  creatorPhoto: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessDetail extends BusinessItem {
  proposal: string | null;
  rabItems: RabItem[];
  rabTotal: number;
}

export interface ListResult<T> {
  items: T[];
  hasMore?: boolean;
  page?: number;
}

export type ListingKind = "barang" | "jasa";
export type ListingStatus = "draft" | "active" | "sold" | "archived";

export interface MarketplaceListing {
  id: string;
  sellerProfileId: string;
  sellerName: string;
  sellerPhoto: string | null;
  sellerCity: string | null;
  kind: ListingKind;
  title: string;
  description: string | null;
  price: number | null;
  category: string;
  photos: string[];
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CoinPackage {
  id: string;
  name: string;
  coinAmount: number;
  price: number;
  bonusCoins: number;
  popular: boolean;
}

export type CoinTransactionType = "purchase" | "spend" | "refund" | "bonus" | "withdraw";

export interface CoinTransaction {
  id: string;
  accountId: string;
  type: CoinTransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  createdAt: string;
}

export interface CoinBalance {
  accountId: string;
  balance: number;
  lifetimePurchased: number;
  lifetimeSpent: number;
}

export interface CoinFeature {
  id: string;
  name: string;
  description: string;
  cost: number;
  duration: string;
}

export interface CryptoSupportedCoin {
  id: string;
  symbol: string;
  name: string;
  network: string;
  contractAddress: string | null;
  decimals: number;
  icon: string;
  color: string;
  coinConversionRate: number;
  minDeposit: number;
  minWithdraw: number;
  withdrawFeePercent: number;
}

export interface CryptoWallet {
  id: string;
  coinSymbol: string;
  network: string;
  walletAddress: string;
  balance: number;
  createdAt: string;
}

export type CryptoTransactionType = "deposit" | "withdraw" | "swap_to_coins" | "swap_from_coins" | "transfer";
export type CryptoTransactionStatus = "pending" | "confirmed" | "failed" | "cancelled";

export interface CryptoTransaction {
  id: string;
  type: CryptoTransactionType;
  coinSymbol: string;
  amountCrypto: number;
  amountCoins: number;
  txHash: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  status: CryptoTransactionStatus;
  description: string;
  createdAt: string;
  confirmedAt: string | null;
}

export interface ShippingProvider {
  id: string;
  name: string;
  enabled: boolean;
  baseRate: number;
}

export type MediaPostType = "photo" | "video";

export interface MediaComment {
  id: string;
  postId: string;
  accountId: string;
  authorName: string;
  authorPhoto: string | null;
  body: string;
  createdAt: string;
}

export interface MediaPost {
  id: string;
  accountId: string;
  authorName: string;
  authorPhoto: string | null;
  authorTier: WidowRole;
  type: MediaPostType;
  mediaUrl: string;
  caption: string | null;
  likes: string[];
  comments: MediaComment[];
  shares: number;
  duration: number | null;
  createdAt: string;
}

export type SubAgentStatus = "active" | "standby" | "disabled";
export type SubAgentRole =
  | "market_scanner"
  | "trading_executor"
  | "risk_manager"
  | "news_analyzer"
  | "portfolio_manager"
  | "backtester"
  | "data_aggregator"
  | "wallet_monitor"
  | "social_sentinel"
  | "copy_trader";

export interface SubAgentConfig {
  id: string;
  name: string;
  icon: string;
  role: SubAgentRole;
  description: string;
  status: SubAgentStatus;
  priority: number;
  intervalSeconds: number;
  enabled: boolean;
  config: Record<string, string | number | boolean>;
}

export type TradingServerStatus = "connected" | "disconnected" | "error" | "demo";

export interface TradingServerConfig {
  id: string;
  name: string;
  provider: string;
  description: string;
  baseUrl: string;
  wsUrl: string;
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
  status: TradingServerStatus;
  enabled: boolean;
  rateLimit: number;
  symbols: string[];
  features: string[];
  lastHeartbeat: string | null;
}

export type PromptCategory =
  | "wallet_monitor"
  | "news_analysis"
  | "news_surveillance"
  | "telegram_forum"
  | "twitter_x"
  | "copy_trading"
  | "market_analysis"
  | "risk_assessment"
  | "sentiment"
  | "execution";

export interface AiPromptTemplate {
  id: string;
  name: string;
  category: PromptCategory;
  description: string;
  prompt: string;
  variables: string[];
  enabled: boolean;
  priority: number;
  subAgentRoles: SubAgentRole[];
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  payment: {
    midtransServerKey: string;
    midtransClientKey: string;
    midtransEnvironment: "sandbox" | "production";
    enabled: boolean;
  };
  shipping: {
    enabled: boolean;
    providers: ShippingProvider[];
  };
  subscription: {
    prices: {
      sosialita: number;
      high_society: number;
      the_ceo: number;
      ceo: number;
      sultan: number;
    };
  };
  academy: {
    enabled: boolean;
    title: string;
    description: string;
    schedule: string;
    location: string;
    modules: { id: string; title: string; duration: string; enabled: boolean }[];
  };
  trading: {
    enabled: boolean;
    title: string;
    description: string;
    schedule: string;
    location: string;
    modules: { id: string; title: string; duration: string; enabled: boolean }[];
  };
  links: {
    enabled: boolean;
    items: { id: string; title: string; url: string; enabled: boolean }[];
  };
  liveTrading: {
    enabled: boolean;
    provider: string;
    tradingViewWidgetId: string;
    tradingViewSymbol: string;
    tradingViewInterval: string;
    tradingViewTheme: string;
    apiKey: string;
    apiBaseUrl: string;
    symbols: { id: string; symbol: string; label: string; enabled: boolean }[];
    refreshInterval: number;
  };
  metaTrader5: {
    enabled: boolean;
    broker: string;
    server: string;
    login: string;
    password: string;
    accountType: "demo" | "real";
    leverage: number;
    balance: number;
    currency: string;
    allowedSymbols: string[];
    riskManagement: {
      maxLotSize: number;
      maxOpenPositions: number;
      stopLossPips: number;
      takeProfitPips: number;
      dailyLossLimit: number;
    };
  };
  aiTradingAgent: {
    enabled: boolean;
    name: string;
    description: string;
    model: string;
    strategy: string;
    riskLevel: string;
    maxDailyTrades: number;
    minConfidence: number;
    autoExecute: boolean;
    notifyOnTrade: boolean;
    parameters: {
      lookbackPeriod: number;
      entryThreshold: number;
      exitThreshold: number;
      positionSizePercent: number;
    };
    allowedMarkets: string[];
    schedule: {
      enabled: boolean;
      startHour: number;
      endHour: number;
      timezone: string;
    };
    subAgents: SubAgentConfig[];
    tradingServers: TradingServerConfig[];
    promptLibrary: AiPromptTemplate[];
  };
  coinSettings: {
    purchaseMethods: { id: string; label: string; enabled: boolean }[];
    withdrawMethods: { id: string; label: string; enabled: boolean }[];
    conversionRate: number;
    fees: {
      adminFeePercent: number;
      withdrawFeePercent: number;
      minWithdrawCoins: number;
    };
  };
  blockchainApi: {
    enabled: boolean;
    apiBaseUrl: string;
    apiKey: string;
    network: string;
    contractAddress: string;
    chainId: string;
    rpcUrl: string;
    webhookSecret: string;
    platformWallet: string;
    gasLimit: number;
    confirmations: number;
  };
  trialAccounts: {
    enabled: boolean;
    accountsPerTier: number;
    password: string;
  };
  cryptoSettings: {
    treasuryWallets: {
      id: string;
      coinSymbol: string;
      network: string;
      address: string;
      label: string;
      balance: number;
      enabled: boolean;
    }[];
    distribution: {
      autoCreditOnDeposit: boolean;
      minConfirmations: number;
      maxDailyWithdrawCrypto: number;
      maxDailySwapCoins: number;
      enableAutoSwap: boolean;
      defaultSwapSlippagePercent: number;
    };
    globalFees: {
      depositFeePercent: number;
      withdrawFeePercent: number;
      swapFeePercent: number;
      minDepositUsd: number;
      minWithdrawUsd: number;
    };
    notifications: {
      notifyOnLargeDeposit: boolean;
      largeDepositThresholdUsd: number;
      notifyOnWithdraw: boolean;
      notifyOnLowTreasury: boolean;
      lowTreasuryThresholdUsd: number;
    };
  };
  apiManagement: {
    apis: {
      id: string;
      name: string;
      description: string;
      apiKey: string;
      apiSecret: string;
      baseUrl: string;
      provider: string;
      category: string;
      enabled: boolean;
      rateLimit: number;
      lastUsed: string | null;
      createdAt: string;
    }[];
    categories: string[];
  };
}
