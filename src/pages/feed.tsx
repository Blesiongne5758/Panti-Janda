import { useEffect, useState, useRef } from "react";
import { Heart, MessageCircle, Share2, Trash2, Clock, User, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/session";
import { api } from "@/lib/api";
import type { MediaPost } from "@/lib/types";
import { toast } from "sonner";
import { usePresignedUpload } from "@/hooks/use-presigned-upload";

export function FeedPage() {
  const auth = useAuth();
  const [posts, setPosts] = useState<MediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    type: "photo" as "photo" | "video",
    mediaUrl: "",
    caption: "",
    duration: 6,
  });
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);
  const { uploading, uploadFile, error: uploadError, clearError } = usePresignedUpload();

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed() {
    try {
      const data = await api<{ items: MediaPost[] }>("media.feed", {});
      setPosts(data.items);
    } catch (error) {
      console.error("Failed to load feed:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLike(postId: string) {
    try {
      const data = await api<{ likes: string[] }>("media.like", { postId });
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likes: data.likes } : p))
      );
    } catch (error) {
      toast.error("Gagal memberikan like");
    }
  }

  async function handleComment(postId: string) {
    const text = commentText[postId]?.trim();
    if (!text) return;

    try {
      const data = await api<{ comment: MediaPost["comments"][0] }>("media.comment", { postId, body: text });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments: [...p.comments, data.comment] } : p
        )
      );
      setCommentText((prev) => ({ ...prev, [postId]: "" }));
      toast.success("Komentar ditambahkan");
    } catch (error) {
      toast.error("Gagal menambahkan komentar");
    }
  }

  async function handleShare(postId: string) {
    try {
      const data = await api<{ shares: number }>("media.share", { postId });
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, shares: data.shares } : p))
      );
      toast.success("Postingan dibagikan");
    } catch (error) {
      toast.error("Gagal membagikan postingan");
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm("Hapus postingan ini?")) return;

    try {
      await api<{ deleted: boolean }>("media.delete", { postId });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Postingan dihapus");
    } catch (error) {
      toast.error("Gagal menghapus postingan");
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      toast.error("Hanya file gambar atau video yang diperbolehkan");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 10 MB");
      return;
    }

    setUploadForm({ ...uploadForm, type: isVideo ? "video" : "photo" });
    selectedFileRef.current = file;

    const previewUrl = URL.createObjectURL(file);
    setFilePreview(previewUrl);
  }

  function clearFileSelection() {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    selectedFileRef.current = null;
    setUploadForm({ ...uploadForm, mediaUrl: "" });
    clearError();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    const file = selectedFileRef.current;
    if (!file) {
      toast.error("File harus dipilih");
      return;
    }

    try {
      const result = await uploadFile(file, "public");
      if (!result) {
        toast.error(uploadError || "Upload gagal");
        return;
      }

      const mediaUrl = result.publicUrl || result.key;
      const data = await api<{ post: MediaPost }>("media.create", {
        type: uploadForm.type,
        mediaUrl,
        caption: uploadForm.caption || null,
        duration: uploadForm.type === "video" ? uploadForm.duration : null,
      });

      setPosts((prev) => [data.post, ...prev]);
      setUploadDialogOpen(false);
      setUploadForm({ type: "photo", mediaUrl: "", caption: "", duration: 6 });
      if (filePreview) URL.revokeObjectURL(filePreview);
      setFilePreview(null);
      selectedFileRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Postingan berhasil ditambahkan");
    } catch (error) {
      toast.error("Gagal menambahkan postingan");
    }
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString("id-ID");
  }

  if (!auth.account) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <User className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">Masuk untuk melihat feed</h2>
            <p className="text-muted-foreground">
              Anda perlu masuk untuk melihat dan berinteraksi dengan postingan
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20" />
              <CardContent className="h-64" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Feed</h1>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>Posting Foto/Video</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat Postingan Baru</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Tipe Media</label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={uploadForm.type === "photo" ? "default" : "outline"}
                      onClick={() => setUploadForm({ ...uploadForm, type: "photo" })}
                    >
                      Foto
                    </Button>
                    <Button
                      type="button"
                      variant={uploadForm.type === "video" ? "default" : "outline"}
                      onClick={() => setUploadForm({ ...uploadForm, type: "video" })}
                    >
                      Video Pendek
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Upload {uploadForm.type === "photo" ? "Foto" : "Video"}</label>
                  {filePreview ? (
                    <div className="relative">
                      {uploadForm.type === "photo" ? (
                        <img src={filePreview} alt="Preview" className="max-h-64 w-full rounded-lg object-contain" />
                      ) : (
                        <video src={filePreview} controls className="max-h-64 w-full rounded-lg" />
                      )}
                      <button
                        type="button"
                        onClick={clearFileSelection}
                        className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-destructive text-white"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-8 transition-colors hover:border-primary/50 hover:bg-muted/50">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={uploadForm.type === "photo" ? "image/*" : "video/*"}
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Upload className="size-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Klik untuk pilih {uploadForm.type === "photo" ? "foto" : "video"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {uploadForm.type === "photo" ? "JPG, PNG, atau WebP (maks 10 MB)" : "MP4 atau WebM (maks 10 MB, durasi 6 detik)"}
                      </span>
                    </label>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Caption</label>
                  <Textarea
                    value={uploadForm.caption}
                    onChange={(e) => setUploadForm({ ...uploadForm, caption: e.target.value })}
                    placeholder="Tulis caption..."
                    rows={3}
                  />
                </div>

                {uploadForm.type === "video" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Durasi Video (detik, maks 6)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={6}
                      value={uploadForm.duration}
                      onChange={(e) =>
                        setUploadForm({ ...uploadForm, duration: parseInt(e.target.value) || 6 })
                      }
                    />
                  </div>
                )}

                <Button onClick={handleUpload} className="w-full" disabled={uploading}>
                  {uploading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {uploading ? "Mengunggah..." : "Posting"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Belum ada postingan</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => {
            const isLiked = post.likes.includes(auth.account!.id);
            const isOwner = post.accountId === auth.account!.id;

            return (
              <Card key={post.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{post.authorName}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary">{post.authorTier}</Badge>
                        <span>•</span>
                        <span>{formatTime(post.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(post.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  {post.type === "photo" ? (
                    <img
                      src={post.mediaUrl}
                      alt={post.caption || "Photo"}
                      className="w-full rounded-lg object-cover"
                      style={{ maxHeight: "500px" }}
                    />
                  ) : (
                    <video
                      src={post.mediaUrl}
                      controls
                      className="w-full rounded-lg"
                      style={{ maxHeight: "500px" }}
                      poster=""
                    >
                      Video tidak didukung
                    </video>
                  )}

                  {post.caption && <p className="text-sm">{post.caption}</p>}

                  <div className="flex items-center gap-4 border-t pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(post.id)}
                      className={isLiked ? "text-red-500" : ""}
                    >
                      <Heart
                        className={`mr-1 h-4 w-4 ${isLiked ? "fill-current" : ""}`}
                      />
                      {post.likes.length}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setShowComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                      }
                    >
                      <MessageCircle className="mr-1 h-4 w-4" />
                      {post.comments.length}
                    </Button>

                    <Button variant="ghost" size="sm" onClick={() => handleShare(post.id)}>
                      <Share2 className="mr-1 h-4 w-4" />
                      {post.shares}
                    </Button>

                    {post.type === "video" && post.duration && (
                      <div className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {post.duration}s
                      </div>
                    )}
                  </div>

                  {showComments[post.id] && (
                    <div className="space-y-3 border-t pt-4">
                      {post.comments.map((comment) => (
                        <div key={comment.id} className="flex gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                            <User className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{comment.authorName}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(comment.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm">{comment.body}</p>
                          </div>
                        </div>
                      ))}

                      <div className="flex gap-2">
                        <Input
                          value={commentText[post.id] || ""}
                          onChange={(e) =>
                            setCommentText((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          placeholder="Tulis komentar..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleComment(post.id);
                            }
                          }}
                        />
                        <Button size="sm" onClick={() => handleComment(post.id)}>
                          Kirim
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
