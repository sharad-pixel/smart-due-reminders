/**
 * Shared upload constants and image compression utility.
 * All file uploads in the app should reference these limits.
 */

/** Maximum allowed file size for any upload (5 MB). */
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

/** Target size for compressed images (800 KB). */
const TARGET_COMPRESSED_SIZE = 800 * 1024;

/** Maximum pixel dimension for compressed images. */
const MAX_DIMENSION = 2048;

/**
 * Compress an image file to reduce storage usage.
 * Returns the original file if it's an SVG, already small, or can't be processed.
 */
export async function compressImage(
  file: File,
  options?: { maxDimension?: number; targetSize?: number }
): Promise<File> {
  // SVGs are already compact, skip
  if (file.type === "image/svg+xml") return file;

  // Already under target, skip
  const targetSize = options?.targetSize ?? TARGET_COMPRESSED_SIZE;
  if (file.size <= targetSize) return file;

  const maxDim = options?.maxDimension ?? MAX_DIMENSION;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    // Scale down if needed
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // For PNGs with transparency, keep PNG format
    const isPng = file.type === "image/png";

    // Try progressive quality reduction for JPEG
    if (!isPng) {
      for (const quality of [0.85, 0.7, 0.5]) {
        const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
        if (blob.size <= targetSize || quality === 0.5) {
          const ext = file.name.replace(/\.[^.]+$/, "") + ".jpg";
          return new File([blob], ext, { type: "image/jpeg" });
        }
      }
    }

    // PNG path: just resize (no lossy compression available for PNG in canvas)
    const blob = await canvas.convertToBlob({
      type: isPng ? "image/png" : "image/jpeg",
      quality: isPng ? undefined : 0.8,
    });

    return new File([blob], file.name, { type: blob.type });
  } catch (e) {
    console.warn("Image compression failed, using original:", e);
    return file;
  }
}
