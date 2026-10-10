import { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/common";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

const SUGGESTED_QUESTIONS = [
  "Bagaimana cara memulai usaha kuliner dari rumah?",
  "Apa saja yang perlu disiapkan untuk proposal bisnis?",
  "Tips mengelola keuangan usaha untuk pemula",
  "Strategi pemasaran digital untuk UMKM",
];

export default function AIMentorPage() {
  const { account, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api<{ reply: string }>("ai.mentor.chat", { message: text });
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Maaf, terjadi kendala. Silakan coba lagi.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
          AI Mentor Bisnis
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tanyakan apa saja tentang bisnis, proposal, atau strategi usaha Anda
        </p>
      </div>

      <Card className="flex h-[min(600px,70dvh)] flex-col">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-primary" aria-hidden />
            Mentor Virtual
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-0">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-8 text-primary" aria-hidden />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">Halo! Saya AI Mentor Anda</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Saya siap membantu Anda dengan pertanyaan seputar bisnis, proposal, RAB, dan strategi usaha
                </p>
              </div>
              <div className="grid w-full max-w-2xl gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void sendMessage(q)}
                    className="rounded-lg border border-border bg-card p-3 text-left text-sm transition-colors hover:bg-secondary"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    {msg.role === "user" ? (
                      profile ? (
                        <MemberAvatar
                          name={profile.nickname}
                          tier={profile.tier}
                          photoData={profile.photoData}
                          size={32}
                        />
                      ) : (
                        <User className="size-4" aria-hidden />
                      )
                    ) : (
                      <Bot className="size-4 text-primary" aria-hidden />
                    )}
                  </div>
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <Bot className="size-4 text-primary" aria-hidden />
                  </div>
                  <div className="rounded-2xl bg-secondary px-4 py-2.5">
                    <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </CardContent>

        <form
          onSubmit={handleSubmit}
          className="flex gap-2 border-t border-border p-4"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ketik pertanyaan Anda..."
            className="min-h-[44px] resize-none"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()} size="icon">
            <Send className="size-4" aria-hidden />
          </Button>
        </form>
      </Card>
    </div>
  );
}
