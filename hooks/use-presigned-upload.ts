import { useState, useCallback } from "react";
import { api, chatStorageApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
  rar: "application/vnd.rar",
};

function resolveMimeType(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const inferred = MIME_BY_EXTENSION[extension];
  if (!file.type || file.type === "application/octet-stream") {
    return inferred ?? file.type ?? "application/octet-stream";
  }
  return file.type;
}

export interface PresignedUploadResult {
  presignedUrl: string;
  publicUrl: string | null;
  key: string;
  bucket: string;
  method: string;
  headers?: Record<string, string>;
  provider?: string;
  mimeType?: string;
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
        const buffer = await file.slice(0, 16).arrayBuffer();
        magicBytes = Array.from(new Uint8Array(buffer))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
      } catch {
        // The server still checks the allowlist, size limit, and uploaded object.
      }

      const mime = resolveMimeType(file);
      const payload = {
        fileName: file.name,
        fileSize: file.size,
        mimeType: mime,
        magicBytes,
      };
      const result = mime.startsWith("image/")
        ? await api<{ valid: boolean }>("storage.validateFile", payload)
        : await chatStorageApi<{ valid: boolean }>("chatStorage.validate", payload);
      return { valid: result.valid, mime, size: file.size };
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
      return api<PresignedUploadResult>("storage.presignedUpload", {
        fileName,
        mimeType,
        fileSize,
        bucketType: filePurpose,
      });
    },
    [],
  );

  const uploadFile = useCallback(
    async (
      file: File,
      filePurpose: "public" | "private" = "public",
      onProgress?: (progress: number) => void,
    ): Promise<PresignedUploadResult> => {
      setUploading(true);
      setError(null);
      try {
        const validation = await validateFile(file);
        if (!validation.valid) {
          throw new Error(`Berkas tidak valid: tipe ${validation.mime} tidak diizinkan.`);
        }

        if (filePurpose === "private") {
          const buffer = await file.slice(0, 16).arrayBuffer();
          const magicBytes = Array.from(new Uint8Array(buffer))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
          const signed = await chatStorageApi<{
            bucket: string;
            key: string;
            uploadToken: string;
            mimeType: string;
          }>("chatStorage.upload", {
            fileName: file.name,
            fileSize: file.size,
            mimeType: validation.mime,
            magicBytes,
          });
          onProgress?.(35);
          const { error: uploadError } = await supabase.storage
            .from(signed.bucket)
            .uploadToSignedUrl(signed.key, signed.uploadToken, file, {
              contentType: signed.mimeType,
              upsert: false,
            });
          if (uploadError) throw new Error("Unggah dokumen gagal. Periksa koneksi lalu coba lagi.");
          onProgress?.(80);
          await chatStorageApi("chatStorage.verifyUpload", {
            key: signed.key,
            fileSize: file.size,
          });
          onProgress?.(100);
          return {
            presignedUrl: "",
            publicUrl: null,
            key: signed.key,
            bucket: signed.bucket,
            method: "PUT",
            provider: "supabase",
            mimeType: signed.mimeType,
          };
        }

        let publicUrl: string | null = null;
        let uploadFailure: Error | null = null;
        let finalResult: PresignedUploadResult = {
          presignedUrl: "",
          publicUrl: null,
          key: file.name,
          bucket: "cloud",
          method: "POST",
        };

        try {
          const presigned = await getPresignedUrl(file.name, validation.mime, file.size, filePurpose);
          finalResult = presigned;
          onProgress?.(30);

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 30_000);
          try {
            const isMultipart = Boolean(presigned.fields && Object.keys(presigned.fields).length > 0);
            let response: Response;
            if (isMultipart) {
              const formData = new FormData();
              for (const [key, value] of Object.entries(presigned.fields ?? {})) {
                if (value) formData.append(key, value);
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
                  "Content-Type": validation.mime,
                },
                body: file,
                signal: controller.signal,
              });
            }

            if (!response.ok) throw new Error(`Unggah berkas gagal (${response.status}).`);
            const responseData = await response.json().catch(() => null) as Record<string, unknown> | null;
            const responseUrl = typeof responseData?.secure_url === "string"
              ? responseData.secure_url
              : typeof responseData?.url === "string"
                ? responseData.url
                : null;
            publicUrl = responseUrl || presigned.publicUrl || null;
            finalResult.publicUrl = publicUrl;
          } catch (uploadError) {
            uploadFailure = uploadError instanceof Error ? uploadError : new Error("Unggah berkas gagal.");
          } finally {
            clearTimeout(timer);
          }
        } catch (presignError) {
          uploadFailure = presignError instanceof Error ? presignError : new Error("Layanan penyimpanan belum tersedia.");
        }

        if (!publicUrl) {
          if (!validation.mime.startsWith("image/")) {
            throw uploadFailure ?? new Error("Dokumen belum terunggah. Periksa koneksi dan coba lagi.");
          }
          // Keep the legacy small-image fallback; never put documents in message JSON as data URLs.
          onProgress?.(60);
          publicUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Gagal membaca berkas gambar."));
            reader.readAsDataURL(file);
          });
          finalResult.publicUrl = publicUrl;
        }

        onProgress?.(100);
        return finalResult;
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "Unggah berkas gagal.";
        setError(message);
        throw uploadError instanceof Error ? uploadError : new Error(message);
      } finally {
        setUploading(false);
      }
    },
    [validateFile, getPresignedUrl],
  );

  const getDownloadUrl = useCallback(
    async (key: string, filePurpose: "public" | "private" = "public"): Promise<PresignedDownloadResult> => {
      return api<PresignedDownloadResult>("storage.presignedDownload", {
        key,
        bucketType: filePurpose,
      });
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
