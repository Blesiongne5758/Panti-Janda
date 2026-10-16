import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bitcoin,
  BookOpen,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  Coins,
  CreditCard,
  Crown,
  ExternalLink,
  Flag,
  Gem,
  Globe,
  Key,
  Loader2,
  Pencil,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { formatDateTime, formatRupiah, timeAgo } from "@/lib/format";
import { APPROVAL_REASON_LABEL, ROLE_LABEL, TIER_META, PUBLIC_TIER_META, WIDOW_ROLES } from "@/lib/constants";
import { DOC_TYPE_OPTIONS } from "@/lib/verify-doc";
import type {
  AdminAccount,
  AdminEventApproval,
  AdminStats,
  AppSettings,
  DonationItem,
  Profile,
  ReportItem,
  WidowRole,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AccountGate, Chip, ErrorNote, LoadingGrid, MemberAvatar, Stat, StatusPill } from "@/components/common";
import { toast } from "sonner";

interface AdminEventTicketStats {
  total: number;
  valid: number;
  used: number;
  pending: number;
  cancelled: number;
  revenue: number;
}

const APPROVAL_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Disetujui", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Ditolak", className: "bg-rose-100 text-rose-800" },
  revision: { label: "Perlu revisi", className: "bg-sky-100 text-sky-800" },
};

interface ApprovalDecision {
  approval: AdminEventApproval;
  decision: "reject" | "revision";
}

interface AdminEventRow {
  id: string;
  title: string;
  audience: string;
  status: string;
  startsAt: string;
  createdAt: string;
  capacity: number | null;
  ticketPrice: number | null;
  createdBy: string;
  creatorName: string | null;
  tickets: AdminEventTicketStats;
  attendanceCount: number;
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1"
      />
    </div>
  );
}

function RejectDialog({
  profile,
  open,
  onOpenChange,
  onDone,
}: {
  profile: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  const submit = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      await api("admin.profiles.review", { id: profile.id, approve: false, reason: reason.trim() || undefined });
      toast.success("Profil ditandai perlu perbaikan.");
      onOpenChange(false);
      setReason("");
      onDone();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Tolak sementara profil</DialogTitle>
          <DialogDescription>
            Berikan alasan yang jelas agar {profile?.nickname ?? "anggota"} dapat memperbaiki datanya dan mengajukan
            ulang.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Alasan</Label>
          <Textarea
            id="reason"
            rows={3}
            maxLength={400}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Contoh: data tanggungan tidak sesuai, mohon lengkapi."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Kirim penolakan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalDecisionDialog({
  target,
  onOpenChange,
  onDone,
}: {
  target: ApprovalDecision | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const close = (open: boolean) => {
    if (!open) setNote("");
    onOpenChange(open);
  };

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api("admin.events.decide", {
        approvalId: target.approval.id,
        decision: target.decision,
        note: note.trim() || undefined,
      });
      toast.success(
        target.decision === "reject"
          ? "Event ditolak dan dikembalikan ke draf."
          : "Permintaan revisi terkirim ke pembuat event.",
      );
      close(false);
      onDone();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {target?.decision === "reject" ? "Tolak event" : "Minta revisi event"}
          </DialogTitle>
          <DialogDescription>
            {target?.decision === "reject"
              ? `Event "${target?.approval.eventTitle}" akan dikembalikan ke draf dan pembuat menerima notifikasi.`
              : `Event "${target?.approval.eventTitle}" dikembalikan ke draf agar pembuat melengkapi sesuai catatan Anda.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="approval-note">Catatan (opsional)</Label>
          <Textarea
            id="approval-note"
            rows={3}
            maxLength={400}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Contoh: lampirkan rincian anggaran konsumsi dan konfirmasi pelatih."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={busy}>
            Batal
          </Button>
          <Button variant={target?.decision === "reject" ? "destructive" : "default"} onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {target?.decision === "reject" ? "Kirim penolakan" : "Kirim permintaan revisi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPage() {
  const { ready, account } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [pending, setPending] = useState<Profile[] | null>(null);
  const [reports, setReports] = useState<ReportItem[] | null>(null);
  const [donations, setDonations] = useState<DonationItem[] | null>(null);
  const [eventsAdmin, setEventsAdmin] = useState<AdminEventRow[] | null>(null);
  const [approvals, setApprovals] = useState<AdminEventApproval[] | null>(null);
  const [approvalBusy, setApprovalBusy] = useState<string | null>(null);
  const [approvalDecision, setApprovalDecision] = useState<ApprovalDecision | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Profile | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [paymentForm, setPaymentForm] = useState<{ serverKey: string; clientKey: string; environment: "sandbox" | "production"; enabled: boolean }>({ serverKey: "", clientKey: "", environment: "sandbox", enabled: true });
  const [shippingForm, setShippingForm] = useState<{ enabled: boolean; providers: { id: string; name: string; enabled: boolean; baseRate: number }[] }>({ enabled: false, providers: [] });
  const [subscriptionForm, setSubscriptionForm] = useState<{ sosialita: number; high_society: number; the_ceo: number; ceo: number; sultan: number }>({ sosialita: 100000, high_society: 500000, the_ceo: 1000000, ceo: 1000000, sultan: 2000000 });
  const [academyForm, setAcademyForm] = useState<{ enabled: boolean; title: string; description: string; schedule: string; location: string; modules: { id: string; title: string; duration: string; enabled: boolean }[] }>({ enabled: true, title: "", description: "", schedule: "", location: "", modules: [] });
  const [tradingForm, setTradingForm] = useState<{ enabled: boolean; title: string; description: string; schedule: string; location: string; modules: { id: string; title: string; duration: string; enabled: boolean }[] }>({ enabled: true, title: "", description: "", schedule: "", location: "", modules: [] });
  const [linksForm, setLinksForm] = useState<{ enabled: boolean; items: { id: string; title: string; url: string; enabled: boolean }[] }>({ enabled: true, items: [] });
  const [liveTradingForm, setLiveTradingForm] = useState<{
    enabled: boolean; provider: string; tradingViewWidgetId: string; tradingViewSymbol: string;
    tradingViewInterval: string; tradingViewTheme: string; apiKey: string; apiBaseUrl: string;
    symbols: { id: string; symbol: string; label: string; enabled: boolean }[]; refreshInterval: number;
  }>({ enabled: false, provider: "tradingview", tradingViewWidgetId: "", tradingViewSymbol: "IDX:IHSG", tradingViewInterval: "15", tradingViewTheme: "light", apiKey: "", apiBaseUrl: "", symbols: [], refreshInterval: 30 });
  const [metaTrader5Form, setMetaTrader5Form] = useState<{
    enabled: boolean; broker: string; server: string; login: string; password: string;
    accountType: "demo" | "real"; leverage: number; balance: number; currency: string;
    allowedSymbols: string[]; riskManagement: { maxLotSize: number; maxOpenPositions: number; stopLossPips: number; takeProfitPips: number; dailyLossLimit: number };
  }>({ enabled: false, broker: "", server: "", login: "", password: "", accountType: "demo", leverage: 100, balance: 10000000, currency: "USD", allowedSymbols: [], riskManagement: { maxLotSize: 1, maxOpenPositions: 10, stopLossPips: 50, takeProfitPips: 100, dailyLossLimit: 500 } });
  const [aiTradingAgentForm, setAiTradingAgentForm] = useState<{
    enabled: boolean; name: string; description: string; model: string; strategy: string;
    riskLevel: string; maxDailyTrades: number; minConfidence: number; autoExecute: boolean; notifyOnTrade: boolean;
    parameters: { lookbackPeriod: number; entryThreshold: number; exitThreshold: number; positionSizePercent: number };
    allowedMarkets: string[]; schedule: { enabled: boolean; startHour: number; endHour: number; timezone: string };
  }>({ enabled: false, name: "", description: "", model: "gpt-4", strategy: "momentum", riskLevel: "medium", maxDailyTrades: 20, minConfidence: 0.7, autoExecute: false, notifyOnTrade: true, parameters: { lookbackPeriod: 14, entryThreshold: 0.65, exitThreshold: 0.45, positionSizePercent: 5 }, allowedMarkets: [], schedule: { enabled: true, startHour: 8, endHour: 22, timezone: "Asia/Jakarta" } });
  const [coinSettingsForm, setCoinSettingsForm] = useState<{
    purchaseMethods: { id: string; label: string; enabled: boolean }[];
    withdrawMethods: { id: string; label: string; enabled: boolean }[];
    conversionRate: number;
    fees: { adminFeePercent: number; withdrawFeePercent: number; minWithdrawCoins: number };
  }>({
    purchaseMethods: [
      { id: "transfer_bank", label: "Transfer Bank", enabled: true },
      { id: "qris", label: "Scan QRIS", enabled: true },
      { id: "payment_gateway", label: "Payment Gateway", enabled: true },
    ],
    withdrawMethods: [
      { id: "qris", label: "QRIS", enabled: true },
      { id: "transfer_bank", label: "Transfer Bank", enabled: true },
      { id: "dana", label: "DANA", enabled: true },
      { id: "gopay", label: "GoPay", enabled: true },
      { id: "ovo", label: "OVO", enabled: true },
    ],
    conversionRate: 100,
    fees: { adminFeePercent: 2, withdrawFeePercent: 1.5, minWithdrawCoins: 1000 },
  });
  const [blockchainApiForm, setBlockchainApiForm] = useState<{
    enabled: boolean; apiBaseUrl: string; apiKey: string; network: string;
    contractAddress: string; chainId: string; rpcUrl: string; webhookSecret: string;
    platformWallet: string; gasLimit: number; confirmations: number;
  }>({
    enabled: false, apiBaseUrl: "", apiKey: "", network: "testnet",
    contractAddress: "", chainId: "", rpcUrl: "", webhookSecret: "",
    platformWallet: "", gasLimit: 21000, confirmations: 12,
  });
  const [paymentDirty, setPaymentDirty] = useState(false);
  const [shippingDirty, setShippingDirty] = useState(false);
  const [subscriptionDirty, setSubscriptionDirty] = useState(false);
  const [academyDirty, setAcademyDirty] = useState(false);
  const [tradingDirty, setTradingDirty] = useState(false);
  const [linksDirty, setLinksDirty] = useState(false);
  const [liveTradingDirty, setLiveTradingDirty] = useState(false);
  const [metaTrader5Dirty, setMetaTrader5Dirty] = useState(false);
  const [aiTradingAgentDirty, setAiTradingAgentDirty] = useState(false);
  const [coinSettingsDirty, setCoinSettingsDirty] = useState(false);
  const [blockchainApiDirty, setBlockchainApiDirty] = useState(false);
  const [trialForm, setTrialForm] = useState<{ accountsPerTier: number; password: string }>({ accountsPerTier: 2, password: "trial12345" });
  const [trialDirty, setTrialDirty] = useState(false);
  const [trialStatus, setTrialStatus] = useState<{ total: number; byTier: Record<string, { id: string; email: string; display_name: string }[]> } | null>(null);
  const [trialBusy, setTrialBusy] = useState(false);
  const [cryptoSettingsForm, setCryptoSettingsForm] = useState<AppSettings["cryptoSettings"]>({
    treasuryWallets: [],
    distribution: { autoCreditOnDeposit: true, minConfirmations: 3, maxDailyWithdrawCrypto: 10000, maxDailySwapCoins: 1000000, enableAutoSwap: false, defaultSwapSlippagePercent: 0.5 },
    globalFees: { depositFeePercent: 0, withdrawFeePercent: 1.5, swapFeePercent: 0.5, minDepositUsd: 1, minWithdrawUsd: 5 },
    notifications: { notifyOnLargeDeposit: true, largeDepositThresholdUsd: 1000, notifyOnWithdraw: true, notifyOnLowTreasury: true, lowTreasuryThresholdUsd: 500 },
  });
  const [cryptoSettingsDirty, setCryptoSettingsDirty] = useState(false);
  const [newTreasuryWallet, setNewTreasuryWallet] = useState({ coinSymbol: "", network: "", address: "", label: "" });

  const [apiManagementForm, setApiManagementForm] = useState<AppSettings["apiManagement"]>({
    apis: [],
    categories: [],
  });
  const [apiManagementDirty, setApiManagementDirty] = useState(false);
  const [editingApiId, setEditingApiId] = useState<string | null>(null);
  const [newApiForm, setNewApiForm] = useState({
    name: "",
    description: "",
    apiKey: "",
    apiSecret: "",
    baseUrl: "",
    provider: "",
    category: "",
    rateLimit: 60,
  });
  const [showAddApi, setShowAddApi] = useState(false);

  const isAdmin = account?.role === "admin";

  const load = useCallback(async () => {
    setError(null);
    try {
      const [statsData, accountsData, pendingData, reportsData, donationsData, settingsData] = await Promise.all([
        api<AdminStats>("admin.stats"),
        api<{ items: AdminAccount[] }>("admin.accounts.list"),
        api<{ items: Profile[] }>("admin.profiles.pending"),
        api<{ items: ReportItem[] }>("admin.reports.list"),
        api<{ items: DonationItem[] }>("donations.list"),
        api<{ settings: AppSettings }>("admin.settings.get"),
      ]);
      setStats(statsData);
      setAccounts(accountsData.items);
      setPending(pendingData.items);
      setReports(reportsData.items);
      setDonations(donationsData.items);
      setSettings(settingsData.settings);
      try {
        const eventsData = await api<{ items: AdminEventRow[] }>("admin.events.list");
        setEventsAdmin(eventsData.items);
      } catch { /* abaikan bila backend lama belum menyediakan */ }
      try {
        const approvalsData = await api<{ items: AdminEventApproval[] }>("admin.events.approvals");
        setApprovals(approvalsData.items);
      } catch { /* abaikan bila backend lama belum menyediakan */ }
      setPaymentForm({
        serverKey: settingsData.settings.payment.midtransServerKey,
        clientKey: settingsData.settings.payment.midtransClientKey,
        environment: settingsData.settings.payment.midtransEnvironment,
        enabled: settingsData.settings.payment.enabled,
      });
      setShippingForm({
        enabled: settingsData.settings.shipping.enabled,
        providers: settingsData.settings.shipping.providers.map((p) => ({ ...p })),
      });
      setSubscriptionForm({
        sosialita: settingsData.settings.subscription.prices.sosialita,
        high_society: settingsData.settings.subscription.prices.high_society,
        the_ceo: settingsData.settings.subscription.prices.the_ceo,
        ceo: settingsData.settings.subscription.prices.ceo ?? 1000000,
        sultan: settingsData.settings.subscription.prices.sultan ?? 2000000,
      });
      setAcademyForm({
        enabled: settingsData.settings.academy.enabled,
        title: settingsData.settings.academy.title,
        description: settingsData.settings.academy.description,
        schedule: settingsData.settings.academy.schedule,
        location: settingsData.settings.academy.location,
        modules: settingsData.settings.academy.modules.map((m) => ({ ...m })),
      });
      setTradingForm({
        enabled: settingsData.settings.trading.enabled,
        title: settingsData.settings.trading.title,
        description: settingsData.settings.trading.description,
        schedule: settingsData.settings.trading.schedule,
        location: settingsData.settings.trading.location,
        modules: settingsData.settings.trading.modules.map((m) => ({ ...m })),
      });
      setLinksForm({
        enabled: settingsData.settings.links.enabled,
        items: settingsData.settings.links.items.map((item) => ({ ...item })),
      });
      const lt = settingsData.settings.liveTrading;
      setLiveTradingForm({
        enabled: lt.enabled, provider: lt.provider, tradingViewWidgetId: lt.tradingViewWidgetId,
        tradingViewSymbol: lt.tradingViewSymbol, tradingViewInterval: lt.tradingViewInterval,
        tradingViewTheme: lt.tradingViewTheme, apiKey: lt.apiKey, apiBaseUrl: lt.apiBaseUrl,
        symbols: lt.symbols.map((s) => ({ ...s })), refreshInterval: lt.refreshInterval,
      });
      const mt = settingsData.settings.metaTrader5;
      setMetaTrader5Form({
        enabled: mt.enabled, broker: mt.broker, server: mt.server, login: mt.login,
        password: mt.password, accountType: mt.accountType, leverage: mt.leverage,
        balance: mt.balance, currency: mt.currency, allowedSymbols: [...mt.allowedSymbols],
        riskManagement: { ...mt.riskManagement },
      });
      const ai = settingsData.settings.aiTradingAgent;
      setAiTradingAgentForm({
        enabled: ai.enabled, name: ai.name, description: ai.description, model: ai.model,
        strategy: ai.strategy, riskLevel: ai.riskLevel, maxDailyTrades: ai.maxDailyTrades,
        minConfidence: ai.minConfidence, autoExecute: ai.autoExecute, notifyOnTrade: ai.notifyOnTrade,
        parameters: { ...ai.parameters }, allowedMarkets: [...ai.allowedMarkets],
        schedule: { ...ai.schedule },
      });
      const cs = settingsData.settings.coinSettings;
      setCoinSettingsForm({
        purchaseMethods: cs.purchaseMethods.map((m) => ({ ...m })),
        withdrawMethods: cs.withdrawMethods.map((m) => ({ ...m })),
        conversionRate: cs.conversionRate,
        fees: { ...cs.fees },
      });
      setPaymentDirty(false);
      setShippingDirty(false);
      setSubscriptionDirty(false);
      setAcademyDirty(false);
      setTradingDirty(false);
      setLinksDirty(false);
      setLiveTradingDirty(false);
      setMetaTrader5Dirty(false);
      setAiTradingAgentDirty(false);
      setCoinSettingsDirty(false);
      const ba = settingsData.settings.blockchainApi;
      setBlockchainApiForm({
        enabled: ba.enabled, apiBaseUrl: ba.apiBaseUrl, apiKey: ba.apiKey, network: ba.network,
        contractAddress: ba.contractAddress, chainId: ba.chainId, rpcUrl: ba.rpcUrl, webhookSecret: ba.webhookSecret,
        platformWallet: ba.platformWallet, gasLimit: ba.gasLimit, confirmations: ba.confirmations,
      });
      setBlockchainApiDirty(false);
      const ta = settingsData.settings.trialAccounts;
      setTrialForm({ accountsPerTier: ta.accountsPerTier, password: ta.password });
      setTrialDirty(false);
      const crypto = settingsData.settings.cryptoSettings;
      if (crypto) {
        setCryptoSettingsForm({
          treasuryWallets: crypto.treasuryWallets ?? [],
          distribution: crypto.distribution ?? { autoCreditOnDeposit: true, minConfirmations: 3, maxDailyWithdrawCrypto: 10000, maxDailySwapCoins: 1000000, enableAutoSwap: false, defaultSwapSlippagePercent: 0.5 },
          globalFees: crypto.globalFees ?? { depositFeePercent: 0, withdrawFeePercent: 1.5, swapFeePercent: 0.5, minDepositUsd: 1, minWithdrawUsd: 5 },
          notifications: crypto.notifications ?? { notifyOnLargeDeposit: true, largeDepositThresholdUsd: 1000, notifyOnWithdraw: true, notifyOnLowTreasury: true, lowTreasuryThresholdUsd: 500 },
        });
        setCryptoSettingsDirty(false);
      }
      const am = settingsData.settings.apiManagement;
      if (am) {
        setApiManagementForm({
          apis: am.apis ?? [],
          categories: am.categories ?? [],
        });
        setApiManagementDirty(false);
      }
      try {
        const trialData = await api<{ total: number; byTier: Record<string, { id: string; email: string; display_name: string }[]> }>("admin.trial.status");
        setTrialStatus(trialData);
      } catch { /* ignore */ }
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!account) {
    return (
      <AccountGate
        title="Masuk sebagai admin"
        description="Panel ini hanya untuk admin platform."
        actionLabel="Masuk"
        showRegister={false}
      />
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-20 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-rose-50">
          <XCircle className="size-6 text-rose-600" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold">Akses khusus admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Akunmu berperan sebagai {ROLE_LABEL[account.role]}. Hubungi admin platform jika kamu memerlukan akses.
        </p>
      </div>
    );
  }

  const review = async (profile: Profile, approve: boolean) => {
    setBusyId(profile.id);
    try {
      await api("admin.profiles.review", { id: profile.id, approve });
      toast.success(approve ? `${profile.nickname} kini terverifikasi.` : "Profil ditandai perlu perbaikan.");
      await load();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const setRole = async (target: AdminAccount, role: WidowRole) => {
    setBusyId(target.id);
    try {
      await api("admin.accounts.setRole", { id: target.id, role });
      toast.success(`Peran ${target.displayName ?? target.email} menjadi ${ROLE_LABEL[role]}.`);
      await load();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (target: AdminAccount, status: "active" | "suspended") => {
    setBusyId(target.id);
    try {
      await api("admin.accounts.setStatus", { id: target.id, status });
      toast.success(status === "suspended" ? "Akun dinonaktifkan." : "Akun diaktifkan kembali.");
      await load();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const resolveReport = async (report: ReportItem, resolution: "hide" | "dismiss") => {
    setBusyId(report.id);
    try {
      await api("admin.reports.resolve", { id: report.id, resolution });
      toast.success(resolution === "hide" ? "Konten disembunyikan." : "Laporan diabaikan.");
      await load();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    setSavingSettings(true);
    try {
      const res = await api<{ settings: AppSettings }>("admin.settings.update", newSettings);
      setSettings(res.settings);
      if (newSettings.payment) {
        setPaymentForm({
          serverKey: res.settings.payment.midtransServerKey,
          clientKey: res.settings.payment.midtransClientKey,
          environment: res.settings.payment.midtransEnvironment,
          enabled: res.settings.payment.enabled,
        });
        setPaymentDirty(false);
      }
      if (newSettings.shipping) {
        setShippingForm({
          enabled: res.settings.shipping.enabled,
          providers: res.settings.shipping.providers.map((p) => ({ ...p })),
        });
        setShippingDirty(false);
      }
      if (newSettings.subscription) {
        setSubscriptionForm({
          sosialita: res.settings.subscription.prices.sosialita,
          high_society: res.settings.subscription.prices.high_society,
          the_ceo: res.settings.subscription.prices.the_ceo,
          ceo: res.settings.subscription.prices.ceo ?? 1000000,
          sultan: res.settings.subscription.prices.sultan ?? 2000000,
        });
        setSubscriptionDirty(false);
      }
      if (newSettings.academy) {
        setAcademyForm({
          enabled: res.settings.academy.enabled,
          title: res.settings.academy.title,
          description: res.settings.academy.description,
          schedule: res.settings.academy.schedule,
          location: res.settings.academy.location,
          modules: res.settings.academy.modules.map((m) => ({ ...m })),
        });
        setAcademyDirty(false);
      }
      if (newSettings.trading) {
        setTradingForm({
          enabled: res.settings.trading.enabled,
          title: res.settings.trading.title,
          description: res.settings.trading.description,
          schedule: res.settings.trading.schedule,
          location: res.settings.trading.location,
          modules: res.settings.trading.modules.map((m) => ({ ...m })),
        });
        setTradingDirty(false);
      }
      if (newSettings.links) {
        setLinksForm({
          enabled: res.settings.links.enabled,
          items: res.settings.links.items.map((item) => ({ ...item })),
        });
        setLinksDirty(false);
      }
      if (newSettings.liveTrading) {
        const lt = res.settings.liveTrading;
        setLiveTradingForm({
          enabled: lt.enabled, provider: lt.provider, tradingViewWidgetId: lt.tradingViewWidgetId,
          tradingViewSymbol: lt.tradingViewSymbol, tradingViewInterval: lt.tradingViewInterval,
          tradingViewTheme: lt.tradingViewTheme, apiKey: lt.apiKey, apiBaseUrl: lt.apiBaseUrl,
          symbols: lt.symbols.map((s) => ({ ...s })), refreshInterval: lt.refreshInterval,
        });
        setLiveTradingDirty(false);
      }
      if (newSettings.metaTrader5) {
        const mt = res.settings.metaTrader5;
        setMetaTrader5Form({
          enabled: mt.enabled, broker: mt.broker, server: mt.server, login: mt.login,
          password: mt.password, accountType: mt.accountType, leverage: mt.leverage,
          balance: mt.balance, currency: mt.currency, allowedSymbols: [...mt.allowedSymbols],
          riskManagement: { ...mt.riskManagement },
        });
        setMetaTrader5Dirty(false);
      }
      if (newSettings.aiTradingAgent) {
        const ai = res.settings.aiTradingAgent;
        setAiTradingAgentForm({
          enabled: ai.enabled, name: ai.name, description: ai.description, model: ai.model,
          strategy: ai.strategy, riskLevel: ai.riskLevel, maxDailyTrades: ai.maxDailyTrades,
          minConfidence: ai.minConfidence, autoExecute: ai.autoExecute, notifyOnTrade: ai.notifyOnTrade,
          parameters: { ...ai.parameters }, allowedMarkets: [...ai.allowedMarkets],
          schedule: { ...ai.schedule },
        });
        setAiTradingAgentDirty(false);
      }
      if (newSettings.coinSettings) {
        const cs = res.settings.coinSettings;
        setCoinSettingsForm({
          purchaseMethods: cs.purchaseMethods.map((m) => ({ ...m })),
          withdrawMethods: cs.withdrawMethods.map((m) => ({ ...m })),
          conversionRate: cs.conversionRate,
          fees: { ...cs.fees },
        });
        setCoinSettingsDirty(false);
      }
      if (newSettings.blockchainApi) {
        const ba = res.settings.blockchainApi;
        setBlockchainApiForm({
          enabled: ba.enabled, apiBaseUrl: ba.apiBaseUrl, apiKey: ba.apiKey, network: ba.network,
          contractAddress: ba.contractAddress, chainId: ba.chainId, rpcUrl: ba.rpcUrl, webhookSecret: ba.webhookSecret,
          platformWallet: ba.platformWallet, gasLimit: ba.gasLimit, confirmations: ba.confirmations,
        });
        setBlockchainApiDirty(false);
      }
      if (newSettings.trialAccounts) {
        const ta = res.settings.trialAccounts;
        setTrialForm({ accountsPerTier: ta.accountsPerTier, password: ta.password });
        setTrialDirty(false);
      }
      if (newSettings.cryptoSettings) {
        const crypto = res.settings.cryptoSettings;
        setCryptoSettingsForm({
          treasuryWallets: crypto.treasuryWallets ?? [],
          distribution: crypto.distribution ?? cryptoSettingsForm.distribution,
          globalFees: crypto.globalFees ?? cryptoSettingsForm.globalFees,
          notifications: crypto.notifications ?? cryptoSettingsForm.notifications,
        });
        setCryptoSettingsDirty(false);
      }
      if (newSettings.apiManagement) {
        const am = res.settings.apiManagement;
        setApiManagementForm({
          apis: am.apis ?? [],
          categories: am.categories ?? [],
        });
        setApiManagementDirty(false);
      }
      toast.success("Pengaturan berhasil disimpan.");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSavingSettings(false);
    }
  };

  const pendingApprovals = approvals?.filter((item) => item.status === "pending").length ?? 0;

  const decideApproval = async (approval: AdminEventApproval) => {
    setApprovalBusy(approval.id);
    try {
      await api("admin.events.decide", { approvalId: approval.id, decision: "approve" });
      toast.success("Event disetujui dan telah dipublikasikan.");
      await load();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setApprovalBusy(null);
    }
  };

  const loading = !stats || !accounts || !pending || !reports || !donations || !settings;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-6 sm:gap-6 sm:px-4 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <ShieldCheck className="size-5 text-primary sm:size-6" aria-hidden />
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Panel admin</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/keuangan">
              <TrendingUp className="size-4" aria-hidden />
              Laporan Keuangan
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="size-4" aria-hidden />
            Muat ulang data
          </Button>
        </div>
      </div>

      {error ? <ErrorNote message={error} onRetry={load} /> : null}

      <Tabs defaultValue="ringkasan">
        <TabsList className="flex h-auto w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
          <TabsTrigger value="verifikasi">
            Verifikasi{pending && pending.length ? ` (${pending.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="pengguna">Pengguna</TabsTrigger>
          <TabsTrigger value="laporan">
            Laporan{reports && reports.length ? ` (${reports.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="donasi">Donasi</TabsTrigger>
          <TabsTrigger value="events">
            Event & Tiket{eventsAdmin && eventsAdmin.length ? ` (${eventsAdmin.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="approval">
            Approval Event{pendingApprovals ? ` (${pendingApprovals})` : ""}
          </TabsTrigger>
          <TabsTrigger value="pembayaran">Pembayaran</TabsTrigger>
          <TabsTrigger value="pengiriman">Pengiriman</TabsTrigger>
          <TabsTrigger value="langganan">Langganan</TabsTrigger>
          <TabsTrigger value="akademi">Akademi</TabsTrigger>
          <TabsTrigger value="trading">Belajar Trading</TabsTrigger>
          <TabsTrigger value="tautan">Tautan</TabsTrigger>
          <TabsTrigger value="liveTrading">Live Trading</TabsTrigger>
          <TabsTrigger value="metaTrader5">MetaTrader 5</TabsTrigger>
          <TabsTrigger value="aiAgent">AI Trading Agent</TabsTrigger>
          <TabsTrigger value="coinSettings">Pengaturan Koin</TabsTrigger>
          <TabsTrigger value="blockchainApi">API Blockchain</TabsTrigger>
          <TabsTrigger value="cryptoSettings">Crypto Wallet</TabsTrigger>
          <TabsTrigger value="trialAccounts">Akun Uji Coba</TabsTrigger>
          <TabsTrigger value="apiManagement">Manajemen API</TabsTrigger>
          <TabsTrigger value="storage">Cloud Storage</TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan" className="mt-4">
          {loading || !stats ? (
            <LoadingGrid count={4} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total akun" value={stats.accounts.total} />
              <Stat label="Profil menunggu" value={stats.pendingProfiles} hint="termasuk yang perlu perbaikan" />
              <Stat label="Laporan terbuka" value={stats.openReports} />
              <Stat
                label="Donasi berhasil"
                value={formatRupiah(stats.donationTotal)}
                hint={stats.paymentEnabled ? "Pembayaran daring aktif" : "Pembayaran daring belum dikonfigurasi"}
              />
              <Card className="sm:col-span-2 lg:col-span-4">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Distribusi peran</CardTitle>
                  <CardDescription>Jumlah akun per peran saat ini.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {Object.entries(stats.accounts.byRole).map(([role, count]) => (
                    <Chip key={role}>
                      {ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? role}: {count}
                    </Chip>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="verifikasi" className="mt-4">
          {loading ? (
            <LoadingGrid count={3} />
          ) : (pending ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada profil yang menunggu verifikasi. Semua beres.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {(pending ?? []).map((profile) => (
                <Card key={profile.id}>
                  <CardHeader className="gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <MemberAvatar
                          name={profile.nickname}
                          tier={profile.tier}
                          size={46}
                          photoData={profile.photoData}
                        />
                        <div>
                          <p className="font-display text-lg font-semibold">{profile.nickname}</p>
                          {profile.fullName ? (
                            <p className="text-xs text-muted-foreground">Nama lengkap: {profile.fullName}</p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {TIER_META[profile.tier].label} · diajukan {timeAgo(profile.createdAt)}
                          </p>
                        </div>
                      </div>
                      <StatusPill kind="profile" status={profile.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <ul className="space-y-1 text-muted-foreground">
                      <li>Kota: {profile.city ?? "—"}</li>
                      <li>
                        Umur: {profile.age ?? "—"} · Tanggungan: {profile.dependents ?? "—"}
                      </li>
                      <li>Pekerjaan: {profile.employmentStatus ?? "—"}</li>
                      <li>Target utama: {profile.mainTarget ?? "—"}</li>
                      <li>Kebutuhan: {profile.needsTarget ?? "—"}</li>
                    </ul>
                    <div className="rounded-xl border border-border bg-secondary/40 p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Dokumen verifikasi — rahasia, hanya admin
                      </p>
                      {profile.verificationDoc ? (
                        <div className="mt-2 flex items-center gap-3">
                          <img
                            src={profile.verificationDoc.dataUrl}
                            alt={`Dokumen ${profile.nickname}`}
                            className="h-16 w-24 rounded-md border border-border bg-background object-cover"
                          />
                          <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                            <p>
                              {DOC_TYPE_OPTIONS.find((option) => option.value === profile.verificationDoc?.type)
                                ?.label ?? "Dokumen"}
                            </p>
                            <p className="truncate">{profile.verificationDoc.fileName ?? "dokumen.jpg"}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              profile.verificationDoc &&
                              window.open(profile.verificationDoc.dataUrl, "_blank", "noopener")
                            }
                          >
                            Lihat
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-amber-700">
                          Tidak ada dokumen terlampir — minta anggota melengkapi lewat dasbornya.
                        </p>
                      )}
                    </div>
                    {profile.skills.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {profile.skills.map((skill) => (
                          <Chip key={skill}>{skill}</Chip>
                        ))}
                      </div>
                    ) : null}
                    {profile.bio ? (
                      <p className="rounded-xl bg-secondary/60 px-3 py-2 text-muted-foreground">{profile.bio}</p>
                    ) : null}
                    {profile.rejectReason ? (
                      <p className="text-xs text-rose-700">Catatan sebelumnya: {profile.rejectReason}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={busyId === profile.id}
                        onClick={() => review(profile, true)}
                      >
                        {busyId === profile.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <BadgeCheck className="size-4" aria-hidden />
                        )}
                        Verifikasi
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === profile.id}
                        onClick={() => setRejectTarget(profile)}
                      >
                        Perlu perbaikan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pengguna" className="mt-4">
          {loading ? (
            <LoadingGrid count={4} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <Users className="size-4" aria-hidden />
                  Daftar akun
                </CardTitle>
                <CardDescription>
                  Ubah tier anggota janda atau nonaktifkan akun. Akun tanpa profil janda tidak dapat diberi tier.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(accounts ?? []).map((item) => {
                  const isSelf = item.id === account.id;
                  const admin = item.role === "admin";
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
                    >
                      <div className="min-w-52 flex-1">
                        <p className="text-sm font-medium">{item.displayName ?? item.nickname ?? item.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.email} · gabung {timeAgo(item.createdAt)}
                        </p>
                      </div>
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                        {ROLE_LABEL[item.role]}
                      </span>
                      <span
                        className={
                          item.status === "active"
                            ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-900"
                            : "rounded-full bg-rose-100 px-2.5 py-0.5 text-xs text-rose-900"
                        }
                      >
                        {item.status === "active" ? "Aktif" : "Nonaktif"}
                      </span>
                      {!admin && !isSelf ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {item.tier ? (
                            <Select
                              value={item.tier}
                              onValueChange={(value) => setRole(item, value as WidowRole)}
                              disabled={busyId === item.id}
                            >
                              <SelectTrigger className="h-9 w-44">
                                <UserCog className="size-3.5" aria-hidden />
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {WIDOW_ROLES.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {TIER_META[role].label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground">Tanpa profil janda</span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === item.id}
                            onClick={() => setStatus(item, item.status === "active" ? "suspended" : "active")}
                          >
                            {busyId === item.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                            {item.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{isSelf ? "Akun Anda" : "Admin"}</span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="laporan" className="mt-4">
          {loading ? (
            <LoadingGrid count={3} />
          ) : (reports ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada laporan terbuka.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {(reports ?? []).map((report) => (
                <Card key={report.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="flex items-start gap-3">
                      <Flag className="mt-0.5 size-4 text-rose-600" aria-hidden />
                      <div>
                        <p className="text-sm font-medium">
                          {report.reason} · {report.targetType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ID {report.targetId.slice(0, 8)}… · {timeAgo(report.createdAt)}
                        </p>
                        {report.detail ? (
                          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{report.detail}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === report.id}
                        onClick={() => resolveReport(report, "hide")}
                      >
                        {busyId === report.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Sembunyikan konten
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === report.id}
                        onClick={() => resolveReport(report, "dismiss")}
                      >
                        Abaikan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="donasi" className="mt-4">
          {loading ? (
            <LoadingGrid count={3} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <Coins className="size-4" aria-hidden />
                  Riwayat donasi
                </CardTitle>
                <CardDescription>100 transaksi terbaru dari seluruh profil.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(donations ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada transaksi donasi.</p>
                ) : (
                  (donations ?? []).map((donation) => (
                    <div
                      key={donation.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{formatRupiah(donation.grossAmount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {donation.supporterName} · {donation.orderId} · {timeAgo(donation.createdAt)}
                        </p>
                      </div>
                      <StatusPill kind="donation" status={donation.status} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          {loading || !eventsAdmin ? (
            <LoadingGrid count={3} />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Total event" value={eventsAdmin.length} />
                <Stat
                  label="Tiket diterbitkan"
                  value={eventsAdmin.reduce((sum, e) => sum + e.tickets.total, 0)}
                  hint="dari seluruh event"
                />
                <Stat
                  label="Tiket terpakai"
                  value={eventsAdmin.reduce((sum, e) => sum + e.tickets.used, 0)}
                  hint="sudah diabsen"
                />
                <Stat
                  label="Pendapatan tiket"
                  value={formatRupiah(eventsAdmin.reduce((sum, e) => sum + e.tickets.revenue, 0))}
                  hint="tiket valid & terpakai"
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-lg">
                    <CalendarDays className="size-4" aria-hidden />
                    Event &amp; penerbitan tiket
                  </CardTitle>
                  <CardDescription>
                    Daftar event beserta pembuatnya dan jumlah tiket yang diterbitkan. Klik judul event untuk membuka pengelolaan.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {eventsAdmin.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada event yang dibuat.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs text-muted-foreground">
                            <th className="pb-2 pr-4">Event</th>
                            <th className="pb-2 pr-4">Pembuat</th>
                            <th className="pb-2 pr-4">Tiket</th>
                            <th className="pb-2 pr-4">Absensi</th>
                            <th className="pb-2 pr-4">Harga</th>
                            <th className="pb-2">Mulai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {eventsAdmin.map((ev) => (
                            <tr key={ev.id}>
                              <td className="py-3 pr-4">
                                <Link
                                  to={`/event/${ev.id}/kelola`}
                                  className="font-medium underline-offset-2 hover:underline"
                                >
                                  {ev.title}
                                </Link>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <Badge variant="secondary" className="capitalize">{ev.audience}</Badge>
                                  {ev.status === "cancelled" ? (
                                    <Badge variant="destructive">Dibatalkan</Badge>
                                  ) : (
                                    <Badge variant="outline" className="capitalize">{ev.status}</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="font-medium">{ev.creatorName ?? "Tidak diketahui"}</span>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <QrCode className="size-3.5 text-muted-foreground" aria-hidden />
                                  <span className="font-semibold">{ev.tickets.total}</span>
                                  <span className="text-muted-foreground">
                                    (berlaku {ev.tickets.valid} · terpakai {ev.tickets.used}
                                    {ev.tickets.pending ? ` · menunggu ${ev.tickets.pending}` : ""})
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="font-semibold">{ev.attendanceCount}</span>
                              </td>
                              <td className="py-3 pr-4">
                                {ev.ticketPrice ? formatRupiah(ev.ticketPrice) : "Gratis"}
                              </td>
                              <td className="py-3 text-xs text-muted-foreground">
                                {formatDateTime(ev.startsAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="approval" className="mt-4">
          {loading || !approvals ? (
            <LoadingGrid count={3} />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Menunggu keputusan" value={pendingApprovals} hint="perlu tindakan admin" />
                <Stat
                  label="Disetujui"
                  value={approvals.filter((item) => item.status === "approved").length}
                  hint="otomatis dipublikasikan"
                />
                <Stat
                  label="Ditolak / revisi"
                  value={approvals.filter((item) => item.status === "rejected" || item.status === "revision").length}
                  hint="dikembalikan ke draf"
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-lg">
                    <ClipboardCheck className="size-4" aria-hidden />
                    Persetujuan event
                  </CardTitle>
                  <CardDescription>
                    Pengajuan event yang memakai dana platform, melibatkan sponsor, menargetkan lebih dari 1.000
                    peserta, berkategori amal, atau konferensi berizin.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {approvals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada pengajuan persetujuan event.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {approvals.map((item) => {
                        const meta = APPROVAL_STATUS_META[item.status] ?? APPROVAL_STATUS_META.pending;
                        return (
                          <li key={item.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 py-4">
                            <div className="min-w-0 flex-1 basis-64 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  to={`/event/${item.eventId}/kelola`}
                                  className="font-medium underline-offset-2 hover:underline"
                                >
                                  {item.eventTitle}
                                </Link>
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>
                                  {meta.label}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>
                                  Diajukan {item.requestedByName} · {timeAgo(item.createdAt)}
                                </span>
                                {item.startsAt ? <span>Mulai {formatDateTime(item.startsAt)}</span> : null}
                                {item.capacity ? <span>Kapasitas {item.capacity}</span> : null}
                              </div>
                              {item.reason.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {item.reason.map((reason) => (
                                    <Badge key={reason} variant="outline">
                                      {APPROVAL_REASON_LABEL[reason] ?? reason}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                              <p className="text-xs text-muted-foreground">
                                Anggaran {formatRupiah(item.totalBudget)} · Sumber dana {formatRupiah(item.totalFunding)}
                              </p>
                              {item.decisionNote ? (
                                <p className="text-xs text-muted-foreground">Catatan admin: {item.decisionNote}</p>
                              ) : null}
                            </div>
                            {item.status === "pending" ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => void decideApproval(item)}
                                  disabled={approvalBusy === item.id}
                                >
                                  {approvalBusy === item.id ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="size-4" aria-hidden />
                                  )}
                                  Setujui
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setApprovalDecision({ approval: item, decision: "revision" })}
                                  disabled={approvalBusy === item.id}
                                >
                                  <RotateCcw className="size-4" aria-hidden />
                                  Minta revisi
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setApprovalDecision({ approval: item, decision: "reject" })}
                                  disabled={approvalBusy === item.id}
                                >
                                  <XCircle className="size-4" aria-hidden />
                                  Tolak
                                </Button>
                              </div>
                            ) : item.decidedAt ? (
                              <span className="text-xs text-muted-foreground">Diputuskan {timeAgo(item.decidedAt)}</span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pembayaran" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <CreditCard className="size-4" aria-hidden />
                Pengaturan Pembayaran
              </CardTitle>
              <CardDescription>Konfigurasi gateway pembayaran Midtrans</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Pembayaran daring</p>
                  <p className="text-xs text-muted-foreground">Aktifkan atau nonaktifkan seluruh pembayaran Midtrans.</p>
                </div>
                <Switch
                  checked={paymentForm.enabled}
                  onCheckedChange={(checked) => {
                    setPaymentForm((prev) => ({ ...prev, enabled: checked }));
                    setPaymentDirty(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="midtrans-server">Midtrans Server Key</Label>
                <Input
                  id="midtrans-server"
                  type="password"
                  placeholder="SB-Mid-server-xxxxxxxxxxxx"
                  value={paymentForm.serverKey}
                  onChange={(e) => {
                    setPaymentForm((prev) => ({ ...prev, serverKey: e.target.value }));
                    setPaymentDirty(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="midtrans-client">Midtrans Client Key</Label>
                <Input
                  id="midtrans-client"
                  placeholder="SB-Mid-client-xxxxxxxxxxxx"
                  value={paymentForm.clientKey}
                  onChange={(e) => {
                    setPaymentForm((prev) => ({ ...prev, clientKey: e.target.value }));
                    setPaymentDirty(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Mode</Label>
                <Select
                  value={paymentForm.environment}
                  onValueChange={(value) => {
                    setPaymentForm((prev) => ({ ...prev, environment: value as "sandbox" | "production" }));
                    setPaymentDirty(true);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox — mode testing, tanpa uang asli</SelectItem>
                    <SelectItem value="production">Production — transaksi nyata</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prefix Order ID</Label>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between rounded-lg border border-border p-2">
                    <span className="text-muted-foreground">Donasi</span>
                    <code className="font-mono">PJ-</code>
                  </div>
                  <div className="flex justify-between rounded-lg border border-border p-2">
                    <span className="text-muted-foreground">Campaign</span>
                    <code className="font-mono">PJC-</code>
                  </div>
                  <div className="flex justify-between rounded-lg border border-border p-2">
                    <span className="text-muted-foreground">Tiket Event</span>
                    <code className="font-mono">PJT-</code>
                  </div>
                  <div className="flex justify-between rounded-lg border border-border p-2">
                    <span className="text-muted-foreground">Langganan</span>
                    <code className="font-mono">PJS-</code>
                  </div>
                </div>
              </div>

              <Button
                disabled={savingSettings || !paymentDirty}
                onClick={() =>
                  updateSettings({
                    payment: {
                      midtransServerKey: paymentForm.serverKey,
                      midtransClientKey: paymentForm.clientKey,
                      midtransEnvironment: paymentForm.environment,
                      enabled: paymentForm.enabled,
                    },
                  })
                }
              >
                {savingSettings ? <Loader2 className="size-4 animate-spin" /> : null}
                Simpan pengaturan pembayaran
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pengiriman" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Truck className="size-4" aria-hidden />
                Pengaturan Pengiriman
              </CardTitle>
              <CardDescription>Konfigurasi kurir dan tarif dasar pengiriman</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Fitur pengiriman</p>
                  <p className="text-xs text-muted-foreground">Aktifkan perhitungan ongkos kirim pada checkout marketplace.</p>
                </div>
                <Switch
                  checked={shippingForm.enabled}
                  onCheckedChange={(checked) => {
                    setShippingForm((prev) => ({ ...prev, enabled: checked }));
                    setShippingDirty(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Kurir</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShippingForm((prev) => ({
                        ...prev,
                        providers: [
                          ...prev.providers,
                          { id: `courier_${Date.now()}`, name: "", enabled: true, baseRate: 0 },
                        ],
                      }));
                      setShippingDirty(true);
                    }}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Tambah kurir
                  </Button>
                </div>

                {shippingForm.providers.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Belum ada kurir yang dikonfigurasi.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {shippingForm.providers.map((provider, index) => (
                      <div key={provider.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="space-y-1">
                            <Label htmlFor={`provider-name-${index}`} className="text-xs">
                              Nama kurir
                            </Label>
                            <Input
                              id={`provider-name-${index}`}
                              placeholder="Contoh: JNE Express"
                              value={provider.name}
                              onChange={(e) => {
                                setShippingForm((prev) => ({
                                  ...prev,
                                  providers: prev.providers.map((p, i) =>
                                    i === index ? { ...p, name: e.target.value } : p,
                                  ),
                                }));
                                setShippingDirty(true);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`provider-rate-${index}`} className="text-xs">
                              Tarif dasar (Rp)
                            </Label>
                            <Input
                              id={`provider-rate-${index}`}
                              type="number"
                              min={0}
                              value={provider.baseRate}
                              onChange={(e) => {
                                setShippingForm((prev) => ({
                                  ...prev,
                                  providers: prev.providers.map((p, i) =>
                                    i === index ? { ...p, baseRate: Number(e.target.value) || 0 } : p,
                                  ),
                                }));
                                setShippingDirty(true);
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={provider.enabled}
                              onCheckedChange={(checked) => {
                                setShippingForm((prev) => ({
                                  ...prev,
                                  providers: prev.providers.map((p, i) =>
                                    i === index ? { ...p, enabled: checked } : p,
                                  ),
                                }));
                                setShippingDirty(true);
                              }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {provider.enabled ? "Aktif" : "Nonaktif"}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShippingForm((prev) => ({
                                ...prev,
                                providers: prev.providers.filter((_, i) => i !== index),
                              }));
                              setShippingDirty(true);
                            }}
                          >
                            <Trash2 className="size-3.5 text-rose-600" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                disabled={savingSettings || !shippingDirty}
                onClick={() =>
                  updateSettings({
                    shipping: {
                      enabled: shippingForm.enabled,
                      providers: shippingForm.providers,
                    },
                  })
                }
              >
                {savingSettings ? <Loader2 className="size-4 animate-spin" /> : null}
                Simpan pengaturan pengiriman
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="langganan" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Crown className="size-4" aria-hidden />
                Harga Langganan Tier
              </CardTitle>
              <CardDescription>Atur harga bulanan untuk masing-masing tier badge.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tier Janda</p>
                <div className="space-y-3">
                  {(["sosialita", "high_society", "the_ceo"] as const).map((tier) => {
                    const meta = TIER_META[tier];
                    return (
                      <div key={tier} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                        <Crown className="size-5" style={{ color: meta.accent }} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">{meta.tagline}</p>
                        </div>
                        <div className="w-40 space-y-1">
                          <Label htmlFor={`price-${tier}`} className="text-xs">Harga (Rp/bulan)</Label>
                          <Input
                            id={`price-${tier}`}
                            type="number"
                            min={0}
                            step={1000}
                            value={subscriptionForm[tier]}
                            onChange={(e) => {
                              setSubscriptionForm((prev) => ({ ...prev, [tier]: Number(e.target.value) || 0 }));
                              setSubscriptionDirty(true);
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tier Non-Janda</p>
                <div className="space-y-3">
                  {(["ceo", "sultan"] as const).map((tier) => {
                    const meta = PUBLIC_TIER_META[tier];
                    return (
                      <div key={tier} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                        <Gem className="size-5" style={{ color: meta.accent }} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{meta.label}</p>
                        </div>
                        <div className="w-40 space-y-1">
                          <Label htmlFor={`price-${tier}`} className="text-xs">Harga (Rp/bulan)</Label>
                          <Input
                            id={`price-${tier}`}
                            type="number"
                            min={0}
                            step={1000}
                            value={subscriptionForm[tier]}
                            onChange={(e) => {
                              setSubscriptionForm((prev) => ({ ...prev, [tier]: Number(e.target.value) || 0 }));
                              setSubscriptionDirty(true);
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                disabled={savingSettings || !subscriptionDirty}
                onClick={() =>
                  updateSettings({
                    subscription: {
                      prices: {
                        sosialita: subscriptionForm.sosialita,
                        high_society: subscriptionForm.high_society,
                        the_ceo: subscriptionForm.the_ceo,
                        ceo: subscriptionForm.ceo,
                        sultan: subscriptionForm.sultan,
                      },
                    },
                  })
                }
              >
                {savingSettings ? <Loader2 className="size-4 animate-spin" /> : null}
                Simpan harga langganan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="akademi" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <BookOpen className="size-4" aria-hidden />
                Pengaturan Akademi
              </CardTitle>
              <CardDescription>Konfigurasi program akademi wirausaha untuk anggota.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Fitur Akademi</p>
                  <p className="text-xs text-muted-foreground">Aktifkan atau nonaktifkan halaman akademi.</p>
                </div>
                <Switch
                  checked={academyForm.enabled}
                  onCheckedChange={(checked) => {
                    setAcademyForm((prev) => ({ ...prev, enabled: checked }));
                    setAcademyDirty(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="academy-title">Judul</Label>
                <Input
                  id="academy-title"
                  value={academyForm.title}
                  onChange={(e) => {
                    setAcademyForm((prev) => ({ ...prev, title: e.target.value }));
                    setAcademyDirty(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="academy-desc">Deskripsi</Label>
                <Textarea
                  id="academy-desc"
                  rows={3}
                  value={academyForm.description}
                  onChange={(e) => {
                    setAcademyForm((prev) => ({ ...prev, description: e.target.value }));
                    setAcademyDirty(true);
                  }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="academy-schedule">Jadwal</Label>
                  <Input
                    id="academy-schedule"
                    placeholder="Contoh: Setiap Sabtu, 09:00 - 12:00 WIB"
                    value={academyForm.schedule}
                    onChange={(e) => {
                      setAcademyForm((prev) => ({ ...prev, schedule: e.target.value }));
                      setAcademyDirty(true);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="academy-location">Lokasi</Label>
                  <Input
                    id="academy-location"
                    placeholder="Contoh: Ruang Komunitas Panti Janda"
                    value={academyForm.location}
                    onChange={(e) => {
                      setAcademyForm((prev) => ({ ...prev, location: e.target.value }));
                      setAcademyDirty(true);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Modul Pembelajaran</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAcademyForm((prev) => ({
                        ...prev,
                        modules: [...prev.modules, { id: `mod_${Date.now()}`, title: "", duration: "", enabled: true }],
                      }));
                      setAcademyDirty(true);
                    }}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Tambah modul
                  </Button>
                </div>

                {academyForm.modules.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Belum ada modul pembelajaran.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {academyForm.modules.map((mod, index) => (
                      <div key={mod.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="space-y-1">
                            <Label htmlFor={`academy-mod-title-${index}`} className="text-xs">Judul modul</Label>
                            <Input
                              id={`academy-mod-title-${index}`}
                              placeholder="Contoh: Dasar-Dasar Bisnis"
                              value={mod.title}
                              onChange={(e) => {
                                setAcademyForm((prev) => ({
                                  ...prev,
                                  modules: prev.modules.map((m, i) => i === index ? { ...m, title: e.target.value } : m),
                                }));
                                setAcademyDirty(true);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`academy-mod-duration-${index}`} className="text-xs">Durasi</Label>
                            <Input
                              id={`academy-mod-duration-${index}`}
                              placeholder="Contoh: 2 jam"
                              value={mod.duration}
                              onChange={(e) => {
                                setAcademyForm((prev) => ({
                                  ...prev,
                                  modules: prev.modules.map((m, i) => i === index ? { ...m, duration: e.target.value } : m),
                                }));
                                setAcademyDirty(true);
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={mod.enabled}
                              onCheckedChange={(checked) => {
                                setAcademyForm((prev) => ({
                                  ...prev,
                                  modules: prev.modules.map((m, i) => i === index ? { ...m, enabled: checked } : m),
                                }));
                                setAcademyDirty(true);
                              }}
                            />
                            <span className="text-xs text-muted-foreground">{mod.enabled ? "Aktif" : "Nonaktif"}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAcademyForm((prev) => ({
                                ...prev,
                                modules: prev.modules.filter((_, i) => i !== index),
                              }));
                              setAcademyDirty(true);
                            }}
                          >
                            <Trash2 className="size-3.5 text-rose-600" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                disabled={savingSettings || !academyDirty}
                onClick={() =>
                  updateSettings({
                    academy: {
                      enabled: academyForm.enabled,
                      title: academyForm.title,
                      description: academyForm.description,
                      schedule: academyForm.schedule,
                      location: academyForm.location,
                      modules: academyForm.modules,
                    },
                  })
                }
              >
                {savingSettings ? <Loader2 className="size-4 animate-spin" /> : null}
                Simpan pengaturan akademi
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trading" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <TrendingUp className="size-4" aria-hidden />
                Pengaturan Belajar Trading
              </CardTitle>
              <CardDescription>Konfigurasi program pelatihan trading untuk anggota.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Fitur Belajar Trading</p>
                  <p className="text-xs text-muted-foreground">Aktifkan atau nonaktifkan halaman belajar trading.</p>
                </div>
                <Switch
                  checked={tradingForm.enabled}
                  onCheckedChange={(checked) => {
                    setTradingForm((prev) => ({ ...prev, enabled: checked }));
                    setTradingDirty(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trading-title">Judul</Label>
                <Input
                  id="trading-title"
                  value={tradingForm.title}
                  onChange={(e) => {
                    setTradingForm((prev) => ({ ...prev, title: e.target.value }));
                    setTradingDirty(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trading-desc">Deskripsi</Label>
                <Textarea
                  id="trading-desc"
                  rows={3}
                  value={tradingForm.description}
                  onChange={(e) => {
                    setTradingForm((prev) => ({ ...prev, description: e.target.value }));
                    setTradingDirty(true);
                  }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="trading-schedule">Jadwal</Label>
                  <Input
                    id="trading-schedule"
                    placeholder="Contoh: Setiap Rabu, 19:00 - 21:00 WIB"
                    value={tradingForm.schedule}
                    onChange={(e) => {
                      setTradingForm((prev) => ({ ...prev, schedule: e.target.value }));
                      setTradingDirty(true);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trading-location">Lokasi</Label>
                  <Input
                    id="trading-location"
                    placeholder="Contoh: Online via Zoom"
                    value={tradingForm.location}
                    onChange={(e) => {
                      setTradingForm((prev) => ({ ...prev, location: e.target.value }));
                      setTradingDirty(true);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Modul Pembelajaran</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTradingForm((prev) => ({
                        ...prev,
                        modules: [...prev.modules, { id: `trade_${Date.now()}`, title: "", duration: "", enabled: true }],
                      }));
                      setTradingDirty(true);
                    }}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Tambah modul
                  </Button>
                </div>

                {tradingForm.modules.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Belum ada modul pembelajaran.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {tradingForm.modules.map((mod, index) => (
                      <div key={mod.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="space-y-1">
                            <Label htmlFor={`trading-mod-title-${index}`} className="text-xs">Judul modul</Label>
                            <Input
                              id={`trading-mod-title-${index}`}
                              placeholder="Contoh: Pengantar Trading"
                              value={mod.title}
                              onChange={(e) => {
                                setTradingForm((prev) => ({
                                  ...prev,
                                  modules: prev.modules.map((m, i) => i === index ? { ...m, title: e.target.value } : m),
                                }));
                                setTradingDirty(true);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`trading-mod-duration-${index}`} className="text-xs">Durasi</Label>
                            <Input
                              id={`trading-mod-duration-${index}`}
                              placeholder="Contoh: 1.5 jam"
                              value={mod.duration}
                              onChange={(e) => {
                                setTradingForm((prev) => ({
                                  ...prev,
                                  modules: prev.modules.map((m, i) => i === index ? { ...m, duration: e.target.value } : m),
                                }));
                                setTradingDirty(true);
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={mod.enabled}
                              onCheckedChange={(checked) => {
                                setTradingForm((prev) => ({
                                  ...prev,
                                  modules: prev.modules.map((m, i) => i === index ? { ...m, enabled: checked } : m),
                                }));
                                setTradingDirty(true);
                              }}
                            />
                            <span className="text-xs text-muted-foreground">{mod.enabled ? "Aktif" : "Nonaktif"}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTradingForm((prev) => ({
                                ...prev,
                                modules: prev.modules.filter((_, i) => i !== index),
                              }));
                              setTradingDirty(true);
                            }}
                          >
                            <Trash2 className="size-3.5 text-rose-600" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                disabled={savingSettings || !tradingDirty}
                onClick={() =>
                  updateSettings({
                    trading: {
                      enabled: tradingForm.enabled,
                      title: tradingForm.title,
                      description: tradingForm.description,
                      schedule: tradingForm.schedule,
                      location: tradingForm.location,
                      modules: tradingForm.modules,
                    },
                  })
                }
              >
                {savingSettings ? <Loader2 className="size-4 animate-spin" /> : null}
                Simpan pengaturan trading
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tautan" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <ExternalLink className="size-4" aria-hidden />
                Pengaturan Tautan
              </CardTitle>
              <CardDescription>Kelola tautan yang dapat dibuka pada browser internal aplikasi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Fitur Tautan</p>
                  <p className="text-xs text-muted-foreground">Aktifkan atau nonaktifkan halaman tautan.</p>
                </div>
                <Switch
                  checked={linksForm.enabled}
                  onCheckedChange={(checked) => {
                    setLinksForm((prev) => ({ ...prev, enabled: checked }));
                    setLinksDirty(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Daftar Tautan</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLinksForm((prev) => ({
                        ...prev,
                        items: [...prev.items, { id: `link_${Date.now()}`, title: "", url: "", enabled: true }],
                      }));
                      setLinksDirty(true);
                    }}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Tambah tautan
                  </Button>
                </div>

                {linksForm.items.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Belum ada tautan yang dikonfigurasi.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {linksForm.items.map((item, index) => (
                      <div key={item.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="space-y-1">
                            <Label htmlFor={`link-title-${index}`} className="text-xs">Judul</Label>
                            <Input
                              id={`link-title-${index}`}
                              placeholder="Contoh: Website Resmi"
                              value={item.title}
                              onChange={(e) => {
                                setLinksForm((prev) => ({
                                  ...prev,
                                  items: prev.items.map((l, i) => i === index ? { ...l, title: e.target.value } : l),
                                }));
                                setLinksDirty(true);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`link-url-${index}`} className="text-xs">URL</Label>
                            <Input
                              id={`link-url-${index}`}
                              type="url"
                              placeholder="https://contoh.com"
                              value={item.url}
                              onChange={(e) => {
                                setLinksForm((prev) => ({
                                  ...prev,
                                  items: prev.items.map((l, i) => i === index ? { ...l, url: e.target.value } : l),
                                }));
                                setLinksDirty(true);
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={item.enabled}
                              onCheckedChange={(checked) => {
                                setLinksForm((prev) => ({
                                  ...prev,
                                  items: prev.items.map((l, i) => i === index ? { ...l, enabled: checked } : l),
                                }));
                                setLinksDirty(true);
                              }}
                            />
                            <span className="text-xs text-muted-foreground">{item.enabled ? "Aktif" : "Nonaktif"}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setLinksForm((prev) => ({
                                ...prev,
                                items: prev.items.filter((_, i) => i !== index),
                              }));
                              setLinksDirty(true);
                            }}
                          >
                            <Trash2 className="size-3.5 text-rose-600" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                disabled={savingSettings || !linksDirty}
                onClick={() =>
                  updateSettings({
                    links: {
                      enabled: linksForm.enabled,
                      items: linksForm.items,
                    },
                  })
                }
              >
                {savingSettings ? <Loader2 className="size-4 animate-spin" /> : null}
                Simpan pengaturan tautan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="liveTrading" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Activity className="size-4" aria-hidden />
                Live Trading
              </CardTitle>
              <CardDescription>Konfigurasi TradingView widget dan API data pasar real-time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Fitur Live Trading</p>
                  <p className="text-xs text-muted-foreground">Aktifkan tampilan data pasar real-time.</p>
                </div>
                <Switch
                  checked={liveTradingForm.enabled}
                  onCheckedChange={(checked) => {
                    setLiveTradingForm((prev) => ({ ...prev, enabled: checked }));
                    setLiveTradingDirty(true);
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Provider</Label>
                  <Select
                    value={liveTradingForm.provider}
                    onValueChange={(value) => {
                      setLiveTradingForm((prev) => ({ ...prev, provider: value }));
                      setLiveTradingDirty(true);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tradingview">TradingView</SelectItem>
                      <SelectItem value="custom">Custom API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Tema</Label>
                  <Select
                    value={liveTradingForm.tradingViewTheme}
                    onValueChange={(value) => {
                      setLiveTradingForm((prev) => ({ ...prev, tradingViewTheme: value }));
                      setLiveTradingDirty(true);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Terang</SelectItem>
                      <SelectItem value="dark">Gelap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Widget ID</Label>
                  <Input
                    placeholder="ID widget TradingView"
                    value={liveTradingForm.tradingViewWidgetId}
                    onChange={(e) => {
                      setLiveTradingForm((prev) => ({ ...prev, tradingViewWidgetId: e.target.value }));
                      setLiveTradingDirty(true);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Interval</Label>
                  <Select
                    value={liveTradingForm.tradingViewInterval}
                    onValueChange={(value) => {
                      setLiveTradingForm((prev) => ({ ...prev, tradingViewInterval: value }));
                      setLiveTradingDirty(true);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 menit</SelectItem>
                      <SelectItem value="5">5 menit</SelectItem>
                      <SelectItem value="15">15 menit</SelectItem>
                      <SelectItem value="60">1 jam</SelectItem>
                      <SelectItem value="D">Harian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Symbol default</Label>
                <Input
                  placeholder="IDX:IHSG"
                  value={liveTradingForm.tradingViewSymbol}
                  onChange={(e) => {
                    setLiveTradingForm((prev) => ({ ...prev, tradingViewSymbol: e.target.value }));
                    setLiveTradingDirty(true);
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    placeholder="Kunci API provider"
                    value={liveTradingForm.apiKey}
                    onChange={(e) => {
                      setLiveTradingForm((prev) => ({ ...prev, apiKey: e.target.value }));
                      setLiveTradingDirty(true);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>API Base URL</Label>
                  <Input
                    placeholder="https://api.provider.com"
                    value={liveTradingForm.apiBaseUrl}
                    onChange={(e) => {
                      setLiveTradingForm((prev) => ({ ...prev, apiBaseUrl: e.target.value }));
                      setLiveTradingDirty(true);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Refresh interval (detik)</Label>
                <Input
                  type="number"
                  min={5}
                  value={liveTradingForm.refreshInterval}
                  onChange={(e) => {
                    setLiveTradingForm((prev) => ({ ...prev, refreshInterval: Number(e.target.value) }));
                    setLiveTradingDirty(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Daftar Symbol</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLiveTradingForm((prev) => ({
                        ...prev,
                        symbols: [...prev.symbols, { id: `sym_${Date.now()}`, symbol: "", label: "", enabled: true }],
                      }));
                      setLiveTradingDirty(true);
                    }}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Tambah symbol
                  </Button>
                </div>
                {liveTradingForm.symbols.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Belum ada symbol yang dikonfigurasi.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {liveTradingForm.symbols.map((sym, index) => (
                      <div key={sym.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Symbol</Label>
                            <Input
                              placeholder="IDX:BBCA"
                              value={sym.symbol}
                              onChange={(e) => {
                                setLiveTradingForm((prev) => ({
                                  ...prev,
                                  symbols: prev.symbols.map((s, i) => i === index ? { ...s, symbol: e.target.value } : s),
                                }));
                                setLiveTradingDirty(true);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Label</Label>
                            <Input
                              placeholder="BBCA"
                              value={sym.label}
                              onChange={(e) => {
                                setLiveTradingForm((prev) => ({
                                  ...prev,
                                  symbols: prev.symbols.map((s, i) => i === index ? { ...s, label: e.target.value } : s),
                                }));
                                setLiveTradingDirty(true);
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={sym.enabled}
                              onCheckedChange={(checked) => {
                                setLiveTradingForm((prev) => ({
                                  ...prev,
                                  symbols: prev.symbols.map((s, i) => i === index ? { ...s, enabled: checked } : s),
                                }));
                                setLiveTradingDirty(true);
                              }}
                            />
                            <span className="text-xs text-muted-foreground">{sym.enabled ? "Aktif" : "Nonaktif"}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setLiveTradingForm((prev) => ({
                                ...prev,
                                symbols: prev.symbols.filter((_, i) => i !== index),
                              }));
                              setLiveTradingDirty(true);
                            }}
                          >
                            <Trash2 className="size-3.5 text-rose-600" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                disabled={savingSettings || !liveTradingDirty}
                onClick={() =>
                  updateSettings({
                    liveTrading: {
                      enabled: liveTradingForm.enabled,
                      provider: liveTradingForm.provider,
                      tradingViewWidgetId: liveTradingForm.tradingViewWidgetId,
                      tradingViewSymbol: liveTradingForm.tradingViewSymbol,
                      tradingViewInterval: liveTradingForm.tradingViewInterval,
                      tradingViewTheme: liveTradingForm.tradingViewTheme,
                      apiKey: liveTradingForm.apiKey,
                      apiBaseUrl: liveTradingForm.apiBaseUrl,
                      symbols: liveTradingForm.symbols,
                      refreshInterval: liveTradingForm.refreshInterval,
                    },
                  })
                }
              >
                {savingSettings ? <Loader2 className="size-4 animate-spin" /> : null}
                Simpan pengaturan live trading
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metaTrader5" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <BarChart3 className="size-4" aria-hidden />
                MetaTrader 5
              </CardTitle>
              <CardDescription>Konfigurasi koneksi broker dan parameter akun MetaTrader 5.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Fitur MetaTrader 5</p>
                  <p className="text-xs text-muted-foreground">Aktifkan integrasi MetaTrader 5.</p>
                </div>
                <Switch
                  checked={metaTrader5Form.enabled}
                  onCheckedChange={(checked) => {
                    setMetaTrader5Form((prev) => ({ ...prev, enabled: checked }));
                    setMetaTrader5Dirty(true);
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Broker</Label>
                  <Input
                    placeholder="Nama broker"
                    value={metaTrader5Form.broker}
                    onChange={(e) => {
                      setMetaTrader5Form((prev) => ({ ...prev, broker: e.target.value }));
                      setMetaTrader5Dirty(true);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Server</Label>
                  <Input
                    placeholder="Server MT5"
                    value={metaTrader5Form.server}
                    onChange={(e) => {
                      setMetaTrader5Form((prev) => ({ ...prev, server: e.target.value }));
                      setMetaTrader5Dirty(true);
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Login</Label>
                  <Input
                    placeholder="Nomor login"
                    value={metaTrader5Form.login}
                    onChange={(e) => {
                      setMetaTrader5Form((prev) => ({ ...prev, login: e.target.value }));
                      setMetaTrader5Dirty(true);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Password akun"
                    value={metaTrader5Form.password}
                    onChange={(e) => {
                      setMetaTrader5Form((prev) => ({ ...prev, password: e.target.value }));
                      setMetaTrader5Dirty(true);
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Tipe akun</Label>
                  <Select
                    value={metaTrader5Form.accountType}
                    onValueChange={(value) => {
                      setMetaTrader5Form((prev) => ({ ...prev, accountType: value as "demo" | "real" }));
                      setMetaTrader5Dirty(true);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="real">Real</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Leverage</Label>
                  <Input
                    type="number"
                    min={1}
                    value={metaTrader5Form.leverage}
                    onChange={(e) => {
                      setMetaTrader5Form((prev) => ({ ...prev, leverage: Number(e.target.value) }));
                      setMetaTrader5Dirty(true);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Mata uang</Label>
                  <Input
                    placeholder="USD"
                    value={metaTrader5Form.currency}
                    onChange={(e) => {
                      setMetaTrader5Form((prev) => ({ ...prev, currency: e.target.value }));
                      setMetaTrader5Dirty(true);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Saldo awal</Label>
                <Input
                  type="number"
                  min={0}
                  value={metaTrader5Form.balance}
                  onChange={(e) => {
                    setMetaTrader5Form((prev) => ({ ...prev, balance: Number(e.target.value) }));
                    setMetaTrader5Dirty(true);
                  }}
                />
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium">Manajemen Risiko</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Max lot size</Label>
                    <Input
                      type="number"
                      step={0.01}
                      min={0.01}
                      value={metaTrader5Form.riskManagement.maxLotSize}
                      onChange={(e) => {
                        setMetaTrader5Form((prev) => ({
                          ...prev,
                          riskManagement: { ...prev.riskManagement, maxLotSize: Number(e.target.value) },
                        }));
                        setMetaTrader5Dirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max posisi terbuka</Label>
                    <Input
                      type="number"
                      min={1}
                      value={metaTrader5Form.riskManagement.maxOpenPositions}
                      onChange={(e) => {
                        setMetaTrader5Form((prev) => ({
                          ...prev,
                          riskManagement: { ...prev.riskManagement, maxOpenPositions: Number(e.target.value) },
                        }));
                        setMetaTrader5Dirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stop loss (pips)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={metaTrader5Form.riskManagement.stopLossPips}
                      onChange={(e) => {
                        setMetaTrader5Form((prev) => ({
                          ...prev,
                          riskManagement: { ...prev.riskManagement, stopLossPips: Number(e.target.value) },
                        }));
                        setMetaTrader5Dirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Take profit (pips)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={metaTrader5Form.riskManagement.takeProfitPips}
                      onChange={(e) => {
                        setMetaTrader5Form((prev) => ({
                          ...prev,
                          riskManagement: { ...prev.riskManagement, takeProfitPips: Number(e.target.value) },
                        }));
                        setMetaTrader5Dirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Batas rugi harian</Label>
                    <Input
                      type="number"
                      min={0}
                      value={metaTrader5Form.riskManagement.dailyLossLimit}
                      onChange={(e) => {
                        setMetaTrader5Form((prev) => ({
                          ...prev,
                          riskManagement: { ...prev.riskManagement, dailyLossLimit: Number(e.target.value) },
                        }));
                        setMetaTrader5Dirty(true);
                      }}
                    />
                  </div>
                </div>
              </div>

              <Button
                disabled={savingSettings || !metaTrader5Dirty}
                onClick={() =>
                  updateSettings({
                    metaTrader5: {
                      enabled: metaTrader5Form.enabled,
                      broker: metaTrader5Form.broker,
                      server: metaTrader5Form.server,
                      login: metaTrader5Form.login,
                      password: metaTrader5Form.password,
                      accountType: metaTrader5Form.accountType,
                      leverage: metaTrader5Form.leverage,
                      balance: metaTrader5Form.balance,
                      currency: metaTrader5Form.currency,
                      allowedSymbols: metaTrader5Form.allowedSymbols,
                      riskManagement: metaTrader5Form.riskManagement,
                    },
                  })
                }
              >
                {savingSettings ? <Loader2 className="size-4 animate-spin" /> : null}
                Simpan pengaturan MetaTrader 5
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aiAgent" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Bot className="size-4" aria-hidden />
                AI Trading Agent
              </CardTitle>
              <CardDescription>Konfigurasi agent trading otomatis berbasis kecerdasan buatan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Aktifkan AI Agent</p>
                  <p className="text-xs text-muted-foreground">Jalankan agent trading otomatis.</p>
                </div>
                <Switch
                  checked={aiTradingAgentForm.enabled}
                  onCheckedChange={(checked) => {
                    setAiTradingAgentForm((prev) => ({ ...prev, enabled: checked }));
                    setAiTradingAgentDirty(true);
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Nama agent</Label>
                  <Input
                    placeholder="AI Trading Agent"
                    value={aiTradingAgentForm.name}
                    onChange={(e) => {
                      setAiTradingAgentForm((prev) => ({ ...prev, name: e.target.value }));
                      setAiTradingAgentDirty(true);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Model AI</Label>
                  <Select
                    value={aiTradingAgentForm.model}
                    onValueChange={(value) => {
                      setAiTradingAgentForm((prev) => ({ ...prev, model: value }));
                      setAiTradingAgentDirty(true);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                      <SelectItem value="claude-3">Claude 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Deskripsi</Label>
                <Textarea
                  rows={2}
                  maxLength={1000}
                  placeholder="Deskripsi agent trading"
                  value={aiTradingAgentForm.description}
                  onChange={(e) => {
                    setAiTradingAgentForm((prev) => ({ ...prev, description: e.target.value }));
                    setAiTradingAgentDirty(true);
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Strategi</Label>
                  <Select
                    value={aiTradingAgentForm.strategy}
                    onValueChange={(value) => {
                      setAiTradingAgentForm((prev) => ({ ...prev, strategy: value }));
                      setAiTradingAgentDirty(true);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="momentum">Momentum</SelectItem>
                      <SelectItem value="mean_reversion">Mean Reversion</SelectItem>
                      <SelectItem value="scalping">Scalping</SelectItem>
                      <SelectItem value="swing">Swing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Level risiko</Label>
                  <Select
                    value={aiTradingAgentForm.riskLevel}
                    onValueChange={(value) => {
                      setAiTradingAgentForm((prev) => ({ ...prev, riskLevel: value }));
                      setAiTradingAgentDirty(true);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Rendah</SelectItem>
                      <SelectItem value="medium">Sedang</SelectItem>
                      <SelectItem value="high">Tinggi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Max trade/hari</Label>
                  <Input
                    type="number"
                    min={1}
                    value={aiTradingAgentForm.maxDailyTrades}
                    onChange={(e) => {
                      setAiTradingAgentForm((prev) => ({ ...prev, maxDailyTrades: Number(e.target.value) }));
                      setAiTradingAgentDirty(true);
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Min confidence (0-1)</Label>
                  <Input
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={aiTradingAgentForm.minConfidence}
                    onChange={(e) => {
                      setAiTradingAgentForm((prev) => ({ ...prev, minConfidence: Number(e.target.value) }));
                      setAiTradingAgentDirty(true);
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <Switch
                    checked={aiTradingAgentForm.autoExecute}
                    onCheckedChange={(checked) => {
                      setAiTradingAgentForm((prev) => ({ ...prev, autoExecute: checked }));
                      setAiTradingAgentDirty(true);
                    }}
                  />
                  <span className="text-sm">Eksekusi otomatis</span>
                </label>
                <label className="flex items-center gap-2">
                  <Switch
                    checked={aiTradingAgentForm.notifyOnTrade}
                    onCheckedChange={(checked) => {
                      setAiTradingAgentForm((prev) => ({ ...prev, notifyOnTrade: checked }));
                      setAiTradingAgentDirty(true);
                    }}
                  />
                  <span className="text-sm">Notifikasi setiap trade</span>
                </label>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium">Parameter Strategi</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Lookback period</Label>
                    <Input
                      type="number"
                      min={1}
                      value={aiTradingAgentForm.parameters.lookbackPeriod}
                      onChange={(e) => {
                        setAiTradingAgentForm((prev) => ({
                          ...prev,
                          parameters: { ...prev.parameters, lookbackPeriod: Number(e.target.value) },
                        }));
                        setAiTradingAgentDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Entry threshold (0-1)</Label>
                    <Input
                      type="number"
                      step={0.05}
                      min={0}
                      max={1}
                      value={aiTradingAgentForm.parameters.entryThreshold}
                      onChange={(e) => {
                        setAiTradingAgentForm((prev) => ({
                          ...prev,
                          parameters: { ...prev.parameters, entryThreshold: Number(e.target.value) },
                        }));
                        setAiTradingAgentDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Exit threshold (0-1)</Label>
                    <Input
                      type="number"
                      step={0.05}
                      min={0}
                      max={1}
                      value={aiTradingAgentForm.parameters.exitThreshold}
                      onChange={(e) => {
                        setAiTradingAgentForm((prev) => ({
                          ...prev,
                          parameters: { ...prev.parameters, exitThreshold: Number(e.target.value) },
                        }));
                        setAiTradingAgentDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Position size (%)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={aiTradingAgentForm.parameters.positionSizePercent}
                      onChange={(e) => {
                        setAiTradingAgentForm((prev) => ({
                          ...prev,
                          parameters: { ...prev.parameters, positionSizePercent: Number(e.target.value) },
                        }));
                        setAiTradingAgentDirty(true);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium">Jadwal Operasional</p>
                <div className="flex items-center gap-2 mb-3">
                  <Switch
                    checked={aiTradingAgentForm.schedule.enabled}
                    onCheckedChange={(checked) => {
                      setAiTradingAgentForm((prev) => ({
                        ...prev,
                        schedule: { ...prev.schedule, enabled: checked },
                      }));
                      setAiTradingAgentDirty(true);
                    }}
                  />
                  <span className="text-sm">Batasi jadwal operasional</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Jam mulai</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={aiTradingAgentForm.schedule.startHour}
                      onChange={(e) => {
                        setAiTradingAgentForm((prev) => ({
                          ...prev,
                          schedule: { ...prev.schedule, startHour: Number(e.target.value) },
                        }));
                        setAiTradingAgentDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Jam selesai</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={aiTradingAgentForm.schedule.endHour}
                      onChange={(e) => {
                        setAiTradingAgentForm((prev) => ({
                          ...prev,
                          schedule: { ...prev.schedule, endHour: Number(e.target.value) },
                        }));
                        setAiTradingAgentDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Zona waktu</Label>
                    <Input
                      placeholder="Asia/Jakarta"
                      value={aiTradingAgentForm.schedule.timezone}
                      onChange={(e) => {
                        setAiTradingAgentForm((prev) => ({
                          ...prev,
                          schedule: { ...prev.schedule, timezone: e.target.value },
                        }));
                        setAiTradingAgentDirty(true);
                      }}
                    />
                  </div>
                </div>
              </div>

              <Button
                disabled={savingSettings || !aiTradingAgentDirty}
                onClick={() =>
                  updateSettings({
                    aiTradingAgent: {
                      enabled: aiTradingAgentForm.enabled,
                      name: aiTradingAgentForm.name,
                      description: aiTradingAgentForm.description,
                      model: aiTradingAgentForm.model,
                      strategy: aiTradingAgentForm.strategy,
                      riskLevel: aiTradingAgentForm.riskLevel,
                      maxDailyTrades: aiTradingAgentForm.maxDailyTrades,
                      minConfidence: aiTradingAgentForm.minConfidence,
                      autoExecute: aiTradingAgentForm.autoExecute,
                      notifyOnTrade: aiTradingAgentForm.notifyOnTrade,
                      parameters: aiTradingAgentForm.parameters,
                      allowedMarkets: aiTradingAgentForm.allowedMarkets,
                      schedule: aiTradingAgentForm.schedule,
                      subAgents: settings?.aiTradingAgent?.subAgents ?? [],
                      tradingServers: settings?.aiTradingAgent?.tradingServers ?? [],
                      promptLibrary: settings?.aiTradingAgent?.promptLibrary ?? [],
                    },
                  })
                }
              >
                {savingSettings ? <Loader2 className="size-4 animate-spin" /> : null}
                Simpan pengaturan AI agent
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coinSettings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Coins className="size-4" aria-hidden />
                Pengaturan Koin
              </CardTitle>
              <CardDescription>Konfigurasi metode pembayaran, penarikan, rate konversi, dan potongan biaya.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium">Metode Pembayaran Pembelian Koin</p>
                <div className="space-y-2">
                  {coinSettingsForm.purchaseMethods.map((method, idx) => (
                    <div key={method.id} className="flex items-center justify-between rounded-md border border-border p-3">
                      <div className="flex-1">
                        <Input
                          className="mb-1 h-8 text-sm font-medium"
                          value={method.label}
                          onChange={(e) => {
                            const updated = [...coinSettingsForm.purchaseMethods];
                            updated[idx] = { ...updated[idx], label: e.target.value };
                            setCoinSettingsForm((prev) => ({ ...prev, purchaseMethods: updated }));
                            setCoinSettingsDirty(true);
                          }}
                        />
                      </div>
                      <Switch
                        checked={method.enabled}
                        onCheckedChange={(checked) => {
                          const updated = [...coinSettingsForm.purchaseMethods];
                          updated[idx] = { ...updated[idx], enabled: checked };
                          setCoinSettingsForm((prev) => ({ ...prev, purchaseMethods: updated }));
                          setCoinSettingsDirty(true);
                        }}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCoinSettingsForm((prev) => ({
                        ...prev,
                        purchaseMethods: [...prev.purchaseMethods, { id: `custom_${Date.now()}`, label: "Metode baru", enabled: true }],
                      }));
                      setCoinSettingsDirty(true);
                    }}
                  >
                    <Plus className="mr-1 size-3" /> Tambah metode
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium">Metode Penarikan Koin ke Uang</p>
                <div className="space-y-2">
                  {coinSettingsForm.withdrawMethods.map((method, idx) => (
                    <div key={method.id} className="flex items-center justify-between rounded-md border border-border p-3">
                      <div className="flex-1">
                        <Input
                          className="mb-1 h-8 text-sm font-medium"
                          value={method.label}
                          onChange={(e) => {
                            const updated = [...coinSettingsForm.withdrawMethods];
                            updated[idx] = { ...updated[idx], label: e.target.value };
                            setCoinSettingsForm((prev) => ({ ...prev, withdrawMethods: updated }));
                            setCoinSettingsDirty(true);
                          }}
                        />
                      </div>
                      <Switch
                        checked={method.enabled}
                        onCheckedChange={(checked) => {
                          const updated = [...coinSettingsForm.withdrawMethods];
                          updated[idx] = { ...updated[idx], enabled: checked };
                          setCoinSettingsForm((prev) => ({ ...prev, withdrawMethods: updated }));
                          setCoinSettingsDirty(true);
                        }}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCoinSettingsForm((prev) => ({
                        ...prev,
                        withdrawMethods: [...prev.withdrawMethods, { id: `custom_${Date.now()}`, label: "Metode baru", enabled: true }],
                      }));
                      setCoinSettingsDirty(true);
                    }}
                  >
                    <Plus className="mr-1 size-3" /> Tambah metode
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium">Rate Konversi</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">1 koin = ? rupiah (dalam satuan)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={coinSettingsForm.conversionRate}
                      onChange={(e) => {
                        setCoinSettingsForm((prev) => ({ ...prev, conversionRate: Number(e.target.value) }));
                        setCoinSettingsDirty(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {coinSettingsForm.conversionRate} koin = Rp{(coinSettingsForm.conversionRate * 10).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium">Potongan Biaya</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Biaya admin (%)</Label>
                    <Input
                      type="number"
                      step={0.1}
                      min={0}
                      max={100}
                      value={coinSettingsForm.fees.adminFeePercent}
                      onChange={(e) => {
                        setCoinSettingsForm((prev) => ({
                          ...prev,
                          fees: { ...prev.fees, adminFeePercent: Number(e.target.value) },
                        }));
                        setCoinSettingsDirty(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Potongan dari setiap transaksi</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Biaya penarikan (%)</Label>
                    <Input
                      type="number"
                      step={0.1}
                      min={0}
                      max={100}
                      value={coinSettingsForm.fees.withdrawFeePercent}
                      onChange={(e) => {
                        setCoinSettingsForm((prev) => ({
                          ...prev,
                          fees: { ...prev.fees, withdrawFeePercent: Number(e.target.value) },
                        }));
                        setCoinSettingsDirty(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Potongan saat tukar koin ke uang</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Min. penarikan (koin)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={coinSettingsForm.fees.minWithdrawCoins}
                      onChange={(e) => {
                        setCoinSettingsForm((prev) => ({
                          ...prev,
                          fees: { ...prev.fees, minWithdrawCoins: Number(e.target.value) },
                        }));
                        setCoinSettingsDirty(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Minimum koin untuk penarikan</p>
                  </div>
                </div>
              </div>

              <Button
                disabled={savingSettings || !coinSettingsDirty}
                onClick={() =>
                  updateSettings({
                    coinSettings: {
                      purchaseMethods: coinSettingsForm.purchaseMethods,
                      withdrawMethods: coinSettingsForm.withdrawMethods,
                      conversionRate: coinSettingsForm.conversionRate,
                      fees: coinSettingsForm.fees,
                    },
                  })
                }
              >
                {savingSettings ? <Loader2 className="size-4 animate-spin" /> : null}
                Simpan pengaturan koin
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blockchainApi" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Globe className="size-4" aria-hidden />
                API Blockchain
              </CardTitle>
              <CardDescription>Konfigurasi koneksi API blockchain untuk koin custom. Aktifkan untuk mengganti sistem transaksi koin dengan token blockchain.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium">Aktifkan Blockchain API</p>
                  <p className="text-xs text-muted-foreground">Transaksi koin akan menggunakan token blockchain yang dikonfigurasi di bawah.</p>
                </div>
                <Switch
                  checked={blockchainApiForm.enabled}
                  onCheckedChange={(checked) => {
                    setBlockchainApiForm((prev) => ({ ...prev, enabled: checked }));
                    setBlockchainApiDirty(true);
                  }}
                />
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium">Koneksi API</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">API Base URL</Label>
                    <Input
                      placeholder="https://api.blockchain-platform.com/v1"
                      value={blockchainApiForm.apiBaseUrl}
                      onChange={(e) => {
                        setBlockchainApiForm((prev) => ({ ...prev, apiBaseUrl: e.target.value }));
                        setBlockchainApiDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">API Key</Label>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={blockchainApiForm.apiKey}
                      onChange={(e) => {
                        setBlockchainApiForm((prev) => ({ ...prev, apiKey: e.target.value }));
                        setBlockchainApiDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Network</Label>
                    <Select
                      value={blockchainApiForm.network}
                      onValueChange={(val) => {
                        setBlockchainApiForm((prev) => ({ ...prev, network: val }));
                        setBlockchainApiDirty(true);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mainnet">Mainnet</SelectItem>
                        <SelectItem value="testnet">Testnet</SelectItem>
                        <SelectItem value="devnet">Devnet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Chain ID</Label>
                    <Input
                      placeholder="1 / 56 / 137 / dll."
                      value={blockchainApiForm.chainId}
                      onChange={(e) => {
                        setBlockchainApiForm((prev) => ({ ...prev, chainId: e.target.value }));
                        setBlockchainApiDirty(true);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium">Kontrak & Wallet</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Contract Address</Label>
                    <Input
                      placeholder="0x..."
                      value={blockchainApiForm.contractAddress}
                      onChange={(e) => {
                        setBlockchainApiForm((prev) => ({ ...prev, contractAddress: e.target.value }));
                        setBlockchainApiDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Platform Wallet Address</Label>
                    <Input
                      placeholder="0x..."
                      value={blockchainApiForm.platformWallet}
                      onChange={(e) => {
                        setBlockchainApiForm((prev) => ({ ...prev, platformWallet: e.target.value }));
                        setBlockchainApiDirty(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Wallet penerima untuk setiap transaksi koin.</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">RPC URL</Label>
                    <Input
                      placeholder="https://rpc.example.com"
                      value={blockchainApiForm.rpcUrl}
                      onChange={(e) => {
                        setBlockchainApiForm((prev) => ({ ...prev, rpcUrl: e.target.value }));
                        setBlockchainApiDirty(true);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium">Keamanan & Parameter</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Webhook Secret</Label>
                    <Input
                      type="password"
                      placeholder="whsec_..."
                      value={blockchainApiForm.webhookSecret}
                      onChange={(e) => {
                        setBlockchainApiForm((prev) => ({ ...prev, webhookSecret: e.target.value }));
                        setBlockchainApiDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gas Limit</Label>
                    <Input
                      type="number"
                      min={21000}
                      value={blockchainApiForm.gasLimit}
                      onChange={(e) => {
                        setBlockchainApiForm((prev) => ({ ...prev, gasLimit: Number(e.target.value) }));
                        setBlockchainApiDirty(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Minimum 21000</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Konfirmasi Blok</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={blockchainApiForm.confirmations}
                      onChange={(e) => {
                        setBlockchainApiForm((prev) => ({ ...prev, confirmations: Number(e.target.value) }));
                        setBlockchainApiDirty(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Jumlah blok konfirmasi</p>
                  </div>
                </div>
              </div>

              <Button
                disabled={savingSettings || !blockchainApiDirty}
                onClick={() =>
                  updateSettings({
                    blockchainApi: {
                      enabled: blockchainApiForm.enabled,
                      apiBaseUrl: blockchainApiForm.apiBaseUrl,
                      apiKey: blockchainApiForm.apiKey,
                      network: blockchainApiForm.network,
                      contractAddress: blockchainApiForm.contractAddress,
                      chainId: blockchainApiForm.chainId,
                      rpcUrl: blockchainApiForm.rpcUrl,
                      webhookSecret: blockchainApiForm.webhookSecret,
                      platformWallet: blockchainApiForm.platformWallet,
                      gasLimit: blockchainApiForm.gasLimit,
                      confirmations: blockchainApiForm.confirmations,
                    },
                  })
                }
              >
                {savingSettings ? <Loader2 className="size-4 animate-spin" /> : null}
                Simpan API Blockchain
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cryptoSettings" className="mt-4">
          <div className="flex flex-col gap-4 sm:gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bitcoin className="size-5 text-primary" />
                  Treasury Wallet Utama
                </CardTitle>
                <CardDescription>Wallet utama platform untuk menyimpan token/crypto yang akan didistribusikan ke pengguna.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {cryptoSettingsForm.treasuryWallets.length > 0 && (
                  <div className="space-y-3">
                    {cryptoSettingsForm.treasuryWallets.map((tw, idx) => (
                      <div key={tw.id} className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {tw.coinSymbol.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-semibold">{tw.label}</p>
                              <p className="text-xs text-muted-foreground">{tw.coinSymbol} — {tw.network}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={tw.enabled ? "default" : "secondary"}>{tw.enabled ? "Aktif" : "Nonaktif"}</Badge>
                            <button
                              type="button"
                              className="text-xs text-red-600 hover:underline"
                              onClick={() => {
                                setCryptoSettingsForm((prev) => ({ ...prev, treasuryWallets: prev.treasuryWallets.filter((_, i) => i !== idx) }));
                                setCryptoSettingsDirty(true);
                              }}
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Alamat Wallet</Label>
                            <Input
                              value={tw.address}
                              onChange={(e) => {
                                setCryptoSettingsForm((prev) => ({
                                  ...prev,
                                  treasuryWallets: prev.treasuryWallets.map((w, i) => i === idx ? { ...w, address: e.target.value } : w),
                                }));
                                setCryptoSettingsDirty(true);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Label</Label>
                            <Input
                              value={tw.label}
                              onChange={(e) => {
                                setCryptoSettingsForm((prev) => ({
                                  ...prev,
                                  treasuryWallets: prev.treasuryWallets.map((w, i) => i === idx ? { ...w, label: e.target.value } : w),
                                }));
                                setCryptoSettingsDirty(true);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Symbol</Label>
                            <Input
                              value={tw.coinSymbol}
                              onChange={(e) => {
                                setCryptoSettingsForm((prev) => ({
                                  ...prev,
                                  treasuryWallets: prev.treasuryWallets.map((w, i) => i === idx ? { ...w, coinSymbol: e.target.value.toUpperCase() } : w),
                                }));
                                setCryptoSettingsDirty(true);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Network</Label>
                            <Input
                              value={tw.network}
                              onChange={(e) => {
                                setCryptoSettingsForm((prev) => ({
                                  ...prev,
                                  treasuryWallets: prev.treasuryWallets.map((w, i) => i === idx ? { ...w, network: e.target.value } : w),
                                }));
                                setCryptoSettingsDirty(true);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Saldo</Label>
                            <Input
                              type="number"
                              value={tw.balance}
                              onChange={(e) => {
                                setCryptoSettingsForm((prev) => ({
                                  ...prev,
                                  treasuryWallets: prev.treasuryWallets.map((w, i) => i === idx ? { ...w, balance: Number(e.target.value) } : w),
                                }));
                                setCryptoSettingsDirty(true);
                              }}
                            />
                          </div>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={tw.enabled}
                                onChange={(e) => {
                                  setCryptoSettingsForm((prev) => ({
                                    ...prev,
                                    treasuryWallets: prev.treasuryWallets.map((w, i) => i === idx ? { ...w, enabled: e.target.checked } : w),
                                  }));
                                  setCryptoSettingsDirty(true);
                                }}
                              />
                              Aktifkan wallet ini
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-lg border border-dashed p-4">
                  <p className="mb-3 text-sm font-medium">Tambah Treasury Wallet Baru</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Symbol</Label>
                      <Input placeholder="USDT" value={newTreasuryWallet.coinSymbol} onChange={(e) => setNewTreasuryWallet((p) => ({ ...p, coinSymbol: e.target.value.toUpperCase() }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Network</Label>
                      <Input placeholder="TRC20" value={newTreasuryWallet.network} onChange={(e) => setNewTreasuryWallet((p) => ({ ...p, network: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Alamat Wallet</Label>
                      <Input placeholder="Alamat wallet blockchain" value={newTreasuryWallet.address} onChange={(e) => setNewTreasuryWallet((p) => ({ ...p, address: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input placeholder="Contoh: Treasury USDT TRC20" value={newTreasuryWallet.label} onChange={(e) => setNewTreasuryWallet((p) => ({ ...p, label: e.target.value }))} />
                    </div>
                  </div>
                  <Button
                    className="mt-3"
                    variant="outline"
                    size="sm"
                    disabled={!newTreasuryWallet.coinSymbol || !newTreasuryWallet.address}
                    onClick={() => {
                      setCryptoSettingsForm((prev) => ({
                        ...prev,
                        treasuryWallets: [...prev.treasuryWallets, {
                          id: `tw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                          coinSymbol: newTreasuryWallet.coinSymbol,
                          network: newTreasuryWallet.network,
                          address: newTreasuryWallet.address,
                          label: newTreasuryWallet.label || newTreasuryWallet.coinSymbol,
                          balance: 0,
                          enabled: true,
                        }],
                      }));
                      setNewTreasuryWallet({ coinSymbol: "", network: "", address: "", label: "" });
                      setCryptoSettingsDirty(true);
                    }}
                  >
                    <Plus className="mr-1 size-4" />
                    Tambah Wallet
                  </Button>
                </div>

                <Button
                  onClick={() => updateSettings({ cryptoSettings: cryptoSettingsForm })}
                  disabled={savingSettings || !cryptoSettingsDirty}
                >
                  {savingSettings ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Simpan Treasury Wallet
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribusi Token</CardTitle>
                <CardDescription>Pengaturan distribusi otomatis token/crypto ke pengguna.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cryptoSettingsForm.distribution.autoCreditOnDeposit}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, distribution: { ...prev.distribution, autoCreditOnDeposit: e.target.checked } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                    Otomatis kredit koin saat deposit
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cryptoSettingsForm.distribution.enableAutoSwap}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, distribution: { ...prev.distribution, enableAutoSwap: e.target.checked } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                    Aktifkan auto-swap crypto ↔ koin
                  </label>
                  <div className="space-y-1">
                    <Label>Min. konfirmasi blockchain</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={cryptoSettingsForm.distribution.minConfirmations}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, distribution: { ...prev.distribution, minConfirmations: Number(e.target.value) } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Default slippage swap (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      step={0.1}
                      value={cryptoSettingsForm.distribution.defaultSwapSlippagePercent}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, distribution: { ...prev.distribution, defaultSwapSlippagePercent: Number(e.target.value) } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Maks. penarikan crypto/hari (USD)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={cryptoSettingsForm.distribution.maxDailyWithdrawCrypto}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, distribution: { ...prev.distribution, maxDailyWithdrawCrypto: Number(e.target.value) } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Maks. swap koin/hari</Label>
                    <Input
                      type="number"
                      min={0}
                      value={cryptoSettingsForm.distribution.maxDailySwapCoins}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, distribution: { ...prev.distribution, maxDailySwapCoins: Number(e.target.value) } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => updateSettings({ cryptoSettings: cryptoSettingsForm })}
                  disabled={savingSettings || !cryptoSettingsDirty}
                >
                  {savingSettings ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Simpan Distribusi
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Biaya Global Crypto</CardTitle>
                <CardDescription>Pengaturan biaya default untuk semua transaksi crypto.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Biaya deposit (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      step={0.1}
                      value={cryptoSettingsForm.globalFees.depositFeePercent}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, globalFees: { ...prev.globalFees, depositFeePercent: Number(e.target.value) } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Biaya penarikan (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      step={0.1}
                      value={cryptoSettingsForm.globalFees.withdrawFeePercent}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, globalFees: { ...prev.globalFees, withdrawFeePercent: Number(e.target.value) } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Biaya swap (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      step={0.1}
                      value={cryptoSettingsForm.globalFees.swapFeePercent}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, globalFees: { ...prev.globalFees, swapFeePercent: Number(e.target.value) } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Min. deposit (USD)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={cryptoSettingsForm.globalFees.minDepositUsd}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, globalFees: { ...prev.globalFees, minDepositUsd: Number(e.target.value) } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Min. penarikan (USD)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={cryptoSettingsForm.globalFees.minWithdrawUsd}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, globalFees: { ...prev.globalFees, minWithdrawUsd: Number(e.target.value) } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => updateSettings({ cryptoSettings: cryptoSettingsForm })}
                  disabled={savingSettings || !cryptoSettingsDirty}
                >
                  {savingSettings ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Simpan Biaya
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notifikasi Crypto</CardTitle>
                <CardDescription>Pengaturan notifikasi untuk aktivitas crypto penting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cryptoSettingsForm.notifications.notifyOnLargeDeposit}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, notifications: { ...prev.notifications, notifyOnLargeDeposit: e.target.checked } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                    Notifikasi deposit besar
                  </label>
                  <div className="space-y-1">
                    <Label>Threshold deposit besar (USD)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={cryptoSettingsForm.notifications.largeDepositThresholdUsd}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, notifications: { ...prev.notifications, largeDepositThresholdUsd: Number(e.target.value) } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cryptoSettingsForm.notifications.notifyOnWithdraw}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, notifications: { ...prev.notifications, notifyOnWithdraw: e.target.checked } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                    Notifikasi setiap penarikan
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cryptoSettingsForm.notifications.notifyOnLowTreasury}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, notifications: { ...prev.notifications, notifyOnLowTreasury: e.target.checked } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                    Notifikasi saldo treasury rendah
                  </label>
                  <div className="space-y-1">
                    <Label>Threshold treasury rendah (USD)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={cryptoSettingsForm.notifications.lowTreasuryThresholdUsd}
                      onChange={(e) => {
                        setCryptoSettingsForm((prev) => ({ ...prev, notifications: { ...prev.notifications, lowTreasuryThresholdUsd: Number(e.target.value) } }));
                        setCryptoSettingsDirty(true);
                      }}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => updateSettings({ cryptoSettings: cryptoSettingsForm })}
                  disabled={savingSettings || !cryptoSettingsDirty}
                >
                  {savingSettings ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Simpan Notifikasi
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trialAccounts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <UserCog className="size-4" aria-hidden />
                Akun Uji Coba
              </CardTitle>
              <CardDescription>Buat akun uji coba untuk setiap tier guna menguji semua fitur platform. Nonaktifkan untuk menghapus seluruh akun uji coba sekaligus.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {trialStatus !== null && (
                <div className="rounded-lg border border-border p-4">
                  <p className="mb-3 text-sm font-medium">Status Akun Uji Coba</p>
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`inline-flex size-2 rounded-full ${trialStatus.total > 0 ? "bg-green-500" : "bg-muted-foreground"}`} />
                    <span className="text-sm">{trialStatus.total > 0 ? `${trialStatus.total} akun uji coba aktif` : "Tidak ada akun uji coba"}</span>
                  </div>
                  {trialStatus.total > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {Object.entries(trialStatus.byTier).filter(([, v]) => v.length > 0).map(([tier, accounts]) => (
                        <div key={tier} className="rounded-md border border-border px-3 py-2">
                          <p className="text-xs font-medium text-muted-foreground">{tier}</p>
                          <p className="text-lg font-semibold">{accounts.length}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium">Konfigurasi</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Jumlah akun per tier</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={trialForm.accountsPerTier}
                      onChange={(e) => {
                        setTrialForm((prev) => ({ ...prev, accountsPerTier: Number(e.target.value) }));
                        setTrialDirty(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Maksimum 10 akun per tier (8 tier)</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Password (semua akun uji coba)</Label>
                    <Input
                      type="text"
                      placeholder="Minimal 8 karakter"
                      value={trialForm.password}
                      onChange={(e) => {
                        setTrialForm((prev) => ({ ...prev, password: e.target.value }));
                        setTrialDirty(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Email: trial.[tier].[nomor]@panti.test</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={savingSettings || !trialDirty}
                  onClick={() =>
                    updateSettings({
                      trialAccounts: {
                        enabled: trialStatus !== null && trialStatus.total > 0,
                        accountsPerTier: trialForm.accountsPerTier,
                        password: trialForm.password,
                      },
                    })
                  }
                >
                  {savingSettings ? <Loader2 className="size-4 animate-spin" /> : null}
                  Simpan konfigurasi
                </Button>

                <Button
                  variant="outline"
                  disabled={trialBusy}
                  onClick={async () => {
                    setTrialBusy(true);
                    try {
                      await api("admin.trial.create");
                      toast.success("Akun uji coba berhasil dibuat.");
                      const status = await api<{ total: number; byTier: Record<string, { id: string; email: string; display_name: string }[]> }>("admin.trial.status");
                      setTrialStatus(status);
                    } catch (err) {
                      toast.error(errorText(err));
                    } finally {
                      setTrialBusy(false);
                    }
                  }}
                >
                  {trialBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Buat akun uji coba
                </Button>

                <Button
                  variant="destructive"
                  disabled={trialBusy || !trialStatus || trialStatus.total === 0}
                  onClick={async () => {
                    setTrialBusy(true);
                    try {
                      await api("admin.trial.delete");
                      toast.success("Semua akun uji coba telah dihapus.");
                      setTrialStatus({ total: 0, byTier: {} });
                    } catch (err) {
                      toast.error(errorText(err));
                    } finally {
                      setTrialBusy(false);
                    }
                  }}
                >
                  {trialBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Hapus semua akun uji coba
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apiManagement" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Key className="size-4" aria-hidden />
                Manajemen API
              </CardTitle>
              <CardDescription>Kelola API key untuk integrasi layanan eksternal seperti price feed, exchange, dan AI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Total API Terdaftar</p>
                  <p className="text-2xl font-bold">{apiManagementForm.apis.length}</p>
                </div>
                <Button onClick={() => setShowAddApi(!showAddApi)} variant="outline">
                  <Plus className="mr-2 size-4" />
                  Tambah API
                </Button>
              </div>

              {showAddApi && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="mb-3 text-sm font-semibold">Tambah API Baru</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nama API</Label>
                      <Input
                        placeholder="Contoh: CoinGecko Price API"
                        value={newApiForm.name}
                        onChange={(e) => setNewApiForm((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Provider</Label>
                      <Input
                        placeholder="Contoh: CoinGecko, Binance, OpenAI"
                        value={newApiForm.provider}
                        onChange={(e) => setNewApiForm((prev) => ({ ...prev, provider: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Deskripsi</Label>
                      <Input
                        placeholder="Deskripsi singkat fungsi API ini"
                        value={newApiForm.description}
                        onChange={(e) => setNewApiForm((prev) => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">API Key</Label>
                      <Input
                        placeholder="Masukkan API key"
                        value={newApiForm.apiKey}
                        onChange={(e) => setNewApiForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">API Secret (opsional)</Label>
                      <Input
                        type="password"
                        placeholder="Masukkan API secret jika ada"
                        value={newApiForm.apiSecret}
                        onChange={(e) => setNewApiForm((prev) => ({ ...prev, apiSecret: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Base URL</Label>
                      <Input
                        placeholder="https://api.example.com/v1"
                        value={newApiForm.baseUrl}
                        onChange={(e) => setNewApiForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Kategori</Label>
                      <Select
                        value={newApiForm.category}
                        onValueChange={(v) => setNewApiForm((prev) => ({ ...prev, category: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kategori..." />
                        </SelectTrigger>
                        <SelectContent>
                          {apiManagementForm.categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rate Limit (req/menit)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10000}
                        value={newApiForm.rateLimit}
                        onChange={(e) => setNewApiForm((prev) => ({ ...prev, rateLimit: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => {
                        if (!newApiForm.name.trim() || !newApiForm.apiKey.trim()) {
                          toast.error("Nama dan API Key wajib diisi");
                          return;
                        }
                        const newApi = {
                          id: `api_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                          name: newApiForm.name.trim(),
                          description: newApiForm.description.trim(),
                          apiKey: newApiForm.apiKey.trim(),
                          apiSecret: newApiForm.apiSecret.trim(),
                          baseUrl: newApiForm.baseUrl.trim(),
                          provider: newApiForm.provider.trim(),
                          category: newApiForm.category || "other",
                          enabled: true,
                          rateLimit: newApiForm.rateLimit,
                          lastUsed: null,
                          createdAt: new Date().toISOString(),
                        };
                        const updated = [...apiManagementForm.apis, newApi];
                        setApiManagementForm((prev) => ({ ...prev, apis: updated }));
                        setApiManagementDirty(true);
                        setNewApiForm({
                          name: "",
                          description: "",
                          apiKey: "",
                          apiSecret: "",
                          baseUrl: "",
                          provider: "",
                          category: "",
                          rateLimit: 60,
                        });
                        setShowAddApi(false);
                        toast.success("API baru ditambahkan. Klik Simpan untuk menyimpan perubahan.");
                      }}
                    >
                      Tambah
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddApi(false)}>
                      Batal
                    </Button>
                  </div>
                </div>
              )}

              {apiManagementForm.apis.length === 0 ? (
                <div className="py-8 text-center">
                  <Key className="mx-auto mb-3 size-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Belum ada API terdaftar</p>
                  <p className="mt-1 text-xs text-muted-foreground">Klik "Tambah API" untuk menambahkan integrasi baru</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiManagementForm.apis.map((apiItem) => (
                    <div
                      key={apiItem.id}
                      className={`rounded-lg border p-4 transition-colors ${
                        apiItem.enabled ? "border-green-500/30 bg-green-500/5" : "border-border bg-muted/30"
                      }`}
                    >
                      {editingApiId === apiItem.id ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Nama API</Label>
                              <Input
                                value={apiItem.name}
                                onChange={(e) => {
                                  const updated = apiManagementForm.apis.map((a) =>
                                    a.id === apiItem.id ? { ...a, name: e.target.value } : a,
                                  );
                                  setApiManagementForm((prev) => ({ ...prev, apis: updated }));
                                  setApiManagementDirty(true);
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Provider</Label>
                              <Input
                                value={apiItem.provider}
                                onChange={(e) => {
                                  const updated = apiManagementForm.apis.map((a) =>
                                    a.id === apiItem.id ? { ...a, provider: e.target.value } : a,
                                  );
                                  setApiManagementForm((prev) => ({ ...prev, apis: updated }));
                                  setApiManagementDirty(true);
                                }}
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <Label className="text-xs">Deskripsi</Label>
                              <Input
                                value={apiItem.description}
                                onChange={(e) => {
                                  const updated = apiManagementForm.apis.map((a) =>
                                    a.id === apiItem.id ? { ...a, description: e.target.value } : a,
                                  );
                                  setApiManagementForm((prev) => ({ ...prev, apis: updated }));
                                  setApiManagementDirty(true);
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">API Key</Label>
                              <Input
                                value={apiItem.apiKey}
                                onChange={(e) => {
                                  const updated = apiManagementForm.apis.map((a) =>
                                    a.id === apiItem.id ? { ...a, apiKey: e.target.value } : a,
                                  );
                                  setApiManagementForm((prev) => ({ ...prev, apis: updated }));
                                  setApiManagementDirty(true);
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">API Secret</Label>
                              <Input
                                type="password"
                                value={apiItem.apiSecret}
                                onChange={(e) => {
                                  const updated = apiManagementForm.apis.map((a) =>
                                    a.id === apiItem.id ? { ...a, apiSecret: e.target.value } : a,
                                  );
                                  setApiManagementForm((prev) => ({ ...prev, apis: updated }));
                                  setApiManagementDirty(true);
                                }}
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <Label className="text-xs">Base URL</Label>
                              <Input
                                value={apiItem.baseUrl}
                                onChange={(e) => {
                                  const updated = apiManagementForm.apis.map((a) =>
                                    a.id === apiItem.id ? { ...a, baseUrl: e.target.value } : a,
                                  );
                                  setApiManagementForm((prev) => ({ ...prev, apis: updated }));
                                  setApiManagementDirty(true);
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Kategori</Label>
                              <Select
                                value={apiItem.category}
                                onValueChange={(v) => {
                                  const updated = apiManagementForm.apis.map((a) =>
                                    a.id === apiItem.id ? { ...a, category: v } : a,
                                  );
                                  setApiManagementForm((prev) => ({ ...prev, apis: updated }));
                                  setApiManagementDirty(true);
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {apiManagementForm.categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                      {cat}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Rate Limit</Label>
                              <Input
                                type="number"
                                min={1}
                                max={10000}
                                value={apiItem.rateLimit}
                                onChange={(e) => {
                                  const updated = apiManagementForm.apis.map((a) =>
                                    a.id === apiItem.id ? { ...a, rateLimit: Number(e.target.value) } : a,
                                  );
                                  setApiManagementForm((prev) => ({ ...prev, apis: updated }));
                                  setApiManagementDirty(true);
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setEditingApiId(null);
                                toast.success("Perubahan disimpan. Klik Simpan Pengaturan untuk menyimpan permanen.");
                              }}
                            >
                              Selesai Edit
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{apiItem.name}</p>
                              <Badge variant={apiItem.enabled ? "default" : "secondary"}>
                                {apiItem.enabled ? "Aktif" : "Nonaktif"}
                              </Badge>
                              <Badge variant="outline">{apiItem.category}</Badge>
                            </div>
                            {apiItem.description && (
                              <p className="text-sm text-muted-foreground">{apiItem.description}</p>
                            )}
                            <div className="grid gap-1 text-xs sm:grid-cols-2">
                              <div>
                                <span className="text-muted-foreground">Provider: </span>
                                <span className="font-medium">{apiItem.provider || "-"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Rate Limit: </span>
                                <span className="font-medium">{apiItem.rateLimit} req/menit</span>
                              </div>
                              <div className="sm:col-span-2">
                                <span className="text-muted-foreground">Base URL: </span>
                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{apiItem.baseUrl || "-"}</code>
                              </div>
                              <div className="sm:col-span-2">
                                <span className="text-muted-foreground">API Key: </span>
                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                  {apiItem.apiKey.slice(0, 8)}...{apiItem.apiKey.slice(-4)}
                                </code>
                              </div>
                              {apiItem.lastUsed && (
                                <div className="sm:col-span-2">
                                  <span className="text-muted-foreground">Terakhir digunakan: </span>
                                  <span className="text-xs">
                                    {new Date(apiItem.lastUsed).toLocaleString("id-ID", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const updated = apiManagementForm.apis.map((a) =>
                                  a.id === apiItem.id ? { ...a, enabled: !a.enabled } : a,
                                );
                                setApiManagementForm((prev) => ({ ...prev, apis: updated }));
                                setApiManagementDirty(true);
                                toast.success(
                                  `API ${apiItem.enabled ? "dinonaktifkan" : "diaktifkan"}. Klik Simpan untuk menyimpan.`,
                                );
                              }}
                            >
                              <Power className="mr-1 size-3" />
                              {apiItem.enabled ? "Nonaktifkan" : "Aktifkan"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingApiId(apiItem.id)}
                            >
                              <Pencil className="mr-1 size-3" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(`Hapus API "${apiItem.name}"?`)) {
                                  const updated = apiManagementForm.apis.filter((a) => a.id !== apiItem.id);
                                  setApiManagementForm((prev) => ({ ...prev, apis: updated }));
                                  setApiManagementDirty(true);
                                  toast.success("API dihapus. Klik Simpan untuk menyimpan perubahan.");
                                }
                              }}
                            >
                              <Trash2 className="mr-1 size-3" />
                              Hapus
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={savingSettings || !apiManagementDirty}
                  onClick={() =>
                    updateSettings({
                      apiManagement: {
                        apis: apiManagementForm.apis,
                        categories: apiManagementForm.categories,
                      },
                    })
                  }
                >
                  {savingSettings ? <Loader2 className="size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                  Simpan Pengaturan API
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <Cloud className="mr-2 inline size-5" />
                Cloud Storage Settings
              </CardTitle>
              <CardDescription>
                Konfigurasi penyimpanan file cloud (AWS S3, DigitalOcean Spaces, MinIO, Cloudinary) dengan pre-signed URLs untuk upload langsung.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!settings ? (
                <div className="text-center text-sm text-muted-foreground">Memuat pengaturan...</div>
              ) : (
              <>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Storage Enabled</h4>
                  <p className="text-sm text-muted-foreground">Aktifkan penyimpanan cloud untuk file upload</p>
                </div>
                <Switch
                  checked={settings.storage?.enabled ?? false}
                  onCheckedChange={(checked) =>
                    updateSettings({ storage: { ...(settings.storage ?? {}), enabled: checked } })
                  }
                />
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Storage Provider</h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {(["aws_s3", "digitalocean_spaces", "minio", "cloudinary"] as const).map((provider) => (
                    <Button
                      key={provider}
                      variant={settings.storage?.provider === provider ? "default" : "outline"}
                      onClick={() => updateSettings({ storage: { ...(settings.storage ?? {}), provider } })}
                      className="justify-start"
                    >
                      {provider === "aws_s3" && "AWS S3"}
                      {provider === "digitalocean_spaces" && "DigitalOcean Spaces"}
                      {provider === "minio" && "MinIO"}
                      {provider === "cloudinary" && "Cloudinary"}
                    </Button>
                  ))}
                </div>
              </div>

              {settings.storage?.provider !== "cloudinary" && (
                <div className="space-y-4">
                  <h4 className="font-semibold">S3 Configuration</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InputField
                      label="Region"
                      value={settings.storage?.s3?.region ?? ""}
                      onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), s3: { ...(settings.storage?.s3 ?? {}), region: v } } })}
                      placeholder="ap-southeast-1"
                    />
                    <InputField
                      label="Endpoint (optional for custom S3)"
                      value={settings.storage?.s3?.endpoint ?? ""}
                      onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), s3: { ...(settings.storage?.s3 ?? {}), endpoint: v } } })}
                      placeholder="https://s3.amazonaws.com"
                    />
                    <InputField
                      label="Access Key ID"
                      value={settings.storage?.s3?.accessKeyId ?? ""}
                      onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), s3: { ...(settings.storage?.s3 ?? {}), accessKeyId: v } } })}
                      placeholder="AKIA..."
                      type="password"
                    />
                    <InputField
                      label="Secret Access Key"
                      value={settings.storage?.s3?.secretAccessKey ?? ""}
                      onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), s3: { ...(settings.storage?.s3 ?? {}), secretAccessKey: v } } })}
                      placeholder="••••••••"
                      type="password"
                    />
                    <InputField
                      label="Public Bucket Name"
                      value={settings.storage?.s3?.publicBucket ?? ""}
                      onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), s3: { ...(settings.storage?.s3 ?? {}), publicBucket: v } } })}
                      placeholder="my-public-bucket"
                    />
                    <InputField
                      label="Private Bucket Name"
                      value={settings.storage?.s3?.privateBucket ?? ""}
                      onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), s3: { ...(settings.storage?.s3 ?? {}), privateBucket: v } } })}
                      placeholder="my-private-bucket"
                    />
                    <InputField
                      label="CDN URL (optional)"
                      value={settings.storage?.s3?.cdnUrl ?? ""}
                      onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), s3: { ...(settings.storage?.s3 ?? {}), cdnUrl: v } } })}
                      placeholder="https://cdn.example.com"
                    />
                    <InputField
                      label="Max File Size (MB)"
                      value={String(settings.storage?.s3?.maxFileSizeMB ?? 10)}
                      onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), s3: { ...(settings.storage?.s3 ?? {}), maxFileSizeMB: Number(v) || 10 } } })}
                      type="number"
                    />
                  </div>
                </div>
              )}

              {settings.storage?.provider === "cloudinary" && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Cloudinary Configuration</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InputField
                      label="Cloud Name"
                      value={settings.storage?.cloudinary?.cloudName ?? ""}
                      onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), cloudinary: { ...(settings.storage?.cloudinary ?? {}), cloudName: v } } })}
                      placeholder="my-cloud"
                    />
                    <InputField
                      label="API Key"
                      value={settings.storage?.cloudinary?.apiKey ?? ""}
                      onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), cloudinary: { ...(settings.storage?.cloudinary ?? {}), apiKey: v } } })}
                      placeholder="123456789012345"
                    />
                    <InputField
                      label="API Secret"
                      value={settings.storage?.cloudinary?.apiSecret ?? ""}
                      onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), cloudinary: { ...(settings.storage?.cloudinary ?? {}), apiSecret: v } } })}
                      placeholder="••••••••"
                      type="password"
                    />
                    <InputField
                      label="Upload Preset"
                      value={settings.storage?.cloudinary?.uploadPreset ?? ""}
                      onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), cloudinary: { ...(settings.storage?.cloudinary ?? {}), uploadPreset: v } } })}
                      placeholder="panti_janda"
                    />
                    <InputField
                      label="Folder"
                      value={settings.storage?.cloudinary?.folder ?? ""}
                      onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), cloudinary: { ...(settings.storage?.cloudinary ?? {}), folder: v } } })}
                      placeholder="panti-janda"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="font-semibold">Media Optimization</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Optimization</p>
                    <p className="text-sm text-muted-foreground">Auto compress, WebP conversion, thumbnail generation</p>
                  </div>
                  <Switch
                    checked={settings.storage?.optimization?.enabled ?? true}
                    onCheckedChange={(checked) =>
                      updateSettings({ storage: { ...(settings.storage ?? {}), optimization: { ...(settings.storage?.optimization ?? {}), enabled: checked } } })
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Optimization Provider</label>
                    <select
                      value={settings.storage?.optimization?.provider ?? "cloudinary"}
                      onChange={(e) =>
                        updateSettings({ storage: { ...(settings.storage ?? {}), optimization: { ...(settings.storage?.optimization ?? {}), provider: e.target.value as any } } })
                      }
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                    >
                      <option value="cloudinary">Cloudinary</option>
                      <option value="imagekit">ImageKit</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Security Settings</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <InputField
                    label="Pre-signed URL Expiry (seconds)"
                    value={String(settings.storage?.security?.presignedUrlExpirySeconds ?? 300)}
                    onChange={(v) => updateSettings({ storage: { ...(settings.storage ?? {}), security: { ...(settings.storage?.security ?? {}), presignedUrlExpirySeconds: Number(v) || 300 } } })}
                    type="number"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Require Ownership for Private Files</p>
                    <p className="text-sm text-muted-foreground">Only allow access to private files after verifying ownership</p>
                  </div>
                  <Switch
                    checked={settings.storage?.security?.requireOwnershipForPrivate ?? true}
                    onCheckedChange={(checked) =>
                      updateSettings({ storage: { ...(settings.storage ?? {}), security: { ...(settings.storage?.security ?? {}), requireOwnershipForPrivate: checked } } })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={savingSettings}
                  onClick={() =>
                    updateSettings({
                      storage: settings.storage,
                    })
                  }
                >
                  {savingSettings ? <Loader2 className="size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                  Simpan Pengaturan Storage
                </Button>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RejectDialog
        profile={rejectTarget}
        open={rejectTarget !== null}
        onOpenChange={(open) => (!open ? setRejectTarget(null) : null)}
        onDone={load}
      />

      <ApprovalDecisionDialog
        target={approvalDecision}
        onOpenChange={(open) => (!open ? setApprovalDecision(null) : null)}
        onDone={load}
      />
    </div>
  );
}
