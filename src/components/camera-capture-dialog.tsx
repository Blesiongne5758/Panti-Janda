import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  Video,
  SwitchCamera,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  Square,
  Circle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image-compress";

export interface CapturedMedia {
  file: File;
  type: "photo" | "video";
  duration?: number;
  previewUrl: string;
}

interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowedModes?: "both" | "photo-only" | "video-only";
  onCapture: (media: CapturedMedia) => void;
  maxVideoSeconds?: number;
}

export function CameraCaptureDialog({
  open,
  onOpenChange,
  allowedModes = "both",
  onCapture,
  maxVideoSeconds = 6,
}: CameraCaptureDialogProps) {
  const [activeTab, setActiveTab] = useState<"photo" | "video">(
    allowedModes === "video-only" ? "video" : "photo",
  );
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loadingCamera, setLoadingCamera] = useState(false);

  // Video recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Preview state after capture
  const [previewMedia, setPreviewMedia] = useState<CapturedMedia | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const fileFallbackInputRef = useRef<HTMLInputElement | null>(null);

  // Start Camera Stream
  useEffect(() => {
    if (!open || previewMedia) return;

    let isMounted = true;
    setLoadingCamera(true);
    setCameraError(null);

    async function initCamera() {
      // Stop any existing stream first
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      try {
        let mediaStream: MediaStream | null = null;
        const attempts: MediaStreamConstraints[] = [
          // 1. Ideal dengan facingMode dan audio jika video
          {
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: activeTab === "video",
          },
          // 2. Ideal dengan facingMode tanpa audio
          {
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          // 3. Fallback umum (sangat penting untuk webcam desktop / PC tanpa facingMode)
          {
            video: true,
            audio: activeTab === "video",
          },
          // 4. Fallback absolut hanya video (kompatibel 100% semua webcam USB/desktop)
          {
            video: true,
            audio: false,
          },
        ];

        let lastErr: unknown = null;
        for (const constraint of attempts) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia(constraint);
            if (mediaStream) break;
          } catch (e) {
            lastErr = e;
          }
        }

        if (!mediaStream) {
          throw lastErr || new Error("Tidak dapat mengakses kamera perangkat. Pastikan izin kamera diizinkan pada browser Anda.");
        }

        if (!isMounted) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
          };
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        if (!isMounted) return;
        const msg =
          err instanceof Error
            ? err.message
            : "Tidak dapat mengakses kamera perangkat. Pastikan izin kamera telah diberikan pada browser.";
        setCameraError(msg);
      } finally {
        if (isMounted) setLoadingCamera(false);
      }
    }

    void initCamera();

    return () => {
      isMounted = false;
    };
  }, [open, facingMode, activeTab, previewMedia]);

  // Clean up stream when closing
  useEffect(() => {
    if (!open) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
      }
      if (isRecording) {
        stopRecording();
      }
      setPreviewMedia(null);
      setRecordingSeconds(0);
    }
  }, [open]);

  // Handle Capture Photo
  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Flip horizontal if using user (selfie) camera for natural mirror effect
    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;

        const rawFile = new File([blob], `kamera-${Date.now()}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });

        // Automatically compress image to keep it lightweight (<100KB)
        const compressed = await compressImage(rawFile, { maxWidth: 1200, quality: 0.78 });
        const previewUrl = URL.createObjectURL(compressed);

        setPreviewMedia({
          file: compressed,
          type: "photo",
          previewUrl,
        });

        // Stop camera while in preview
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          setStream(null);
        }
      },
      "image/jpeg",
      0.9,
    );
  };

  // Start Video Recording (Max 6 Seconds)
  const startRecording = () => {
    if (!stream) return;

    recordedChunksRef.current = [];
    setIsRecording(true);
    setRecordingSeconds(0);
    startTimeRef.current = Date.now();

    // Determine supported mime type
    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    let selectedMime = "";
    for (const m of mimeTypes) {
      if (MediaRecorder.isTypeSupported(m)) {
        selectedMime = m;
        break;
      }
    }

    const recorder = selectedMime
      ? new MediaRecorder(stream, { mimeType: selectedMime })
      : new MediaRecorder(stream);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const mime = recorder.mimeType || "video/webm";
      const blob = new Blob(recordedChunksRef.current, { type: mime });
      const durationSec = Math.min(
        maxVideoSeconds,
        Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)),
      );

      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `video-${Date.now()}.${ext}`, {
        type: mime,
        lastModified: Date.now(),
      });

      const previewUrl = URL.createObjectURL(blob);
      setPreviewMedia({
        file,
        type: "video",
        duration: durationSec,
        previewUrl,
      });

      // Stop camera stream
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start(100);

    // Live counter and auto-stop exactly at maxVideoSeconds
    const interval = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setRecordingSeconds(elapsed);
    }, 50);
    recordIntervalRef.current = interval;

    const timeout = window.setTimeout(() => {
      stopRecording();
    }, maxVideoSeconds * 1000);
    recordTimerRef.current = timeout;
  };

  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Retake photo / video
  const handleRetake = () => {
    if (previewMedia?.previewUrl) {
      URL.revokeObjectURL(previewMedia.previewUrl);
    }
    setPreviewMedia(null);
    setRecordingSeconds(0);
  };

  // Confirm and use captured media
  const handleUseMedia = () => {
    if (!previewMedia) return;
    onCapture(previewMedia);
    onOpenChange(false);
  };

  // Fallback native input when camera API is unavailable
  const handleNativeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const compressed = await compressImage(file, { maxWidth: 1200, quality: 0.78 });
      const previewUrl = URL.createObjectURL(compressed);
      setPreviewMedia({
        file: compressed,
        type: "photo",
        previewUrl,
      });
    } else if (file.type.startsWith("video/")) {
      const previewUrl = URL.createObjectURL(file);
      setPreviewMedia({
        file,
        type: "video",
        duration: 6,
        previewUrl,
      });
    }
  };

  const progressPercent = Math.min(100, (recordingSeconds / maxVideoSeconds) * 100);

  // Render modal langsung ke document.body via portal agar z-index lebih tinggi dari
  // chat container (z-[60]) dan tidak tertimpa di mobile view
  if (!open) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kamera Perangkat"
    >
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-black text-white border border-zinc-800 shadow-2xl flex flex-col max-h-[95dvh]">

        {/* HEADER */}
        <div className="flex shrink-0 items-center justify-between p-4 bg-zinc-900/90 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Camera className="size-4 text-primary" />
            <span>Kamera Perangkat</span>
          </div>

          {/* Mode Switcher Tabs (Foto vs Video 6s) */}
          {allowedModes === "both" && !previewMedia && !isRecording && (
            <div className="flex bg-zinc-800 p-0.5 rounded-full text-xs">
              <button
                type="button"
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  activeTab === "photo" ? "bg-primary text-white" : "text-zinc-400 hover:text-white"
                }`}
                onClick={() => setActiveTab("photo")}
              >
                Foto
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  activeTab === "video" ? "bg-primary text-white" : "text-zinc-400 hover:text-white"
                }`}
                onClick={() => setActiveTab("video")}
              >
                Video ({maxVideoSeconds}d)
              </button>
            </div>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="ml-2 flex size-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* VIEWPORT AREA */}
        <div className="relative aspect-[4/5] sm:aspect-[3/4] w-full bg-zinc-950 flex items-center justify-center overflow-hidden flex-shrink-0">
          {previewMedia ? (
            /* PREVIEW CAPTURED MEDIA */
            <div className="relative w-full h-full flex items-center justify-center">
              {previewMedia.type === "photo" ? (
                <img
                  src={previewMedia.previewUrl}
                  alt="Hasil Kamera"
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  src={previewMedia.previewUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          ) : cameraError ? (
            /* ERROR / PERMISSION FALLBACK */
            <div className="p-6 text-center space-y-4 max-w-xs">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                <AlertCircle className="size-6" />
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">{cameraError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2 border-zinc-700 text-white hover:bg-zinc-800"
                onClick={() => fileFallbackInputRef.current?.click()}
              >
                <Camera className="size-4" />
                Buka Kamera Sistem
              </Button>
              <input
                ref={fileFallbackInputRef}
                type="file"
                accept={activeTab === "video" ? "video/*" : "image/*"}
                capture="environment"
                onChange={handleNativeFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            /* LIVE CAMERA VIEWFINDER */
            <>
              {loadingCamera && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10 gap-2">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <span className="text-xs text-zinc-400">Menghubungkan kamera…</span>
                </div>
              )}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
              />

              {/* RECORDING OVERLAY (PROGRESS BAR & TIMER) */}
              {isRecording && (
                <div className="absolute top-3 inset-x-3 z-20 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                    <span className="flex items-center gap-1.5 text-rose-500">
                      <span className="size-2.5 rounded-full bg-rose-500 animate-pulse" />
                      REC
                    </span>
                    <span className="font-mono text-white">
                      {recordingSeconds.toFixed(1)}s / {maxVideoSeconds}s
                    </span>
                  </div>

                  {/* Visual Smooth Progress Bar */}
                  <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 transition-all duration-75 ease-linear rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* FLIP CAMERA BUTTON */}
              {!isRecording && (
                <button
                  type="button"
                  onClick={() => setFacingMode((prev) => (prev === "user" ? "environment" : "user"))}
                  className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/75 transition-colors z-20"
                  title="Putar Kamera"
                >
                  <SwitchCamera className="size-5" />
                </button>
              )}
            </>
          )}
        </div>

        {/* BOTTOM CONTROLS FOOTER */}
        <div className="shrink-0 p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between">
          {previewMedia ? (
            /* AFTER CAPTURE ACTIONS */
            <div className="flex w-full items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white"
                onClick={handleRetake}
              >
                <RotateCcw className="size-4" />
                Ambil Ulang
              </Button>

              <Button
                type="button"
                size="sm"
                className="flex-1 gap-1.5 bg-primary hover:bg-primary/90 text-white font-semibold"
                onClick={handleUseMedia}
              >
                <Check className="size-4" />
                {previewMedia.type === "photo" ? "Gunakan Foto" : "Gunakan Video"}
              </Button>
            </div>
          ) : (
            /* LIVE CAPTURE TRIGGER BUTTONS */
            <div className="flex w-full items-center justify-around">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>

              {activeTab === "photo" ? (
                /* PHOTO SHUTTER BUTTON */
                <button
                  type="button"
                  onClick={() => void capturePhoto()}
                  disabled={loadingCamera || !!cameraError}
                  className="flex size-16 items-center justify-center rounded-full border-4 border-white bg-white/20 p-1 transition-transform active:scale-90 hover:bg-white/30 disabled:opacity-40"
                  aria-label="Ambil Foto"
                >
                  <div className="size-full rounded-full bg-white shadow-md" />
                </button>
              ) : (
                /* VIDEO RECORD BUTTON (MAX 6 SECONDS) */
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={loadingCamera || !!cameraError}
                  className={`flex size-16 items-center justify-center rounded-full border-4 p-1 transition-transform active:scale-95 disabled:opacity-40 ${
                    isRecording ? "border-rose-500 bg-rose-500/20" : "border-rose-600 bg-rose-600/20"
                  }`}
                  aria-label={isRecording ? "Hentikan Rekaman" : "Mulai Rekam Video"}
                >
                  {isRecording ? (
                    <div className="size-6 rounded-sm bg-rose-600 shadow-md animate-pulse" />
                  ) : (
                    <div className="size-full rounded-full bg-rose-600 shadow-md" />
                  )}
                </button>
              )}

              <div className="w-12 text-center text-[10px] text-zinc-400">
                {activeTab === "video" && (
                  <span>Maks {maxVideoSeconds}d</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
