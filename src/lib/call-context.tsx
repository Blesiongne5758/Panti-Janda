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

function mediaPermissionMessage(error: unknown, requestVideo: boolean): string {
  const name = error instanceof Error ? error.name : "";
  const devices = requestVideo ? "kamera dan mikrofon" : "mikrofon";
  if (name === "MediaDevicesUnavailable") {
    return "Browser ini tidak menyediakan akses perangkat. Buka aplikasi melalui browser modern dan koneksi aman (HTTPS).";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return `Izin ${devices} ditolak. Aktifkan akses perangkat untuk situs ini di pengaturan browser, lalu coba lagi.`;
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return requestVideo ? "Kamera atau mikrofon tidak ditemukan pada perangkat ini." : "Mikrofon tidak ditemukan pada perangkat ini.";
  }
  return `Izin ${devices} diperlukan agar panggilan dapat tersambung.`;
}

export interface CallUser {
  accountId: string;
  name: string;
  photoData: string | null;
}

export type CallMode = "audio" | "video";
export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

export interface CallState {
  callId: string;
  mode: CallMode;
  status: CallStatus;
  isCaller: boolean;
  otherUser: CallUser;
  duration: number; // in seconds
  isMuted: boolean;
  isCameraOff: boolean;
  isMinimized: boolean;
}

export interface IncomingCall {
  callId: string;
  id?: string;
  mode: CallMode;
  callerAccountId: string;
  callerName: string;
  callerPhoto: string | null;
  offer: RTCSessionDescriptionInit;
}

interface CallRenegotiation {
  revision: number;
  mode: CallMode;
  offererAccountId: string;
  offer: RTCSessionDescriptionInit;
  answer: RTCSessionDescriptionInit | null;
  status: "pending" | "accepted" | "rejected";
}

interface CallPollCandidate {
  revision: number;
  candidate: RTCIceCandidateInit;
}

interface CallContextValue {
  callState: CallState | null;
  incomingCall: IncomingCall | null;
  mediaPermissionIssue: string | null;
  incomingVideoUpgrade: CallRenegotiation | null;
  acceptingVideoUpgrade: boolean;
  startCall: (target: CallUser, mode?: CallMode) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  acceptVideoUpgrade: () => Promise<void>;
  rejectVideoUpgrade: () => Promise<void>;
  endCall: (reason?: "ended" | "rejected" | "missed") => Promise<void>;
  switchToVideoCall: () => Promise<void>;
  switchingToVideoTarget: CallUser | null;
  toggleMute: () => void;
  toggleCamera: () => void;
  flipCamera: () => Promise<void>;
  toggleMinimize: () => void;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
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
  const [incomingVideoUpgrade, setIncomingVideoUpgrade] = useState<CallRenegotiation | null>(null);
  const [acceptingVideoUpgrade, setAcceptingVideoUpgrade] = useState(false);
  const [mediaPermissionIssue, setMediaPermissionIssue] = useState<string | null>(null);
  const [switchingToVideoTarget, setSwitchingToVideoTarget] = useState<CallUser | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const switchingToVideoRef = useRef(false);
  const callIdRef = useRef<string | null>(null);
  const localCandidateRevisionRef = useRef<number | null>(null);
  const pendingLocalCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingRemoteCandidatesRef = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());
  const appliedRemoteCandidatesRef = useRef<Set<string>>(new Set());
  const ignoredNegotiationRevisionsRef = useRef<Set<number>>(new Set());
  const negotiationRevisionRef = useRef(0);
  const activeMediaRevisionRef = useRef(0);
  const remoteDescriptionRevisionRef = useRef(-1);
  const lastAppliedAnswerRevisionRef = useRef(0);
  const lastHandledRemoteOfferRevisionRef = useRef(0);
  const lastSettledLocalOfferRevisionRef = useRef(0);
  const localNegotiationPendingRef = useRef(false);
  const pollInFlightRef = useRef(false);
  const pendingLocalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const incomingVideoUpgradeRef = useRef<CallRenegotiation | null>(null);
  const acceptingVideoUpgradeRef = useRef(false);
  const acceptingCallRef = useRef(false);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

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
    remoteStreamRef.current = null;
    callIdRef.current = null;
    localCandidateRevisionRef.current = null;
    pendingLocalCandidatesRef.current = [];
    pendingRemoteCandidatesRef.current.clear();
    appliedRemoteCandidatesRef.current.clear();
    ignoredNegotiationRevisionsRef.current.clear();
    negotiationRevisionRef.current = 0;
    activeMediaRevisionRef.current = 0;
    remoteDescriptionRevisionRef.current = -1;
    lastAppliedAnswerRevisionRef.current = 0;
    lastHandledRemoteOfferRevisionRef.current = 0;
    lastSettledLocalOfferRevisionRef.current = 0;
    localNegotiationPendingRef.current = false;
    pendingLocalVideoTrackRef.current = null;
    switchingToVideoRef.current = false;
    incomingVideoUpgradeRef.current = null;
    acceptingVideoUpgradeRef.current = false;
    setIncomingVideoUpgrade(null);
    setAcceptingVideoUpgrade(false);
    setSwitchingToVideoTarget(null);
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
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
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
      callStateRef.current = null;
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

  const publishLocalCandidate = useCallback((candidate: RTCIceCandidateInit) => {
    const callId = callIdRef.current;
    const revision = localCandidateRevisionRef.current;
    if (!callId || revision === null) {
      pendingLocalCandidatesRef.current.push(candidate);
      return;
    }
    void api("call.candidate", { callId, revision, candidate }).catch(() => {});
  }, []);

  const activateLocalCandidateRevision = useCallback((callId: string, revision: number) => {
    callIdRef.current = callId;
    localCandidateRevisionRef.current = revision;
    const pending = pendingLocalCandidatesRef.current.splice(0);
    for (const candidate of pending) {
      void api("call.candidate", { callId, revision, candidate }).catch(() => {});
    }
  }, []);

  const addOrQueueRemoteCandidates = useCallback(async (
    pc: RTCPeerConnection,
    candidates: CallPollCandidate[],
  ) => {
    for (const item of candidates) {
      if (ignoredNegotiationRevisionsRef.current.has(item.revision)) continue;
      const key = `${item.revision}:${JSON.stringify(item.candidate)}`;
      if (appliedRemoteCandidatesRef.current.has(key)) continue;
      if (item.revision > remoteDescriptionRevisionRef.current) {
        const pending = pendingRemoteCandidatesRef.current.get(item.revision) ?? [];
        if (!pending.some((candidate) => JSON.stringify(candidate) === JSON.stringify(item.candidate))) {
          pending.push(item.candidate);
        }
        pendingRemoteCandidatesRef.current.set(item.revision, pending);
        continue;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(item.candidate));
        appliedRemoteCandidatesRef.current.add(key);
      } catch {
        // The candidate may belong to an obsolete ICE generation; later polls can retry it.
      }
    }
  }, []);

  const drainRemoteCandidates = useCallback(async (pc: RTCPeerConnection, readyRevision: number) => {
    remoteDescriptionRevisionRef.current = readyRevision;
    const ready: CallPollCandidate[] = [];
    for (const [revision, candidates] of pendingRemoteCandidatesRef.current) {
      if (revision > readyRevision) continue;
      pendingRemoteCandidatesRef.current.delete(revision);
      for (const candidate of candidates) ready.push({ revision, candidate });
    }
    await addOrQueueRemoteCandidates(pc, ready);
  }, [addOrQueueRemoteCandidates]);

  const ignoreNegotiationRevision = useCallback((revision: number) => {
    ignoredNegotiationRevisionsRef.current.add(revision);
    pendingRemoteCandidatesRef.current.delete(revision);
  }, []);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setCallState((prev) => (prev ? { ...prev, isMuted: !audioTrack.enabled } : null));
    }
  }, []);

  // Toggle Camera
  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCallState((prev) => (prev ? { ...prev, isCameraOff: !videoTrack.enabled } : null));
    }
  }, []);

  // Flip Camera (for mobile)
  const flipCamera = useCallback(async () => {
    if (!localStreamRef.current || !pcRef.current) return;
    const nextFacing = facingMode === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: { exact: nextFacing } },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];

      if (oldVideoTrack && newVideoTrack) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
        oldVideoTrack.stop();
        localStreamRef.current.removeTrack(oldVideoTrack);
        localStreamRef.current.addTrack(newVideoTrack);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        setFacingMode(nextFacing);
      }
    } catch {
      toast.info("Perangkat tidak memiliki kamera alternatif.");
    }
  }, [facingMode]);

  // Toggle minimize
  const toggleMinimize = useCallback(() => {
    setCallState((prev) => (prev ? { ...prev, isMinimized: !prev.isMinimized } : null));
  }, []);

  // Setup RTCPeerConnection
  const setupPeerConnection = useCallback(
    (callId?: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      negotiationRevisionRef.current = 0;
      activeMediaRevisionRef.current = 0;
      remoteDescriptionRevisionRef.current = -1;
      if (callId) activateLocalCandidateRevision(callId, 0);
      else {
        callIdRef.current = null;
        localCandidateRevisionRef.current = null;
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) publishLocalCandidate(event.candidate.toJSON());
      };

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (!remoteStream) return;
        remoteStreamRef.current = remoteStream;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(() => {});
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
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
    [activateLocalCandidateRevision, endCall, publishLocalCandidate],
  );

  // Start outgoing call (audio or video)
  const startCall = useCallback(
    async (target: CallUser, mode: CallMode = "audio") => {
      if (callStateRef.current) {
        toast.info("Anda sedang dalam panggilan aktif.");
        return;
      }

      cleanupMediaAndPC();

      let stream: MediaStream;
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("MediaDevicesUnavailable");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === "video" ? { facingMode: "user" } : false,
        });
        setMediaPermissionIssue(null);
        localStreamRef.current = stream;
        if (mode === "video" && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        const message = mediaPermissionMessage(error, mode === "video");
        setMediaPermissionIssue(message);
        toast.error(message);
        return;
      }

      try {
        callSounds.playRingback();
        const pc = setupPeerConnection();

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: mode === "video",
        });
        await pc.setLocalDescription(offer);

        const data = await api<{
          call: { id: string; mode: CallMode; status: CallStatus; createdAt: number };
        }>("call.start", {
          recipientAccountId: target.accountId,
          mode,
          offer: {
            type: offer.type,
            sdp: offer.sdp,
          },
        });

        negotiationRevisionRef.current = 0;
        activeMediaRevisionRef.current = 0;
        remoteDescriptionRevisionRef.current = -1;
        activateLocalCandidateRevision(data.call.id, 0);

        const newCallState: CallState = {
          callId: data.call.id,
          mode,
          status: "calling",
          isCaller: true,
          otherUser: target,
          duration: 0,
          isMuted: false,
          isCameraOff: false,
          isMinimized: false,
        };

        setCallState(newCallState);
      } catch {
        callSounds.stop();
        cleanupMediaAndPC();
        toast.error("Gagal memulai panggilan. Pastikan pengguna tujuan aktif.");
      }
    },
    [activateLocalCandidateRevision, cleanupMediaAndPC, setupPeerConnection],
  );

  const rollbackVideoUpgrade = useCallback(async (
    pc: RTCPeerConnection,
    callId: string,
    restoreRevision: number,
  ) => {
    if (pcRef.current !== pc || callIdRef.current !== callId) return;
    if (pc.signalingState !== "stable") {
      await pc.setLocalDescription({ type: "rollback" }).catch(() => {});
    }
    const track = pendingLocalVideoTrackRef.current;
    if (track) {
      const sender = pc.getSenders().find((item) => item.track === track);
      if (sender) pc.removeTrack(sender);
      localStreamRef.current?.removeTrack(track);
      track.stop();
    }
    pendingLocalVideoTrackRef.current = null;
    pendingLocalCandidatesRef.current = [];
    localCandidateRevisionRef.current = restoreRevision;
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, []);

  const switchToVideoCall = useCallback(async () => {
    const current = callStateRef.current;
    const pc = pcRef.current;
    const localStream = localStreamRef.current;
    if (
      !current || current.mode !== "audio" || current.status !== "connected" || !pc || !localStream ||
      switchingToVideoRef.current || incomingVideoUpgradeRef.current
    ) return;
    if (pc.signalingState !== "stable") {
      toast.info("Tunggu sebentar hingga negosiasi panggilan selesai.");
      return;
    }
    if (localStream.getVideoTracks().length > 0) return;

    switchingToVideoRef.current = true;
    localNegotiationPendingRef.current = true;
    const callId = current.callId;
    const expectedRevision = negotiationRevisionRef.current;
    const previousCandidateRevision = activeMediaRevisionRef.current;
    setSwitchingToVideoTarget(current.otherUser);

    let cameraStream: MediaStream | null = null;
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user" },
      });
      if (callStateRef.current?.callId !== callId || pcRef.current !== pc) {
        cameraStream.getTracks().forEach((track) => track.stop());
        return;
      }

      const videoTrack = cameraStream.getVideoTracks()[0];
      if (!videoTrack) throw new Error("camera_track_unavailable");
      localStream.addTrack(videoTrack);
      pendingLocalVideoTrackRef.current = videoTrack;
      pc.addTrack(videoTrack, localStream);
      localCandidateRevisionRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      let result: { revision: number } | null = null;
      try {
        result = await api<{ revision: number }>("call.renegotiate.offer", {
          callId,
          expectedRevision,
          mode: "video",
          offer: { type: offer.type, sdp: offer.sdp },
        });
      } catch (error) {
        // A lost HTTP response may follow a committed offer; reconcile before rolling back.
        const poll = await api<{ call: { renegotiation?: CallRenegotiation | null } | null }>(
          "call.poll",
          { callId },
        ).catch(() => null);
        const committed = poll?.call?.renegotiation;
        if (
          committed && committed.offererAccountId === account?.id &&
          committed.revision === expectedRevision + 1 &&
          committed.offer?.sdp === offer.sdp
        ) result = { revision: committed.revision };
        else throw error;
      }
      if (!result || !Number.isSafeInteger(result.revision)) throw new Error("invalid_negotiation_revision");
      negotiationRevisionRef.current = result.revision;
      activateLocalCandidateRevision(callId, result.revision);
    } catch {
      if (cameraStream && pcRef.current === pc) {
        await rollbackVideoUpgrade(pc, callId, previousCandidateRevision);
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      localNegotiationPendingRef.current = false;
      switchingToVideoRef.current = false;
      setSwitchingToVideoTarget(null);
      if (callStateRef.current?.callId === callId) {
        toast.error("Tidak dapat memulai permintaan video. Panggilan suara tetap berlangsung.");
      }
    }
  }, [account?.id, activateLocalCandidateRevision, rollbackVideoUpgrade]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall || acceptingCallRef.current) return;
    acceptingCallRef.current = true;

    callSounds.stop();
    const currentIncoming = incomingCall;
    const isVideo = currentIncoming.mode === "video";
    setIncomingCall(null);

    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("MediaDevicesUnavailable");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: "user" } : false,
      });
      setMediaPermissionIssue(null);
      localStreamRef.current = stream;
      if (isVideo && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      const message = mediaPermissionMessage(error, isVideo);
      setMediaPermissionIssue(message);
      toast.error(message);
      try {
        await api("call.end", { callId: currentIncoming.callId, reason: "rejected", duration: 0 });
      } catch {
        // ignore signaling cleanup failure
      }
      acceptingCallRef.current = false;
      return;
    }

    try {
      const pc = setupPeerConnection(currentIncoming.callId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(currentIncoming.offer));
      await drainRemoteCandidates(pc, 0);
      negotiationRevisionRef.current = 0;
      activeMediaRevisionRef.current = 0;
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
        mode: currentIncoming.mode,
        status: "calling",
        isCaller: false,
        otherUser: {
          accountId: currentIncoming.callerAccountId,
          name: currentIncoming.callerName,
          photoData: currentIncoming.callerPhoto,
        },
        duration: 0,
        isMuted: false,
        isCameraOff: false,
        isMinimized: false,
      });
      acceptingCallRef.current = false;

    } catch {
      cleanupMediaAndPC();
      try {
        await api("call.end", { callId: currentIncoming.callId, reason: "rejected", duration: 0 });
      } catch {
        // ignore signaling cleanup failure
      }
      acceptingCallRef.current = false;
      toast.error("Gagal menghubungkan panggilan.");
    }
  }, [cleanupMediaAndPC, drainRemoteCandidates, incomingCall, setupPeerConnection]);

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

  const acceptVideoUpgrade = useCallback(async () => {
    const request = incomingVideoUpgradeRef.current;
    const current = callStateRef.current;
    const pc = pcRef.current;
    const localStream = localStreamRef.current;
    if (
      !request || !current || current.mode !== "audio" || !pc || !localStream ||
      acceptingVideoUpgradeRef.current || request.offererAccountId === account?.id
    ) return;
    if (pc.signalingState !== "stable") {
      toast.info("Tunggu sebentar hingga negosiasi panggilan selesai.");
      return;
    }

    acceptingVideoUpgradeRef.current = true;
    localNegotiationPendingRef.current = true;
    setAcceptingVideoUpgrade(true);
    const callId = current.callId;
    const previousCandidateRevision = localCandidateRevisionRef.current ?? 0;
    let cameraStream: MediaStream | null = null;
    let answerCommitted = false;
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user" },
      });
      if (callStateRef.current?.callId !== callId || pcRef.current !== pc) {
        cameraStream.getTracks().forEach((track) => track.stop());
        return;
      }

      const videoTrack = cameraStream.getVideoTracks()[0];
      if (!videoTrack) throw new Error("camera_track_unavailable");
      localStream.addTrack(videoTrack);
      pendingLocalVideoTrackRef.current = videoTrack;
      localCandidateRevisionRef.current = null;
      pc.addTrack(videoTrack, localStream);

      await pc.setRemoteDescription(new RTCSessionDescription(request.offer));
      await drainRemoteCandidates(pc, request.revision);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      try {
        await api("call.renegotiate.answer", {
          callId,
          revision: request.revision,
          answer: { type: answer.type, sdp: answer.sdp },
        });
        answerCommitted = true;
      } catch (error) {
        const poll = await api<{ call: { renegotiation?: CallRenegotiation | null } | null }>(
          "call.poll",
          { callId },
        ).catch(() => null);
        const committed = poll?.call?.renegotiation;
        if (
          committed?.revision === request.revision && committed.status === "accepted" &&
          committed.offererAccountId === request.offererAccountId && committed.answer?.sdp === answer.sdp
        ) answerCommitted = true;
        else throw error;
      }

      activateLocalCandidateRevision(callId, request.revision);
      negotiationRevisionRef.current = Math.max(negotiationRevisionRef.current, request.revision);
      activeMediaRevisionRef.current = request.revision;
      lastHandledRemoteOfferRevisionRef.current = request.revision;
      lastSettledLocalOfferRevisionRef.current = Math.max(lastSettledLocalOfferRevisionRef.current, request.revision);
      pendingLocalVideoTrackRef.current = null;
      incomingVideoUpgradeRef.current = null;
      setIncomingVideoUpgrade(null);
      setAcceptingVideoUpgrade(false);
      setCallState((prev) => prev?.callId === callId
        ? { ...prev, mode: request.mode, isCameraOff: false }
        : prev);
      setFacingMode("user");
    } catch {
      const stillInCall = callStateRef.current?.callId === callId && pcRef.current === pc;
      if (stillInCall && !answerCommitted) {
        await api("call.renegotiate.reject", { callId, revision: request.revision }).catch(() => {});
        ignoreNegotiationRevision(request.revision);
        await rollbackVideoUpgrade(pc, callId, previousCandidateRevision);
        lastHandledRemoteOfferRevisionRef.current = request.revision;
        negotiationRevisionRef.current = Math.max(negotiationRevisionRef.current, request.revision);
        incomingVideoUpgradeRef.current = null;
        setIncomingVideoUpgrade(null);
        setAcceptingVideoUpgrade(false);
        toast.error("Kamera tidak tersedia atau negosiasi gagal. Panggilan suara tetap berlangsung.");
      } else if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    } finally {
      acceptingVideoUpgradeRef.current = false;
      localNegotiationPendingRef.current = false;
      setAcceptingVideoUpgrade(false);
    }
  }, [account?.id, activateLocalCandidateRevision, drainRemoteCandidates, ignoreNegotiationRevision, rollbackVideoUpgrade]);

  const rejectVideoUpgrade = useCallback(async () => {
    const request = incomingVideoUpgradeRef.current;
    const current = callStateRef.current;
    if (!request || !current || acceptingVideoUpgradeRef.current) return;
    acceptingVideoUpgradeRef.current = true;
    setAcceptingVideoUpgrade(true);
    try {
      await api("call.renegotiate.reject", { callId: current.callId, revision: request.revision });
      ignoreNegotiationRevision(request.revision);
      lastHandledRemoteOfferRevisionRef.current = request.revision;
      negotiationRevisionRef.current = Math.max(negotiationRevisionRef.current, request.revision);
      incomingVideoUpgradeRef.current = null;
      setIncomingVideoUpgrade(null);
    } catch {
      toast.error("Permintaan belum dapat ditolak. Periksa koneksi lalu coba lagi.");
    } finally {
      acceptingVideoUpgradeRef.current = false;
      setAcceptingVideoUpgrade(false);
    }
  }, [ignoreNegotiationRevision]);

  // Ensure local video element gets stream if attached after render
  useEffect(() => {
    if (!callState) return;
    if (localStreamRef.current && localVideoRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (remoteStreamRef.current) {
      if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
        remoteAudioRef.current.play().catch(() => {});
      }
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch(() => {});
      }
    }
  }, [callState]);

  // In-call signaling polling (active call loop)
  useEffect(() => {
    const callId = callState?.callId;
    if (!callId) return;
    let active = true;

    const poll = async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const data = await api<{
          call: {
            id: string;
            status: CallStatus | "active" | "rejected" | "missed";
            mode: CallMode;
            answer: RTCSessionDescriptionInit | null;
            remoteCandidates: RTCIceCandidateInit[];
            negotiationCandidates?: Array<CallPollCandidate & { id: number | string }>;
            currentRevision?: number;
            renegotiation?: CallRenegotiation | null;
            duration: number;
          } | null;
        }>("call.poll", { callId });
        if (!active) return;

        const current = callStateRef.current;
        const call = data.call;
        if (!current || current.callId !== callId) return;
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

        if (Number.isSafeInteger(call.currentRevision) && call.currentRevision !== undefined) {
          negotiationRevisionRef.current = Math.max(negotiationRevisionRef.current, call.currentRevision);
        }
        const pc = pcRef.current;
        if (!pc) return;

        // The initial caller answer remains revision 0; later answers are keyed to their own offer.
        if (current.isCaller && call.answer && remoteDescriptionRevisionRef.current < 0) {
          await pc.setRemoteDescription(new RTCSessionDescription(call.answer));
          await drainRemoteCandidates(pc, 0);
        }

        const negotiation = call.renegotiation;
        if (negotiation && negotiation.revision > 0) {
          const isLocalOffer = negotiation.offererAccountId === account?.id;
          if (negotiation.status === "pending" && !isLocalOffer && !localNegotiationPendingRef.current) {
            if (
              negotiation.revision > lastHandledRemoteOfferRevisionRef.current &&
              incomingVideoUpgradeRef.current?.revision !== negotiation.revision
            ) {
              incomingVideoUpgradeRef.current = negotiation;
              setIncomingVideoUpgrade(negotiation);
              setAcceptingVideoUpgrade(false);
              toast.info(`${current.otherUser.name} mengajak Anda beralih ke video.`);
            }
          } else if (
            negotiation.status === "accepted" && isLocalOffer && negotiation.answer &&
            negotiation.revision > lastAppliedAnswerRevisionRef.current
          ) {
            await pc.setRemoteDescription(new RTCSessionDescription(negotiation.answer));
            await drainRemoteCandidates(pc, negotiation.revision);
            remoteDescriptionRevisionRef.current = negotiation.revision;
            negotiationRevisionRef.current = Math.max(negotiationRevisionRef.current, negotiation.revision);
            activeMediaRevisionRef.current = negotiation.revision;
            localCandidateRevisionRef.current = negotiation.revision;
            lastAppliedAnswerRevisionRef.current = negotiation.revision;
            lastSettledLocalOfferRevisionRef.current = negotiation.revision;
            pendingLocalVideoTrackRef.current = null;
            localNegotiationPendingRef.current = false;
            switchingToVideoRef.current = false;
            setSwitchingToVideoTarget(null);
            setCallState((prev) => prev?.callId === callId
              ? { ...prev, mode: negotiation.mode, isCameraOff: false }
              : prev);
          } else if (
            negotiation.status === "rejected" && isLocalOffer &&
            negotiation.revision > lastSettledLocalOfferRevisionRef.current
          ) {
            const restoreRevision = activeMediaRevisionRef.current;
            await rollbackVideoUpgrade(pc, callId, restoreRevision);
            ignoreNegotiationRevision(negotiation.revision);
            lastSettledLocalOfferRevisionRef.current = negotiation.revision;
            negotiationRevisionRef.current = Math.max(negotiationRevisionRef.current, negotiation.revision);
            localNegotiationPendingRef.current = false;
            switchingToVideoRef.current = false;
            setSwitchingToVideoTarget(null);
            toast.info("Kontak memilih tetap menggunakan panggilan suara.");
          } else if (
            negotiation.status === "rejected" && !isLocalOffer &&
            negotiation.revision > lastHandledRemoteOfferRevisionRef.current
          ) {
            ignoreNegotiationRevision(negotiation.revision);
            lastHandledRemoteOfferRevisionRef.current = negotiation.revision;
            if (incomingVideoUpgradeRef.current?.revision === negotiation.revision) {
              incomingVideoUpgradeRef.current = null;
              setIncomingVideoUpgrade(null);
              setAcceptingVideoUpgrade(false);
            }
          }
        }

        const candidates: CallPollCandidate[] = [
          ...(call.remoteCandidates ?? []).map((candidate) => ({ revision: 0, candidate })),
          ...(call.negotiationCandidates ?? [])
            .filter((item) => Number.isSafeInteger(item.revision) && item.revision >= 0 && item.candidate)
            .map((item) => ({ revision: item.revision, candidate: item.candidate })),
        ];
        await addOrQueueRemoteCandidates(pc, candidates);
      } catch {
        // Network and transient SDP errors are retried by the next poll without ending audio.
      } finally {
        pollInFlightRef.current = false;
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 1200);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [account?.id, addOrQueueRemoteCandidates, callState?.callId, drainRemoteCandidates, endCall, ignoreNegotiationRevision, rollbackVideoUpgrade]);

  // Background incoming call polling (when account is logged in and not in active call)
  useEffect(() => {
    if (!account || callState || acceptingCallRef.current || switchingToVideoTarget) return;

    let active = true;
    const lastNotifiedCallIdRef = { current: "" };
    const checkIncoming = async () => {
      try {
        const data = await api<{
          incomingCall: IncomingCall | null;
        }>("call.poll", {});

        if (!active) return;

        if (data.incomingCall) {
          const normalizedCallId = data.incomingCall.callId || data.incomingCall.id;
          if (!normalizedCallId) return;
          const normalizedIncoming: IncomingCall = {
            ...data.incomingCall,
            callId: normalizedCallId,
          };
          if (!incomingCall || incomingCall.callId !== normalizedIncoming.callId) {
            setIncomingCall(normalizedIncoming);
            callSounds.playIncoming();
            if (lastNotifiedCallIdRef.current !== normalizedIncoming.callId) {
              lastNotifiedCallIdRef.current = normalizedIncoming.callId;
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                const title = normalizedIncoming.mode === "video" ? "Panggilan video masuk" : "Panggilan suara masuk";
                const body = `${normalizedIncoming.callerName} sedang menghubungi Anda`;
                const url = `/#/pesan?with=${encodeURIComponent(normalizedIncoming.callerAccountId)}`;
                const options: NotificationOptions = {
                  body,
                  icon: "/images/logo-pj.png",
                  tag: normalizedIncoming.callId,
                  data: { url },
                };
                const fallbackNotification = () => {
                  if (Notification.permission !== "granted") return;
                  try {
                    const notification = new Notification(title, options);
                    notification.onclick = () => {
                      window.focus();
                      window.location.hash = url.slice(1);
                      notification.close();
                    };
                  } catch {
                    // Some browsers require a service-worker notification instead.
                  }
                };
                if ("serviceWorker" in navigator) {
                  void navigator.serviceWorker.getRegistration().then((registration) => {
                    if (registration) return registration.showNotification(title, options);
                    fallbackNotification();
                  }).catch(fallbackNotification);
                } else {
                  fallbackNotification();
                }
              }
            }
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
  }, [account, callState, incomingCall, switchingToVideoTarget]);

  return (
    <CallContext.Provider
      value={{
        callState,
        incomingCall,
        mediaPermissionIssue,
        incomingVideoUpgrade,
        acceptingVideoUpgrade,
        startCall,
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
        remoteAudioRef,
        remoteVideoRef,
        localVideoRef,
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
