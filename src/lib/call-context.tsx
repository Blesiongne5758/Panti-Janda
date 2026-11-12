import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useAuth } from "./session";
import { callSounds } from "./call-tones";
import { toast } from "sonner";

export interface CallUser {
  accountId: string;
  name: string;
  photoData: string | null;
}

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

export interface CallState {
  callId: string;
  status: CallStatus;
  isCaller: boolean;
  otherUser: CallUser;
  duration: number; // in seconds
  isMuted: boolean;
  isMinimized: boolean;
}

export interface IncomingCall {
  callId: string;
  callerAccountId: string;
  callerName: string;
  callerPhoto: string | null;
  offer: RTCSessionDescriptionInit;
}

interface CallContextValue {
  callState: CallState | null;
  incomingCall: IncomingCall | null;
  startCall: (target: CallUser) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: (reason?: "ended" | "rejected" | "missed") => Promise<void>;
  toggleMute: () => void;
  toggleMinimize: () => void;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
}

const CallContext = createContext<CallContextValue | null>(null);

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
};

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const [callState, setCallState] = useState<CallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const durationTimerRef = useRef<number | null>(null);
  const callStateRef = useRef<CallState | null>(null);
  callStateRef.current = callState;

  // Cleanup helper
  const cleanupMediaAndPC = useCallback(() => {
    callSounds.stop();
    if (durationTimerRef.current !== null) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  // End call
  const endCall = useCallback(
    async (reason: "ended" | "rejected" | "missed" = "ended") => {
      const current = callStateRef.current;
      const callId = current?.callId;
      const duration = current?.duration ?? 0;

      callSounds.playEnd();
      cleanupMediaAndPC();
      setCallState(null);
      setIncomingCall(null);

      if (callId) {
        try {
          await api("call.end", { callId, reason, duration });
        } catch {
          // ignore
        }
      }
    },
    [cleanupMediaAndPC],
  );

  // Toggle Mute
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setCallState((prev) => (prev ? { ...prev, isMuted: !audioTrack.enabled } : null));
    }
  }, []);

  // Toggle minimize
  const toggleMinimize = useCallback(() => {
    setCallState((prev) => (prev ? { ...prev, isMinimized: !prev.isMinimized } : null));
  }, []);

  // Setup RTCPeerConnection
  const setupPeerConnection = useCallback(
    (callId: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void api("call.candidate", {
            callId,
            candidate: event.candidate.toJSON(),
          }).catch(() => {});
        }
      };

      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          callSounds.stop();
          setCallState((prev) => (prev ? { ...prev, status: "connected" } : null));
          if (!durationTimerRef.current) {
            durationTimerRef.current = window.setInterval(() => {
              setCallState((prev) => (prev ? { ...prev, duration: prev.duration + 1 } : null));
            }, 1000);
          }
        } else if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          void endCall("ended");
        }
      };

      return pc;
    },
    [endCall],
  );

  // Start outgoing call
  const startCall = useCallback(
    async (target: CallUser) => {
      if (callStateRef.current) {
        toast.info("Anda sedang dalam panggilan aktif.");
        return;
      }

      cleanupMediaAndPC();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
      } catch {
        toast.error("Izin mikrofon diperlukan untuk melakukan panggilan suara.");
        return;
      }

      try {
        callSounds.playRingback();
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
        });
        await pc.setLocalDescription(offer);

        const data = await api<{
          call: { id: string; status: CallStatus; createdAt: number };
        }>("call.start", {
          recipientAccountId: target.accountId,
          offer: {
            type: offer.type,
            sdp: offer.sdp,
          },
        });

        const newCallState: CallState = {
          callId: data.call.id,
          status: "calling",
          isCaller: true,
          otherUser: target,
          duration: 0,
          isMuted: false,
          isMinimized: false,
        };

        setCallState(newCallState);

        // Bind candidates and tracks to the new callId
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            void api("call.candidate", {
              callId: data.call.id,
              candidate: event.candidate.toJSON(),
            }).catch(() => {});
          }
        };

        pc.ontrack = (event) => {
          if (remoteAudioRef.current && event.streams[0]) {
            remoteAudioRef.current.srcObject = event.streams[0];
            remoteAudioRef.current.play().catch(() => {});
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            callSounds.stop();
            setCallState((prev) => (prev ? { ...prev, status: "connected" } : null));
            if (!durationTimerRef.current) {
              durationTimerRef.current = window.setInterval(() => {
                setCallState((prev) => (prev ? { ...prev, duration: prev.duration + 1 } : null));
              }, 1000);
            }
          } else if (
            pc.connectionState === "disconnected" ||
            pc.connectionState === "failed" ||
            pc.connectionState === "closed"
          ) {
            void endCall("ended");
          }
        };
      } catch (error) {
        callSounds.stop();
        cleanupMediaAndPC();
        toast.error("Gagal memulai panggilan suara. Pastikan pengguna tujuan aktif.");
      }
    },
    [cleanupMediaAndPC, endCall],
  );

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    callSounds.stop();
    const currentIncoming = incomingCall;
    setIncomingCall(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
    } catch {
      toast.error("Izin mikrofon diperlukan untuk menerima panggilan suara.");
      void endCall("rejected");
      return;
    }

    try {
      const pc = setupPeerConnection(currentIncoming.callId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(currentIncoming.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await api("call.answer", {
        callId: currentIncoming.callId,
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
      });

      setCallState({
        callId: currentIncoming.callId,
        status: "connected",
        isCaller: false,
        otherUser: {
          accountId: currentIncoming.callerAccountId,
          name: currentIncoming.callerName,
          photoData: currentIncoming.callerPhoto,
        },
        duration: 0,
        isMuted: false,
        isMinimized: false,
      });

      if (!durationTimerRef.current) {
        durationTimerRef.current = window.setInterval(() => {
          setCallState((prev) => (prev ? { ...prev, duration: prev.duration + 1 } : null));
        }, 1000);
      }
    } catch {
      cleanupMediaAndPC();
      toast.error("Gagal menghubungkan panggilan suara.");
    }
  }, [cleanupMediaAndPC, endCall, incomingCall, setupPeerConnection]);

  // Reject incoming call
  const rejectCall = useCallback(async () => {
    if (!incomingCall) return;
    const callId = incomingCall.callId;
    callSounds.stop();
    setIncomingCall(null);
    try {
      await api("call.end", { callId, reason: "rejected", duration: 0 });
    } catch {
      // ignore
    }
  }, [incomingCall]);

  // In-call signaling polling (active call loop)
  useEffect(() => {
    if (!callState) return;

    const callId = callState.callId;
    const interval = window.setInterval(async () => {
      try {
        const data = await api<{
          call: {
            id: string;
            status: CallStatus | "rejected" | "missed";
            answer: RTCSessionDescriptionInit | null;
            remoteCandidates: RTCIceCandidateInit[];
            duration: number;
          } | null;
        }>("call.poll", { callId });

        const call = data.call;
        if (!call || call.status === "ended" || call.status === "rejected" || call.status === "missed") {
          toast.info(
            call?.status === "rejected"
              ? "Panggilan ditolak"
              : call?.status === "missed"
                ? "Panggilan tidak terjawab"
                : "Panggilan telah diakhiri",
          );
          void endCall("ended");
          return;
        }

        const pc = pcRef.current;
        if (pc) {
          // If caller received answer
          if (callState.isCaller && call.answer && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(call.answer));
          }

          // Add any new remote ICE candidates
          if (call.remoteCandidates && call.remoteCandidates.length > 0) {
            for (const cand of call.remoteCandidates) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch {
                // ignore duplicate/out of order candidate
              }
            }
          }
        }
      } catch {
        // ignore transient network poll error
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [callState, endCall]);

  // Background incoming call polling (when account is logged in and not in active call)
  useEffect(() => {
    if (!account || callState) return;

    let active = true;
    const checkIncoming = async () => {
      try {
        const data = await api<{
          incomingCall: IncomingCall | null;
        }>("call.poll", {});

        if (!active) return;

        if (data.incomingCall) {
          if (!incomingCall || incomingCall.callId !== data.incomingCall.callId) {
            setIncomingCall(data.incomingCall);
            callSounds.playIncoming();
          }
        } else if (incomingCall) {
          callSounds.stop();
          setIncomingCall(null);
        }
      } catch {
        // ignore
      }
    };

    void checkIncoming();
    const interval = window.setInterval(() => void checkIncoming(), 3500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [account, callState, incomingCall]);

  return (
    <CallContext.Provider
      value={{
        callState,
        incomingCall,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleMinimize,
        remoteAudioRef,
      }}
    >
      {children}
      {/* Hidden audio element for WebRTC playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" aria-hidden />
    </CallContext.Provider>
  );
}

export function useVoiceCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useVoiceCall must be used within a VoiceCallProvider");
  }
  return context;
}
