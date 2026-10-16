import { Calendar, ArrowRight, LogIn, LogOut } from "lucide-react";
import type { EsportRosterHistory } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RosterHistoryTimelineProps {
  history: EsportRosterHistory[];
  title?: string;
}

export function RosterHistoryTimeline({ history, title = "Riwayat Roster" }: RosterHistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="size-5 text-indigo-600" aria-hidden />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Belum ada riwayat roster.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="size-5 text-indigo-600" aria-hidden />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {/* Timeline line */}
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200" aria-hidden />

          {history.map((entry, idx) => {
            const isActive = !entry.leftAt;
            return (
              <div key={entry.id} className="relative flex gap-4">
                {/* Timeline dot */}
                <div className="relative z-10 flex-shrink-0">
                  <div
                    className={`size-8 rounded-full border-2 flex items-center justify-center ${
                      isActive
                        ? "bg-emerald-100 border-emerald-500"
                        : "bg-slate-100 border-slate-400"
                    }`}
                  >
                    {isActive ? (
                      <LogIn className="size-4 text-emerald-600" aria-hidden />
                    ) : (
                      <LogOut className="size-4 text-slate-600" aria-hidden />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-4">
                  <div className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {entry.team && (
                          <div className="flex items-center gap-2">
                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                              {entry.team.tag || entry.team.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{entry.team.name}</p>
                              {entry.team.tag && (
                                <p className="text-xs text-muted-foreground">{entry.team.tag}</p>
                              )}
                            </div>
                          </div>
                        )}
                        {idx > 0 && (
                          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                        )}
                        {entry.player && (
                          <div className="flex items-center gap-2">
                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                              {entry.player.ign.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{entry.player.ign}</p>
                              {entry.player.mainRole && (
                                <p className="text-xs text-muted-foreground">{entry.player.mainRole}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {isActive && (
                        <Badge variant="default" className="text-xs">
                          Aktif
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3" aria-hidden />
                        <span>
                          Bergabung: {new Date(entry.joinedAt).toLocaleDateString("id-ID")}
                        </span>
                      </div>
                      {entry.leftAt && (
                        <>
                          <ArrowRight className="size-3" aria-hidden />
                          <span>
                            Keluar: {new Date(entry.leftAt).toLocaleDateString("id-ID")}
                          </span>
                        </>
                      )}
                    </div>

                    {entry.leaveReason && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Alasan keluar:</span> {entry.leaveReason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
