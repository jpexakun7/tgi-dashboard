/**
 * Utility functions for handling and optimizing employee profile photos
 */

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(file: File): ImageValidationResult {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Format file tidak didukung. Harap upload gambar format JPG, PNG, atau WebP.',
    };
  }

  // 10MB hard limit before compression
  if (file.size > 10 * 1024 * 1024) {
    return {
      valid: false,
      error: 'Ukuran file terlalu besar (maksimal 10MB). Harap pilih file yang lebih kecil.',
    };
  }

  return { valid: true };
}

/**
 * Compresses and scales an image down to a maximum width/height (default 800px)
 * in JPEG format (default quality 0.8) to keep storage and database usage minimal
 * while maintaining clear visual readability for profile photos and KTP scans.
 */
export function compressImage(
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio scaling capped at maxWidth and maxHeight (default 800px)
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context could not be created'));
          return;
        }

        // Fill white background for transparent PNGs before converting to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Smooth rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed JPEG data URL (quality 0.8)
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };

      img.onerror = () => {
        reject(new Error('Gagal memuat gambar untuk kompresi.'));
      };

      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca file gambar.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Captures and compresses a video frame into JPEG format with maximum width 800px and quality 0.8.
 */
export function compressVideoFrame(
  video: HTMLVideoElement,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8,
  mirror = false
): string {
  let width = video.videoWidth || 640;
  let height = video.videoHeight || 480;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }
  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}

