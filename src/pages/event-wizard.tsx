import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  ImagePlus,
  Loader2,
  Plus,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ApiError, api, errorMissing, errorText, PUBLISH_MISSING_LABEL, PUBLISH_READY_LABEL } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link, useQueryParam, useRoute } from "@/lib/router";
import {
  APPROVAL_REASON_LABEL,
  AUDIENCE_META,
  BUDGET_CATEGORY_META,
  EVENT_CATEGORY_META,
  EVENT_LOCATION_TYPE_LABEL,
  EVENT_STATUS_META,
  EVENT_TEMPLATES,
  FUNDING_SOURCE_META,
  ROLE_RANK,
  VIRTUAL_PLATFORM_LABEL,
} from "@/lib/constants";
import type { EventTemplate } from "@/lib/constants";
import { formatRupiah, toLocalInputValue } from "@/lib/format";
import type {
  Audience,
  BudgetCategory,
  ChecklistPriority,
  EventCategory,
  EventLocationType,
  EventManageData,
  FundingSourceType,
  VirtualPlatform,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AccountGate, EmptyState, LoadingGrid, PageBanner, SectionHeading } from "@/components/common";
import { usePresignedUpload } from "@/hooks/use-presigned-upload";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const AUDIENCES = Object.keys(AUDIENCE_META) as Audience[];
const CATEGORIES = Object.keys(EVENT_CATEGORY_META) as EventCategory[];
const BUDGET_CATEGORIES = Object.keys(BUDGET_CATEGORY_META) as BudgetCategory[];
const FUNDING_TYPES = Object.keys(FUNDING_SOURCE_META) as FundingSourceType[];
const LOCATION_TYPES: EventLocationType[] = ["physical", "virtual", "hybrid"];
const PLATFORMS: VirtualPlatform[] = ["internal", "zoom", "google_meet"];
const PRIORITIES: ChecklistPriority[] = ["high", "medium", "low"];
const TIMEZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"];
const TIMEZONE_LABEL: Record<string, string> = {
  "Asia/Jakarta": "WIB — Asia/Jakarta",
  "Asia/Makassar": "WITA — Asia/Makassar",
  "Asia/Jayapura": "WIT — Asia/Jayapura",
};

const STEPS = [
  { id: "basic", label: "Info Dasar" },
  { id: "schedule", label: "Jadwal & Lokasi" },
  { id: "plan", label: "Perencanaan" },
  { id: "budget", label: "Anggaran" },
  { id: "tickets", label: "Tiket" },
  { id: "review", label: "Tinjau & Publikasi" },
];

interface BasicDraft {
  title: string;
  audience: Audience;
  description: string;
  category: EventCategory;
  tags: string;
  coverImage: string;
}

interface ScheduleDraft {
  startsAt: string;
  endsAt: string;
  timezone: string;
  locationType: EventLocationType;
  venueName: string;
  venueAddress: string;
  venueMapsUrl: string;
  virtualPlatform: VirtualPlatform | "";
  virtualUrl: string;
  capacity: string;
  permitRequired: boolean;
}

interface PlanDraft {
  targetAudience: string;
  objectives: string;
  requirements: string;
  marketingPlan: string;
  promotionChannels: string;
  riskAssessment: string;
}

interface DraftItem {
  key: string;
  category: BudgetCategory;
  name: string;
  quantity: string;
  unit: string;
  estimatedCost: string;
  notes: string;
}

interface DraftSource {
  key: string;
  type: FundingSourceType;
  name: string;
  amount: string;
  notes: string;
}

interface DraftSession {
  key: string;
  title: string;
  startsAt: string;
  endsAt: string;
  room: string;
  description: string;
}

interface DraftChecklist {
  key: string;
  title: string;
  category: BudgetCategory;
  priority: ChecklistPriority;
  dueAt: string;
}

interface DraftTier {
  key: string;
  name: string;
  price: string;
  quota: string;
  benefits: string;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const emptyBasic = (): BasicDraft => ({
  title: "",
  audience: "anggota",
  description: "",
  category: "other",
  tags: "",
  coverImage: "",
});

const emptySchedule = (): ScheduleDraft => ({
  startsAt: "",
  endsAt: "",
  timezone: "Asia/Jakarta",
  locationType: "physical",
  venueName: "",
  venueAddress: "",
  venueMapsUrl: "",
  virtualPlatform: "",
  virtualUrl: "",
  capacity: "",
  permitRequired: false,
});

const emptyPlan = (): PlanDraft => ({
  targetAudience: "",
  objectives: "",
  requirements: "",
  marketingPlan: "",
  promotionChannels: "",
  riskAssessment: "",
});

const itemCost = (item: DraftItem): number =>
  Math.round((Number(item.quantity) || 0) * (Number(item.estimatedCost) || 0));

const toIsoOrNull = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function dayOffsetToLocal(value: string, dayOffset?: number): string {
  if (!value || dayOffset === undefined) return "";
  const base = new Date(value);
  if (Number.isNaN(base.getTime())) return "";
  const target = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, 9, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
}

function StepBadge({ index, current }: { index: number; current: number }) {
  if (index < current) return <CheckCircle2 className="size-3.5" aria-hidden />;
  return <span className="text-[11px] font-bold">{index + 1}</span>;
}

export function EventWizardPage() {
  const { account } = useAuth();
  const { navigate } = useRoute();
  const resumeId = useQueryParam("id");
  const rank = account ? ROLE_RANK[account.role] ?? 0 : 0;

  const [step, setStep] = useState(0);
  const [eventId, setEventId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<string>("draft");
  const [hydrating, setHydrating] = useState(Boolean(resumeId));
  const [basic, setBasic] = useState<BasicDraft>(emptyBasic);
  const [schedule, setSchedule] = useState<ScheduleDraft>(emptySchedule);
  const [plan, setPlan] = useState<PlanDraft>(emptyPlan);
  const [budgetItems, setBudgetItems] = useState<DraftItem[]>([]);
  const [fundingSources, setFundingSources] = useState<DraftSource[]>([]);
  const [sessions, setSessions] = useState<DraftSession[]>([]);
  const [checklists, setChecklists] = useState<DraftChecklist[]>([]);
  const [ticketing, setTicketing] = useState(false);
  const [tiers, setTiers] = useState<DraftTier[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const eventIdRef = useRef<string | null>(null);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const buildPayloadRef = useRef<() => Record<string, unknown>>(() => ({}));
  const snapshotRef = useRef("");
  const stateRef = useRef({ dirty: false, title: "" });
  const markCleanRef = useRef(false);
  const hydratedRef = useRef(false);

  const applyResume = useCallback((data: EventManageData) => {
    const event = data.event;
    markCleanRef.current = true;
    eventIdRef.current = event.id;
    setEventId(event.id);
    setDraftStatus(event.status);
    setBasic({
      title: event.title,
      audience: event.audience,
      description: event.description ?? "",
      category: event.category,
      tags: (event.tags ?? []).join(", "),
      coverImage: event.coverImage ?? "",
    });
    setSchedule({
      startsAt: toLocalInputValue(event.startsAt),
      endsAt: toLocalInputValue(event.endsAt),
      timezone: event.timezone ?? "Asia/Jakarta",
      locationType: event.locationType,
      venueName: event.venueName ?? "",
      venueAddress: event.venueAddress ?? "",
      venueMapsUrl: event.venueMapsUrl ?? "",
      virtualPlatform: event.virtualPlatform ?? "",
      virtualUrl: event.virtualUrl ?? "",
      capacity: event.capacity !== null && event.capacity !== undefined ? String(event.capacity) : "",
      permitRequired: Boolean(event.permitRequired),
    });
    setPlan({
      targetAudience: data.plan?.targetAudience ?? "",
      objectives: data.plan?.objectives ?? "",
      requirements: data.plan?.requirements ?? "",
      marketingPlan: data.plan?.marketingPlan ?? "",
      promotionChannels: (data.plan?.promotionChannels ?? []).join(", "),
      riskAssessment: data.plan?.riskAssessment ?? "",
    });
    setBudgetItems(
      data.budgetItems.map((item) => ({
        key: uid(),
        category: item.category,
        name: item.name,
        quantity: String(item.quantity),
        unit: item.unit ?? "",
        estimatedCost: String(item.estimatedCost),
        notes: item.notes ?? "",
      })),
    );
    setFundingSources(
      data.fundingSources.map((source) => ({
        key: uid(),
        type: source.type,
        name: source.name,
        amount: String(source.amount),
        notes: source.notes ?? "",
      })),
    );
    setSessions(
      data.sessions.map((session) => ({
        key: uid(),
        title: session.title,
        startsAt: toLocalInputValue(session.startsAt),
        endsAt: toLocalInputValue(session.endsAt),
        room: session.room ?? "",
        description: session.description ?? "",
      })),
    );
    setChecklists(
      data.checklists.map((item) => ({
        key: uid(),
        title: item.title,
        category: (item.category && BUDGET_CATEGORY_META[item.category] ? item.category : "OTHER") as BudgetCategory,
        priority: item.priority ?? "medium",
        dueAt: item.dueAt ? item.dueAt.slice(0, 10) : "",
      })),
    );
    setTiers(
      data.tiers.map((tier) => ({
        key: uid(),
        name: tier.name,
        price: String(tier.price),
        quota: String(tier.quota),
        benefits: tier.benefits ?? "",
      })),
    );
    setTicketing(data.tiers.length > 0);
  }, []);

  useEffect(() => {
    if (!resumeId || !account || hydratedRef.current) return;
    hydratedRef.current = true;
    void (async () => {
      try {
        const data = await api<EventManageData>("events.manage.get", { id: resumeId });
        applyResume(data);
      } catch (error) {
        toast.error(errorText(error));
      } finally {
        setHydrating(false);
      }
    })();
  }, [resumeId, account, applyResume]);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        basic,
        schedule,
        plan,
        budgetItems,
        fundingSources,
        sessions,
        checklists,
        ticketing,
        tiers,
      }),
    [basic, schedule, plan, budgetItems, fundingSources, sessions, checklists, ticketing, tiers],
  );
  const lastSnapshotRef = useRef(snapshot);
  useEffect(() => {
    if (markCleanRef.current) {
      markCleanRef.current = false;
      lastSnapshotRef.current = snapshot;
      return;
    }
    if (lastSnapshotRef.current === snapshot) return;
    lastSnapshotRef.current = snapshot;
    setDirty(true);
  }, [snapshot]);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);
  useEffect(() => {
    stateRef.current = { dirty, title: basic.title.trim() };
  }, [dirty, basic.title]);

  const totalBudget = useMemo(() => budgetItems.reduce((sum, item) => sum + itemCost(item), 0), [budgetItems]);
  const totalFunding = useMemo(
    () => fundingSources.reduce((sum, source) => sum + Math.round(Number(source.amount) || 0), 0),
    [fundingSources],
  );
  const deficit = Math.max(0, totalBudget - totalFunding);
  const expectedTicketRevenue = useMemo(
    () => tiers.reduce((sum, tier) => sum + Math.round((Number(tier.price) || 0) * (Number(tier.quota) || 0)), 0),
    [tiers],
  );

  const pieData = useMemo(() => {
    const byCategory = new Map<BudgetCategory, number>();
    for (const item of budgetItems) {
      const value = itemCost(item);
      if (!item.name.trim() || value <= 0) continue;
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + value);
    }
    return Array.from(byCategory, ([category, value]) => ({
      name: BUDGET_CATEGORY_META[category]?.label ?? category,
      value,
      color: BUDGET_CATEGORY_META[category]?.color ?? "#94a3b8",
    }));
  }, [budgetItems]);

  const approvalReasons = useMemo(() => {
    const reasons: string[] = [];
    if (fundingSources.some((source) => source.type === "PLATFORM_FUND" && Number(source.amount) > 0)) {
      reasons.push("platform_fund");
    }
    if (fundingSources.some((source) => source.type === "SPONSORSHIP" && Number(source.amount) > 0)) {
      reasons.push("sponsorship");
    }
    if ((Number(schedule.capacity) || 0) > 1000) reasons.push("audience_over_1000");
    if (basic.category === "charity") reasons.push("charity_category");
    if (basic.category === "conference" && schedule.permitRequired) reasons.push("conference_permit");
    return reasons;
  }, [fundingSources, schedule.capacity, schedule.permitRequired, basic.category]);

  const readiness = useMemo(() => {
    const validItems = budgetItems.filter((item) => item.name.trim());
    const validSessions = sessions.filter((session) => session.title.trim());
    return {
      plan: Boolean(plan.targetAudience.trim() && plan.objectives.trim()),
      budget_items: validItems.length > 0,
      funding_deficit: validItems.length > 0 && totalFunding < totalBudget,
      rundown: validSessions.length > 0,
    };
  }, [budgetItems, sessions, plan, totalFunding, totalBudget]);

  const buildPayload = useCallback(
    () => ({
      eventId: eventIdRef.current ?? undefined,
      basic: {
        title: basic.title.trim(),
        audience: basic.audience,
        description: basic.description.trim(),
        category: basic.category,
        tags: basic.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        coverImage: basic.coverImage || undefined,
      },
      schedule: {
        startsAt: schedule.startsAt ? new Date(schedule.startsAt).toISOString() : undefined,
        endsAt: toIsoOrNull(schedule.endsAt),
        timezone: schedule.timezone,
        locationType: schedule.locationType,
        venueName: schedule.venueName.trim(),
        venueAddress: schedule.venueAddress.trim(),
        venueMapsUrl: schedule.venueMapsUrl.trim(),
        virtualPlatform: schedule.virtualPlatform || null,
        virtualUrl: schedule.virtualUrl.trim(),
        capacity: schedule.capacity ? Number(schedule.capacity) : null,
        permitRequired: schedule.permitRequired,
      },
      plan: {
        targetAudience: plan.targetAudience.trim(),
        objectives: plan.objectives.trim(),
        requirements: plan.requirements.trim(),
        marketingPlan: plan.marketingPlan.trim(),
        promotionChannels: plan.promotionChannels
          .split(",")
          .map((channel) => channel.trim())
          .filter(Boolean),
        riskAssessment: plan.riskAssessment.trim(),
      },
      sessions: sessions
        .filter((session) => session.title.trim())
        .map((session, index) => ({
          title: session.title.trim(),
          description: session.description.trim() || null,
          startsAt: toIsoOrNull(session.startsAt),
          endsAt: toIsoOrNull(session.endsAt),
          room: session.room.trim() || null,
          orderIndex: index,
        })),
      checklist: checklists
        .filter((item) => item.title.trim())
        .map((item, index) => ({
          title: item.title.trim(),
          category: item.category,
          priority: item.priority,
          dueAt: toIsoOrNull(item.dueAt),
          orderIndex: index,
        })),
      budget: {
        items: budgetItems
          .filter((item) => item.name.trim())
          .map((item) => ({
            category: item.category,
            name: item.name.trim(),
            quantity: Number(item.quantity) || 0,
            unit: item.unit.trim() || null,
            estimatedCost: Math.round(Number(item.estimatedCost) || 0),
            notes: item.notes.trim() || null,
          })),
        sources: fundingSources
          .filter((source) => source.name.trim())
          .map((source) => ({
            type: source.type,
            name: source.name.trim(),
            amount: Math.round(Number(source.amount) || 0),
            notes: source.notes.trim() || null,
          })),
      },
      tiers: tiers
        .filter((tier) => tier.name.trim())
        .map((tier) => ({
          name: tier.name.trim(),
          price: Math.round(Number(tier.price) || 0),
          quota: Math.round(Number(tier.quota) || 0),
          benefits: tier.benefits.trim() || null,
        })),
    }),
    [basic, schedule, plan, sessions, checklists, budgetItems, fundingSources, tiers],
  );

  useEffect(() => {
    buildPayloadRef.current = buildPayload;
  }, [buildPayload]);

  const saveDraft = useCallback((options?: { silent?: boolean }): Promise<string | null> => {
    const task = saveChainRef.current.then(async () => {
      const payload = buildPayloadRef.current();
      const title = String((payload.basic as { title?: string })?.title ?? "");
      if (title.length < 3) return null;
      const snapshotAtSave = snapshotRef.current;
      setSaveState("saving");
      try {
        const res = await api<{ eventId: string; status: string }>("events.wizard.save", payload);
        eventIdRef.current = res.eventId;
        setEventId(res.eventId);
        setDraftStatus(res.status);
        setSaveState("saved");
        setLastSavedAt(new Date());
        if (snapshotRef.current === snapshotAtSave) setDirty(false);
        return res.eventId;
      } catch (error) {
        setSaveState("error");
        if (!options?.silent) toast.error(errorText(error));
        return null;
      }
    });
    saveChainRef.current = task.catch(() => undefined);
    return task;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = stateRef.current;
      if (!current.dirty || current.title.length < 3) return;
      void saveDraft({ silent: true });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [saveDraft]);

  const stepError = useCallback(
    (index: number): string | null => {
      if (index === 0) {
        if (basic.title.trim().length < 3) return "Judul event minimal 3 karakter.";
        if (basic.description.trim().length < 10) return "Deskripsi minimal 10 karakter agar peserta memahami acara.";
      }
      if (index === 1) {
        if (!schedule.startsAt) return "Waktu mulai wajib diisi.";
        if (schedule.endsAt && new Date(schedule.endsAt).getTime() <= new Date(schedule.startsAt).getTime()) {
          return "Waktu selesai harus setelah waktu mulai.";
        }
        if (
          (schedule.locationType === "virtual" || schedule.locationType === "hybrid") &&
          !schedule.virtualPlatform
        ) {
          return "Pilih platform siaran untuk event online.";
        }
      }
      if (index === 2) {
        if (plan.targetAudience.trim().length < 5) return "Target peserta minimal 5 karakter.";
        if (plan.objectives.trim().length < 10) return "Tujuan acara minimal 10 karakter.";
      }
      if (index === 3) {
        if (!budgetItems.some((item) => item.name.trim())) return "Tambahkan minimal satu item anggaran.";
      }
      return null;
    },
    [basic.title, basic.description, schedule, plan, budgetItems],
  );

  const goNext = () => {
    const error = stepError(step);
    if (error) {
      setSectionError(error);
      toast.error(error);
      return;
    }
    setSectionError(null);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      void saveDraft({ silent: true });
    }
  };

  const goBack = () => {
    setSectionError(null);
    if (step > 0) setStep(step - 1);
  };

  const applyTemplate = (template: EventTemplate) => {
    setBasic((current) => ({
      ...current,
      category: template.category as EventCategory,
      description: current.description.trim().length >= 10 ? current.description : template.description,
    }));
    setChecklists((current) => {
      const existing = new Set(current.map((item) => item.title.trim().toLowerCase()));
      const additions = template.checklist
        .filter((item) => !existing.has(item.title.trim().toLowerCase()))
        .map((item) => ({
          key: uid(),
          title: item.title,
          category: (item.category as BudgetCategory) ?? "OTHER",
          priority: item.priority,
          dueAt: dayOffsetToLocal(schedule.startsAt, item.dayOffset),
        }));
      return [...current, ...additions];
    });
    setBudgetItems((current) => {
      const existing = new Set(current.map((item) => item.name.trim().toLowerCase()));
      const additions = template.budget
        .filter((item) => !existing.has(item.name.trim().toLowerCase()))
        .map((item) => ({
          key: uid(),
          category: item.category as BudgetCategory,
          name: item.name,
          quantity: String(item.quantity),
          unit: item.unit,
          estimatedCost: String(item.estimatedCost),
          notes: "",
        }));
      return [...current, ...additions];
    });
    toast.success(`Template ${template.name} diterapkan — cek langkah Perencanaan & Anggaran.`);
  };

  const autoChecklist = () => {
    const template =
      EVENT_TEMPLATES.find((item) => item.category === basic.category) ??
      EVENT_TEMPLATES.find((item) => item.id === "meetup") ??
      EVENT_TEMPLATES[0];
    setChecklists((current) => {
      const existing = new Set(current.map((item) => item.title.trim().toLowerCase()));
      const additions = template.checklist
        .filter((item) => !existing.has(item.title.trim().toLowerCase()))
        .map((item) => ({
          key: uid(),
          title: item.title,
          category: (item.category as BudgetCategory) ?? "OTHER",
          priority: item.priority,
          dueAt: dayOffsetToLocal(schedule.startsAt, item.dayOffset),
        }));
      if (!additions.length) {
        toast.info("Checklist sudah lengkap untuk template ini.");
        return current;
      }
      toast.success(`${additions.length} checklist ditambahkan dari template ${template.name}.`);
      return [...current, ...additions];
    });
  };

  const publish = async () => {
    for (let index = 0; index <= 3; index += 1) {
      const error = stepError(index);
      if (error) {
        setStep(index);
        setSectionError(error);
        toast.error(error);
        return;
      }
    }
    setMissing([]);
    setPublishing(true);
    try {
      const id = await saveDraft({ silent: false });
      if (!id) return;
      const res = await api<{ status: string; reasons?: string[] }>("events.publish", { id });
      if (res.status === "published") {
        toast.success("Event berhasil dipublikasikan!");
      } else {
        toast.info("Event menunggu persetujuan admin sebelum tampil ke peserta.");
      }
      navigate(`/event/${id}/kelola`);
    } catch (error) {
      if (error instanceof ApiError && error.code === "publish_incomplete") {
        const list = errorMissing(error);
        setMissing(list.length ? list : ["plan"]);
        toast.error("Event belum bisa dipublikasikan. Lengkapi item yang ditandai merah.");
      } else if (error instanceof ApiError && error.code === "pending_approval") {
        toast.info("Event ini sedang menunggu persetujuan admin.");
      } else {
        toast.error(errorText(error));
      }
    } finally {
      setPublishing(false);
    }
  };

  if (!account) {
    return (
      <AccountGate
        title="Masuk untuk membuat event"
        description="Wizard perencanaan & anggaran tersedia untuk anggota terverifikasi Panti Janda."
      />
    );
  }

  if (rank < 2) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <EmptyState
          title="Akun belum terverifikasi"
          description="Hanya anggota terverifikasi yang dapat membuat event. Selesaikan verifikasi profil Anda terlebih dahulu."
          action={
            <Button asChild variant="outline">
              <Link to="/dasbor">Ke dasbor</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const isVirtualish = schedule.locationType === "virtual" || schedule.locationType === "hybrid";
  const isPhysicalish = schedule.locationType === "physical" || schedule.locationType === "hybrid";
  const statusMeta = EVENT_STATUS_META[draftStatus] ?? EVENT_STATUS_META.draft;

  if (hydrating) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <LoadingGrid count={4} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <PageBanner art="/images/wajah-sosialita.webp">
        <SectionHeading
          eyebrow="Wizard Event"
          title={eventId ? "Lanjutkan draf event" : "Buat event baru"}
          description="Enam langkah terstruktur: info dasar, jadwal & lokasi, perencanaan, anggaran, tiket, lalu publikasi. Draf tersimpan otomatis setiap 30 detik."
        />
      </PageBanner>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ol className="flex flex-wrap items-center gap-2">
            {STEPS.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (index < step) {
                      setSectionError(null);
                      setStep(index);
                    }
                  }}
                  disabled={index > step}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    index === step && "border-primary bg-primary text-primary-foreground",
                    index < step && "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
                    index > step && "border-border bg-secondary/40 text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full",
                      index === step ? "bg-primary-foreground/20" : index < step ? "bg-emerald-200/70" : "bg-secondary",
                    )}
                  >
                    <StepBadge index={index} current={step} />
                  </span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium", statusMeta.tone)}>
              {statusMeta.label}
            </span>
            <span className="inline-flex items-center gap-1">
              {saveState === "saving" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> Menyimpan…
                </>
              ) : saveState === "error" ? (
                <>
                  <XCircle className="size-3.5 text-destructive" aria-hidden /> Gagal menyimpan draf
                </>
              ) : lastSavedAt ? (
                <>
                  <Save className="size-3.5" aria-hidden />
                  Tersimpan {lastSavedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </>
              ) : (
                "Draf tersimpan otomatis"
              )}
            </span>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {sectionError ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <CircleAlert className="size-4 text-destructive" aria-hidden />
          {sectionError}
        </div>
      ) : null}

      {step === 0 ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold">Mulai dari template</h3>
                <p className="text-sm text-muted-foreground">
                  Template mengisi kategori, checklist kerja, dan item anggaran secara otomatis — bisa diubah kapan saja.
                </p>
              </div>
              <Sparkles className="size-5 text-accent-foreground" aria-hidden />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {EVENT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="flex h-full flex-col gap-1.5 rounded-2xl border border-border bg-secondary/30 p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/60"
                >
                  <span className="text-2xl" aria-hidden>
                    {template.emoji}
                  </span>
                  <span className="font-display text-sm font-semibold">{template.name}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{template.description}</span>
                  <span className="mt-1 text-xs font-medium text-primary">
                    {template.checklist.length} checklist · {template.budget.length} item anggaran
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h3 className="font-display text-lg font-semibold">Info dasar</h3>
            <div className="space-y-2">
              <Label htmlFor="wz-title">Judul event *</Label>
              <Input
                id="wz-title"
                value={basic.title}
                maxLength={140}
                onChange={(event) => setBasic((current) => ({ ...current, title: event.target.value }))}
                placeholder="Seminar kemandirian ekonomi keluarga"
              />
              <p className="text-xs text-muted-foreground">
                Minimal 3 karakter. {basic.title.trim().length}/140
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Akses peserta *</Label>
                <Select
                  value={basic.audience}
                  onValueChange={(value) => setBasic((current) => ({ ...current, audience: value as Audience }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCES.map((key) => (
                      <SelectItem key={key} value={key} disabled={key === "undangan" && rank < 4}>
                        {AUDIENCE_META[key].label} — {AUDIENCE_META[key].hint}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kategori *</Label>
                <Select
                  value={basic.category}
                  onValueChange={(value) => setBasic((current) => ({ ...current, category: value as EventCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((key) => (
                      <SelectItem key={key} value={key}>
                        {EVENT_CATEGORY_META[key].emoji} {EVENT_CATEGORY_META[key].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {basic.category === "charity" ? (
                  <p className="text-xs text-amber-700">Kategori amal perlu persetujuan admin sebelum publikasi.</p>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-desc">Deskripsi *</Label>
              <Textarea
                id="wz-desc"
                rows={4}
                maxLength={1500}
                value={basic.description}
                onChange={(event) => setBasic((current) => ({ ...current, description: event.target.value }))}
                placeholder="Jelaskan tujuan acara, siapa yang bisa ikut, dan apa yang akan didapat peserta."
              />
              <p className="text-xs text-muted-foreground">Minimal 10 karakter. {basic.description.trim().length}/1500</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-tags">Tag pencarian (opsional)</Label>
              <Input
                id="wz-tags"
                value={basic.tags}
                onChange={(event) => setBasic((current) => ({ ...current, tags: event.target.value }))}
                placeholder="kewirausahaan, pelatihan, gratis"
              />
              <p className="text-xs text-muted-foreground">Pisahkan dengan koma.</p>
            </div>
            <CoverUpload
              value={basic.coverImage}
              onChange={(value) => setBasic((current) => ({ ...current, coverImage: value }))}
            />
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h3 className="font-display text-lg font-semibold">Jadwal & lokasi</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wz-start">Mulai *</Label>
              <Input
                id="wz-start"
                type="datetime-local"
                value={schedule.startsAt}
                onChange={(event) => setSchedule((current) => ({ ...current, startsAt: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-end">Selesai</Label>
              <Input
                id="wz-end"
                type="datetime-local"
                value={schedule.endsAt}
                onChange={(event) => setSchedule((current) => ({ ...current, endsAt: event.target.value }))}
              />
              {schedule.endsAt &&
              schedule.startsAt &&
              new Date(schedule.endsAt).getTime() <= new Date(schedule.startsAt).getTime() ? (
                <p className="text-xs text-destructive">Waktu selesai harus setelah waktu mulai.</p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Zona waktu</Label>
              <Select
                value={schedule.timezone}
                onValueChange={(value) => setSchedule((current) => ({ ...current, timezone: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {TIMEZONE_LABEL[zone] ?? zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-capacity">Kuota peserta</Label>
              <Input
                id="wz-capacity"
                type="number"
                min={1}
                value={schedule.capacity}
                onChange={(event) => setSchedule((current) => ({ ...current, capacity: event.target.value }))}
                placeholder="Kosongkan jika tidak dibatasi"
              />
              {(Number(schedule.capacity) || 0) > 1000 ? (
                <p className="text-xs text-amber-700">Lebih dari 1.000 peserta perlu persetujuan admin.</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Format acara *</Label>
            <div className="flex flex-wrap gap-2">
              {LOCATION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSchedule((current) => ({ ...current, locationType: type }))}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    schedule.locationType === type
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-accent",
                  )}
                >
                  {EVENT_LOCATION_TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          </div>
          {isPhysicalish ? (
            <div className="space-y-4 rounded-2xl bg-secondary/30 p-4">
              <p className="text-sm font-medium">Lokasi fisik</p>
              <div className="space-y-2">
                <Label htmlFor="wz-venue">Nama tempat</Label>
                <Input
                  id="wz-venue"
                  value={schedule.venueName}
                  onChange={(event) => setSchedule((current) => ({ ...current, venueName: event.target.value }))}
                  placeholder="Aula Komunitas Melati"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-address">Alamat</Label>
                <Input
                  id="wz-address"
                  value={schedule.venueAddress}
                  onChange={(event) => setSchedule((current) => ({ ...current, venueAddress: event.target.value }))}
                  placeholder="Jl. Melati No. 12, Jakarta Selatan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-maps">Tautan peta (opsional)</Label>
                <Input
                  id="wz-maps"
                  value={schedule.venueMapsUrl}
                  onChange={(event) => setSchedule((current) => ({ ...current, venueMapsUrl: event.target.value }))}
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </div>
          ) : null}
          {isVirtualish ? (
            <div className="space-y-4 rounded-2xl bg-secondary/30 p-4">
              <p className="text-sm font-medium">Siaran online</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Platform *</Label>
                  <Select
                    value={schedule.virtualPlatform || undefined}
                    onValueChange={(value) =>
                      setSchedule((current) => ({ ...current, virtualPlatform: value as VirtualPlatform }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((platform) => (
                        <SelectItem key={platform} value={platform}>
                          {VIRTUAL_PLATFORM_LABEL[platform]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {schedule.virtualPlatform === "internal" ? (
                    <p className="text-xs text-muted-foreground">
                      Ruang live stream Panti Janda dibuat otomatis saat event dipublikasikan.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wz-vurl">Tautan ruang (opsional)</Label>
                  <Input
                    id="wz-vurl"
                    value={schedule.virtualUrl}
                    onChange={(event) => setSchedule((current) => ({ ...current, virtualUrl: event.target.value }))}
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Perizinan keramaian</p>
              <p className="text-xs text-muted-foreground">
                Konferensi dengan izin perlu persetujuan admin sebelum publikasi.
              </p>
            </div>
            <Switch
              checked={schedule.permitRequired}
              onCheckedChange={(checked) => setSchedule((current) => ({ ...current, permitRequired: checked }))}
            />
          </div>
          {schedule.startsAt ? (
            <p className="text-xs text-muted-foreground">
              Tersimpan sebagai waktu lokal: {toLocalInputValue(schedule.startsAt)} ({schedule.timezone}).
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h3 className="font-display text-lg font-semibold">Rencana acara *</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wz-target">Target peserta *</Label>
                <Textarea
                  id="wz-target"
                  rows={2}
                  maxLength={800}
                  value={plan.targetAudience}
                  onChange={(event) => setPlan((current) => ({ ...current, targetAudience: event.target.value }))}
                  placeholder="Janda usia produktif di Jabodetabek yang ingin memulai usaha"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-objectives">Tujuan acara *</Label>
                <Textarea
                  id="wz-objectives"
                  rows={2}
                  maxLength={2000}
                  value={plan.objectives}
                  onChange={(event) => setPlan((current) => ({ ...current, objectives: event.target.value }))}
                  placeholder="Peserta memahami dasar pembukuan usaha dan membuat rencana usaha sederhana"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wz-req">Kebutuhan peserta</Label>
                <Textarea
                  id="wz-req"
                  rows={2}
                  maxLength={2000}
                  value={plan.requirements}
                  onChange={(event) => setPlan((current) => ({ ...current, requirements: event.target.value }))}
                  placeholder="Membawa buku catatan; tidak ada prasyarat keahlian"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-marketing">Rencana promosi</Label>
                <Textarea
                  id="wz-marketing"
                  rows={2}
                  maxLength={2000}
                  value={plan.marketingPlan}
                  onChange={(event) => setPlan((current) => ({ ...current, marketingPlan: event.target.value }))}
                  placeholder="Poster di grup komunitas, undangan personal, feed Panti Janda"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wz-channels">Kanal promosi</Label>
                <Input
                  id="wz-channels"
                  value={plan.promotionChannels}
                  onChange={(event) => setPlan((current) => ({ ...current, promotionChannels: event.target.value }))}
                  placeholder="WhatsApp, Instagram, Feed Komunitas"
                />
                <p className="text-xs text-muted-foreground">Pisahkan dengan koma.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-risk">Antisipasi risiko</Label>
                <Textarea
                  id="wz-risk"
                  rows={2}
                  maxLength={2000}
                  value={plan.riskAssessment}
                  onChange={(event) => setPlan((current) => ({ ...current, riskAssessment: event.target.value }))}
                  placeholder="Peserta sedikit → perpanjang pendaftaran; cuaca buruk → ruang indoor cadangan"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold">Rundown / sesi acara *</h3>
                <p className="text-sm text-muted-foreground">
                  Minimal satu sesi diperlukan sebelum event dapat dipublikasikan.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setSessions((current) => [
                    ...current,
                    { key: uid(), title: "", startsAt: "", endsAt: "", room: "", description: "" },
                  ])
                }
              >
                <Plus className="size-4" aria-hidden />
                Tambah sesi
              </Button>
            </div>
            {sessions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Belum ada sesi. Tambahkan rundown seperti pembukaan, materi inti, dan penutup.
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.map((session, index) => (
                  <div key={session.key} className="space-y-3 rounded-2xl bg-secondary/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Sesi {index + 1}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSessions((current) => current.filter((item) => item.key !== session.key))}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Hapus
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`wz-session-title-${session.key}`}>Judul sesi</Label>
                        <Input
                          id={`wz-session-title-${session.key}`}
                          value={session.title}
                          onChange={(event) =>
                            setSessions((current) =>
                              current.map((item) =>
                                item.key === session.key ? { ...item, title: event.target.value } : item,
                              ),
                            )
                          }
                          placeholder="Pembukaan & sambutan"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`wz-session-room-${session.key}`}>Ruang</Label>
                        <Input
                          id={`wz-session-room-${session.key}`}
                          value={session.room}
                          onChange={(event) =>
                            setSessions((current) =>
                              current.map((item) =>
                                item.key === session.key ? { ...item, room: event.target.value } : item,
                              ),
                            )
                          }
                          placeholder="Ruang Utama"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`wz-session-start-${session.key}`}>Mulai</Label>
                        <Input
                          id={`wz-session-start-${session.key}`}
                          type="datetime-local"
                          value={session.startsAt}
                          onChange={(event) =>
                            setSessions((current) =>
                              current.map((item) =>
                                item.key === session.key ? { ...item, startsAt: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`wz-session-end-${session.key}`}>Selesai</Label>
                        <Input
                          id={`wz-session-end-${session.key}`}
                          type="datetime-local"
                          value={session.endsAt}
                          onChange={(event) =>
                            setSessions((current) =>
                              current.map((item) =>
                                item.key === session.key ? { ...item, endsAt: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`wz-session-desc-${session.key}`}>Catatan</Label>
                      <Input
                        id={`wz-session-desc-${session.key}`}
                        value={session.description}
                        onChange={(event) =>
                          setSessions((current) =>
                            current.map((item) =>
                              item.key === session.key ? { ...item, description: event.target.value } : item,
                            ),
                          )
                        }
                        placeholder="Petugas: divisi acara"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold">Checklist kerja panitia</h3>
                <p className="text-sm text-muted-foreground">
                  Daftar tugas persiapan — otomatis dari template kategori, deadline dihitung dari tanggal acara.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={autoChecklist}>
                  <Sparkles className="size-4" aria-hidden />
                  Buat otomatis
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setChecklists((current) => [
                      ...current,
                      { key: uid(), title: "", category: "OTHER", priority: "medium", dueAt: "" },
                    ])
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  Tambah tugas
                </Button>
              </div>
            </div>
            {checklists.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Belum ada checklist. Gunakan tombol otomatis agar panitia punya panduan kerja.
              </p>
            ) : (
              <div className="space-y-3">
                {checklists.map((item) => (
                  <div key={item.key} className="grid gap-3 rounded-2xl bg-secondary/30 p-4 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-3">
                      <Input
                        value={item.title}
                        onChange={(event) =>
                          setChecklists((current) =>
                            current.map((row) =>
                              row.key === item.key ? { ...row, title: event.target.value } : row,
                            ),
                          )
                        }
                        placeholder="Judul tugas"
                      />
                      <div className="flex flex-wrap gap-3">
                        <div className="w-40 space-y-1">
                          <Label className="text-xs">Kategori</Label>
                          <Select
                            value={item.category}
                            onValueChange={(value) =>
                              setChecklists((current) =>
                                current.map((row) =>
                                  row.key === item.key ? { ...row, category: value as BudgetCategory } : row,
                                ),
                              )
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BUDGET_CATEGORIES.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {BUDGET_CATEGORY_META[category].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-32 space-y-1">
                          <Label className="text-xs">Prioritas</Label>
                          <Select
                            value={item.priority}
                            onValueChange={(value) =>
                              setChecklists((current) =>
                                current.map((row) =>
                                  row.key === item.key ? { ...row, priority: value as ChecklistPriority } : row,
                                ),
                              )
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">Tinggi</SelectItem>
                              <SelectItem value="medium">Sedang</SelectItem>
                              <SelectItem value="low">Rendah</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-44 space-y-1">
                          <Label className="text-xs">Tenggat</Label>
                          <Input
                            type="date"
                            className="h-9"
                            value={item.dueAt}
                            onChange={(event) =>
                              setChecklists((current) =>
                                current.map((row) =>
                                  row.key === item.key ? { ...row, dueAt: event.target.value } : row,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setChecklists((current) => current.filter((row) => row.key !== item.key))}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Hapus
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold">Item anggaran *</h3>
                <p className="text-sm text-muted-foreground">
                  12 kategori standar. Total dihitung otomatis dari kuantitas × estimasi biaya.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setBudgetItems((current) => [
                    ...current,
                    { key: uid(), category: "OTHER", name: "", quantity: "1", unit: "", estimatedCost: "", notes: "" },
                  ])
                }
              >
                <Plus className="size-4" aria-hidden />
                Tambah item
              </Button>
            </div>
            {budgetItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Belum ada item anggaran. Event tidak dapat dipublikasikan tanpa anggaran.
              </p>
            ) : (
              <div className="space-y-3">
                {budgetItems.map((item) => (
                  <div key={item.key} className="space-y-3 rounded-2xl bg-secondary/30 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Kategori</Label>
                        <Select
                          value={item.category}
                          onValueChange={(value) =>
                            setBudgetItems((current) =>
                              current.map((row) =>
                                row.key === item.key ? { ...row, category: value as BudgetCategory } : row,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BUDGET_CATEGORIES.map((category) => (
                              <SelectItem key={category} value={category}>
                                {BUDGET_CATEGORY_META[category].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Nama item</Label>
                        <Input
                          value={item.name}
                          onChange={(event) =>
                            setBudgetItems((current) =>
                              current.map((row) =>
                                row.key === item.key ? { ...row, name: event.target.value } : row,
                              ),
                            )
                          }
                          placeholder="Sewa gedung"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Kuantitas</Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.quantity}
                          onChange={(event) =>
                            setBudgetItems((current) =>
                              current.map((row) =>
                                row.key === item.key ? { ...row, quantity: event.target.value } : row,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Satuan</Label>
                        <Input
                          value={item.unit}
                          onChange={(event) =>
                            setBudgetItems((current) =>
                              current.map((row) =>
                                row.key === item.key ? { ...row, unit: event.target.value } : row,
                              ),
                            )
                          }
                          placeholder="hari / orang / paket"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Estimasi biaya (Rp)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.estimatedCost}
                          onChange={(event) =>
                            setBudgetItems((current) =>
                              current.map((row) =>
                                row.key === item.key ? { ...row, estimatedCost: event.target.value } : row,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Subtotal</Label>
                        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold">
                          {formatRupiah(itemCost(item))}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div className="w-full flex-1 space-y-2 sm:max-w-sm">
                        <Label className="text-xs">Catatan</Label>
                        <Input
                          value={item.notes}
                          onChange={(event) =>
                            setBudgetItems((current) =>
                              current.map((row) =>
                                row.key === item.key ? { ...row, notes: event.target.value } : row,
                              ),
                            )
                          }
                          placeholder="Vendor, termin pembayaran, dsb."
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setBudgetItems((current) => current.filter((row) => row.key !== item.key))}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Hapus
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold">Sumber dana *</h3>
                  <p className="text-sm text-muted-foreground">
                    Total dana harus menutupi seluruh anggaran sebelum publikasi.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setFundingSources((current) => [
                      ...current,
                      { key: uid(), type: "SELF_FUNDED", name: "", amount: "", notes: "" },
                    ])
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  Tambah sumber
                </Button>
              </div>
              {fundingSources.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Belum ada sumber dana.
                </p>
              ) : (
                <div className="space-y-3">
                  {fundingSources.map((source) => (
                    <div key={source.key} className="space-y-3 rounded-2xl bg-secondary/30 p-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Jenis</Label>
                          <Select
                            value={source.type}
                            onValueChange={(value) =>
                              setFundingSources((current) =>
                                current.map((row) =>
                                  row.key === source.key ? { ...row, type: value as FundingSourceType } : row,
                                ),
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FUNDING_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {FUNDING_SOURCE_META[type].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">{FUNDING_SOURCE_META[source.type].hint}</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Nama sumber</Label>
                          <Input
                            value={source.name}
                            onChange={(event) =>
                              setFundingSources((current) =>
                                current.map((row) =>
                                  row.key === source.key ? { ...row, name: event.target.value } : row,
                                ),
                              )
                            }
                            placeholder="Kas komunitas / Sponsor A"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Jumlah (Rp)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={source.amount}
                            onChange={(event) =>
                              setFundingSources((current) =>
                                current.map((row) =>
                                  row.key === source.key ? { ...row, amount: event.target.value } : row,
                                ),
                              )
                            }
                          />
                          {source.type === "TICKET_SALES" && expectedTicketRevenue > 0 ? (
                            <button
                              type="button"
                              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                              onClick={() =>
                                setFundingSources((current) =>
                                  current.map((row) =>
                                    row.key === source.key
                                      ? { ...row, amount: String(expectedTicketRevenue) }
                                      : row,
                                  ),
                                )
                              }
                            >
                              Isi dari estimasi tiket ({formatRupiah(expectedTicketRevenue)})
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div className="w-full flex-1 space-y-2 sm:max-w-sm">
                          <Label className="text-xs">Catatan</Label>
                          <Input
                            value={source.notes}
                            onChange={(event) =>
                              setFundingSources((current) =>
                                current.map((row) =>
                                  row.key === source.key ? { ...row, notes: event.target.value } : row,
                                ),
                              )
                            }
                            placeholder="Nomor kontrak / termin"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setFundingSources((current) => current.filter((row) => row.key !== source.key))
                          }
                        >
                          <Trash2 className="size-4" aria-hidden />
                          Hapus
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4 self-start lg:sticky lg:top-24">
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h3 className="font-display text-lg font-semibold">Kalender biaya</h3>
                {pieData.length ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatRupiah(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    Grafik muncul setelah ada item anggaran.
                  </p>
                )}
                <div className="space-y-1.5">
                  {pieData.map((entry) => (
                    <div key={entry.name} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
                        {entry.name}
                      </span>
                      <span className="font-medium">{formatRupiah(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h3 className="font-display text-lg font-semibold">Ringkasan dana</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground">Total anggaran</span>
                    <span className="font-semibold">{formatRupiah(totalBudget)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground">Total sumber dana</span>
                    <span className="font-semibold">{formatRupiah(totalFunding)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                    <span className="text-muted-foreground">Status</span>
                    {deficit > 0 ? (
                      <span className="font-semibold text-destructive">Kurang {formatRupiah(deficit)}</span>
                    ) : (
                      <span className="font-semibold text-emerald-700">Dana mencukupi</span>
                    )}
                  </div>
                </div>
                {deficit > 0 ? (
                  <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Event tidak dapat dipublikasikan sampai sumber dana mencukupi total anggaran.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">Tiket berbayar (opsional)</h3>
              <p className="text-sm text-muted-foreground">
                Aktifkan jika event berbayar. Peserta dapat membeli tiket via Midtrans setelah event dipublikasikan.
              </p>
            </div>
            <Switch
              checked={ticketing}
              onCheckedChange={(checked) => {
                setTicketing(checked);
                if (!checked) setTiers([]);
                if (checked && tiers.length === 0) {
                  setTiers([
                    { key: uid(), name: "Early Bird", price: "100000", quota: "50", benefits: "Akses penuh, kursi depan" },
                    { key: uid(), name: "Regular", price: "150000", quota: "100", benefits: "Akses penuh" },
                    { key: uid(), name: "VIP", price: "500000", quota: "20", benefits: "Akses penuh, sesi foto, merchandise" },
                  ]);
                }
              }}
            />
          </div>
          {!ticketing ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Event gratis — peserta mendaftar lewat tombol hadir (RSVP).
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Estimasi pendapatan tiket: <span className="font-semibold">{formatRupiah(expectedTicketRevenue)}</span>
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setTiers((current) => [
                      ...current,
                      { key: uid(), name: "", price: "", quota: "", benefits: "" },
                    ])
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  Tambah tier
                </Button>
              </div>
              {tiers.map((tier) => (
                <div key={tier.key} className="space-y-3 rounded-2xl bg-secondary/30 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Nama tier</Label>
                      <Input
                        value={tier.name}
                        onChange={(event) =>
                          setTiers((current) =>
                            current.map((row) =>
                              row.key === tier.key ? { ...row, name: event.target.value } : row,
                            ),
                          )
                        }
                        placeholder="Early Bird"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Harga (Rp)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={tier.price}
                        onChange={(event) =>
                          setTiers((current) =>
                            current.map((row) =>
                              row.key === tier.key ? { ...row, price: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Kuota</Label>
                      <Input
                        type="number"
                        min={0}
                        value={tier.quota}
                        onChange={(event) =>
                          setTiers((current) =>
                            current.map((row) =>
                              row.key === tier.key ? { ...row, quota: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="w-full flex-1 space-y-2">
                      <Label className="text-xs">Keuntungan tier</Label>
                      <Input
                        value={tier.benefits}
                        onChange={(event) =>
                          setTiers((current) =>
                            current.map((row) =>
                              row.key === tier.key ? { ...row, benefits: event.target.value } : row,
                            ),
                          )
                        }
                        placeholder="Akses penuh, sesi foto, merchandise"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setTiers((current) => current.filter((row) => row.key !== tier.key))}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Hapus
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Jika event memakai tiket berbayar, sumber dana jenis "Penjualan Tiket" sebaiknya diisi di langkah Anggaran.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h3 className="font-display text-lg font-semibold">Ringkasan event</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryRow label="Judul" value={basic.title || "—"} />
              <SummaryRow
                label="Kategori"
                value={
                  basic.category
                    ? `${EVENT_CATEGORY_META[basic.category].emoji} ${EVENT_CATEGORY_META[basic.category].label}`
                    : "—"
                }
              />
              <SummaryRow label="Akses" value={AUDIENCE_META[basic.audience].label} />
              <SummaryRow label="Zona waktu" value={schedule.timezone} />
              <SummaryRow
                label="Mulai"
                value={schedule.startsAt ? toLocalInputValue(schedule.startsAt) : "Belum diisi"}
              />
              <SummaryRow label="Selesai" value={schedule.endsAt ? toLocalInputValue(schedule.endsAt) : "—"} />
              <SummaryRow
                label="Format"
                value={
                  isVirtualish && schedule.virtualPlatform
                    ? `${EVENT_LOCATION_TYPE_LABEL[schedule.locationType]} — ${VIRTUAL_PLATFORM_LABEL[schedule.virtualPlatform]}`
                    : EVENT_LOCATION_TYPE_LABEL[schedule.locationType]
                }
              />
              <SummaryRow
                label="Lokasi"
                value={
                  isPhysicalish
                    ? [schedule.venueName, schedule.venueAddress].filter(Boolean).join(", ") || "Belum diisi"
                    : schedule.virtualUrl || "Ruang live internal"
                }
              />
              <SummaryRow label="Kuota peserta" value={schedule.capacity ? `${schedule.capacity} orang` : "Tidak dibatasi"} />
              <SummaryRow label="Rundown" value={`${sessions.filter((s) => s.title.trim()).length} sesi`} />
              <SummaryRow label="Checklist panitia" value={`${checklists.filter((c) => c.title.trim()).length} tugas`} />
              <SummaryRow
                label="Tiket"
                value={ticketing ? `${tiers.filter((t) => t.name.trim()).length} tier berbayar` : "Gratis (RSVP)"}
              />
              <SummaryRow label="Total anggaran" value={formatRupiah(totalBudget)} />
              <SummaryRow
                label="Total dana"
                value={
                  <span className={deficit > 0 ? "font-semibold text-destructive" : "font-semibold text-emerald-700"}>
                    {formatRupiah(totalFunding)}
                    {deficit > 0 ? ` (kurang ${formatRupiah(deficit)})` : ""}
                  </span>
                }
              />
            </div>
            {basic.coverImage ? (
              <img
                src={basic.coverImage}
                alt="Sampul event"
                className="h-40 w-full rounded-2xl border border-border object-cover"
              />
            ) : null}
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h3 className="font-display text-lg font-semibold">Syarat publikasi</h3>
            <ul className="space-y-2 text-sm">
              <ReadinessRow
                ok={readiness.plan}
                label={readiness.plan ? PUBLISH_READY_LABEL.plan : PUBLISH_MISSING_LABEL.plan}
                hint="Isi target peserta dan tujuan di langkah Perencanaan."
              />
              <ReadinessRow
                ok={readiness.budget_items}
                label={readiness.budget_items ? PUBLISH_READY_LABEL.budget_items : PUBLISH_MISSING_LABEL.budget_items}
                hint="Tambahkan item di langkah Anggaran."
              />
              <ReadinessRow
                ok={!readiness.funding_deficit}
                label={
                  !readiness.funding_deficit
                    ? PUBLISH_READY_LABEL.funding_deficit
                    : PUBLISH_MISSING_LABEL.funding_deficit
                }
                hint="Lengkapi sumber dana di langkah Anggaran."
              />
              <ReadinessRow
                ok={readiness.rundown}
                label={readiness.rundown ? PUBLISH_READY_LABEL.rundown : PUBLISH_MISSING_LABEL.rundown}
                hint="Tambahkan minimal satu sesi di langkah Perencanaan."
              />
            </ul>
            {missing.length ? (
              <div className="space-y-1.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <p className="flex items-center gap-2 font-medium">
                  <CircleAlert className="size-4" aria-hidden />
                  Server menolak publikasi. Yang perlu dilengkapi:
                </p>
                <ul className="list-disc space-y-1 pl-6">
                  {missing.map((code) => (
                    <li key={code}>{PUBLISH_MISSING_LABEL[code] ?? code}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {approvalReasons.length ? (
            <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:p-6">
              <p className="flex items-center gap-2 font-semibold">
                <ClipboardList className="size-4" aria-hidden />
                Event ini akan ditinjau admin terlebih dahulu
              </p>
              <ul className="list-disc space-y-1 pl-6">
                {approvalReasons.map((reason) => (
                  <li key={reason}>{APPROVAL_REASON_LABEL[reason] ?? reason}</li>
                ))}
              </ul>
              <p className="text-xs">
                Setelah diajukan, status menjadi "Menunggu Persetujuan" dan event tampil publik hanya setelah disetujui.
              </p>
            </div>
          ) : null}

          <div className="space-y-2 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h3 className="font-display text-lg font-semibold">Publikasi</h3>
            <p className="text-sm text-muted-foreground">
              {approvalReasons.length
                ? "Klik ajukan — kami kirim pengajuan ke admin dan beri tahu Anda setelah ditinjau."
                : "Klik publikasikan — event langsung tampil sesuai akses yang dipilih."}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={publishing || basic.title.trim().length < 3}
                onClick={() => void saveDraft({ silent: false }).then((id) => id && toast.success("Draf tersimpan."))}
              >
                {saveState === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
                Simpan draf
              </Button>
              <Button type="button" disabled={publishing} onClick={() => void publish()}>
                {publishing ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Rocket className="size-4" aria-hidden />
                )}
                {approvalReasons.length ? "Ajukan untuk persetujuan" : "Publikasikan event"}
              </Button>
            </div>
            {eventId ? (
              <p className="pt-1 text-xs text-muted-foreground">
                Draf tersimpan dengan ID {eventId.slice(0, 8)}… — bisa dilanjutkan dari dasbor penyelenggara.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={goBack} disabled={step === 0}>
          <ArrowLeft className="size-4" aria-hidden />
          Kembali
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={goNext}>
            Lanjut: {STEPS[step + 1].label}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" onClick={() => void publish()} disabled={publishing}>
            {publishing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />}
            {approvalReasons.length ? "Ajukan untuk persetujuan" : "Publikasikan event"}
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/30 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function ReadinessRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      )}
      <span>
        <span className={cn("font-medium", ok ? "text-foreground" : "text-destructive")}>{label}</span>
        {!ok ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </li>
  );
}

function CoverUpload({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { uploading, uploadFile, error } = usePresignedUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Hanya file gambar yang diperbolehkan.");
      return;
    }
    const result = await uploadFile(file, "public");
    if (result) {
      onChange(result.publicUrl || result.key);
      toast.success("Sampul diunggah.");
    } else {
      toast.error(error ?? "Gagal mengunggah sampul.");
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <Label>Sampul event (opsional)</Label>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <img src={value} alt="Pratinjau sampul" className="h-20 w-32 rounded-xl border border-border object-cover" />
        ) : null}
        <label
          className={cn(
            "flex size-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/30 transition-colors hover:border-primary/50",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleSelect} disabled={uploading} />
          <span className="flex flex-col items-center gap-1 text-muted-foreground">
            {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
            <span className="text-[10px]">Upload</span>
          </span>
        </label>
        {value ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
            <Trash2 className="size-4" aria-hidden />
            Hapus sampul
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">JPG/PNG/WebP, disarankan lanskap 16:9.</p>
    </div>
  );
}
