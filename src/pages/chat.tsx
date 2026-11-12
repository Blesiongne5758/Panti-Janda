import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  Clock,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Phone,
  Search,
  Send,
  UserCheck,
  UserPlus,
  Users,
  LogOut,
  Plus,
  Video,
  X,
  Camera,
  Image,
  Paperclip,
  FileText,
  Download,
  ZoomIn,
  ZoomOut,
  Eye,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { CameraCaptureDialog, type CapturedMedia } from "@/components/camera-capture-dialog";
import { compressImage, formatFileSize } from "@/lib/image-compress";
import { usePresignedUpload } from "@/hooks/use-presigned-upload";
import { useAuth } from "@/lib/session";
import { useVoiceCall } from "@/lib/call-context";
import { useQueryParam } from "@/lib/router";
import { ROLE_LABEL, ROLE_RANK, TIER_META } from "@/lib/constants";
import type { ChatContact, ChatMessage, FriendItem, FriendshipStatus, GroupItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AccountGate, EmptyState, ErrorNote, MemberAvatar, TierBadge } from "@/components/common";
import { Link } from "@/lib/router";
import { toast } from "sonner";

type Thread = { kind: "dm"; accountId: string } | { kind: "group"; id: string };
type SidebarTab = "chats" | "search" | "requests";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

function lastSeenLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay ? timeOf(iso) : date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}


// Format nama panggilan: hanya nama depan tanpa spasi, dibatasi maksimal karakter

function formatLastMessage(rawBody: string): string {
  if (rawBody && rawBody.startsWith('{"__attachment":true')) {
    try {
      const parsed = JSON.parse(rawBody);
      const prefix = parsed.attachment?.type === "image" ? "📷 [Foto]" : "📎 [Dokumen]";
      return parsed.text ? `${prefix} ${parsed.text}` : prefix;
    } catch {
      // ignore
    }
  }
  return rawBody;
}

function formatCallName(rawName?: string | null, maxChars = 8): string {
  if (!rawName) return "Pengguna";
  const firstWord = rawName.trim().split(/\s+/)[0] || "Pengguna";
  const clean = firstWord.replace(/\s+/g, "");
  return clean.length > maxChars ? `${clean.slice(0, maxChars)}…` : clean;
}


/** Download file dari URL — force-download via fetch+blob agar tidak sekadar buka tab baru */
async function forceDownload(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "unduhan";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 1500);
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "unduhan";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 500);
  }
}

/** Lightbox full-screen: pratinjau foto, zoom in/out, unduh ke perangkat */
function ImageLightbox({
  url,
  name,
  onClose,
}: {
  url: string;
  name: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleDownload = async () => {
    setDownloading(true);
    await forceDownload(url, name);
    setDownloading(false);
  };

  const handleZoomIn  = () => setZoom((z) => Math.min(z + 0.5, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.5, 1));

  const content = (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5 bg-black/80 backdrop-blur-md border-b border-white/10">
        <p className="truncate text-xs text-zinc-300 font-medium flex-1 min-w-0">{name || "Foto"}</p>
        <div className="flex items-center gap-0.5 shrink-0">
          <button type="button" onClick={handleZoomOut} disabled={zoom <= 1}
            className="flex size-8 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 disabled:opacity-30 transition-colors"
            title="Perkecil" aria-label="Perkecil">
            <ZoomOut className="size-4" />
          </button>
          <span className="text-[11px] font-mono text-zinc-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={handleZoomIn} disabled={zoom >= 4}
            className="flex size-8 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 disabled:opacity-30 transition-colors"
            title="Perbesar" aria-label="Perbesar">
            <ZoomIn className="size-4" />
          </button>
          <button type="button" onClick={() => void handleDownload()} disabled={downloading}
            className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 ml-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            title="Unduh ke perangkat">
            {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            <span className="hidden sm:inline">Unduh</span>
          </button>
          <button type="button" onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 transition-colors ml-1"
            title="Tutup" aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div
        className="flex flex-1 min-h-0 items-center justify-center overflow-auto p-4 relative"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Loader2 className="size-8 animate-spin text-white/40" />
          </div>
        )}
        <img
          src={url}
          alt={name}
          onLoad={() => setLoaded(true)}
          className="rounded-xl object-contain select-none transition-transform duration-200 ease-out"
          style={{
            maxWidth: "90vw",
            maxHeight: "calc(100dvh - 120px)",
            transform: "scale(" + String(zoom) + ")",
            transformOrigin: "center center",
            cursor: zoom < 4 ? "zoom-in" : "zoom-out",
            opacity: loaded ? 1 : 0,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (zoom < 4) handleZoomIn();
            else setZoom(1);
          }}
          draggable={false}
        />
      </div>

      <div className="flex shrink-0 items-center justify-center gap-4 px-4 py-3 bg-black/80 border-t border-white/10">
        <button type="button" onClick={() => setZoom(1)}
          className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
          Reset Zoom
        </button>
        <span className="text-zinc-700 text-xs">|</span>
        <button type="button" onClick={() => void handleDownload()} disabled={downloading}
          className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition-colors disabled:opacity-50">
          {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          Simpan ke Perangkat
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

interface ParsedAttachment {
  type: "image" | "file";
  url: string;
  name: string;
  size?: number;
}

function MessageBubble({
  message,
  mine,
  onPreviewImage,
}: {
  message: ChatMessage;
  mine: boolean;
  onPreviewImage?: (url: string, name: string) => void;
}) {
  const parsed = useMemo<{ text: string; attachment?: ParsedAttachment }>(() => {
    if (message.body && message.body.startsWith('{"__attachment":true')) {
      try {
        const obj = JSON.parse(message.body);
        return {
          text: obj.text || "",
          attachment: obj.attachment as ParsedAttachment,
        };
      } catch {
        // fallback
      }
    }
    return { text: message.body };
  }, [message.body]);

  return (
    <div className={`flex w-full gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine ? <MemberAvatar name={message.senderName} photoData={message.senderPhoto} size={28} /> : null}
      <div className={`max-w-[85%] sm:max-w-[78%] space-y-0.5 ${mine ? "items-end text-right" : ""}`}>
        {!mine ? <p className="px-1 text-[11px] font-medium text-muted-foreground">{message.senderName}</p> : null}
        <div
          className={`inline-block overflow-hidden rounded-2xl text-sm leading-relaxed ${
            mine
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md border border-border bg-secondary text-secondary-foreground"
          }`}
        >
          {/* Pratinjau Foto — klik untuk perbesar, tombol unduh di sudut */}
          {parsed.attachment?.type === "image" && (
            <div className="p-1 relative group">
              <img
                src={parsed.attachment.url}
                alt={parsed.attachment.name || "Foto"}
                className="max-h-60 sm:max-h-72 w-auto max-w-full rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => onPreviewImage?.(parsed.attachment!.url, parsed.attachment!.name || "Foto")}
                loading="lazy"
              />
              {/* Tombol unduh foto — muncul saat hover */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void forceDownload(parsed.attachment!.url, parsed.attachment!.name || "foto.jpg"); }}
                className="absolute bottom-2.5 right-2.5 flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-black/80"
                title="Unduh foto ke perangkat"
                aria-label="Unduh foto"
              >
                <Download className="size-3.5" />
              </button>
            </div>
          )}

          {/* Lampiran Dokumen — klik kartu untuk force-download ke perangkat */}
          {parsed.attachment?.type === "file" && (
            <div className="p-1.5">
              <button
                type="button"
                onClick={() => void forceDownload(parsed.attachment!.url, parsed.attachment!.name)}
                className={`flex w-full items-center gap-2.5 p-2 rounded-xl transition-colors text-left ${
                  mine
                    ? "bg-white/10 hover:bg-white/20 text-white"
                    : "bg-background/80 hover:bg-background text-foreground border border-border/60"
                }`}
                title={"Unduh " + parsed.attachment.name}
              >
                <div className={`p-2 rounded-lg shrink-0 ${mine ? "bg-white/20" : "bg-primary/10 text-primary"}`}>
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-xs font-semibold">{parsed.attachment.name}</p>
                  <p className={`text-[10px] ${mine ? "text-white/80" : "text-muted-foreground"}`}>
                    {parsed.attachment.size ? formatFileSize(parsed.attachment.size) : "Berkas"}
                    {" · Ketuk untuk unduh"}
                  </p>
                </div>
                <Download className="size-4 shrink-0 opacity-60 group-hover:opacity-100" />
              </button>
            </div>
          )}

          {/* Teks Pesan */}
          {parsed.text ? (
            <p className="px-3.5 py-2 text-left whitespace-pre-line leading-relaxed">{parsed.text}</p>
          ) : null}
        </div>
        <p className="px-1 text-[10px] text-muted-foreground">{timeOf(message.createdAt)}</p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { account, ready } = useAuth();
  const { startCall } = useVoiceCall();
  const rank = account ? ROLE_RANK[account.role] : 0;
  const withParam = useQueryParam("with");
  const groupParam = useQueryParam("grup");
  const tabParam = useQueryParam("tab");

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(
    tabParam === "requests" ? "requests" : tabParam === "search" ? "search" : "chats",
  );

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingLists, setLoadingLists] = useState(true);

  // Friend requests state
  const [incomingRequests, setIncomingRequests] = useState<FriendItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Search users state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Group creation & member management states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupFormName, setGroupFormName] = useState("");
  const [groupFormDesc, setGroupFormDesc] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedAddMembers, setSelectedAddMembers] = useState<Set<string>>(new Set());
  const [addingMembers, setAddingMembers] = useState(false);

  // Attachment states (Kamera, Galeri, Dokumen)
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    type: "image" | "file";
    previewUrl: string;
  } | null>(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState<{ url: string; name: string } | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const { uploadFile, uploading: uploadingAttachment } = usePresignedUpload();

  // Active Thread state
  const [thread, setThread] = useState<Thread | null>(null);
  const [threadContact, setThreadContact] = useState<ChatContact | null>(null);
  const [threadFriendship, setThreadFriendship] = useState<FriendshipStatus>("accepted");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Load Contacts & Groups
  const loadLists = useCallback(async () => {
    try {
      const [contactData, groupData] = await Promise.all([
        api<{ items: ChatContact[]; incomingCount?: number }>("chat.contacts"),
        api<{ items: GroupItem[] }>("groups.list").catch(() => ({ items: [] as GroupItem[] })),
      ]);
      setContacts(contactData.items);
      setGroups(groupData.items.filter((group) => group.joined));
      setListError(null);
    } catch (error) {
      setListError(errorText(error));
    } finally {
      setLoadingLists(false);
    }
  }, [rank]);

  // Load Friend Requests
  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const data = await api<{
        incoming: FriendItem[];
        outgoing: FriendItem[];
      }>("friends.list");
      setIncomingRequests(data.incoming ?? []);
      setOutgoingRequests(data.outgoing ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  // Search Users
  const searchUsers = useCallback(async (query: string) => {
    setSearching(true);
    try {
      const data = await api<{ items: FriendItem[] }>("friends.search", { query });
      setSearchResults(data.items ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (rank >= 1) {
      void loadLists();
      void loadRequests();
    }
  }, [loadLists, loadRequests, rank]);

  // Search debounce
  useEffect(() => {
    if (sidebarTab === "search") {
      const timer = setTimeout(() => {
        void searchUsers(searchQuery);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchUsers, sidebarTab]);

  useEffect(() => {
    if (rank < 1 || loadingLists) return;
    if (thread || (!withParam && !groupParam)) return;
    if (withParam) setThread({ kind: "dm", accountId: withParam });
    else if (groupParam) setThread({ kind: "group", id: groupParam });
  }, [groupParam, loadingLists, rank, thread, withParam]);

  const activeContact = useMemo(() => {
    if (thread?.kind !== "dm") return null;
    return contacts.find((item) => item.accountId === thread.accountId) ?? threadContact;
  }, [contacts, thread, threadContact]);

  const activeGroup = useMemo(
    () => (thread?.kind === "group" ? groups.find((item) => item.id === thread.id) ?? null : null),
    [groups, thread],
  );

  // Load conversation thread
  const loadThread = useCallback(
    async (silent = false) => {
      if (!thread) return;
      if (!silent) setThreadLoading(true);
      try {
        if (thread.kind === "dm") {
          const data = await api<{
            items: ChatMessage[];
            contact?: ChatContact;
            friendshipStatus?: FriendshipStatus;
          }>("chat.thread", { withAccountId: thread.accountId });
          setMessages(data.items);
          if (data.contact) setThreadContact(data.contact);
          setThreadFriendship(data.friendshipStatus ?? "accepted");
        } else {
          const data = await api<{ items: ChatMessage[] }>("groups.messages", { id: thread.id });
          setMessages(data.items);
          setThreadFriendship("accepted");
        }
        setThreadError(null);
      } catch (error) {
        if (!silent) setThreadError(errorText(error));
      } finally {
        if (!silent) setThreadLoading(false);
      }
    },
    [thread],
  );

  useEffect(() => {
    if (!thread) {
      setMessages([]);
      setThreadContact(null);
      return;
    }
    void loadThread();
    const timer = window.setInterval(() => void loadThread(true), 4000);
    return () => window.clearInterval(timer);
  }, [loadThread, thread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Friend Request Actions
  const handleSendRequest = async (targetAccountId: string) => {
    try {
      await api("friends.request", { targetAccountId });
      toast.success("Permintaan pertemanan berhasil dikirim!");
      void loadRequests();
      void searchUsers(searchQuery);
      if (thread?.kind === "dm" && thread.accountId === targetAccountId) {
        setThreadFriendship("pending_outgoing");
      }
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const handleRespondRequest = async (targetAccountId: string, action: "accept" | "reject") => {
    try {
      await api("friends.respond", { targetAccountId, decision: action, response: action });
      toast.success(action === "accept" ? "Pertemanan disetujui! Anda sekarang bisa saling chat." : "Permintaan ditolak.");
      void loadLists();
      void loadRequests();
      void searchUsers(searchQuery);
      if (thread?.kind === "dm" && thread.accountId === targetAccountId) {
        setThreadFriendship(action === "accept" ? "accepted" : "none");
        void loadThread(true);
      }
    } catch (error) {
      toast.error(errorText(error));
    }
  };


  // Group Actions
  const handleCreateGroup = async () => {
    const name = groupFormName.trim();
    if (name.length < 3) {
      toast.error("Nama grup minimal 3 karakter.");
      return;
    }
    setCreatingGroup(true);
    try {
      const res = await api<{ group: GroupItem }>("groups.create", {
        name,
        description: groupFormDesc.trim() || null,
        memberAccountIds: Array.from(selectedFriends),
      });
      toast.success(`Grup "${res.group.name}" berhasil dibuat!`);
      setShowCreateGroupModal(false);
      setGroupFormName("");
      setGroupFormDesc("");
      setSelectedFriends(new Set());
      await loadLists();
      setThread({ kind: "group", id: res.group.id });
    } catch (error) {
      toast.error(errorText(error) || "Gagal membuat grup.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleAddMembers = async () => {
    if (!activeGroup || selectedAddMembers.size === 0) return;
    setAddingMembers(true);
    try {
      await api("groups.addMembers", {
        id: activeGroup.id,
        memberAccountIds: Array.from(selectedAddMembers),
      });
      toast.success("Anggota berhasil ditambahkan ke grup!");
      setShowAddMemberModal(false);
      setSelectedAddMembers(new Set());
      await loadLists();
      void loadThread(true);
    } catch (error) {
      toast.error(errorText(error) || "Gagal menambahkan anggota.");
    } finally {
      setAddingMembers(false);
    }
  };


  // Attachment Handlers
  const handleCameraCapture = (media: CapturedMedia) => {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment({
      file: media.file,
      type: "image",
      previewUrl: media.previewUrl,
    });
    toast.success(`Foto kamera siap dikirim (${formatFileSize(media.file.size)})`);
  };

  const handleGallerySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading("Mengompresi foto...", { id: "compress-chat" });
      const compressed = await compressImage(file, { maxWidth: 1200, quality: 0.75 });
      toast.success(
        `Foto dikompresi: ${formatFileSize(file.size)} → ${formatFileSize(compressed.size)}`,
        { id: "compress-chat" },
      );
      if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
      const previewUrl = URL.createObjectURL(compressed);
      setPendingAttachment({
        file: compressed,
        type: "image",
        previewUrl,
      });
    } catch {
      toast.dismiss("compress-chat");
      toast.error("Gagal memproses foto");
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ukuran berkas dokumen maksimal 10 MB.");
      return;
    }
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    setPendingAttachment({
      file,
      type: "file",
      previewUrl,
    });
    toast.success(`Berkas "${file.name}" (${formatFileSize(file.size)}) siap dikirim.`);
    if (e.target) e.target.value = "";
  };

  const clearPendingAttachment = () => {
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    setPendingAttachment(null);
  };

  const handleLeaveGroup = async (groupId: string, groupName: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin keluar dari grup "${groupName}"?`)) {
      return;
    }
    try {
      await api("groups.leave", { id: groupId });
      toast.success(`Anda telah keluar dari grup "${groupName}".`);
      setThread(null);
      await loadLists();
    } catch (error) {
      toast.error(errorText(error) || "Gagal keluar dari grup.");
    }
  };

  const handleCancelRequest = async (targetAccountId: string) => {
    try {
      await api("friends.cancel", { targetAccountId });
      toast.info("Permintaan pertemanan dibatalkan.");
      void loadRequests();
      void searchUsers(searchQuery);
      if (thread?.kind === "dm" && thread.accountId === targetAccountId) {
        setThreadFriendship("none");
      }
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const send = async () => {
    const textBody = draft.trim();
    if (!textBody && !pendingAttachment) return;
    if (!thread) return;

    if (thread.kind === "dm" && threadFriendship !== "accepted") {
      toast.error("Anda harus berteman terlebih dahulu untuk mengirim pesan.");
      return;
    }

    setSending(true);
    try {
      let bodyToSend = textBody;

      if (pendingAttachment) {
        toast.loading("Mengunggah lampiran...", { id: "send-attach" });
        const uploadRes = await uploadFile(pendingAttachment.file, "public");
        const fileUrl = uploadRes?.publicUrl || uploadRes?.key;
        toast.dismiss("send-attach");

        if (!fileUrl) {
          toast.error("Gagal mengunggah lampiran");
          setSending(false);
          return;
        }

        const attachmentData = {
          type: pendingAttachment.type,
          url: fileUrl,
          name: pendingAttachment.file.name,
          size: pendingAttachment.file.size,
        };

        bodyToSend = JSON.stringify({
          __attachment: true,
          text: textBody,
          attachment: attachmentData,
        });
      }

      if (thread.kind === "dm") {
        await api("chat.send", { withAccountId: thread.accountId, body: bodyToSend });
      } else {
        await api("groups.send", { id: thread.id, body: bodyToSend });
      }
      setDraft("");
      clearPendingAttachment();
      await loadThread(true);
      void loadLists();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSending(false);
    }
  };

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <AccountGate
        title="Masuk untuk membuka pesan"
        description="Chat pribadi dan ruang grup hanya untuk anggota Panti Janda. Masuk atau daftar untuk mulai berkomunikasi."
      />
    );
  }

  return (
    <div
      className={`mx-auto flex w-full max-w-6xl flex-col ${
        thread
          ? "fixed inset-0 top-14 z-[60] flex flex-col bg-background sm:static sm:z-auto sm:top-auto sm:inset-auto sm:mx-auto sm:max-w-6xl sm:gap-6 sm:px-4 sm:py-8 lg:py-10"
          : "gap-4 sm:gap-6 px-3 py-4 sm:px-4 sm:py-8 lg:py-10"
      }`}
    >
      {/* Outer Header (hidden when chat thread active on mobile) */}
      <div className={`flex flex-wrap items-end justify-between gap-4 ${thread ? "hidden lg:flex" : "flex"}`}>
        <div className="max-w-2xl space-y-1">
          <p className="text-xs font-semibold tracking-[0.18em] text-accent-foreground uppercase">Komunikasi komunitas</p>
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">Chat & Teman</h1>
        </div>
      </div>

      {listError ? <ErrorNote message={listError} onRetry={loadLists} /> : null}

      <div
        className={`overflow-hidden border-0 sm:border border-border bg-card shadow-sm rounded-none sm:rounded-3xl ${
          thread
            ? "flex-1 min-h-0 flex flex-col sm:grid sm:grid-cols-[300px_1fr] sm:h-[74dvh] overflow-hidden"
            : "grid lg:grid-cols-[300px_1fr]"
        }`}
      >
        {/* SIDEBAR */}
        <aside
          className={`flex flex-col border-border lg:border-r ${
            thread ? "hidden lg:flex lg:h-[74dvh]" : "flex border-b h-[calc(100dvh-140px)] sm:h-[74dvh]"
          }`}
        >
          {/* TAB SWITCHER */}
          <div className="flex border-b border-border bg-muted/40 p-1.5 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarTab("chats")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
                sidebarTab === "chats"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageCircle className="size-3.5" />
              <span>Obrolan</span>
            </button>

            <button
              type="button"
              onClick={() => setSidebarTab("search")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
                sidebarTab === "search"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="size-3.5" />
              <span>Cari User</span>
            </button>

            <button
              type="button"
              onClick={() => setSidebarTab("requests")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all relative ${
                sidebarTab === "requests"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCheck className="size-3.5" />
              <span>Permintaan</span>
              {incomingRequests.length > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white animate-pulse">
                  {incomingRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB CONTENT */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {/* 1. CHATS TAB */}
            {sidebarTab === "chats" && (
              <>
                {loadingLists ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                  </div>
                ) : (
                  <div className="flex flex-col">

                    {/* ── SECTION HEADER: Teman ── */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
                      <p className="text-[10px] font-bold tracking-widest text-muted-foreground/70 uppercase">
                        Teman
                        <span className="ml-1.5 font-normal text-muted-foreground/50">({contacts.length})</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setSidebarTab("search")}
                        className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        <UserPlus className="size-3" />
                        Tambah
                      </button>
                    </div>

                    {/* ── DAFTAR TEMAN ── */}
                    {contacts.length === 0 ? (
                      <div className="mx-3 my-2 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-6 text-center">
                        <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
                          <Users className="size-4 text-muted-foreground" aria-hidden />
                        </span>
                        <p className="text-xs text-muted-foreground">Belum ada teman terhubung.</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs rounded-full gap-1.5 px-3"
                          onClick={() => setSidebarTab("search")}
                        >
                          <UserPlus className="size-3" />
                          Cari & Tambah Pengguna
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {contacts.map((contact) => {
                          const active = thread?.kind === "dm" && thread.accountId === contact.accountId;
                          return (
                            <button
                              key={contact.accountId}
                              type="button"
                              onClick={() => setThread({ kind: "dm", accountId: contact.accountId })}
                              className={`group flex w-full items-center gap-3 border-b border-border/40 px-3 py-2.5 text-left transition-colors ${
                                active
                                  ? "bg-primary/10 border-l-2 border-l-primary"
                                  : "hover:bg-secondary/50"
                              }`}
                            >
                              {/* Avatar */}
                              <div className="relative shrink-0">
                                <MemberAvatar
                                  name={contact.nickname}
                                  tier={contact.tier}
                                  photoData={contact.photoData}
                                  size={40}
                                />
                              </div>

                              {/* Info */}
                              <span className="min-w-0 flex-1 overflow-hidden">
                                <span className="flex items-baseline justify-between gap-1.5">
                                  <span className={`truncate text-sm leading-snug ${active ? "font-semibold text-primary" : "font-semibold text-foreground"}`}>
                                    {contact.nickname}
                                  </span>
                                  {contact.lastMessage && (
                                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                                      {lastSeenLabel(contact.lastMessage.createdAt)}
                                    </span>
                                  )}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                                  {contact.lastMessage
                                    ? (contact.lastMessage.fromMe ? "Anda: " : "") + formatLastMessage(contact.lastMessage.body)
                                    : "Mulai obrolan"}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* ── SECTION HEADER: Grup Chat ── */}
                    <div className="flex items-center justify-between border-t border-border/40 px-4 pt-3 pb-1.5 mt-1">
                      <p className="text-[10px] font-bold tracking-widest text-muted-foreground/70 uppercase">
                        Grup Chat
                        <span className="ml-1.5 font-normal text-muted-foreground/50">({groups.length})</span>
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] rounded-full gap-1 text-primary hover:bg-primary/10"
                        onClick={() => {
                          setGroupFormName("");
                          setGroupFormDesc("");
                          setSelectedFriends(new Set());
                          setShowCreateGroupModal(true);
                        }}
                      >
                        <Plus className="size-3" />
                        Buat Grup
                      </Button>
                    </div>

                    {/* ── DAFTAR GRUP ── */}
                    {groups.length === 0 ? (
                      <div className="mx-3 my-2 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-5 text-center">
                        <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
                          <Users className="size-4 text-muted-foreground" aria-hidden />
                        </span>
                        <p className="text-xs text-muted-foreground">Belum bergabung dengan grup.</p>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          onClick={() => {
                            setGroupFormName("");
                            setGroupFormDesc("");
                            setSelectedFriends(new Set());
                            setShowCreateGroupModal(true);
                          }}
                        >
                          <Plus className="size-3" />
                          Buat grup baru
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col pb-2">
                        {groups.map((group) => {
                          const active = thread?.kind === "group" && thread.id === group.id;
                          return (
                            <button
                              key={group.id}
                              type="button"
                              onClick={() => setThread({ kind: "group", id: group.id })}
                              className={`group flex w-full items-center gap-3 border-b border-border/40 px-3 py-2.5 text-left transition-colors ${
                                active
                                  ? "bg-primary/10 border-l-2 border-l-primary"
                                  : "hover:bg-secondary/50"
                              }`}
                            >
                              {/* Grup Icon Avatar */}
                              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Users className="size-4" aria-hidden />
                              </span>

                              {/* Info */}
                              <span className="min-w-0 flex-1 overflow-hidden">
                                <span className={`block truncate text-sm leading-snug ${active ? "font-semibold text-primary" : "font-semibold text-foreground"}`}>
                                  {group.name}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                                  {group.memberCount} anggota
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* 2. SEARCH & ADD USERS TAB */}
            {sidebarTab === "search" && (
              <div className="flex flex-col">
                <div className="p-3 border-b border-border/60 sticky top-0 bg-card z-10">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari nama pengguna..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs rounded-xl"
                    />
                  </div>
                </div>

                {searching ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-8 text-center space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {searchQuery ? "Tidak ditemukan pengguna yang cocok." : "Ketik nama untuk mencari pengguna lain."}
                    </p>
                  </div>
                ) : (
                  searchResults.map((user) => (
                    <div
                      key={user.accountId}
                      className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <MemberAvatar
                          name={user.nickname}
                          tier={user.tier}
                          photoData={user.photoData}
                          size={36}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{user.nickname}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {user.tier ? ROLE_LABEL[user.tier] : "Pengguna"}
                          </p>
                        </div>
                      </div>

                      {/* Action status button */}
                      <div className="shrink-0">
                        {user.friendshipStatus === "none" && (
                          <Button
                            size="sm"
                            className="h-8 px-2.5 text-xs rounded-full gap-1"
                            onClick={() => void handleSendRequest(user.accountId)}
                          >
                            <UserPlus className="size-3.5" />
                            Tambah
                          </Button>
                        )}

                        {user.friendshipStatus === "pending_outgoing" && (
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Clock className="size-3" />
                              Menunggu
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 rounded-full"
                              onClick={() => void handleCancelRequest(user.accountId)}
                              title="Batalkan Permintaan"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        )}

                        {user.friendshipStatus === "pending_incoming" && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-full gap-0.5"
                              onClick={() => void handleRespondRequest(user.accountId, "accept")}
                            >
                              <Check className="size-3" /> Setujui
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs rounded-full"
                              onClick={() => void handleRespondRequest(user.accountId, "reject")}
                            >
                              Tolak
                            </Button>
                          </div>
                        )}

                        {user.friendshipStatus === "accepted" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 px-3 text-xs rounded-full gap-1.5 text-emerald-700 dark:text-emerald-400"
                            onClick={() => {
                              setThread({ kind: "dm", accountId: user.accountId });
                              setSidebarTab("chats");
                            }}
                          >
                            <MessageCircle className="size-3.5" />
                            Chat
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 3. REQUESTS TAB */}
            {sidebarTab === "requests" && (
              <div className="flex flex-col">
                {loadingRequests ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                  </div>
                ) : (
                  <>
                    {/* Incoming requests */}
                    <div className="border-b border-border">
                      <p className="px-4 pt-3 pb-2 text-[11px] font-semibold tracking-wide text-foreground uppercase flex items-center justify-between">
                        <span>Permintaan Masuk</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">
                          {incomingRequests.length}
                        </span>
                      </p>

                      {incomingRequests.length === 0 ? (
                        <p className="px-4 pb-4 pt-1 text-xs text-muted-foreground">
                          Tidak ada permintaan pertemanan masuk.
                        </p>
                      ) : (
                        incomingRequests.map((req) => (
                          <div
                            key={req.accountId}
                            className="flex items-center justify-between gap-3 border-t border-border/50 px-4 py-3 bg-muted/20"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <MemberAvatar
                                name={req.nickname}
                                tier={req.tier}
                                photoData={req.photoData}
                                size={36}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{req.nickname}</p>
                                <p className="text-[11px] text-muted-foreground">Mengajak berteman</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                size="sm"
                                className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-full gap-1"
                                onClick={() => void handleRespondRequest(req.accountId, "accept")}
                              >
                                <Check className="size-3.5" />
                                Terima
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-xs rounded-full"
                                onClick={() => void handleRespondRequest(req.accountId, "reject")}
                              >
                                Tolak
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Outgoing requests */}
                    <div>
                      <p className="px-4 pt-4 pb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase flex items-center justify-between">
                        <span>Permintaan Terkirim</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">
                          {outgoingRequests.length}
                        </span>
                      </p>

                      {outgoingRequests.length === 0 ? (
                        <p className="px-4 pb-4 pt-1 text-xs text-muted-foreground">
                          Tidak ada permintaan terkirim yang menunggu.
                        </p>
                      ) : (
                        outgoingRequests.map((req) => (
                          <div
                            key={req.accountId}
                            className="flex items-center justify-between gap-3 border-t border-border/50 px-4 py-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <MemberAvatar
                                name={req.nickname}
                                tier={req.tier}
                                photoData={req.photoData}
                                size={36}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{req.nickname}</p>
                                <p className="text-[11px] text-amber-600 dark:text-amber-400">Menunggu persetujuan</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-xs rounded-full text-rose-500 hover:text-rose-600"
                              onClick={() => void handleCancelRequest(req.accountId)}
                            >
                              Batalkan
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* CHAT CONVERSATION SECTION */}
        <section className={`flex flex-1 min-h-0 flex-col overflow-hidden ${thread ? "flex" : "hidden lg:flex"}`}>
          {thread ? (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Header */}
              <header className="flex shrink-0 items-center gap-2 sm:gap-3 border-b border-border px-3 sm:px-4 py-2.5 sm:py-3 bg-card z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 lg:hidden shrink-0"
                  aria-label="Kembali ke daftar"
                  onClick={() => setThread(null)}
                >
                  <ArrowLeft className="size-4" aria-hidden />
                </Button>

                {activeContact ? (
                  <>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MemberAvatar
                        name={activeContact.nickname}
                        tier={activeContact.tier}
                        photoData={activeContact.photoData}
                        size={36}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-semibold text-foreground leading-tight"
                          title={activeContact.nickname}
                        >
                          {activeContact.nickname}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground leading-tight">
                          {activeContact.tier ? ROLE_LABEL[activeContact.tier] : "Pengguna"}
                          {threadFriendship === "accepted" ? " • Teman" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                      {threadFriendship === "accepted" && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 sm:w-auto sm:px-3 sm:py-2 gap-1.5 rounded-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40 shrink-0"
                            onClick={() =>
                              void startCall(
                                {
                                  accountId: activeContact.accountId,
                                  name: activeContact.nickname,
                                  photoData: activeContact.photoData,
                                },
                                "audio",
                              )
                            }
                            title="Mulai Panggilan Suara"
                          >
                            <Phone className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="hidden sm:inline">Suara</span>
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 sm:w-auto sm:px-3 sm:py-2 gap-1.5 rounded-full border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/40 shrink-0"
                            onClick={() =>
                              void startCall(
                                {
                                  accountId: activeContact.accountId,
                                  name: activeContact.nickname,
                                  photoData: activeContact.photoData,
                                },
                                "video",
                              )
                            }
                            title="Mulai Panggilan Video"
                          >
                            <Video className="size-3.5 text-violet-600 dark:text-violet-400" />
                            <span className="hidden sm:inline">Video</span>
                          </Button>
                        </>
                      )}

                      {activeContact.profileId ? (
                        <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-2.5 text-xs shrink-0 rounded-full">
                          <Link to={`/janda/${activeContact.profileId}`}>
                            <span className="hidden sm:inline">Lihat profil</span>
                            <span className="sm:hidden">Profil</span>
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </>
                ) : activeGroup ? (
                  <>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Users className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-semibold text-foreground leading-tight"
                          title={activeGroup.name}
                        >
                          {activeGroup.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground leading-tight">
                          {activeGroup.memberCount} anggota
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 sm:px-3 text-xs rounded-full gap-1 border-border shrink-0"
                        onClick={() => {
                          setSelectedAddMembers(new Set());
                          setShowAddMemberModal(true);
                        }}
                        title="Tambah Anggota"
                      >
                        <UserPlus className="size-3.5 text-muted-foreground" />
                        <span className="hidden sm:inline">Tambah</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 sm:px-3 text-xs rounded-full gap-1 border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40 shrink-0"
                        onClick={() => void handleLeaveGroup(activeGroup.id, activeGroup.name)}
                        title="Keluar dari Grup"
                      >
                        <LogOut className="size-3.5" />
                        <span className="hidden sm:inline">Keluar</span>
                      </Button>
                    </div>
                  </>
                ) : null}
              </header>

              {/* Messages / Friendship Approval Gate */}
              {threadLoading ? (
                <div className="flex flex-1 min-h-0 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                </div>
              ) : threadError ? (
                <div className="flex flex-1 min-h-0 items-start p-4">
                  <ErrorNote message={threadError} onRetry={() => void loadThread()} />
                </div>
              ) : thread.kind === "dm" && threadFriendship !== "accepted" ? (
                <div className="flex flex-1 min-h-0 flex-col items-center justify-center p-6 text-center overflow-y-auto">
                  <div className="max-w-md rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
                    {threadFriendship === "pending_outgoing" && (
                      <>
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Clock className="size-6" />
                        </div>
                        <h3 className="text-base font-bold text-foreground">
                          Menunggu Persetujuan Pertemanan
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Permintaan pertemanan telah dikirim ke <strong>{activeContact?.nickname}</strong>. Anda dapat
                          mulai berkirim pesan dan melakukan panggilan setelah permintaan disetujui.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs text-rose-500 hover:text-rose-600"
                          onClick={() => activeContact && void handleCancelRequest(activeContact.accountId)}
                        >
                          Batalkan Permintaan
                        </Button>
                      </>
                    )}

                    {threadFriendship === "pending_incoming" && (
                      <>
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <UserCheck className="size-6" />
                        </div>
                        <h3 className="text-base font-bold text-foreground">
                          Permintaan Pertemanan Masuk
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <strong>{activeContact?.nickname}</strong> ingin berteman dengan Anda untuk saling mengobrol
                          dan melakukan panggilan.
                        </p>
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-4 text-xs"
                            onClick={() => activeContact && void handleRespondRequest(activeContact.accountId, "accept")}
                          >
                            Setujui Pertemanan
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full px-4 text-xs"
                            onClick={() => activeContact && void handleRespondRequest(activeContact.accountId, "reject")}
                          >
                            Tolak
                          </Button>
                        </div>
                      </>
                    )}

                    {threadFriendship === "none" && (
                      <>
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <UserPlus className="size-6" />
                        </div>
                        <h3 className="text-base font-bold text-foreground">
                          Belum Berteman
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Untuk menjaga kenyamanan dan privasi, Anda harus mengajukan pertemanan dan disetujui terlebih
                          dahulu oleh <strong>{activeContact?.nickname}</strong> sebelum bisa saling berkirim pesan.
                        </p>
                        <Button
                          size="sm"
                          className="rounded-full px-5 text-xs gap-1.5"
                          onClick={() => activeContact && void handleSendRequest(activeContact.accountId)}
                        >
                          <UserPlus className="size-3.5" />
                          Ajukan Pertemanan
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-1 min-h-0 items-center justify-center p-6">
                  <EmptyState
                    icon={<MessagesSquare className="size-5" aria-hidden />}
                    title="Belum ada pesan"
                    description="Kirim pesan pertama untuk memulai percakapan."
                  />
                </div>
              ) : (
                <div className="flex flex-1 flex-col gap-2.5 sm:gap-3 overflow-y-auto overscroll-contain px-3 sm:px-4 py-3 sm:py-4 min-h-0">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      mine={account ? message.senderAccountId === account.id : false}
                      onPreviewImage={(url, name) => setPreviewImageModal({ url, name })}
                    />
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}

              {/* Message Input Form */}
              {(thread.kind === "group" || threadFriendship === "accepted") && (
                <div className="flex flex-col border-t border-border bg-card shrink-0 pb-[env(safe-area-inset-bottom,0px)]">
                  {/* Preview Lampiran Siap Kirim */}
                  {pendingAttachment && (
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 sm:px-4 py-2 bg-muted/20">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {pendingAttachment.type === "image" ? (
                          <div className="relative size-10 rounded-lg overflow-hidden border border-border shrink-0 bg-black/10">
                            <img
                              src={pendingAttachment.previewUrl}
                              alt="Lampiran"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex size-9 rounded-lg items-center justify-center bg-primary/10 text-primary shrink-0">
                            <FileText className="size-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {pendingAttachment.file.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {pendingAttachment.type === "image" ? "Foto" : "Dokumen"} · {formatFileSize(pendingAttachment.file.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-full text-muted-foreground hover:text-foreground shrink-0"
                        onClick={clearPendingAttachment}
                        title="Batalkan lampiran"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  )}

                  {/* Form Input Chat */}
                  <form
                    className="flex items-center gap-1 px-2 py-2 sm:px-3 sm:py-2.5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void send();
                    }}
                  >
                    {/* Tombol Kamera Langsung */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full shrink-0 text-primary hover:text-primary hover:bg-primary/10 transition-colors"
                      onClick={() => setCameraDialogOpen(true)}
                      title="Ambil foto dari kamera perangkat"
                      aria-label="Kamera"
                    >
                      <Camera className="size-4" />
                    </Button>

                    {/* Tombol Galeri Foto */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full shrink-0 text-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors"
                      onClick={() => galleryInputRef.current?.click()}
                      title="Pilih foto dari galeri (otomatis dikompres)"
                      aria-label="Galeri Foto"
                    >
                      <Image className="size-4" />
                    </Button>

                    {/* Tombol Lampirkan Dokumen */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full shrink-0 text-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors"
                      onClick={() => docInputRef.current?.click()}
                      title="Lampirkan berkas dokumen"
                      aria-label="Dokumen"
                    >
                      <Paperclip className="size-4" />
                    </Button>

                    {/* Hidden file inputs */}
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleGallerySelect}
                    />
                    <input
                      ref={docInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                      className="hidden"
                      onChange={handleDocSelect}
                    />

                    <Input
                      value={draft}
                      maxLength={2000}
                      placeholder={
                        pendingAttachment
                          ? "Keterangan foto/dokumen (opsional)…"
                          : activeGroup
                          ? `Pesan ke ${activeGroup.name}…`
                          : "Tulis pesan…"
                      }
                      onChange={(event) => setDraft(event.target.value)}
                      aria-label="Tulis pesan"
                      className="h-9 text-sm rounded-xl min-w-0 flex-1"
                    />

                    <Button
                      type="submit"
                      size="icon"
                      className="size-8 sm:size-9 shrink-0 rounded-full"
                      disabled={sending || uploadingAttachment || (!draft.trim() && !pendingAttachment)}
                      aria-label="Kirim pesan"
                    >
                      {sending || uploadingAttachment ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Send className="size-4" aria-hidden />
                      )}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
                <MessageCircle className="size-5 text-muted-foreground" aria-hidden />
              </span>
              <p className="font-display text-lg font-semibold text-foreground">Pilih percakapan</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Pilih teman yang sudah terhubung atau cari pengguna baru melalui tab di sebelah kiri untuk mengajukan
                pertemanan.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Dialog Kamera Langsung untuk Chat */}
      <CameraCaptureDialog
        open={cameraDialogOpen}
        onOpenChange={setCameraDialogOpen}
        allowedModes="photo-only"
        onCapture={handleCameraCapture}
      />

      {/* Lightbox full-screen pratinjau foto: zoom in/out, unduh ke perangkat */}
      {previewImageModal && (
        <ImageLightbox
          url={previewImageModal.url}
          name={previewImageModal.name}
          onClose={() => setPreviewImageModal(null)}
        />
      )}

      {/* Modal Buat Grup Chat */}
      <Dialog open={showCreateGroupModal} onOpenChange={setShowCreateGroupModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              <span>Buat Grup Chat Baru</span>
            </DialogTitle>
            <DialogDescription>
              Buat ruang obrolan grup baru dan masukkan teman dari daftar kontak Anda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-group-name" className="text-xs font-semibold">
                Nama Grup <span className="text-destructive">*</span>
              </Label>
              <Input id="create-group-name" placeholder="Contoh: Diskusi Komunitas" value={groupFormName} onChange={(e) => setGroupFormName(e.target.value)} maxLength={60} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-group-desc" className="text-xs font-semibold">Deskripsi (Opsional)</Label>
              <Input id="create-group-desc" placeholder="Tujuan atau topik grup..." value={groupFormDesc} onChange={(e) => setGroupFormDesc(e.target.value)} maxLength={200} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Tambahkan Teman ({selectedFriends.size} dipilih)</Label>
              {contacts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 px-4 border rounded-xl text-center bg-muted/20">
                  Belum ada teman. Anda tetap bisa membuat grup dan mengundang nanti.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-border p-2 bg-muted/10 divide-y divide-border/40">
                  {contacts.map((contact) => {
                    const selected = selectedFriends.has(contact.accountId);
                    return (
                      <label key={contact.accountId} className="flex items-center justify-between gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-secondary/60 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <MemberAvatar name={contact.nickname} tier={contact.tier} photoData={contact.photoData} size={28} />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground">{contact.nickname}</p>
                            <p className="text-[10px] text-muted-foreground">{contact.tier ? ROLE_LABEL[contact.tier] : "Pengguna"}</p>
                          </div>
                        </div>
                        <input type="checkbox" checked={selected} onChange={(e) => { const next = new Set(selectedFriends); if (e.target.checked) next.add(contact.accountId); else next.delete(contact.accountId); setSelectedFriends(next); }} className="size-4 rounded accent-primary" />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setShowCreateGroupModal(false)} disabled={creatingGroup}>Batal</Button>
            <Button type="button" onClick={() => void handleCreateGroup()} disabled={creatingGroup || groupFormName.trim().length < 3} className="gap-1.5">
              {creatingGroup ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              <span>Buat Grup</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Tambah Anggota ke Grup */}
      <Dialog open={showAddMemberModal} onOpenChange={setShowAddMemberModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-primary" />
              <span>Tambah Anggota ke Grup</span>
            </DialogTitle>
            <DialogDescription>
              Pilih teman dari kontak Anda untuk dimasukkan ke grup <strong>{activeGroup?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">Pilih Teman ({selectedAddMembers.size} dipilih)</Label>
            {contacts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 px-4 border rounded-xl text-center bg-muted/20">Belum ada teman di daftar kontak.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1 rounded-xl border border-border p-2 bg-muted/10 divide-y divide-border/40">
                {contacts.map((contact) => {
                  const selected = selectedAddMembers.has(contact.accountId);
                  return (
                    <label key={contact.accountId} className="flex items-center justify-between gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-secondary/60 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MemberAvatar name={contact.nickname} tier={contact.tier} photoData={contact.photoData} size={28} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">{contact.nickname}</p>
                          <p className="text-[10px] text-muted-foreground">{contact.tier ? ROLE_LABEL[contact.tier] : "Pengguna"}</p>
                        </div>
                      </div>
                      <input type="checkbox" checked={selected} onChange={(e) => { const next = new Set(selectedAddMembers); if (e.target.checked) next.add(contact.accountId); else next.delete(contact.accountId); setSelectedAddMembers(next); }} className="size-4 rounded accent-primary" />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setShowAddMemberModal(false)} disabled={addingMembers}>Batal</Button>
            <Button type="button" onClick={() => void handleAddMembers()} disabled={addingMembers || selectedAddMembers.size === 0} className="gap-1.5">
              {addingMembers ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              <span>Tambahkan</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
