import { useState, useCallback } from "react";
import { api } from "@/lib/api";

export interface PresignedUploadResult {
  presignedUrl: string;
  publicUrl: string | null;
  key: string;
  bucket: string;
  method: string;
  headers?: Record<string, string>;
  provider?: string;
  fields?: Record<string, string>;
}

export interface PresignedDownloadResult {
  presignedUrl: string;
  expiresInSeconds: number;
}

export function usePresignedUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const validateFile = useCallback(
    async (file: File): Promise<{ valid: boolean; mime: string; size: number }> => {
      let magicBytes = "";
      try {
        const slice = file.slice(0, 16);
        const buffer = await slice.arrayBuffer();
        magicBytes = Array.from(new Uint8Array(buffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      } catch {
        // fallback if slice.arrayBuffer is not supported
      }

      const res = await api<{ valid: boolean }>("storage.validateFile", {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        magicBytes,
      });
      return { valid: res.valid, mime: file.type, size: file.size };
    },
    [],
  );

  const getPresignedUrl = useCallback(
    async (
      fileName: string,
      mimeType: string,
      fileSize: number,
      filePurpose: "public" | "private" = "public",
    ): Promise<PresignedUploadResult> => {
      const res = await api<PresignedUploadResult>("storage.presignedUpload", {
        fileName,
        mimeType,
        fileSize,
        bucketType: filePurpose,
      });
      return res;
    },
    [],
  );

  const uploadFile = useCallback(
    async (
      file: File,
      filePurpose: "public" | "private" = "public",
      onProgress?: (progress: number) => void,
    ): Promise<PresignedUploadResult | null> => {
      setUploading(true);
      setError(null);
      try {
        const validation = await validateFile(file);
        if (!validation.valid) {
          throw new Error(`File tidak valid: tipe ${validation.mime} tidak diizinkan`);
        }

        let publicUrl: string | null = null;
        let finalResult: PresignedUploadResult = {
          presignedUrl: "",
          publicUrl: null,
          key: file.name,
          bucket: "cloud",
          method: "POST",
        };

        try {
          const presigned = await getPresignedUrl(file.name, file.type, file.size, filePurpose);
          finalResult = presigned;
          onProgress?.(30);

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 30_000);
          try {
            const isMultipart = Boolean(presigned.fields && Object.keys(presigned.fields).length > 0);
            let response: Response;
            if (isMultipart) {
              const formData = new FormData();
              for (const [key, val] of Object.entries(presigned.fields ?? {})) {
                if (val) formData.append(key, val);
              }
              formData.append("file", file, file.name);
              response = await fetch(presigned.presignedUrl, {
                method: presigned.method || "POST",
                body: formData,
                signal: controller.signal,
              });
            } else {
              response = await fetch(presigned.presignedUrl, {
                method: presigned.method || "PUT",
                headers: {
                  ...(presigned.headers ?? {}),
                  "Content-Type": file.type || "application/octet-stream",
                },
                body: file,
                signal: controller.signal,
              });
            }

            if (!response.ok) {
              throw new Error(`Upload media gagal (${response.status})`);
            }

            const responseData = await response.json().catch(() => null) as Record<string, unknown> | null;
            const responseUrl = typeof responseData?.secure_url === "string"
              ? responseData.secure_url
              : typeof responseData?.url === "string"
                ? responseData.url
                : null;
            publicUrl = responseUrl || presigned.publicUrl || null;
            finalResult.publicUrl = publicUrl;
          } catch {
            // Upload langsung gagal; gunakan data URL hanya sebagai fallback terakhir.
          } finally {
            clearTimeout(timer);
          }
        } catch {
          // presigned URL request failed; will fall back to data URL
        }

        // If direct cloud upload did not provide a URL, convert to Data URL fallback
        if (!publicUrl) {
          onProgress?.(60);
          publicUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Gagal membaca berkas"));
            reader.readAsDataURL(file);
          });
          finalResult.publicUrl = publicUrl;
        }

        onProgress?.(100);
        return finalResult;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload gagal";
        setError(msg);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [validateFile, getPresignedUrl],
  );

  const getDownloadUrl = useCallback(
    async (key: string, filePurpose: "public" | "private" = "public"): Promise<PresignedDownloadResult> => {
      const res = await api<PresignedDownloadResult>("storage.presignedDownload", {
        key,
        bucketType: filePurpose,
      });
      return res;
    },
    [],
  );

  return {
    uploading,
    error,
    uploadFile,
    getPresignedUrl,
    getDownloadUrl,
    validateFile,
    clearError,
  };
}
