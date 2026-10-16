import { useEffect, useMemo, useRef, useState } from "react";
import { Gavel } from "lucide-react";
import { ESPORT_STAGE_LABEL, esportRoundLabel } from "@/lib/constants";
import type { EsportMatch } from "@/lib/types";
import { cn } from "@/lib/utils";

const BOX_W = 232;
const BOX_H = 80;
const UNIT = 104;
const COL_GAP = 56;
const HEADER_H = 30;
const PAD_BOTTOM = 12;

const STAGE_ORDER = ["main", "winners", "losers", "group", "rr", "playoff", "grand_final"];

const shortDateTime = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function stageLabel(stage: string): string {
  return ESPORT_STAGE_LABEL[stage] ?? stage.replace(/_/g, " ");
}

function TeamRow({
  team,
  score,
  isWinner,
  isLoser,
  pending,
  walkover,
}: {
  team: EsportMatch["homeTeam"];
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  pending: boolean;
  walkover?: boolean;
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[9px] text-muted-foreground"
          aria-hidden
        >
          ?
        </span>
        <span className="truncate text-[11px] text-muted-foreground italic">
          {pending ? "Menunggu pemenang…" : "Belum ditentukan"}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 py-0.5">
      {team.logo ? (
        <img src={team.logo} alt="" className="size-5 shrink-0 rounded-md object-cover" />
      ) : (
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-200 text-[9px] font-bold text-slate-600"
          aria-hidden
        >
          {(team.tag ?? team.name).slice(0, 3).toUpperCase()}
        </span>
      )}
      {team.seed ? (
        <span className="shrink-0 text-[9px] font-semibold tabular-nums text-muted-foreground">#{team.seed}</span>
      ) : null}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[11px]",
          isWinner ? "font-semibold text-foreground" : isLoser ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {team.name}
      </span>
      {walkover ? (
        isWinner ? (
          <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">WO</span>
        ) : (
          <span className="shrink-0 text-[10px] text-muted-foreground">–</span>
        )
      ) : score !== null ? (
        <span
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            isWinner ? "text-emerald-700" : "text-muted-foreground",
          )}
        >
          {score}
        </span>
      ) : (
        <span className="shrink-0 text-[10px] text-muted-foreground">–</span>
      )}
    </div>
  );
}

export function MatchBox({
  match,
  mine,
  disputed = false,
  className,
}: {
  match: EsportMatch;
  mine: boolean;
  disputed?: boolean;
  className?: string;
}) {
  const done = match.status === "finished" || match.status === "walkover";
  const isWalkover = match.status === "walkover";
  const isBye = match.status === "finished" && match.homeTeam && !match.awayTeam && match.homeScore === null;
  const showScores = done && !isBye && (isWalkover || match.homeScore !== null);
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border border-border bg-card px-2.5 py-2 shadow-sm",
        mine && "border-orange-300 ring-2 ring-orange-200/70",
        match.status === "live" && "border-rose-300",
        match.status === "paused" && "border-orange-300",
        match.status === "disputed" && "border-violet-300",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {match.status === "live" ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-rose-600">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
              </span>
              LIVE
            </span>
          ) : match.status === "paused" ? (
            <span className="rounded bg-orange-100 px-1 py-px text-[9px] font-semibold text-orange-700">DIJEDA</span>
          ) : match.status === "disputed" ? (
            <span className="rounded bg-violet-100 px-1 py-px text-[9px] font-semibold text-violet-700">SENGKETA</span>
          ) : match.status === "checkin_open" ? (
            <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-semibold text-amber-700">CHECK-IN</span>
          ) : match.status === "walkover" ? (
            <span className="rounded bg-slate-200 px-1 py-px text-[9px] font-semibold text-slate-700">WO</span>
          ) : match.status === "cancelled" ? (
            <span className="rounded bg-rose-100 px-1 py-px text-[9px] font-semibold text-rose-700">BATAL</span>
          ) : (
            <span className="text-[10px] font-medium text-muted-foreground">
              {/* "BO" = best-of; format seri yang disepakati */}
              BO{match.bestOf}
            </span>
          )}
          {match.groupLabel ? (
            <span className="rounded bg-secondary px-1 py-px text-[9px] font-medium text-secondary-foreground">
              Grup {match.groupLabel}
            </span>
          ) : null}
          {disputed ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-px text-[9px] font-semibold text-amber-700">
              <Gavel className="size-2.5" aria-hidden />
              Sengketa
            </span>
          ) : null}
          {mine ? (
            <span className="rounded bg-orange-100 px-1 py-px text-[9px] font-semibold text-orange-700">Tim Anda</span>
          ) : null}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {isBye ? "Bye" : match.scheduledAt ? shortDateTime.format(new Date(match.scheduledAt)) : ""}
        </span>
      </div>
      <div className="mt-1">
        <TeamRow
          team={match.homeTeam}
          score={match.homeScore}
          isWinner={Boolean(showScores && match.winnerRegId && match.winnerRegId === match.homeRegId)}
          isLoser={Boolean(showScores && match.winnerRegId && match.winnerRegId !== match.homeRegId)}
          pending={!done && !match.homeTeam}
          walkover={isWalkover}
        />
        {isBye ? (
          <div className="flex items-center gap-2 py-0.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[9px] text-muted-foreground" aria-hidden>
              —
            </span>
            <span className="text-[11px] text-muted-foreground italic">Lolos tanpa lawan</span>
          </div>
        ) : (
          <TeamRow
            team={match.awayTeam}
            score={match.awayScore}
            isWinner={Boolean(showScores && match.winnerRegId && match.winnerRegId === match.awayRegId)}
            isLoser={Boolean(showScores && match.winnerRegId && match.winnerRegId !== match.awayRegId)}
            pending={!done && !match.awayTeam}
            walkover={isWalkover}
          />
        )}
      </div>
    </div>
  );
}

function StageBracket({
  stage,
  matches,
  myRegIds,
  disputedIds,
}: {
  stage: string;
  matches: EsportMatch[];
  myRegIds: Set<string>;
  disputedIds: Set<string>;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  const rounds = useMemo(() => {
    const map = new Map<number, EsportMatch[]>();
    for (const m of matches) {
      const list = map.get(m.round);
      if (list) list.push(m);
      else map.set(m.round, [m]);
    }
    for (const list of map.values()) list.sort((a, b) => a.matchIndex - b.matchIndex);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [matches]);

  const maxRound = rounds.length ? rounds[rounds.length - 1][0] : 1;
  const maxCount = Math.max(...rounds.map(([, list]) => list.length), 1);
  const height = maxCount * UNIT;
  const colCount = rounds.length;
  const canvasW = colCount * BOX_W + (colCount - 1) * COL_GAP;
  const canvasH = HEADER_H + height + PAD_BOTTOM;

  const colX = (index: number) => index * (BOX_W + COL_GAP);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      setScale(width > 0 ? Math.min(1, width / canvasW) : 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvasW]);

  const idPos = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    rounds.forEach(([, list], i) => {
      list.forEach((m, k) => {
        map.set(m.id, { x: i * (BOX_W + COL_GAP) + BOX_W, y: HEADER_H + (k + 0.5) * (height / list.length) });
      });
    });
    return map;
  }, [rounds, height]);

  const connectors = useMemo(() => {
    const paths: { d: string; advanced: boolean }[] = [];
    for (const m of matches) {
      if (!m.nextMatchId) continue;
      const from = idPos.get(m.id);
      const to = idPos.get(m.nextMatchId);
      if (!from || !to) continue;
      const midX = from.x + COL_GAP / 2;
      const d = `M ${from.x} ${from.y} H ${midX} V ${to.y} H ${to.x}`;
      paths.push({ d, advanced: (m.status === "finished" || m.status === "walkover") && Boolean(m.winnerRegId) });
    }
    return paths;
  }, [matches, idPos]);

  return (
    <div>
      {/* Desktop: bagan 2D dengan penghubung; mengecil otomatis agar tidak melebihi lebar layar. */}
      <div ref={wrapRef} className="hidden sm:block" style={{ height: canvasH * scale }}>
        <div
          className="relative"
          style={{ width: canvasW, height: canvasH, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <svg className="pointer-events-none absolute inset-0 text-slate-300" width={canvasW} height={canvasH} aria-hidden>
            {connectors.map((c, i) => (
              <path
                key={i}
                d={c.d}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className={c.advanced ? "text-orange-400" : undefined}
              />
            ))}
          </svg>
          {rounds.map(([round, list], i) => (
            <div
              key={round}
              className="absolute text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
              style={{ left: colX(i), top: 4, width: BOX_W }}
            >
              {esportRoundLabel(stage, round, maxRound)}
            </div>
          ))}
          {rounds.map(([, list], i) =>
            list.map((m, k) => (
              <div
                key={m.id}
                className="absolute"
                style={{
                  left: colX(i),
                  top: HEADER_H + (k + 0.5) * (height / list.length) - BOX_H / 2,
                  width: BOX_W,
                  height: BOX_H,
                }}
              >
                <MatchBox
                  match={m}
                  mine={myRegIds.has(m.homeRegId ?? "") || myRegIds.has(m.awayRegId ?? "")}
                  disputed={disputedIds.has(m.id)}
                  className="h-full"
                />
              </div>
            )),
          )}
        </div>
      </div>

      {/* Mobile: ronde bertumpuk, kotak membungkus (flex-wrap) tanpa gulir horizontal. */}
      <div className="flex flex-col gap-5 sm:hidden">
        {rounds.map(([round, list]) => (
          <div key={round} className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {esportRoundLabel(stage, round, maxRound)}
            </p>
            <div className="flex flex-wrap gap-3">
              {list.map((m) => (
                <MatchBox
                  key={m.id}
                  match={m}
                  mine={myRegIds.has(m.homeRegId ?? "") || myRegIds.has(m.awayRegId ?? "")}
                  disputed={disputedIds.has(m.id)}
                  className="w-full"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EsportBracket({
  matches,
  myRegIds = [],
  disputedMatchIds = [],
}: {
  matches: EsportMatch[];
  myRegIds?: string[];
  disputedMatchIds?: string[];
}) {
  const mineSet = useMemo(() => new Set(myRegIds), [myRegIds]);
  const disputedSet = useMemo(() => new Set(disputedMatchIds), [disputedMatchIds]);
  const stages = useMemo(() => {
    const map = new Map<string, EsportMatch[]>();
    for (const m of matches) {
      const list = map.get(m.stage);
      if (list) list.push(m);
      else map.set(m.stage, [m]);
    }
    const ordered = STAGE_ORDER.filter((s) => map.has(s));
    for (const key of map.keys()) {
      if (!ordered.includes(key)) ordered.push(key);
    }
    return ordered.map((stage) => [stage, map.get(stage)!] as const);
  }, [matches]);

  if (!matches.length) return null;

  return (
    <div className="flex flex-col gap-8">
      {stages.map(([stage, list]) => (
        <section key={stage} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-foreground">{stageLabel(stage)}</h3>
            <span className="text-xs text-muted-foreground">
              {list.length} pertandingan · {Math.max(...list.map((m) => m.round))} ronde
            </span>
          </div>
          <StageBracket stage={stage} matches={list} myRegIds={mineSet} disputedIds={disputedSet} />
        </section>
      ))}
    </div>
  );
}
