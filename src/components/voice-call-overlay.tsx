import { useEffect, useRef } from "react";
import { MemberAvatar } from "@/components/common";
import { useVoiceCall } from "@/lib/call-context";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Video,
  VideoOff,
  ChevronDown,
  Maximize2,
  SwitchCamera,
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
    incomingVideoUpgrade,
    acceptingVideoUpgrade,
    acceptCall,
    rejectCall,
    acceptVideoUpgrade,
    rejectVideoUpgrade,
    endCall,
    switchToVideoCall,
    switchingToVideoTarget,
    toggleMute,
    toggleCamera,
    flipCamera,
    toggleMinimize,
    remoteVideoRef,
    localVideoRef,
  } = useVoiceCall();
  const videoUpgradeDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!callState || !incomingVideoUpgrade) return;
    const dialog = videoUpgradeDialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusable = () => Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    ).filter((element) => !element.hasAttribute("hidden"));
    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!acceptingVideoUpgrade) void rejectVideoUpgrade();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [acceptingVideoUpgrade, callState?.callId, incomingVideoUpgrade?.revision, rejectVideoUpgrade]);

  // 1. INCOMING CALL MODAL (VOICE OR VIDEO)
  if (incomingCall && !callState) {
    const isVideo = incomingCall.mode === "video";
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative flex w-full max-w-sm flex-col items-center rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
          {/* Animated caller avatar */}
          <div className="relative mb-5 flex items-center justify-center">
            <span
              className={`absolute -inset-3 animate-ping rounded-full duration-1000 ${
                isVideo ? "bg-violet-500/20" : "bg-emerald-500/20"
              }`}
            />
            <span
              className={`absolute -inset-1.5 rounded-full ${
                isVideo ? "bg-violet-500/30" : "bg-emerald-500/30"
              }`}
            />
            <MemberAvatar
              name={incomingCall.callerName}
              photoData={incomingCall.callerPhoto}
              size={84}
              className="relative shadow-lg ring-4 ring-card"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-foreground">
            {isVideo ? (
              <>
                <Video className="size-3.5 text-violet-500" />
                <span>Panggilan Video Masuk</span>
              </>
            ) : (
              <>
                <PhoneCall className="size-3.5 text-emerald-500" />
                <span>Panggilan Suara Masuk</span>
              </>
            )}
          </div>

          <h3 className="mt-3 text-xl font-bold text-foreground">
            {incomingCall.callerName}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {isVideo
              ? "Mengajak Anda untuk panggilan video tatap muka"
              : "Ingin melakukan panggilan suara dengan Anda"}
          </p>

          <div className="mt-8 flex w-full items-center justify-center gap-6">
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="h-14 w-14 rounded-full p-0 shadow-lg hover:scale-105 active:scale-95 transition-transform"
              onClick={() => void rejectCall()}
              title="Tolak Panggilan"
              aria-label="Tolak panggilan masuk"
            >
              <PhoneOff className="size-6" />
            </Button>
            <Button
              type="button"
              size="lg"
              className={`h-14 w-14 rounded-full p-0 text-white shadow-lg hover:scale-105 active:scale-95 transition-transform animate-pulse ${
                isVideo
                  ? "bg-violet-600 shadow-violet-600/30 hover:bg-violet-700"
                  : "bg-emerald-600 shadow-emerald-600/30 hover:bg-emerald-700"
              }`}
              onClick={() => void acceptCall()}
              title="Terima Panggilan"
            >
              {isVideo ? <Video className="size-6" /> : <PhoneCall className="size-6" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (switchingToVideoTarget && !callState) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950 p-6 text-center text-white">
        <div className="relative">
          <span className="absolute -inset-4 animate-ping rounded-full bg-emerald-500/15 duration-1000" />
          <MemberAvatar
            name={switchingToVideoTarget.name}
            photoData={switchingToVideoTarget.photoData}
            size={96}
            className="relative ring-4 ring-emerald-400/30"
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Panggilan Video</p>
          <h3 className="text-2xl font-bold">{switchingToVideoTarget.name}</h3>
          <p className="text-sm text-white/75">Menyiapkan kamera dan meminta persetujuan untuk beralih ke video…</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-emerald-300" role="status">
          <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
          Menghubungkan…
        </div>
      </div>
    );
  }

  const videoUpgradePrompt = callState && incomingVideoUpgrade ? (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in duration-150">
      <div
        ref={videoUpgradeDialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-upgrade-title"
        aria-busy={acceptingVideoUpgrade}
        className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-border bg-card p-6 text-center text-foreground shadow-2xl"
      >
        <div className="relative mb-5 flex items-center justify-center">
          <span className="absolute -inset-3 animate-pulse rounded-full bg-violet-500/20" />
          <MemberAvatar
            name={callState.otherUser.name}
            photoData={callState.otherUser.photoData}
            size={80}
            className="relative ring-4 ring-card"
          />
        </div>
        <div className="flex items-center gap-2 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
          <Video className="size-3.5" />
          Permintaan video
        </div>
        <h3 id="video-upgrade-title" className="mt-3 text-xl font-bold">
          {callState.otherUser.name} ingin beralih ke video
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Panggilan suara tetap tersambung. Kamera Anda hanya akan diaktifkan jika Anda menyetujui.
        </p>
        <div className="mt-7 flex w-full gap-3">
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            disabled={acceptingVideoUpgrade}
            onClick={() => void rejectVideoUpgrade()}
            aria-label="Tolak permintaan panggilan video"
          >
            Tolak
          </Button>
          <Button
            type="button"
            className="flex-1 bg-violet-600 text-white hover:bg-violet-700"
            disabled={acceptingVideoUpgrade}
            onClick={() => void acceptVideoUpgrade()}
            aria-label="Setujui dan aktifkan kamera untuk panggilan video"
          >
            {acceptingVideoUpgrade ? "Mengaktifkan kamera…" : "Setuju"}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full"
          onClick={() => void endCall("ended")}
          aria-label="Akhiri panggilan yang sedang berlangsung"
        >
          <PhoneOff className="mr-2 size-4" />
          Akhiri panggilan
        </Button>
      </div>
    </div>
  ) : null;

  // 2. ACTIVE CALL OVERLAY (VOICE OR VIDEO)
  if (callState) {
    const isVideo = callState.mode === "video";

    // A. MINIMIZED FLOATING WIDGET
    if (callState.isMinimized) {
      return (
        <>
        {videoUpgradePrompt}
        <div className="fixed bottom-20 right-4 z-[60] flex items-center gap-3 rounded-2xl border border-border/80 bg-card/95 p-2.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200">
          {isVideo ? (
            <div className="relative h-14 w-20 overflow-hidden rounded-xl bg-black">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <p className="absolute bottom-0.5 left-1 text-[10px] font-mono font-medium text-white">
                {callState.status === "connected"
                  ? formatDuration(callState.duration)
                  : "..."}
              </p>
            </div>
          ) : (
            <div className="relative flex items-center justify-center pl-1">
              {callState.status === "connected" && (
                <span className="absolute -inset-1 animate-pulse rounded-full bg-emerald-500/30" />
              )}
              <MemberAvatar
                name={callState.otherUser.name}
                photoData={callState.otherUser.photoData}
                size={38}
              />
            </div>
          )}

          <div className="min-w-0 pr-1">
            <p className="truncate text-xs font-semibold text-foreground max-w-[110px]">
              {callState.otherUser.name}
            </p>
            <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
              {switchingToVideoTarget
                ? "Meminta izin video…"
                : callState.status === "connected"
                  ? formatDuration(callState.duration)
                  : "Menghubungkan..."}
            </p>
          </div>

          <div className="flex items-center gap-1 border-l border-border pl-2">
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

            {isVideo && (
              <Button
                type="button"
                size="icon"
                variant={callState.isCameraOff ? "destructive" : "secondary"}
                className="h-8 w-8 rounded-full"
                onClick={toggleCamera}
                title={callState.isCameraOff ? "Nyalakan Kamera" : "Matikan Kamera"}
              >
                {callState.isCameraOff ? <VideoOff className="size-3.5" /> : <Video className="size-3.5" />}
              </Button>
            )}

            {!isVideo && (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full"
                disabled={Boolean(switchingToVideoTarget) || callState.status !== "connected"}
                onClick={() => void switchToVideoCall()}
                title={switchingToVideoTarget ? "Menunggu persetujuan video" : "Minta beralih ke panggilan video"}
                aria-label="Minta beralih ke panggilan video tanpa mengakhiri panggilan suara"
              >
                <Video className="size-3.5" />
              </Button>
            )}

            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="h-8 w-8 rounded-full"
              onClick={() => void endCall("ended")}
              title="Akhiri Panggilan"
              aria-label="Akhiri panggilan"
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
        </>
      );
    }

    // B. VIDEO CALL FULL MODAL VIEW
    if (isVideo) {
      return (
        <>
        {videoUpgradePrompt}
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-2 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative flex h-full max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 shadow-2xl">
            {/* Header / Top controls */}
            <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
              <div className="flex items-center gap-3">
                <MemberAvatar
                  name={callState.otherUser.name}
                  photoData={callState.otherUser.photoData}
                  size={40}
                  className="ring-2 ring-white/30"
                />
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    {callState.otherUser.name}
                  </h4>
                  <p className="text-xs font-mono text-emerald-400">
                    {callState.status === "connected" ? (
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        {formatDuration(callState.duration)}
                      </span>
                    ) : (
                      <span className="text-white/70 animate-pulse">
                        {callState.status === "calling"
                          ? "Menghubungi video..."
                          : callState.status === "ringing"
                            ? "Berdering..."
                            : "Menghubungkan..."}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="rounded-full bg-white/15 p-2.5 text-white backdrop-blur-md hover:bg-white/25 transition-colors"
                onClick={toggleMinimize}
                title="Kecilkan Layar Panggilan"
              >
                <ChevronDown className="size-5" />
              </button>
            </div>

            {/* Main Remote Video Screen */}
            <div className="relative flex-1 w-full h-full flex items-center justify-center bg-neutral-900 overflow-hidden">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover sm:object-contain"
              />

              {/* Fallback if remote video not connected or camera turned off */}
              {callState.status !== "connected" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950/80 p-4 text-center">
                  <div className="relative">
                    <span className="absolute -inset-4 animate-ping rounded-full bg-violet-500/20 duration-1000" />
                    <MemberAvatar
                      name={callState.otherUser.name}
                      photoData={callState.otherUser.photoData}
                      size={96}
                      className="relative ring-4 ring-violet-500/30"
                    />
                  </div>
                  <p className="text-sm font-medium text-white/80 animate-pulse">
                    {callState.status === "calling"
                      ? "Menghubungi video..."
                      : "Menunggu jawaban..."}
                  </p>
                </div>
              )}

              {/* PiP Local Video Preview (Kamera Diri Sendiri) */}
              <div className="absolute top-16 right-4 z-20 h-40 w-28 sm:h-48 sm:w-36 overflow-hidden rounded-2xl border-2 border-white/20 bg-neutral-900 shadow-2xl backdrop-blur-md">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover -scale-x-100 ${
                    callState.isCameraOff ? "hidden" : "block"
                  }`}
                />
                {callState.isCameraOff && (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-800 p-2 text-center text-white/70">
                    <VideoOff className="size-5 mb-1 text-white/50" />
                    <span className="text-[10px]">Kamera Mati</span>
                  </div>
                )}
                <div className="absolute bottom-1 left-2 text-[10px] font-medium text-white/80 drop-shadow">
                  Anda
                </div>
              </div>
            </div>

            {/* Bottom Controls Bar */}
            <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-center gap-4 p-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <Button
                type="button"
                variant={callState.isMuted ? "destructive" : "secondary"}
                size="lg"
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-full p-0 shadow-lg hover:scale-105 active:scale-95 transition-transform"
                onClick={toggleMute}
                title={callState.isMuted ? "Aktifkan Mikrofon" : "Bisukan Mikrofon"}
              >
                {callState.isMuted ? <MicOff className="size-5 sm:size-6" /> : <Mic className="size-5 sm:size-6" />}
              </Button>

              <Button
                type="button"
                variant={callState.isCameraOff ? "destructive" : "secondary"}
                size="lg"
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-full p-0 shadow-lg hover:scale-105 active:scale-95 transition-transform"
                onClick={toggleCamera}
                title={callState.isCameraOff ? "Nyalakan Kamera" : "Matikan Kamera"}
              >
                {callState.isCameraOff ? <VideoOff className="size-5 sm:size-6" /> : <Video className="size-5 sm:size-6" />}
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-full p-0 shadow-lg hover:scale-105 active:scale-95 transition-transform"
                onClick={() => void flipCamera()}
                title="Balik Kamera (Depan/Belakang)"
              >
                <SwitchCamera className="size-5 sm:size-6" />
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-full p-0 shadow-lg shadow-rose-600/40 hover:scale-105 active:scale-95 transition-transform"
                onClick={() => void endCall("ended")}
                title="Akhiri Panggilan Video"
                aria-label="Akhiri panggilan video"
              >
                <PhoneOff className="size-5 sm:size-6" />
              </Button>
            </div>
          </div>
        </div>
        </>
      );
    }

    // C. VOICE CALL FULL SCREEN
    return (
      <>
      {videoUpgradePrompt}
      <div className="fixed inset-0 z-[60] bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 text-white animate-in fade-in duration-200">
        <div className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-y-auto px-6 pb-40 pt-20 text-center sm:px-8">
          {/* Minimize button */}
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white"
            onClick={toggleMinimize}
            title="Kecilkan panggilan"
            aria-label="Kecilkan panggilan"
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

          <h3 className="text-2xl font-bold text-white sm:text-3xl">
            {callState.otherUser.name}
          </h3>

          <div className="mt-2 flex items-center justify-center gap-2">
            {callState.status === "connected" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                {formatDuration(callState.duration)}
              </span>
            ) : (
              <p className="text-sm text-white/70 animate-pulse" role="status">
                {callState.status === "calling"
                  ? "Menghubungi suara..."
                  : callState.status === "ringing"
                    ? "Berdering..."
                    : "Menghubungkan..."}
              </p>
            )}
          </div>

          {switchingToVideoTarget && (
            <p className="mt-3 text-sm text-violet-200" role="status">
              Meminta persetujuan untuk beralih ke video. Panggilan suara tetap tersambung.
            </p>
          )}

          {callState.isMuted && (
            <p className="mt-2 text-xs font-medium text-rose-300">
              Mikrofon Anda sedang dibisukan
            </p>
          )}

          {/* Action buttons */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex w-full items-end justify-center gap-5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 sm:gap-10">
            <div className="flex flex-col items-center gap-2">
              <Button
                type="button"
                variant={callState.isMuted ? "destructive" : "secondary"}
                size="lg"
                className="h-14 w-14 rounded-full p-0 shadow-md hover:scale-105 active:scale-95 transition-transform"
                onClick={toggleMute}
                title={callState.isMuted ? "Aktifkan mikrofon" : "Bisukan mikrofon"}
                aria-label={callState.isMuted ? "Aktifkan mikrofon" : "Bisukan mikrofon"}
              >
                {callState.isMuted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
              </Button>
              <span className="text-xs font-medium text-white/80">{callState.isMuted ? "Nyalakan mic" : "Bisukan"}</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="h-14 w-14 rounded-full p-0 shadow-md hover:scale-105 active:scale-95 transition-transform"
                disabled={Boolean(switchingToVideoTarget) || callState.status !== "connected"}
                onClick={() => void switchToVideoCall()}
                title={switchingToVideoTarget ? "Menunggu persetujuan video" : "Minta beralih ke panggilan video"}
                aria-label="Minta beralih ke panggilan video tanpa mengakhiri panggilan suara"
              >
                <Video className="size-6" />
              </Button>
              <span className="text-xs font-medium text-white/80">{switchingToVideoTarget ? "Meminta…" : "Video"}</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="h-14 w-14 rounded-full p-0 shadow-lg shadow-rose-500/30 hover:scale-105 active:scale-95 transition-transform"
                onClick={() => void endCall("ended")}
                title="Akhiri panggilan"
                aria-label="Akhiri panggilan"
              >
                <PhoneOff className="size-6" />
              </Button>
              <span className="text-xs font-medium text-white/90">Akhiri</span>
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  return null;
}
