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
  maxSizeBytes?: number;
  failOnError?: boolean;
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
    if (options.failOnError) throw new Error("Format foto ini tidak dapat dioptimalkan.");
    return file;
  }

  const maxWidth = options.maxWidth ?? 1200;
  const maxHeight = options.maxHeight ?? 1200;
  const quality = options.quality ?? 0.75;
  const targetMime = options.mimeType ?? "image/jpeg";

  const maxSizeBytes = options.maxSizeBytes;
  const failOnError = options.failOnError ?? false;

  return new Promise((resolve, reject) => {
    const fail = (message: string) => {
      if (failOnError) reject(new Error(message));
      else resolve(file);
    };
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
        let currentQuality = quality;
        let qualityAttempts = 0;

        const encode = () => {
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            fail("Browser tidak dapat mengoptimalkan foto. Coba browser lain atau foto yang berbeda.");
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          // Background putih untuk format JPEG jika ada alpha channel.
          if (targetMime === "image/jpeg") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (!blob) {
              fail("Browser gagal mengoptimalkan foto. Coba pilih foto lain.");
              return;
            }

            if (maxSizeBytes && blob.size > maxSizeBytes) {
              if (currentQuality > 0.4 && qualityAttempts < 4) {
                currentQuality = Math.max(0.4, currentQuality - 0.12);
                qualityAttempts += 1;
                encode();
                return;
              }

              const nextWidth = Math.round(width * 0.85);
              const nextHeight = Math.round(height * 0.85);
              if (Math.max(nextWidth, nextHeight) >= 480 && (nextWidth < width || nextHeight < height)) {
                width = nextWidth;
                height = nextHeight;
                currentQuality = quality;
                qualityAttempts = 0;
                encode();
                return;
              }

              fail("Foto masih terlalu besar setelah dioptimalkan. Pilih foto yang lebih kecil.");
              return;
            }

            // Simpan sumber jika memang sudah lebih kecil dari hasil encode.
            if (blob.size >= file.size && (!maxSizeBytes || file.size <= maxSizeBytes)) {
              resolve(file);
              return;
            }

            const baseName = file.name.replace(/\.[^.]+$/, "");
            const ext = targetMime === "image/webp" ? ".webp" : ".jpg";
            resolve(new File([blob], `${baseName}${ext}`, {
              type: targetMime,
              lastModified: Date.now(),
            }));
          }, targetMime, currentQuality);
        };

        encode();
      };

      img.onerror = () => fail("Foto tidak dapat dibaca untuk proses kompresi. Coba simpan ulang atau pilih foto lain.");
      img.src = String(event.target?.result);
    };

    reader.onerror = () => fail("Foto gagal dibaca untuk proses kompresi.");
    reader.readAsDataURL(file);
  });
}
