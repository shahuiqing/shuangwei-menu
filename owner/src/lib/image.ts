function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** 票据图压缩后再发 AI：长边最多 1600px，JPEG 0.82，失败则回退原图 */
export async function receiptImageDataUrl(
  blob: Blob,
  maxSide = 1600,
  quality = 0.82,
): Promise<string> {
  try {
    if (typeof document === "undefined") return blobToDataUrl(blob);
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && blob.size <= 1.2 * 1024 * 1024) {
      bitmap.close();
      return blobToDataUrl(blob);
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return blobToDataUrl(blob);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return blobToDataUrl(blob);
  }
}
