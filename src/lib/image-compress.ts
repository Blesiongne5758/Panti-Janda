/**
 * Kompresi gambar sisi klien menggunakan HTML5 Canvas
 * Mengurangi ukuran file foto secara signifikan (umumnya dari ~3-8 MB menjadi ~40-100 KB)
 * untuk pengiriman cepat pada chat dan posting feed.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: "image/jpeg" | "image/webp";
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  // Hanya kompres file berformat gambar standar (abaikan GIF/SVG agar animasi/vektor tidak rusak)
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  const maxWidth = options.maxWidth ?? 1200;
  const maxHeight = options.maxHeight ?? 1200;
  const quality = options.quality ?? 0.75;
  const targetMime = options.mimeType ?? "image/jpeg";

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        // Hitung rasio resolusi agar tidak melebihi maxWidth / maxHeight
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file); // fallback
          return;
        }

        // Background putih untuk format JPEG jika ada alpha channel
        if (targetMime === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // Ganti ekstensi file menjadi .jpg atau .webp
            const baseName = file.name.replace(/\.[^.]+$/, "");
            const ext = targetMime === "image/webp" ? ".webp" : ".jpg";
            const newName = `${baseName}${ext}`;

            const compressedFile = new File([blob], newName, {
              type: targetMime,
              lastModified: Date.now(),
            });

            // Jika hasil kompresi ternyata lebih besar dari aslinya, gunakan aslinya
            if (compressedFile.size >= file.size && file.type === targetMime) {
              resolve(file);
            } else {
              resolve(compressedFile);
            }
          },
          targetMime,
          quality,
        );
      };

      img.onerror = () => resolve(file);
      img.src = String(event.target?.result);
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
