import { useState, useCallback } from "react";
import { api } from "@/lib/api";

export interface PresignedUploadResult {
  presignedUrl: string;
  publicUrl: string | null;
  key: string;
  bucket: string;
  method: string;
  headers: Record<string, string>;
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
      const reader = new FileReader();
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
      });
      reader.readAsArrayBuffer(file.slice(0, 16));

      const magicBytes = Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

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

        const presigned = await getPresignedUrl(file.name, file.type, file.size, filePurpose);
        onProgress?.(25);

        await fetch(presigned.presignedUrl, {
          method: presigned.method || "PUT",
          headers: presigned.headers ?? { "Content-Type": file.type },
          body: file,
        });
        onProgress?.(100);

        return presigned;
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
