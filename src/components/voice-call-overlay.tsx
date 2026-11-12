import { MemberAvatar } from "@/components/common";
import { useVoiceCall } from "@/lib/call-context";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneOff,
  ChevronDown,
  Maximize2,
} from "lucide-react";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function VoiceCallOverlay() {
  const {
    callState,
    incomingCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleMinimize,
  } = useVoiceCall();

  // 1. INCOMING CALL MODAL
  if (incomingCall && !callState) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative flex w-full max-w-sm flex-col items-center rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
          {/* Animated caller avatar */}
          <div className="relative mb-5 flex items-center justify-center">
            <span className="absolute -inset-2.5 animate-ping rounded-full bg-emerald-500/20 duration-1000" />
            <span className="absolute -inset-1 rounded-full bg-emerald-500/30" />
            <MemberAvatar
              name={incomingCall.callerName}
              photoData={incomingCall.callerPhoto}
              size={80}
              className="relative shadow-md"
            />
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Panggilan Suara Masuk...
          </p>
          <h3 className="mt-1 text-xl font-bold text-foreground">
            {incomingCall.callerName}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Ingin melakukan panggilan suara dengan Anda
          </p>

          <div className="mt-8 flex w-full items-center justify-center gap-6">
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="h-14 w-14 rounded-full p-0 shadow-lg hover:scale-105 active:scale-95 transition-transform"
              onClick={() => void rejectCall()}
              title="Tolak Panggilan"
            >
              <PhoneOff className="size-6" />
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-14 w-14 rounded-full bg-emerald-600 p-0 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-transform animate-pulse"
              onClick={() => void acceptCall()}
              title="Terima Panggilan"
            >
              <PhoneCall className="size-6" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. ACTIVE / OUTGOING CALL OVERLAY
  if (callState) {
    // Minimized floating widget
    if (callState.isMinimized) {
      return (
        <div className="fixed bottom-20 right-4 z-50 flex items-center gap-3 rounded-full border border-border bg-card/95 px-4 py-2.5 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200">
          <div className="relative flex items-center justify-center">
            {callState.status === "connected" && (
              <span className="absolute -inset-1 animate-pulse rounded-full bg-emerald-500/30" />
            )}
            <MemberAvatar
              name={callState.otherUser.name}
              photoData={callState.otherUser.photoData}
              size={36}
            />
          </div>

          <div className="min-w-0 pr-1">
            <p className="truncate text-xs font-semibold text-foreground max-w-[120px]">
              {callState.otherUser.name}
            </p>
            <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
              {callState.status === "connected"
                ? formatDuration(callState.duration)
                : "Menghubungkan..."}
            </p>
          </div>

          <div className="flex items-center gap-1.5 border-l border-border pl-2">
            <Button
              type="button"
              size="icon"
              variant={callState.isMuted ? "destructive" : "secondary"}
              className="h-8 w-8 rounded-full"
              onClick={toggleMute}
              title={callState.isMuted ? "Aktifkan Mikrofon" : "Bisukan Mikrofon"}
            >
              {callState.isMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
            </Button>

            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="h-8 w-8 rounded-full"
              onClick={() => void endCall("ended")}
              title="Akhiri Panggilan"
            >
              <PhoneOff className="size-3.5" />
            </Button>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              onClick={toggleMinimize}
              title="Perbesar Layar"
            >
              <Maximize2 className="size-3.5" />
            </Button>
          </div>
        </div>
      );
    }

    // Full modal overlay
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative flex w-full max-w-sm flex-col items-center rounded-3xl border border-border/80 bg-card p-6 text-center shadow-2xl">
          {/* Minimize button */}
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={toggleMinimize}
            title="Kecilkan Panggilan"
          >
            <ChevronDown className="size-5" />
          </button>

          {/* Avatar with pulsing waves */}
          <div className="relative my-6 flex items-center justify-center">
            {callState.status === "connected" && (
              <>
                <span className="absolute -inset-4 animate-ping rounded-full bg-emerald-500/15 duration-1000" />
                <span className="absolute -inset-2 animate-pulse rounded-full bg-emerald-500/25" />
              </>
            )}
            <MemberAvatar
              name={callState.otherUser.name}
              photoData={callState.otherUser.photoData}
              size={96}
              className="relative shadow-xl ring-4 ring-emerald-500/20"
            />
          </div>

          <h3 className="text-xl font-bold text-foreground">
            {callState.otherUser.name}
          </h3>

          <div className="mt-2 flex items-center justify-center gap-2">
            {callState.status === "connected" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                {formatDuration(callState.duration)}
              </span>
            ) : (
              <p className="text-xs text-muted-foreground animate-pulse">
                {callState.status === "calling"
                  ? "Menghubungi..."
                  : callState.status === "ringing"
                    ? "Berdering..."
                    : "Menghubungkan..."}
              </p>
            )}
          </div>

          {callState.isMuted && (
            <p className="mt-2 text-[11px] font-medium text-rose-500">
              Mikrofon Anda sedang dibisukan
            </p>
          )}

          {/* Action buttons */}
          <div className="mt-8 flex w-full items-center justify-center gap-6">
            <Button
              type="button"
              variant={callState.isMuted ? "destructive" : "secondary"}
              size="lg"
              className="h-14 w-14 rounded-full p-0 shadow-md hover:scale-105 active:scale-95 transition-transform"
              onClick={toggleMute}
              title={callState.isMuted ? "Aktifkan Mikrofon" : "Bisukan Mikrofon"}
            >
              {callState.isMuted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="h-14 w-14 rounded-full p-0 shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95 transition-transform"
              onClick={() => void endCall("ended")}
              title="Akhiri Panggilan"
            >
              <PhoneOff className="size-6" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
