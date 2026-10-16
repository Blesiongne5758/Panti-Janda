import type { VerificationDocType } from "./types";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 1600;
const TARGET_CHARS = 900_000;

export interface PreparedDoc {
  fileName: string;
  dataUrl: string;
}

export const docErrorText = (error: unknown) =>
  error instanceof Error ? error.message : "Gagal memproses dokumen. Coba berkas lain.";

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca berkas. Coba lagi."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Berkas bukan gambar yang dapat dibaca. Gunakan JPG, PNG, atau WebP."));
    img.src = src;
  });
}

// Images are stored as compressed JPEG data URLs; the platform Function only
// reaches the database, so this keeps the payload small before upload.
async function compressImage(file: File, maxEdge: number, targetChars: number, label: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${label} harus berupa gambar (JPG, PNG, atau WebP).`);
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Ukuran berkas maksimal 8 MB.");
  }
  const source = await readAsDataUrl(file);
  const img = await loadImage(source);
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak dapat memproses gambar. Coba berkas lain.");
  ctx.drawImage(img, 0, 0, width, height);
  let quality = 0.82;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length > targetChars && quality > 0.4) {
    quality -= 0.12;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  return out;
}

export async function prepareVerificationDoc(file: File): Promise<PreparedDoc> {
  const dataUrl = await compressImage(file, MAX_EDGE, TARGET_CHARS, "Dokumen");
  return { fileName: file.name, dataUrl };
}

export const docKb = (dataUrl: string) => Math.round((dataUrl.length * 0.75) / 1024);

// Profile photos use the same pipeline with a tighter budget: square-cropped by
// CSS on display, so 512px is plenty and keeps the stored data URL small.
const PHOTO_EDGE = 512;
const PHOTO_TARGET_CHARS = 220_000;

export async function prepareProfilePhoto(file: File): Promise<string> {
  return compressImage(file, PHOTO_EDGE, PHOTO_TARGET_CHARS, "Foto");
}

// Tournament banners keep the widest edge and the same payload budget the
// esport_tournaments.banner_data column accepts.
const BANNER_EDGE = 1920;

export async function prepareBannerImage(file: File): Promise<string> {
  return compressImage(file, BANNER_EDGE, TARGET_CHARS, "Gambar banner");
}

export const DOC_TYPE_OPTIONS: ReadonlyArray<{ value: VerificationDocType; label: string }> = [
  { value: "ktp", label: "Foto KTP terbaru" },
  { value: "pengadilan", label: "Dokumen resmi pengadilan" },
];
