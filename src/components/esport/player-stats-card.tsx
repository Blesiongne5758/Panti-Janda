import { TrendingUp, Trophy, Target, Award, Users } from "lucide-react";
import type { EsportPlayerStats } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PlayerStatsCardProps {
  stats: EsportPlayerStats | null;
  loading?: boolean;
}

export function PlayerStatsCard({ stats, loading }: PlayerStatsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="size-5 text-blue-600" aria-hidden />
            Statistik Pemain
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="size-5 text-blue-600" aria-hidden />
            Statistik Pemain
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Belum ada data statistik.</p>
        </CardContent>
      </Card>
    );
  }

  const statItems = [
    {
      label: "Total Pertandingan",
      value: stats.totalMatches,
      icon: Target,
      color: "text-blue-600",
    },
    {
      label: "Win Rate",
      value: `${stats.winRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-emerald-600",
    },
    {
      label: "KDA Ratio",
      value: stats.kdaRatio.toFixed(2),
      icon: Award,
      color: "text-purple-600",
    },
    {
      label: "Turnamen Dimainkan",
      value: stats.tournamentsPlayed,
      icon: Trophy,
      color: "text-amber-600",
    },
    {
      label: "Turnamen Menang",
      value: stats.tournamentsWon,
      icon: Trophy,
      color: "text-yellow-600",
    },
    {
      label: "MVP Awards",
      value: stats.mvpAwards,
      icon: Award,
      color: "text-orange-600",
    },
    {
      label: "Team Win Rate",
      value: `${stats.teamWinRate.toFixed(1)}%`,
      icon: Users,
      color: "text-indigo-600",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <TrendingUp className="size-5 text-blue-600" aria-hidden />
            Statistik Pemain
          </span>
          {stats.dataSource && (
            <Badge variant="outline" className="text-xs">
              {stats.dataSource}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <Icon className={`size-5 ${item.color}`} aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">
                    {item.label}
                  </p>
                  <p className="text-lg font-semibold">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>
        {stats.gameSpecific && Object.keys(stats.gameSpecific).length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-2">Statistik Game Spesifik</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.gameSpecific).map(([key, value]) => (
                <Badge key={key} variant="secondary">
                  {key}: {value}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
