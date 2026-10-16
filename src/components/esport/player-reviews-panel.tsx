import { useState } from "react";
import { Star, MessageSquare, User, Calendar } from "lucide-react";
import { api, errorText } from "@/lib/api";
import type { EsportPlayerReview, EsportPlayerReviewSummary } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PlayerReviewsPanelProps {
  playerProfileId: string;
  reviews: EsportPlayerReview[];
  summary: EsportPlayerReviewSummary | null;
  onRefresh: () => void;
}

function StarRating({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground min-w-[100px]">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "size-4",
              star <= value ? "fill-yellow-400 text-yellow-400" : "text-slate-300"
            )}
            aria-hidden
          />
        ))}
      </div>
      <span className="text-sm font-medium">{value.toFixed(1)}</span>
    </div>
  );
}

export function PlayerReviewsPanel({
  playerProfileId,
  reviews,
  summary,
  onRefresh,
}: PlayerReviewsPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ratingSkill, setRatingSkill] = useState(5);
  const [ratingTeamwork, setRatingTeamwork] = useState(5);
  const [ratingDiscipline, setRatingDiscipline] = useState(5);
  const [ratingCommunication, setRatingCommunication] = useState(5);
  const [comment, setComment] = useState("");

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const json = await api<{ review: EsportPlayerReview }>("esport.transfer.reviews.create", {
        playerProfileId,
        ratingSkill,
        ratingTeamwork,
        ratingDiscipline,
        ratingCommunication,
        comment: comment.trim() || null,
      });
      if (json.review) {
        toast.success("Review berhasil disimpan");
        setShowForm(false);
        setComment("");
        onRefresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <MessageSquare className="size-5 text-green-600" aria-hidden />
            Review Pemain
          </span>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Batal" : "Tulis Review"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary && summary.reviewCount > 0 && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium">Rating Rata-rata</p>
            <StarRating value={summary.avgSkill} label="Skill" />
            <StarRating value={summary.avgTeamwork} label="Teamwork" />
            <StarRating value={summary.avgDiscipline} label="Disiplin" />
            <StarRating value={summary.avgCommunication} label="Komunikasi" />
            <div className="pt-2 border-t">
              <StarRating value={summary.avgOverall} label="Overall" />
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Berdasarkan {summary.reviewCount} review
            </p>
          </div>
        )}

        {showForm && (
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <p className="text-sm font-medium">Beri Rating</p>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="min-w-[120px]">Skill</Label>
                <select
                  value={ratingSkill}
                  onChange={(e) => setRatingSkill(Number(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>{v} Bintang</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="min-w-[120px]">Teamwork</Label>
                <select
                  value={ratingTeamwork}
                  onChange={(e) => setRatingTeamwork(Number(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>{v} Bintang</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="min-w-[120px]">Disiplin</Label>
                <select
                  value={ratingDiscipline}
                  onChange={(e) => setRatingDiscipline(Number(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>{v} Bintang</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="min-w-[120px]">Komunikasi</Label>
                <select
                  value={ratingCommunication}
                  onChange={(e) => setRatingCommunication(Number(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>{v} Bintang</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Komentar (opsional)</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tulis komentar tentang pemain ini..."
                rows={3}
              />
            </div>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan Review"}
            </Button>
          </div>
        )}

        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Belum ada review untuk pemain ini.
          </p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {review.reviewer?.name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{review.reviewer?.name || "Anonim"}</p>
                      {review.reviewerTeam && (
                        <p className="text-xs text-muted-foreground">
                          {review.reviewerTeam.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="size-3" aria-hidden />
                    {new Date(review.createdAt).toLocaleDateString("id-ID")}
                  </div>
                </div>
                <div className="space-y-1">
                  <StarRating value={review.ratingSkill} label="Skill" />
                  <StarRating value={review.ratingTeamwork} label="Teamwork" />
                  <StarRating value={review.ratingDiscipline} label="Disiplin" />
                  <StarRating value={review.ratingCommunication} label="Komunikasi" />
                </div>
                {review.comment && (
                  <p className="text-sm text-muted-foreground pt-2 border-t">
                    {review.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
