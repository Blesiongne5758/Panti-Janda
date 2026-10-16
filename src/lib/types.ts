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

export type EventStatus =
  | "draft"
  | "planning"
  | "budgeting"
  | "pending_approval"
  | "published"
  | "ongoing"
  | "completed"
  | "archived"
  | "cancelled";

export type EventCategory =
  | "workshop"
  | "webinar"
  | "meetup"
  | "concert"
  | "charity"
  | "conference"
  | "garage_sale"
  | "lelang"
  | "bazar"
  | "nobar"
  | "other";
export type EventLocationType = "physical" | "virtual" | "hybrid";
export type VirtualPlatform = "zoom" | "google_meet" | "internal";
export type BudgetCategory =
  | "VENUE"
  | "EQUIPMENT"
  | "TALENT"
  | "CATERING"
  | "MARKETING"
  | "TRANSPORTATION"
  | "PERMIT"
  | "PRODUCTION"
  | "DOCUMENTATION"
  | "STAFF"
  | "CONTINGENCY"
  | "OTHER";
export type FundingSourceType = "SELF_FUNDED" | "TICKET_SALES" | "SPONSORSHIP" | "PLATFORM_FUND" | "DONATION";
export type ChecklistStatus = "pending" | "in_progress" | "done";
export type ChecklistPriority = "low" | "medium" | "high";

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
  status: EventStatus;
  createdBy: string;
  createdAt: string;
  goingCount: number;
  myRsvp: string | null;
  invited: boolean;
  isCommittee: boolean;
  creatorName: string | null;
  category: EventCategory;
  tags: string[];
  coverImage: string | null;
  timezone: string | null;
  locationType: EventLocationType;
  venueName: string | null;
  venueAddress: string | null;
  venueMapsUrl: string | null;
  virtualPlatform: VirtualPlatform | null;
  virtualUrl: string | null;
  permitRequired: boolean;
  requiresApproval: boolean;
  liveRoomStatus: string;
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

export interface EventInviteInfo {
  id: string;
  attendedAt: string | null;
}

export interface EventDetail {
  event: EventItem & {
    attendees: string[];
    invited: string[];
    committees: EventCommittee[];
    isCreator: boolean;
    isCommittee: boolean;
    myTicket: EventTicket | null;
    myCommitteeRole: string | null;
    myInvite: EventInviteInfo | null;
    eventGroupId: string | null;
    attendanceCount: number;
    tiers: TicketTierInfo[];
    liveRoom: LiveRoomInfo | null;
  };
}

export interface TicketTierInfo {
  id: string;
  name: string;
  price: number;
  quota: number;
  benefits: string | null;
  saleStart: string | null;
  saleEnd: string | null;
  sold: number;
}

export interface LiveRoomInfo {
  id?: string;
  provider: VirtualPlatform;
  status: "idle" | "live" | "ended";
  startedAt: string | null;
  endedAt: string | null;
  joinPath?: string;
}

export interface EventPlanInfo {
  targetAudience: string | null;
  objectives: string | null;
  requirements: string | null;
  marketingPlan: string | null;
  promotionChannels: string[];
  riskAssessment: string | null;
  updatedAt: string | null;
}

export interface BudgetItemInfo {
  id: string;
  category: BudgetCategory;
  name: string;
  quantity: number;
  unit: string | null;
  estimatedCost: number;
  actualCost: number;
  notes: string | null;
}

export interface FundingSourceInfo {
  id: string;
  type: FundingSourceType;
  name: string;
  amount: number;
  notes: string | null;
}

export interface EventSpeakerInfo {
  id: string;
  sessionId: string | null;
  accountId: string | null;
  name: string;
  topic: string | null;
  bio: string | null;
}

export interface EventSessionInfo {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  room: string | null;
  orderIndex: number;
  speakers: EventSpeakerInfo[];
}

export interface ChecklistItemInfo {
  id: string;
  title: string;
  category: string | null;
  status: ChecklistStatus;
  priority: ChecklistPriority;
  dueAt: string | null;
  assigneeAccountId: string | null;
  assigneeName: string | null;
  orderIndex: number;
  completedAt: string | null;
}

export interface ExpenseInfo {
  id: string;
  budgetItemId: string | null;
  category: BudgetCategory;
  description: string;
  amount: number;
  spentAt: string;
  recordedBy: string;
  recordedByName: string | null;
  status: "approved" | "pending_approval" | "rejected";
  reviewedByName: string | null;
  createdAt: string;
}

export interface EventReportInfo {
  id: string;
  kind: "financial" | "attendance";
  generatedByName?: string | null;
  createdAt: string;
  payload?: unknown;
}

export interface EventApprovalInfo {
  id: string;
  status: "pending" | "approved" | "rejected" | "revision";
  reason: string[];
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  reviewedByName?: string | null;
}

export interface EventAuditLogInfo {
  id: string;
  actorName: string | null;
  action: string;
  detail: string | null;
  createdAt: string;
}

export interface EventManageData {
  event: EventItem & {
    permitRequired: boolean;
    requiresApproval: boolean;
    timezone: string;
    venueName: string | null;
    venueAddress: string | null;
    venueMapsUrl: string | null;
  };
  permissions: {
    canManage: boolean;
    canBudget: boolean;
    canChecklist: boolean;
    isCreator: boolean;
    committeeRole: string | null;
  };
  plan: EventPlanInfo | null;
  budgetItems: BudgetItemInfo[];
  fundingSources: FundingSourceInfo[];
  totals: {
    totalBudget: number;
    totalFunding: number;
    deficit: number;
    totalSpent: number;
    remaining: number;
    budgetUsagePct: number;
    byCategory: { category: BudgetCategory; planned: number; actual: number }[];
  };
  sessions: EventSessionInfo[];
  checklists: ChecklistItemInfo[];
  dueSoon: ChecklistItemInfo[];
  expenses: ExpenseInfo[];
  tiers: TicketTierInfo[];
  reports: EventReportInfo[];
  approval: EventApprovalInfo | null;
  auditLogs: EventAuditLogInfo[];
  liveRoom: LiveRoomInfo | null;
  team: { id?: string; accountId: string; name: string; role: string }[];
  metrics: {
    going: number;
    tickets: number;
    registrations: number;
    paidCount: number;
    attendanceCount: number;
    invites: number;
    attendedInvites: number;
    pendingChecklists: number;
    checklistTotal?: number;
    daysToEvent: number | null;
  };
}

export interface AdminEventApproval {
  id: string;
  eventId: string;
  eventTitle: string;
  category: EventCategory;
  status: "pending" | "approved" | "rejected" | "revision";
  reason: string[];
  decisionNote: string | null;
  requestedByName: string;
  capacity: number | null;
  startsAt: string | null;
  totalBudget: number;
  totalFunding: number;
  createdAt: string;
  decidedAt: string | null;
}

export interface CommitteeCandidate {
  accountId: string;
  name: string;
  nickname: string | null;
  role: string;
  tier: string | null;
  photoData: string | null;
}

export interface InvitationItem {
  id: string;
  accountId: string;
  accountName: string;
  accountPhoto: string | null;
  createdAt: string | null;
  attendedAt: string | null;
}

export interface InvitationsList {
  canScan: boolean;
  myRole: string | null;
  total: number;
  attendedCount: number;
  items: InvitationItem[];
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
  storage: {
    enabled: boolean;
    provider: "aws_s3" | "digitalocean_spaces" | "minio" | "cloudinary";
    s3: {
      region: string;
      endpoint: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBucket: string;
      privateBucket: string;
      cdnUrl: string;
      maxFileSizeMB: number;
      allowedMimeTypes: string[];
    };
    cloudinary: {
      cloudName: string;
      apiKey: string;
      apiSecret: string;
      uploadPreset: string;
      folder: string;
    };
    optimization: {
      enabled: boolean;
      provider: "cloudinary" | "imagekit" | "none";
      autoFormat: boolean;
      autoQuality: boolean;
      thumbnailSizes: number[];
    };
    security: {
      presignedUrlExpirySeconds: number;
      requireOwnershipForPrivate: boolean;
      scanForMalware: boolean;
    };
  };
}

export type EsportFormat = "single_elim" | "double_elim" | "round_robin" | "group_playoff" | "swiss" | "battle_royale" | "league";
export type EsportPlatform = "pc" | "mobile" | "console";
export type EsportCategory = "amateur" | "semi_pro" | "professional";
export type EsportApprovalStatus = "none" | "pending" | "approved" | "rejected";
export type EsportTournamentStatus = "draft" | "registration" | "bracket" | "ongoing" | "completed" | "cancelled";
export type EsportRegistrationStatus = "registered" | "checked_in" | "eliminated" | "winner" | "disqualified" | "withdrawn" | "waitlist";
export type EsportMatchStatus = "scheduled" | "checkin_open" | "live" | "paused" | "disputed" | "finished" | "walkover" | "cancelled";
export type EsportDisputeStatus = "open" | "investigating" | "resolved" | "rejected";
export type EsportSeedingMode = "manual" | "random" | "registration" | "rank";
export type EsportMemberRole = "member" | "substitute" | "coach" | "manager";
export type EsportPaymentStatus = "unpaid" | "paid" | "refunded";
export type EsportPrizeStatus = "pending" | "locked" | "distributing" | "completed";
export type EsportStreamPlatform = "youtube" | "twitch" | "tiktok" | "facebook" | "kick" | "custom";
export type EsportCasterRole = "main_caster" | "co_caster" | "analyst" | "host" | "observer";

export interface EsportGame {
  id: string;
  slug: string;
  name: string;
  mode: string;
  teamSizeMin: number;
  teamSizeMax: number;
  rosterMax: number;
  icon: string | null;
  developer: string | null;
  genre: string | null;
  platforms: string[] | null;
  mapPool: string[] | null;
  bannerData: string | null;
  defaultFormat: EsportFormat | null;
  defaultRosterSize: number | null;
  minPlayers: number;
}

export interface EsportRequirements {
  minLevel: number;
  minAge: number;
  regionLock: string;
  requireVerified: boolean;
  extra: string;
}

export interface EsportSponsorshipSlot {
  name: string;
  amount: number;
  logo: string | null;
  website: string | null;
}

export interface EsportRulesDetail {
  banPick: string;
  gameRules: string;
  latePenalty: string;
  disconnectPolicy: string;
  substitutePolicy: string;
  anticheatPolicy: string;
  disputePolicy: string;
}

export interface EsportStreamingConfig {
  platforms: string[];
  concurrentStreams: number;
  casterSlots: number;
  overlayEnabled: boolean;
  overlayNotes: string;
  observerEnabled: boolean;
  recordingEnabled: boolean;
}

export interface EsportGameRef {
  id: string;
  slug: string;
  name: string;
  mode: string;
  icon: string | null;
}

export interface EsportTournamentSummary {
  id: string;
  title: string;
  format: EsportFormat;
  status: EsportTournamentStatus;
  maxTeams: number;
  teamCount: number;
  entryFee: number;
  prizeTotal: number;
  platform: EsportPlatform;
  category: EsportCategory;
  tags: string | null;
  streamUrl: string | null;
  registrationCloseAt: string | null;
  startAt: string | null;
  createdAt: string;
  creatorName: string;
  game: EsportGameRef | null;
}

export interface EsportPrize {
  id: string;
  placement: number;
  label: string;
  amount: number;
}

export type EsportBudgetCategory =
  | "PRIZE_POOL"
  | "PRODUCTION"
  | "TALENT"
  | "MARKETING"
  | "STAFF"
  | "EQUIPMENT"
  | "VENUE"
  | "PERMIT"
  | "CONTINGENCY"
  | "OTHER";

export interface EsportBudgetItem {
  id: string;
  category: EsportBudgetCategory;
  itemName: string;
  quantity: number;
  estimatedCost: number;
}

export interface EsportBudgetTemplateItem {
  category: EsportBudgetCategory;
  itemName: string;
  quantity: number;
  estimatedCost: number;
}

export interface EsportBudgetTemplate {
  key: "small" | "medium" | "large";
  name: string;
  hint: string;
  items: EsportBudgetTemplateItem[];
}

export interface EsportRosterMember {
  accountId: string;
  name: string;
  nickname: string | null;
  photoData: string | null;
  memberRole: EsportMemberRole;
  gameRole: string | null;
  inGameName: string | null;
  inGameId: string | null;
  gameRank: string | null;
}

export interface EsportRegistration {
  id: string;
  teamId: string;
  teamName: string;
  teamTag: string | null;
  teamLogo: string | null;
  seed: number | null;
  status: EsportRegistrationStatus;
  groupLabel: string | null;
  registeredAt: string | null;
  checkedInAt: string | null;
  paymentStatus: EsportPaymentStatus;
  paidAt: string | null;
  paymentNote: string | null;
  roster: EsportRosterMember[];
}

export interface EsportMatchTeam {
  name: string;
  tag: string | null;
  logo: string | null;
  seed: number | null;
}

export interface EsportMatchGame {
  id: string;
  gameIndex: number;
  map: string | null;
  homeScore: number;
  awayScore: number;
  winnerRegId: string | null;
  durationMinutes: number | null;
  bans: string[];
  picks: string[];
  notes: string | null;
}

export interface EsportBrResult {
  registrationId: string;
  placement: number;
  kills: number;
  placementPoints: number;
  killPoints: number;
  points: number;
}

export interface EsportMatch {
  id: string;
  stage: string;
  round: number;
  groupLabel: string | null;
  matchIndex: number;
  bestOf: number;
  homeRegId: string | null;
  awayRegId: string | null;
  homeTeam: EsportMatchTeam | null;
  awayTeam: EsportMatchTeam | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerRegId: string | null;
  status: EsportMatchStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  streamUrl: string | null;
  casterName: string | null;
  checkinHomeAt: string | null;
  checkinAwayAt: string | null;
  pausedAt: string | null;
  pauseNote: string | null;
  nextMatchId: string | null;
  nextSlot: string | null;
  disputed: boolean;
  games: EsportMatchGame[];
  brResults: EsportBrResult[];
}

export interface EsportDispute {
  id: string;
  matchId: string;
  matchLabel: string | null;
  teamName: string;
  filedByName: string;
  reason: string;
  evidenceUrl: string | null;
  evidenceUrls: string[];
  status: EsportDisputeStatus;
  resolution: string | null;
  createdAt: string;
  investigatedAt: string | null;
  resolvedAt: string | null;
}

export interface EsportCaster {
  id: string;
  name: string;
  slotLabel: string | null;
  casterRole: EsportCasterRole;
  contact: string | null;
  assignedMatchId: string | null;
}

export interface EsportStream {
  id: string;
  name: string;
  platform: EsportStreamPlatform;
  url: string | null;
  currentMatchId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface EsportMyRegistration {
  registrationId: string;
  teamId: string;
  teamName: string;
  isCaptain: boolean;
  status: EsportRegistrationStatus;
  paymentStatus: EsportPaymentStatus;
}

export interface EsportTournamentDetail {
  tournament: {
    id: string;
    title: string;
    description: string | null;
    format: EsportFormat;
    status: EsportTournamentStatus;
    maxTeams: number;
    rosterMin: number;
    rosterMax: number;
    bestOf: number;
    entryFee: number;
    prizeTotal: number;
    rules: string | null;
    streamUrl: string | null;
    registrationCloseAt: string | null;
    startAt: string | null;
    checkinWindowMinutes: number;
    platform: EsportPlatform;
    bannerData: string | null;
    tags: string | null;
    category: EsportCategory;
    registrationOpenAt: string | null;
    technicalMeetingAt: string | null;
    qualifierStartAt: string | null;
    mainEventStartAt: string | null;
    grandFinalAt: string | null;
    timezone: string;
    substituteMax: number;
    requirements: EsportRequirements | null;
    fundingSource: string | null;
    operationalBudget: number;
    sponsorshipSlots: EsportSponsorshipSlot[] | null;
    rulesDetail: EsportRulesDetail | null;
    streamingConfig: EsportStreamingConfig | null;
    approvalStatus: EsportApprovalStatus;
    approvalNote: string | null;
    approvalThreshold: number;
    gameMode: string | null;
    minPlayers: number;
    currency: string;
    prizeStatus: EsportPrizeStatus;
    prizePaidAt: string | null;
    prizePayoutNote: string | null;
    createdAt: string;
    creatorId: string;
    creatorName: string;
    canManage: boolean;
  };
  game:
    | (EsportGameRef & {
        teamSizeMin: number;
        teamSizeMax: number;
        rosterMax: number;
        developer: string | null;
        genre: string | null;
        platforms: string[] | null;
        mapPool: string[] | null;
        bannerData: string | null;
        defaultFormat: EsportFormat | null;
        defaultRosterSize: number | null;
        minPlayers: number;
      })
    | null;
  prizes: EsportPrize[];
  budgetItems: EsportBudgetItem[];
  registrations: EsportRegistration[];
  matches: EsportMatch[];
  casters: EsportCaster[];
  streams: EsportStream[];
  disputes: EsportDispute[];
  myRegistrations: EsportMyRegistration[];
  permissions: { registrationOpen: boolean };
}

export interface EsportTeamRegistrationRef {
  registrationId: string;
  tournamentId: string;
  tournamentTitle: string;
  tournamentStatus: EsportTournamentStatus | null;
  format: EsportFormat | null;
  gameName: string | null;
  gameIcon: string | null;
  status: EsportRegistrationStatus;
  paymentStatus: EsportPaymentStatus;
  roster: string[];
}

export interface EsportTeam {
  id: string;
  name: string;
  tag: string | null;
  logo: string | null;
  captainId: string;
  isCaptain: boolean;
  myMemberRole: EsportMemberRole | "captain";
  myGameRole: string | null;
  createdAt: string;
  members: EsportRosterMember[];
  registrations: EsportTeamRegistrationRef[];
}

export interface EsportTeamDetail {
  id: string;
  name: string;
  tag: string | null;
  logo: string | null;
  captainId: string;
  createdAt: string;
  members: EsportRosterMember[];
}

export interface EsportMemberCandidate {
  accountId: string;
  name: string;
  nickname: string | null;
  role: string;
  tier: string | null;
  photoData: string | null;
}

export interface EsportLeaderboardRow {
  regId: string;
  teamName: string;
  teamTag: string | null;
  teamLogo: string | null;
  status: EsportRegistrationStatus;
  played: number;
  wins: number;
  losses: number;
  scoreFor?: number;
  scoreAgainst?: number;
  winRate?: number;
  points?: number;
  kills?: number;
  bestPlacement?: number | null;
}

export interface EsportTopPlayer {
  accountId: string;
  name: string;
  photoData: string | null;
  matchesPlayed: number;
}

export interface EsportLeaderboard {
  rows: EsportLeaderboardRow[];
  championRegId: string | null;
  topPlayers: EsportTopPlayer[];
}

export type CalendarKind = "event" | "esport" | "tugas" | "konseling" | "langganan" | "pribadi";

export type CalendarRole = "penyelenggara" | "panitia" | "peserta" | "undangan";

export interface CalendarItem {
  id: string;
  kind: CalendarKind;
  title: string;
  note: string | null;
  noteKey: string | null;
  role: CalendarRole | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay?: boolean;
  link: string | null;
}

export interface CalendarAgenda {
  month: string;
  today: string;
  items: CalendarItem[];
  reminders: CalendarItem[];
  counts: Partial<Record<CalendarKind, number>>;
}

export type EsportTransferListingType = "sale" | "loan" | "loan_to_buy" | "free_agent";

export type EsportPlayerStatus = "free_agent" | "contracted" | "on_loan" | "retired";

export type EsportListingStatus = "open" | "paused" | "closed" | "completed";

export type EsportOfferStatus = "pending" | "countered" | "accepted" | "rejected" | "withdrawn" | "expired";

export type EsportTransferStatus = "pending_payment" | "escrow_held" | "completed" | "cancelled";

export type EsportContractType = "permanent" | "free_agent" | "loan";

export type EsportContractStatus = "active" | "terminated" | "expired";

export type EsportWindowStatus = "upcoming" | "open" | "closed";

export interface EsportTeamRef {
  id: string;
  name: string;
  tag: string | null;
  logo: string | null;
}

export interface EsportPlayerAgent {
  name: string;
  contact: string | null;
  commissionPercent: number;
  active: boolean;
  // Fase A: Extended fields
  agencyName?: string | null;
  bio?: string | null;
  logo?: string | null;
  isVerified?: boolean;
  verifiedAt?: string | null;
  commissionRate?: number;
  totalTransfers?: number;
  totalValue?: number;
}

export interface EsportPlayerContractRef {
  id: string;
  type: EsportContractType;
  endDate: string | null;
  optionPrice: number | null;
}

export interface EsportPlayerListingRef {
  id: string;
  listingType: EsportTransferListingType;
  status: EsportListingStatus;
  askingPrice: number;
  loanDays?: number | null;
  optionPrice?: number | null;
}

export interface EsportPlayerCard {
  id: string;
  accountId: string;
  ign: string;
  mainRole: string | null;
  region: string | null;
  rankTier: string | null;
  rankPoints: number | null;
  bio: string | null;
  stats: Record<string, string | number> | null;
  status: EsportPlayerStatus;
  game: { id: string; name: string; icon: string | null } | null;
  team: EsportTeamRef | null;
  contract: EsportPlayerContractRef | null;
  agent: EsportPlayerAgent | null;
  owner: boolean;
  name: string;
  nickname: string | null;
  photoData: string | null;
  updatedAt: string;
  listing?: EsportPlayerListingRef | null;
  // Fase A: Extended fields
  realName?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  inGameId?: string | null;
  gameRank?: string | null;
  role?: string | null;
  secondaryRole?: string | null;
  marketValue?: number;
  buyoutClause?: number | null;
  salaryExpectation?: number | null;
  avatar?: string | null;
  banner?: string | null;
  highlightVideo?: string | null;
  achievements?: string[];
  isVerified?: boolean;
  verifiedAt?: string | null;
}

export interface EsportTransferListing {
  id: string;
  player: EsportPlayerCard | null;
  team: EsportTeamRef | null;
  createdBy: string;
  listingType: EsportTransferListingType;
  askingPrice: number;
  loanDays: number | null;
  optionPrice: number | null;
  description: string | null;
  status: EsportListingStatus;
  windowOpen: boolean;
  windowName: string | null;
  createdAt: string;
  updatedAt: string;
  // Fase A: Extended fields
  listedBy?: string | null;
  negotiable?: boolean;
  salaryRequirement?: number | null;
  contractDuration?: number | null;
  loanOptionToBuy?: boolean;
  title?: string | null;
  tags?: string[];
  isPublic?: boolean;
  viewCount?: number;
  offerCount?: number;
  expiresAt?: string | null;
}

export interface EsportTransferOffer {
  id: string;
  listingId: string;
  fromTeam: EsportTeamRef | null;
  createdBy: string;
  offerType: EsportTransferListingType;
  fee: number;
  loanDays: number | null;
  optionPrice: number | null;
  message: string | null;
  status: EsportOfferStatus;
  counterOf: string | null;
  expiresAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  // Fase A: Extended fields
  monthlySalary?: number | null;
  contractDuration?: number | null;
  sellOnPercentage?: number | null;
  addons?: Record<string, unknown>;
  responseNote?: string | null;
}

export interface EsportMyOffer extends EsportTransferOffer {
  kind: "incoming" | "outgoing";
  listing: {
    id: string;
    listingType: EsportTransferListingType;
    askingPrice: number;
    loanDays: number | null;
    optionPrice: number | null;
    status: EsportListingStatus;
    teamId: string | null;
  };
  player: { id: string; ign: string; mainRole: string | null; rankTier: string | null } | null;
}

export interface EsportTransferPlayerRef {
  id: string;
  accountId: string;
  ign: string;
  mainRole: string | null;
  rankTier: string | null;
  name: string;
  photoData: string | null;
}

export interface EsportTransfer {
  id: string;
  player: EsportTransferPlayerRef | null;
  fromTeam: EsportTeamRef | null;
  toTeam: EsportTeamRef | null;
  transferType: EsportTransferListingType;
  fee: number;
  loanDays: number | null;
  optionPrice: number | null;
  status: EsportTransferStatus;
  escrowCoins: number;
  paidAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  contractId: string | null;
  contractEnd: string | null;
  active: boolean;
  isBuyer: boolean;
  isSeller: boolean;
  canPay: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  createdAt: string;
  // Fase A: Extended fields
  monthlySalary?: number | null;
  contractDuration?: number | null;
  sellOnPercentage?: number | null;
  paymentStatus?: string | null;
  escrowStatus?: string | null;
  agreedAt?: string | null;
  paymentDeadline?: string | null;
  announcedAt?: string | null;
  announcementPost?: string | null;
}

export interface EsportMyContract {
  id: string;
  player: { id: string; ign: string; mainRole: string | null; photoData: string | null; accountId: string } | null;
  team: EsportTeamRef | null;
  contractType: EsportContractType;
  startDate: string;
  endDate: string | null;
  status: EsportContractStatus;
  optionPrice: number | null;
  optionTeamId: string | null;
  canExerciseOption: boolean;
  createdAt: string;
  // Fase A: Extended fields
  monthlySalary?: number | null;
  currency?: string | null;
  buyoutClause?: number | null;
  sellOnPercentage?: number | null;
  benefits?: Record<string, unknown>;
  isLoan?: boolean;
  loanFromTeamId?: string | null;
  loanEndDate?: string | null;
  loanOptionToBuy?: boolean;
  playerSignedAt?: string | null;
  teamSignedAt?: string | null;
  contractDocUrl?: string | null;
}

export interface EsportTransferWindow {
  id: string;
  gameId: string;
  gameName: string;
  gameIcon: string | null;
  name: string;
  opensAt: string;
  closesAt: string;
  // Fase A: Extended fields
  maxTransfersPerTeam?: number | null;
  allowLoan?: boolean;
  allowTrade?: boolean;
}

export interface EsportMyWindow extends EsportTransferWindow {
  openNow: boolean;
}

export interface EsportManagedWindow extends EsportTransferWindow {
  status: EsportWindowStatus;
}

export interface EsportTransferMy {
  profiles: EsportPlayerCard[];
  teams: string[];
  listings: EsportTransferListing[];
  incomingOffers: EsportMyOffer[];
  outgoingOffers: EsportMyOffer[];
  transfers: EsportTransfer[];
  contracts: EsportMyContract[];
  windows: EsportMyWindow[];
  koinBalance: number;
}

export interface EsportTransferAnnouncement {
  id: string;
  player: EsportTransferPlayerRef | null;
  fromTeam: EsportTeamRef | null;
  toTeam: EsportTeamRef | null;
  transferType: EsportTransferListingType;
  fee: number;
  loanDays: number | null;
  contractEnd: string | null;
  completedAt: string | null;
}

export interface EsportPlayerDetailContract {
  id: string;
  team: EsportTeamRef | null;
  contractType: EsportContractType;
  startDate: string;
  endDate: string | null;
  status: EsportContractStatus;
  optionPrice: number | null;
}

export interface EsportPlayerHistoryEntry {
  id: string;
  fromTeam: EsportTeamRef | null;
  toTeam: EsportTeamRef | null;
  transferType: EsportTransferListingType;
  fee: number;
  completedAt: string | null;
}

export interface EsportPlayerDetail {
  player: EsportPlayerCard;
  listings: EsportTransferListing[];
  contracts: EsportPlayerDetailContract[];
  history: EsportPlayerHistoryEntry[];
}

export interface EsportStatsTeamRow {
  teamId: string;
  name: string;
  tag: string | null;
  logo: string | null;
  captainId: string | null;
  tournaments: number;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  points: number;
  championships: number;
}

export interface EsportStatsPlayerRow {
  accountId: string;
  profileId: string | null;
  name: string;
  nickname: string | null;
  photoData: string | null;
  ign: string | null;
  game: { id: string; name: string; icon: string | null } | null;
  status: EsportPlayerStatus | null;
  team: EsportTeamRef | null;
  tournaments: number;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  championships: number;
  points: number;
  value: number;
}

export interface EsportStatsTransferEntry {
  id: string;
  player: {
    profileId: string;
    accountId: string;
    ign: string;
    name: string;
    photoData: string | null;
    game: { id: string; name: string; icon: string | null } | null;
  } | null;
  fromTeam: EsportTeamRef | null;
  toTeam: EsportTeamRef | null;
  transferType: EsportTransferListingType;
  fee: number;
  loanDays: number | null;
  completedAt: string | null;
}

export interface EsportStatsSpender {
  team: EsportTeamRef | null;
  spent: number;
  transfers: number;
}

export interface EsportStatsValuable {
  accountId: string;
  profileId: string | null;
  ign: string | null;
  name: string;
  photoData: string | null;
  game: { id: string; name: string; icon: string | null } | null;
  status: EsportPlayerStatus | null;
  team: EsportTeamRef | null;
  value: number;
}

export interface EsportStatsMarket {
  summary: {
    completedTransfers: number;
    volumeCoins: number;
    openListings: number;
    pendingOffers: number;
    freeAgents: number;
    activeLoans: number;
  };
  topTransfers: EsportStatsTransferEntry[];
  topSpenders: EsportStatsSpender[];
  topValuables: EsportStatsValuable[];
}

export interface EsportStatsGame {
  gameId: string;
  name: string;
  icon: string | null;
  tournaments: number;
  activeTournaments: number;
  teams: number;
  matches: number;
  players: number;
  listings: number;
}

export type EsportStatsPeriod = "all" | "today" | "week";

export interface EsportStatsBoard {
  period: EsportStatsPeriod;
  since: string | null;
  teams: EsportStatsTeamRow[];
  players: EsportStatsPlayerRow[];
  market: EsportStatsMarket;
  games: EsportStatsGame[];
}

// ========== Fase A: Enhanced Transfer Market Types ==========

export interface EsportPlayerStats {
  id: string;
  playerProfileId: string;
  totalMatches: number;
  winRate: number;
  kdaRatio: number;
  gameSpecific: Record<string, number>;
  tournamentsPlayed: number;
  tournamentsWon: number;
  mvpAwards: number;
  teamWinRate: number;
  dataSource: string;
  createdAt: string;
  updatedAt: string;
}

export interface EsportPlayerReview {
  id: string;
  playerProfileId: string;
  reviewerId: string;
  reviewerTeamId: string | null;
  ratingSkill: number;
  ratingTeamwork: number;
  ratingDiscipline: number;
  ratingCommunication: number;
  comment: string | null;
  createdAt: string;
  reviewer?: {
    id: string;
    name: string;
    photoData: string | null;
  } | null;
  reviewerTeam?: EsportTeamRef | null;
}

export interface EsportPlayerReviewSummary {
  playerProfileId: string;
  reviewCount: number;
  avgSkill: number;
  avgTeamwork: number;
  avgDiscipline: number;
  avgCommunication: number;
  avgOverall: number;
}

export type EsportTransferDisputeStatus = "open" | "under_review" | "resolved" | "dismissed";

export interface EsportTransferDispute {
  id: string;
  transferId: string;
  raisedBy: string;
  reason: string;
  description: string | null;
  evidence: string[];
  status: EsportTransferDisputeStatus;
  resolvedBy: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  raisedByUser?: {
    id: string;
    name: string;
    photoData: string | null;
  } | null;
}

export interface EsportRosterHistory {
  id: string;
  teamId: string;
  playerProfileId: string;
  joinedAt: string;
  leftAt: string | null;
  leaveReason: string | null;
  transferId: string | null;
  createdAt: string;
  team?: EsportTeamRef | null;
  player?: {
    id: string;
    ign: string;
    mainRole: string | null;
    photoData: string | null;
  } | null;
}
