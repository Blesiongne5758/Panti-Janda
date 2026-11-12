import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Video,
  X,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { useVoiceCall } from "@/lib/call-context";
import { useQueryParam } from "@/lib/router";
import { ROLE_LABEL, ROLE_RANK, TIER_META } from "@/lib/constants";
import type { ChatContact, ChatMessage, FriendItem, FriendshipStatus, GroupItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
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

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <div className={`flex w-full gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine ? <MemberAvatar name={message.senderName} photoData={message.senderPhoto} size={28} /> : null}
      <div className={`max-w-[85%] sm:max-w-[78%] space-y-0.5 ${mine ? "items-end text-right" : ""}`}>
        {!mine ? <p className="px-1 text-[11px] font-medium text-muted-foreground">{message.senderName}</p> : null}
        <div
          className={`inline-block rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-line ${
            mine
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md border border-border bg-secondary text-secondary-foreground"
          }`}
        >
          {message.body}
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
        rank >= 2 ? api<{ items: GroupItem[] }>("groups.list") : Promise.resolve({ items: [] as GroupItem[] }),
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
      await api("friends.respond", { targetAccountId, action });
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
    const body = draft.trim();
    if (!body || !thread) return;

    if (thread.kind === "dm" && threadFriendship !== "accepted") {
      toast.error("Anda harus berteman terlebih dahulu untuk mengirim pesan.");
      return;
    }

    setSending(true);
    try {
      if (thread.kind === "dm") {
        await api("chat.send", { withAccountId: thread.accountId, body });
      } else {
        await api("groups.send", { id: thread.id, body });
      }
      setDraft("");
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
        thread ? "gap-0 p-0 sm:gap-6 sm:px-4 sm:py-8 lg:py-10" : "gap-4 sm:gap-6 px-3 py-4 sm:px-4 sm:py-8 lg:py-10"
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

      <div className="grid overflow-hidden border-0 sm:border border-border bg-card shadow-sm rounded-none sm:rounded-3xl lg:grid-cols-[330px_1fr]">
        {/* SIDEBAR */}
        <aside
          className={`h-[calc(100dvh-130px)] sm:h-[74dvh] flex flex-col border-border lg:border-r ${
            thread ? "hidden lg:flex" : "flex border-b"
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
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Teman ({contacts.length})
                      </p>
                      <button
                        type="button"
                        onClick={() => setSidebarTab("search")}
                        className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        <UserPlus className="size-3" /> Tambah Teman
                      </button>
                    </div>

                    {contacts.length === 0 ? (
                      <div className="p-5 text-center space-y-2">
                        <p className="text-xs text-muted-foreground">Belum ada teman terhubung.</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs rounded-full gap-1.5"
                          onClick={() => setSidebarTab("search")}
                        >
                          <UserPlus className="size-3.5" />
                          Cari & Tambah Pengguna
                        </Button>
                      </div>
                    ) : (
                      contacts.map((contact) => {
                        const active = thread?.kind === "dm" && thread.accountId === contact.accountId;
                        return (
                          <button
                            key={contact.accountId}
                            type="button"
                            onClick={() => setThread({ kind: "dm", accountId: contact.accountId })}
                            className={`flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors ${
                              active ? "bg-secondary" : "hover:bg-secondary/60"
                            }`}
                          >
                            <MemberAvatar
                              name={contact.nickname}
                              tier={contact.tier}
                              photoData={contact.photoData}
                              size={38}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-medium text-foreground">{contact.nickname}</span>
                                {contact.lastMessage ? (
                                  <span className="shrink-0 text-[10px] text-muted-foreground">
                                    {lastSeenLabel(contact.lastMessage.createdAt)}
                                  </span>
                                ) : null}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {contact.lastMessage
                                  ? `${contact.lastMessage.fromMe ? "Anda: " : ""}${contact.lastMessage.body}`
                                  : "Teman terhubung — mulai obrolan"}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}

                    {rank >= 2 && (
                      <>
                        <p className="px-4 pt-4 pb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Grup chat
                        </p>
                        {groups.length === 0 ? (
                          <p className="px-4 pb-3 text-xs text-muted-foreground">Belum bergabung dengan grup.</p>
                        ) : (
                          groups.map((group) => {
                            const active = thread?.kind === "group" && thread.id === group.id;
                            return (
                              <button
                                key={group.id}
                                type="button"
                                onClick={() => setThread({ kind: "group", id: group.id })}
                                className={`flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors ${
                                  active ? "bg-secondary" : "hover:bg-secondary/60"
                                }`}
                              >
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                  <Users className="size-4" aria-hidden />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-foreground">{group.name}</span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {group.memberCount} anggota — {TIER_META[group.audienceMinRole]?.label ?? "Anggota"}
                                  </span>
                                </span>
                              </button>
                            );
                          })
                        )}
                      </>
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
        <section className={`h-[calc(100dvh-70px)] sm:h-[74dvh] flex-col ${thread ? "flex" : "hidden lg:flex"}`}>
          {thread ? (
            <>
              {/* Header */}
              <header className="flex items-center gap-2 sm:gap-3 border-b border-border px-3 sm:px-4 py-2.5 sm:py-3 bg-card sticky top-0 z-10">
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
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <MemberAvatar
                        name={activeContact.nickname}
                        tier={activeContact.tier}
                        photoData={activeContact.photoData}
                        size={36}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{activeContact.nickname}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {activeContact.tier ? ROLE_LABEL[activeContact.tier] : "Pengguna"}
                          {threadFriendship === "accepted" ? " • Teman" : " • Belum Berteman"}
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
                            className="h-8 sm:h-9 px-2 sm:px-3 gap-1 sm:gap-1.5 rounded-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
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
                            className="h-8 sm:h-9 px-2 sm:px-3 gap-1 sm:gap-1.5 rounded-full border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/40"
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
                        <Button asChild variant="ghost" size="sm" className="h-8 sm:h-9 px-2 sm:px-2.5 text-xs">
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
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Users className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{activeGroup.name}</p>
                      <p className="text-[11px] text-muted-foreground">{activeGroup.memberCount} anggota</p>
                    </div>
                  </>
                ) : null}
              </header>

              {/* Messages / Friendship Approval Gate */}
              {threadLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                </div>
              ) : threadError ? (
                <div className="flex flex-1 items-start p-4">
                  <ErrorNote message={threadError} onRetry={() => void loadThread()} />
                </div>
              ) : thread.kind === "dm" && threadFriendship !== "accepted" ? (
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
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
                <div className="flex flex-1 items-center justify-center p-6">
                  <EmptyState
                    icon={<MessagesSquare className="size-5" aria-hidden />}
                    title="Belum ada pesan"
                    description="Kirim pesan pertama untuk memulai percakapan."
                  />
                </div>
              ) : (
                <div className="flex flex-1 flex-col gap-2.5 sm:gap-3 overflow-y-auto overscroll-contain px-3 sm:px-4 py-3 sm:py-4">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      mine={account ? message.senderAccountId === account.id : false}
                    />
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}

              {/* Message Input Form */}
              {(thread.kind === "group" || threadFriendship === "accepted") && (
                <form
                  className="flex items-center gap-2 border-t border-border px-3 sm:px-4 py-2.5 sm:py-3 bg-card"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void send();
                  }}
                >
                  <Input
                    value={draft}
                    maxLength={2000}
                    placeholder={activeGroup ? `Pesan ke ${activeGroup.name}` : "Tulis pesan…"}
                    onChange={(event) => setDraft(event.target.value)}
                    aria-label="Tulis pesan"
                  />
                  <Button type="submit" size="icon" disabled={sending || !draft.trim()} aria-label="Kirim pesan">
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                  </Button>
                </form>
              )}
            </>
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
    </div>
  );
}
