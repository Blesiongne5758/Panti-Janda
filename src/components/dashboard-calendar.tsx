import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, errorText } from "@/lib/api";
import { useTranslation } from "@/lib/i18n-context";
import type { TranslationKey } from "@/lib/i18n";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { CALENDAR_KIND_META } from "@/lib/constants";
import type { CalendarAgenda, CalendarItem, CalendarKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const KINDS: CalendarKind[] = ["event", "esport", "tugas", "konseling", "langganan", "pribadi"];
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
const WEEK_START = Date.UTC(2024, 0, 1); // Senin

function jakartaDate(iso: string): string {
  const shifted = new Date(Date.parse(iso) + TZ_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function jakartaTime(iso: string): string {
  const shifted = new Date(Date.parse(iso) + TZ_OFFSET_MS);
  return `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}`;
}

function jakartaNowDate(): string {
  return jakartaDate(new Date().toISOString());
}

function dayDiff(fromDate: string, toDate: string): number {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86400000);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

interface ScheduleForm {
  id: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  note: string;
}

const EMPTY_FORM: ScheduleForm = {
  id: null,
  title: "",
  date: "",
  startTime: "",
  endTime: "",
  location: "",
  note: "",
};

export function DashboardCalendar() {
  const { t, language } = useTranslation();
  const locale = language === "id" ? "id-ID" : "en-US";

  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<CalendarAgenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<CalendarKind | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(
    async (targetMonth: string | null) => {
      setLoading(true);
      setFailed(false);
      try {
        const next = await api<CalendarAgenda>("calendar.agenda", targetMonth ? { month: targetMonth } : {});
        setData(next);
        setMonth(next.month);
        setSelectedDay((current) => {
          if (current && current.startsWith(next.month)) return current;
          return next.today.startsWith(next.month) ? next.today : `${next.month}-01`;
        });
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const monthLabel = useMemo(() => {
    if (!month) return "";
    const [y, m] = month.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(y, m - 1, 1)),
    );
  }, [month, locale]);

  const weekdayNames = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(WEEK_START + i * 86400000)),
      ),
    [locale],
  );

  const gridCells = useMemo(() => {
    if (!month) return [];
    const [y, m] = month.split("-").map(Number);
    const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const totalDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: totalDays }, (_, i) => i + 1),
    ];
  }, [month]);

  const passesFilter = useCallback(
    (item: CalendarItem) => kindFilter === "all" || item.kind === kindFilter,
    [kindFilter],
  );

  const visibleItems = useMemo(() => (data?.items ?? []).filter(passesFilter), [data, passesFilter]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of visibleItems) {
      const day = jakartaDate(item.startsAt);
      const list = map.get(day);
      if (list) list.push(item);
      else map.set(day, [item]);
    }
    return map;
  }, [visibleItems]);

  const agendaItems = useMemo(
    () => (selectedDay ? itemsByDay.get(selectedDay) ?? [] : []),
    [itemsByDay, selectedDay],
  );

  const reminders = useMemo(() => (data?.reminders ?? []).filter(passesFilter), [data, passesFilter]);

  const selectedDayLabel = useMemo(
    () =>
      selectedDay
        ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
            new Date(Date.parse(`${selectedDay}T00:00:00Z`)),
          )
        : "",
    [selectedDay, locale],
  );

  const today = data?.today ?? jakartaNowDate();
  const kindLabel = (kind: CalendarKind) => t(`cal.kind.${kind}` as TranslationKey);
  const noteLabel = (item: CalendarItem) => {
    if (item.noteKey) return t(`cal.ms.${item.noteKey}` as TranslationKey);
    if (item.kind === "pribadi") {
      const parts = [item.note, item.location].filter((value): value is string => Boolean(value));
      return parts.length ? parts.join(" · ") : null;
    }
    return item.note;
  };

  const retry = () => void load(month);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, date: selectedDay ?? today });
    setConfirmDelete(false);
    setFormOpen(true);
  };

  const openEdit = (item: CalendarItem) => {
    if (!item.id.startsWith("pribadi:")) return;
    setForm({
      id: item.id.slice("pribadi:".length),
      title: item.title,
      date: jakartaDate(item.startsAt),
      startTime: item.allDay ? "" : jakartaTime(item.startsAt),
      endTime: item.endsAt ? jakartaTime(item.endsAt) : "",
      location: item.location ?? "",
      note: item.note ?? "",
    });
    setConfirmDelete(false);
    setFormOpen(true);
  };

  const saveSchedule = async () => {
    setFormBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        date: form.date,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        location: form.location.trim() || null,
        note: form.note.trim() || null,
      };
      if (form.id) await api("calendar.personal.update", { id: form.id, ...payload });
      else await api("calendar.personal.create", payload);
      const targetMonth = form.date.slice(0, 7);
      setFormOpen(false);
      setForm(EMPTY_FORM);
      toast.success(t("cal.saved"));
      await load(targetMonth);
      setSelectedDay(form.date);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setFormBusy(false);
    }
  };

  const deleteSchedule = async () => {
    if (!form.id) return;
    setFormBusy(true);
    try {
      await api("calendar.personal.remove", { id: form.id });
      setFormOpen(false);
      setForm(EMPTY_FORM);
      toast.success(t("cal.removed"));
      await load(month);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setFormBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <CalendarDays className="size-4 text-primary" aria-hidden />
          {t("cal.title")}
        </CardTitle>
        <CardDescription>{t("cal.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {failed ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <span>{t("cal.loadFailed")}</span>
            <Button variant="outline" size="sm" onClick={retry}>
              {t("cal.retry")}
            </Button>
          </div>
        ) : loading && !data ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden />
          </div>
        ) : data ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label={t("cal.prevMonth")}
                  onClick={() => month && void load(shiftMonth(month, -1))}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </Button>
                <span className="min-w-32 text-center font-display text-base font-semibold">{monthLabel}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label={t("cal.nextMonth")}
                  onClick={() => month && void load(shiftMonth(month, 1))}
                >
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => void load(null)}>
                  {t("cal.today")}
                </Button>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="size-3.5" aria-hidden />
                  {t("cal.add")}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setKindFilter("all")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  kindFilter === "all"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/60 text-foreground hover:bg-secondary",
                )}
              >
                {t("cal.filterAll")} ({data.items.length})
              </button>
              {KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setKindFilter(kind)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    kindFilter === kind
                      ? "border-primary bg-primary text-primary-foreground"
                      : cn("border-transparent", CALENDAR_KIND_META[kind].tone, "hover:opacity-90"),
                  )}
                >
                  {CALENDAR_KIND_META[kind].emoji} {kindLabel(kind)} ({data.counts[kind] ?? 0})
                </button>
              ))}
            </div>

            <div className="rounded-xl border bg-secondary/30 p-2 sm:p-3">
              <div className="grid grid-cols-7 gap-1">
                {weekdayNames.map((name) => (
                  <div key={name} className="py-1 text-center text-[10px] font-medium uppercase text-muted-foreground sm:text-xs">
                    {name}
                  </div>
                ))}
                {gridCells.map((dayNumber, index) => {
                  if (dayNumber === null) return <div key={`blank-${index}`} />;
                  const dateKey = `${month}-${String(dayNumber).padStart(2, "0")}`;
                  const dayItems = itemsByDay.get(dateKey) ?? [];
                  const dotKinds = Array.from(new Set(dayItems.map((item) => item.kind))).slice(0, 3);
                  const isSelected = selectedDay === dateKey;
                  const isToday = today === dateKey;
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedDay(dateKey)}
                      className={cn(
                        "flex min-h-11 flex-col items-center justify-start gap-1 rounded-lg px-1 py-1.5 text-xs transition-colors sm:min-h-14",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : isToday
                            ? "bg-primary/10 font-semibold text-primary hover:bg-primary/15"
                            : "hover:bg-secondary",
                      )}
                    >
                      <span className="tabular-nums">{dayNumber}</span>
                      <span className="flex h-1.5 items-center gap-0.5">
                        {dotKinds.map((kind) => (
                          <span
                            key={kind}
                            className={cn(
                              "size-1.5 rounded-full",
                              isSelected ? "bg-primary-foreground/80" : CALENDAR_KIND_META[kind].dot,
                            )}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">
                {t("cal.agenda")} — {selectedDayLabel}
              </p>
              {agendaItems.length === 0 ? (
                <p className="rounded-xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">{t("cal.agendaEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {agendaItems.map((item) => (
                    <AgendaRow
                      key={item.id}
                      item={item}
                      locale={locale}
                      note={noteLabel(item)}
                      roleLabel={item.role ? t(`cal.role.${item.role}` as TranslationKey) : null}
                      onEdit={item.kind === "pribadi" ? () => openEdit(item) : undefined}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Bell className="size-4 text-primary" aria-hidden />
                {t("cal.reminders")}
              </p>
              {reminders.length === 0 ? (
                <p className="rounded-xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">{t("cal.remindersEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {reminders.map((item) => {
                    const diff = dayDiff(jakartaNowDate(), jakartaDate(item.startsAt));
                    const chip = diff <= 0 ? t("cal.today") : diff === 1 ? t("cal.tomorrow") : `${diff} ${t("cal.daysLeft")}`;
                    return (
                      <AgendaRow
                        key={`reminder-${item.id}`}
                        item={item}
                        locale={locale}
                        note={noteLabel(item)}
                        roleLabel={item.role ? t(`cal.role.${item.role}` as TranslationKey) : null}
                        chip={chip}
                        onEdit={item.kind === "pribadi" ? () => openEdit(item) : undefined}
                      />
                    );
                  })}
                </ul>
              )}
            </div>

            <Dialog
              open={formOpen}
              onOpenChange={(open) => {
                setFormOpen(open);
                if (!open) setConfirmDelete(false);
              }}
            >
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display">
                    {form.id ? t("cal.editTitle") : t("cal.addTitle")}
                  </DialogTitle>
                  <DialogDescription>{t("cal.addHint")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cal-title">{t("cal.fieldTitle")}</Label>
                    <Input
                      id="cal-title"
                      value={form.title}
                      maxLength={100}
                      placeholder={t("cal.fieldTitlePlaceholder")}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cal-date">{t("cal.fieldDate")}</Label>
                    <Input
                      id="cal-date"
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="cal-start">{t("cal.fieldStart")}</Label>
                      <Input
                        id="cal-start"
                        type="time"
                        value={form.startTime}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, startTime: e.target.value, endTime: e.target.value ? f.endTime : "" }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cal-end">{t("cal.fieldEnd")}</Label>
                      <Input
                        id="cal-end"
                        type="time"
                        value={form.endTime}
                        disabled={!form.startTime}
                        onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cal-location">{t("cal.fieldLocation")}</Label>
                    <Input
                      id="cal-location"
                      value={form.location}
                      maxLength={160}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cal-note">{t("cal.fieldNote")}</Label>
                    <Textarea
                      id="cal-note"
                      rows={3}
                      value={form.note}
                      maxLength={500}
                      onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                  {form.id ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={formBusy}
                      onClick={() => (confirmDelete ? void deleteSchedule() : setConfirmDelete(true))}
                    >
                      {confirmDelete ? t("cal.deleteConfirm") : t("cal.delete")}
                    </Button>
                  ) : (
                    <span aria-hidden />
                  )}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" disabled={formBusy} onClick={() => setFormOpen(false)}>
                      {t("cal.cancel")}
                    </Button>
                    <Button
                      type="button"
                      disabled={formBusy || !form.title.trim() || !form.date}
                      onClick={() => void saveSchedule()}
                    >
                      {formBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                      {t("cal.save")}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AgendaRow({
  item,
  locale,
  note,
  roleLabel,
  chip,
  onEdit,
}: {
  item: CalendarItem;
  locale: string;
  note: string | null;
  roleLabel: string | null;
  chip?: string;
  onEdit?: () => void;
}) {
  const { t } = useTranslation();
  const meta = CALENDAR_KIND_META[item.kind];
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.parse(`${jakartaDate(item.startsAt)}T00:00:00Z`)),
  );
  const timeLabel = item.allDay ? t("cal.allDay") : jakartaTime(item.startsAt);
  const body = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", meta.tone)}>
          {meta.emoji} {item.title}
        </span>
        {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
        {roleLabel ? <span className="text-[11px] text-muted-foreground/80">{roleLabel}</span> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {dayLabel} · {timeLabel}
        </span>
        {chip ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{chip}</span>
        ) : null}
        {onEdit ? <Pencil className="size-3.5" aria-hidden /> : null}
      </div>
    </div>
  );
  if (onEdit) {
    return (
      <li>
        <button
          type="button"
          onClick={onEdit}
          className="block w-full rounded-xl border bg-card px-3 py-2 text-left transition-colors hover:bg-secondary/60"
        >
          {body}
        </button>
      </li>
    );
  }
  if (!item.link) {
    return <li className="rounded-xl border bg-card px-3 py-2">{body}</li>;
  }
  return (
    <li>
      <Link to={item.link} className="block rounded-xl border bg-card px-3 py-2 transition-colors hover:bg-secondary/60">
        {body}
      </Link>
    </li>
  );
}
