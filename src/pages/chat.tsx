import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Lock, MessageCircle, MessagesSquare, Send, Users } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { useQueryParam } from "@/lib/router";
import { ROLE_RANK, TIER_META } from "@/lib/constants";
import type { ChatContact, ChatMessage, GroupItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountGate, EmptyState, ErrorNote, MemberAvatar, TierBadge } from "@/components/common";
import { Link } from "@/lib/router";
import { toast } from "sonner";

type Thread = { kind: "dm"; accountId: string } | { kind: "group"; id: string };

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
      <div className={`max-w-[78%] space-y-0.5 ${mine ? "items-end text-right" : ""}`}>
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
  const rank = account ? ROLE_RANK[account.role] : 0;
  const withParam = useQueryParam("with");
  const groupParam = useQueryParam("grup");

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingLists, setLoadingLists] = useState(true);

  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadLists = useCallback(async () => {
    try {
      const [contactData, groupData] = await Promise.all([
        api<{ items: ChatContact[] }>("chat.contacts"),
        api<{ items: GroupItem[] }>("groups.list"),
      ]);
      setContacts(contactData.items);
      setGroups(groupData.items.filter((group) => group.joined));
      setListError(null);
    } catch (error) {
      setListError(errorText(error));
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    if (rank >= 2) void loadLists();
  }, [loadLists, rank]);

  useEffect(() => {
    if (rank < 2 || loadingLists) return;
    if (thread || (!withParam && !groupParam)) return;
    if (withParam) setThread({ kind: "dm", accountId: withParam });
    else if (groupParam) setThread({ kind: "group", id: groupParam });
  }, [groupParam, loadingLists, rank, thread, withParam]);

  const activeContact = useMemo(
    () => (thread?.kind === "dm" ? contacts.find((item) => item.accountId === thread.accountId) ?? null : null),
    [contacts, thread],
  );
  const activeGroup = useMemo(
    () => (thread?.kind === "group" ? groups.find((item) => item.id === thread.id) ?? null : null),
    [groups, thread],
  );

  const loadThread = useCallback(
    async (silent = false) => {
      if (!thread) return;
      if (!silent) setThreadLoading(true);
      try {
        if (thread.kind === "dm") {
          const data = await api<{ items: ChatMessage[] }>("chat.thread", { withAccountId: thread.accountId });
          setMessages(data.items);
        } else {
          const data = await api<{ items: ChatMessage[] }>("groups.messages", { id: thread.id });
          setMessages(data.items);
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
      return;
    }
    void loadThread();
    const timer = window.setInterval(() => void loadThread(true), 5000);
    return () => window.clearInterval(timer);
  }, [loadThread, thread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !thread) return;
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
        description="Chat pribadi dan grup chat hanya untuk anggota janda Panti Janda. Masuk atau daftar untuk mulai berkomunikasi."
      />
    );
  }

  if (rank < 2) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16">
        <EmptyState
          icon={<Lock className="size-5" aria-hidden />}
          title="Pesan khusus anggota"
          description="Fitur chat pribadi dan grup chat hanya tersedia untuk akun janda terverifikasi. Akun non janda tidak dapat mengakses percakapan anggota."
          action={
            <Button asChild variant="outline">
              <Link to="/jelajah">Jelajahi profil Wonder Woman</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl space-y-1.5">
          <p className="text-xs font-semibold tracking-[0.18em] text-accent-foreground uppercase">Komunikasi anggota</p>
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">Pesan</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Chat pribadi sesama anggota janda dan grup chat minat — semuanya dalam satu ruang.
          </p>
        </div>
      </div>

      {listError ? <ErrorNote message={listError} onRetry={loadLists} /> : null}

      <div className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-sm lg:grid-cols-[320px_1fr]">
        <aside
          className={`max-h-[72dvh] overflow-y-auto border-border lg:border-r ${
            thread ? "hidden lg:block" : "block border-b"
          }`}
        >
          {loadingLists ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : (
            <div className="flex flex-col">
              <p className="px-4 pt-4 pb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Chat pribadi
              </p>
              {contacts.length === 0 ? (
                <p className="px-4 pb-3 text-xs text-muted-foreground">Belum ada anggota lain yang terdaftar.</p>
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
                        size={36}
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
                            : `${TIER_META[contact.tier].label} — mulai percakapan`}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
              <p className="px-4 pt-4 pb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Grup chat
              </p>
              {groups.length === 0 ? (
                <p className="px-4 pb-4 text-xs text-muted-foreground">
                  Belum bergabung dengan grup.{" "}
                  <Link to="/grup" className="text-primary hover:underline">
                    Lihat grup
                  </Link>
                </p>
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
                          {group.memberCount} anggota — {TIER_META[group.audienceMinRole].label} ke atas
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </aside>

        <section className={`flex h-[72dvh] flex-col ${thread ? "flex" : "hidden lg:flex"}`}>
          {thread ? (
            <>
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Kembali ke daftar"
                  onClick={() => setThread(null)}
                >
                  <ArrowLeft className="size-4" aria-hidden />
                </Button>
                {activeContact ? (
                  <>
                    <MemberAvatar
                      name={activeContact.nickname}
                      tier={activeContact.tier}
                      photoData={activeContact.photoData}
                      size={36}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{activeContact.nickname}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {TIER_META[activeContact.tier].label}
                        {activeContact.status !== "verified" ? " — belum terverifikasi" : ""}
                      </p>
                    </div>
                    {activeContact.profileId ? (
                      <Button asChild variant="ghost" size="sm" className="ml-auto">
                        <Link to={`/janda/${activeContact.profileId}`}>Lihat profil</Link>
                      </Button>
                    ) : null}
                  </>
                ) : activeGroup ? (
                  <>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Users className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{activeGroup.name}</p>
                      <p className="text-[11px] text-muted-foreground">{activeGroup.memberCount} anggota</p>
                    </div>
                  </>
                ) : null}
              </header>

              {threadLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                </div>
              ) : threadError ? (
                <div className="flex flex-1 items-start p-4">
                  <ErrorNote message={threadError} onRetry={() => void loadThread()} />
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
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
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

              <form
                className="flex items-center gap-2 border-t border-border px-4 py-3"
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
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
                <MessageCircle className="size-5 text-muted-foreground" aria-hidden />
              </span>
              <p className="font-display text-lg font-semibold text-foreground">Pilih percakapan</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Pilih anggota untuk chat pribadi atau grup minat di sebelah kiri untuk mulai berkomunikasi.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
