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
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    flipCamera,
    toggleMinimize,
    remoteVideoRef,
    localVideoRef,
  } = useVoiceCall();

  // 1. INCOMING CALL MODAL (VOICE OR VIDEO)
  if (incomingCall && !callState) {
    const isVideo = incomingCall.mode === "video";
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md animate-in fade-in duration-200">
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

  // 2. ACTIVE CALL OVERLAY (VOICE OR VIDEO)
  if (callState) {
    const isVideo = callState.mode === "video";

    // A. MINIMIZED FLOATING WIDGET
    if (callState.isMinimized) {
      return (
        <div className="fixed bottom-20 right-4 z-50 flex items-center gap-3 rounded-2xl border border-border/80 bg-card/95 p-2.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200">
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
              {callState.status === "connected"
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

    // B. VIDEO CALL FULL MODAL VIEW
    if (isVideo) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
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
              >
                <PhoneOff className="size-5 sm:size-6" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // C. VOICE CALL FULL MODAL VIEW
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
                  ? "Menghubungi suara..."
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
