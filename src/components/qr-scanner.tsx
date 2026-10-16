import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, CameraOff, CheckCircle2, Loader2, QrCode, ScanLine, XCircle } from "lucide-react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface QrDecodeResult {
  ok: boolean;
  message: string;
}

interface QrScannerSectionProps {
  cameraTitle: string;
  cameraDescription: string;
  manualTitle: string;
  manualDescription: string;
  manualLabel: string;
  manualPlaceholder: string;
  submitLabel: string;
  onDecode: (raw: string) => Promise<QrDecodeResult>;
  manualFooter?: ReactNode;
}

export function QrScannerSection({
  cameraTitle,
  cameraDescription,
  manualTitle,
  manualDescription,
  manualLabel,
  manualPlaceholder,
  submitLabel,
  onDecode,
  manualFooter,
}: QrScannerSectionProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<QrDecodeResult | null>(null);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const busyRef = useRef(false);
  const lastScanRef = useRef<{ raw: string; at: number } | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const submitCode = useCallback(
    async (raw: string): Promise<boolean> => {
      const result = await onDecode(raw);
      setLastResult(result);
      return result.ok;
    },
    [onDecode],
  );

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    if (video.readyState >= 2 && video.videoWidth > 0) {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
        if (decoded?.data && !busyRef.current) {
          const last = lastScanRef.current;
          const duplicate = last && last.raw === decoded.data && Date.now() - last.at < 4000;
          if (!duplicate) {
            lastScanRef.current = { raw: decoded.data, at: Date.now() };
            busyRef.current = true;
            void submitCode(decoded.data).finally(() => {
              busyRef.current = false;
            });
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [submitCode]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError("Kamera tidak dapat diakses. Periksa izin kamera pada peramban Anda.");
    }
  };

  const submitManual = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const ok = await submitCode(code.trim());
    if (ok) setCode("");
    setBusy(false);
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <QrCode className="size-5" aria-hidden />
            {cameraTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{cameraDescription}</p>
          <div className="relative overflow-hidden rounded-xl border border-border bg-black/90">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn("aspect-square w-full object-cover", !scanning && "hidden")}
            />
            {!scanning ? (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <Camera className="size-8" aria-hidden />
                <span className="text-sm">Kamera belum aktif</span>
              </div>
            ) : (
              <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-white/70" />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          {cameraError ? (
            <p role="alert" className="text-sm text-destructive">{cameraError}</p>
          ) : null}
          {scanning ? (
            <Button variant="outline" onClick={stopCamera} className="w-full">
              <CameraOff className="size-4" aria-hidden />
              Hentikan kamera
            </Button>
          ) : (
            <Button onClick={() => void startCamera()} className="w-full">
              <Camera className="size-4" aria-hidden />
              Mulai pindai kamera
            </Button>
          )}
          {lastResult ? (
            <div
              className={cn(
                "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                lastResult.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800",
              )}
            >
              {lastResult.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              <span>{lastResult.message}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <ScanLine className="size-5" aria-hidden />
            {manualTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{manualDescription}</p>
          <div className="space-y-2">
            <Label htmlFor="qr-manual-code">{manualLabel}</Label>
            <Input
              id="qr-manual-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={manualPlaceholder}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitManual();
              }}
            />
          </div>
          <Button onClick={() => void submitManual()} disabled={busy || !code.trim()} className="w-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" aria-hidden />}
            {submitLabel}
          </Button>

          {manualFooter ? (
            <>
              <Separator />
              {manualFooter}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
