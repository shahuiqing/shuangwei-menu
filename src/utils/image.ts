export const compressImage = (
  file: File,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.8,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Try webp first for maximum compression, fallback to jpeg
        let compressedBase64 = canvas.toDataURL("image/webp", quality);
        if (!compressedBase64.startsWith("data:image/webp")) {
          compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(compressedBase64);
      };
      img.onerror = () =>
        reject(new Error("Image failed to load in compressImage"));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("File reading failed"));
  });
};

export const compressBase64Image = (
  base64Str: string,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.8,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Try webp first for maximum compression, fallback to jpeg
      let compressedBase64 = canvas.toDataURL("image/webp", quality);
      if (!compressedBase64.startsWith("data:image/webp")) {
        compressedBase64 = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(compressedBase64);
    };
    img.onerror = () =>
      reject(new Error("Image failed to load in compressBase64Image"));
    if (!base64Str.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.src = base64Str;
  });
};

export const drawBeautifulTableCard = (
  canvas: HTMLCanvasElement,
  qrCanvas: HTMLCanvasElement,
  tableNo: string,
  storeName: string,
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Background Gradient
  const bgGradient = ctx.createLinearGradient(0, 0, w, h);
  bgGradient.addColorStop(0, "#fff7ed");
  bgGradient.addColorStop(1, "#ffedd5");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, w, h);

  // Outer Decorative Border
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 12;
  ctx.strokeRect(30, 30, w - 60, h - 60);

  // Inner Border (Thin)
  ctx.strokeStyle = "#fdba74";
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, w - 96, h - 96);

  // Corner Accents
  const cornerSize = 60;
  ctx.fillStyle = "#ea580c";

  // Top Left Corner
  ctx.beginPath();
  ctx.moveTo(30, 30 + cornerSize);
  ctx.lineTo(30, 30);
  ctx.lineTo(30 + cornerSize, 30);
  ctx.lineTo(30, 30 + cornerSize);
  ctx.fill();

  // Top Right Corner
  ctx.beginPath();
  ctx.moveTo(w - 30 - cornerSize, 30);
  ctx.lineTo(w - 30, 30);
  ctx.lineTo(w - 30, 30 + cornerSize);
  ctx.lineTo(w - 30 - cornerSize, 30);
  ctx.fill();

  // Bottom Left Corner
  ctx.beginPath();
  ctx.moveTo(30, h - 30 - cornerSize);
  ctx.lineTo(30, h - 30);
  ctx.lineTo(30 + cornerSize, h - 30);
  ctx.lineTo(30, h - 30 - cornerSize);
  ctx.fill();

  // Bottom Right Corner
  ctx.beginPath();
  ctx.moveTo(w - 30, h - 30 - cornerSize);
  ctx.lineTo(w - 30, h - 30);
  ctx.lineTo(w - 30 - cornerSize, h - 30);
  ctx.lineTo(w - 30, h - 30 - cornerSize);
  ctx.fill();

  // Store Name
  ctx.fillStyle = "#18181b";
  ctx.font = "900 68px 'Arial', sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.1)";
  ctx.shadowBlur = 10;
  ctx.fillText(storeName || "餐厅扫码点餐", w / 2, 200);

  // Divider Line
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#fed7aa";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.2, 260);
  ctx.lineTo(w * 0.8, 260);
  ctx.stroke();

  // Table Label
  ctx.fillStyle = "#713f12";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText("TABLE / 桌号", w / 2, 340);

  // Table Number Area
  ctx.fillStyle = "#ea580c";
  ctx.font = "900 160px sans-serif";
  ctx.shadowColor = "rgba(234, 88, 12, 0.3)";
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 5;
  ctx.fillText(tableNo || "_______", w / 2, 490);

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Draw QR Code Background/Frame
  const qrSize = 480;
  const qrX = w / 2 - qrSize / 2;
  const qrY = 620;

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.15)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 10;
  ctx.beginPath();
  const r = 30;
  const qrx2 = qrX - 20;
  const qry2 = qrY - 20;
  const qrw = qrSize + 40;
  const qrh = qrSize + 40;

  ctx.moveTo(qrx2 + r, qry2);
  ctx.lineTo(qrx2 + qrw - r, qry2);
  ctx.quadraticCurveTo(qrx2 + qrw, qry2, qrx2 + qrw, qry2 + r);
  ctx.lineTo(qrx2 + qrw, qry2 + qrh - r);
  ctx.quadraticCurveTo(qrx2 + qrw, qry2 + qrh, qrx2 + qrw - r, qry2 + qrh);
  ctx.lineTo(qrx2 + r, qry2 + qrh);
  ctx.quadraticCurveTo(qrx2, qry2 + qrh, qrx2, qry2 + qrh - r);
  ctx.lineTo(qrx2, qry2 + r);
  ctx.quadraticCurveTo(qrx2, qry2, qrx2 + r, qry2);
  ctx.closePath();
  ctx.fill();

  // Reset shadow for QR
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  // Call to Action Text
  ctx.fillStyle = "#18181b";
  ctx.font = "900 52px sans-serif";
  ctx.fillText("扫码点餐", w / 2, 1220);

  ctx.fillStyle = "#52525b";
  ctx.font = "500 32px sans-serif";
  ctx.fillText("Scan the QR Code to Order", w / 2, 1270);

  // Decorative Bottom Divider
  ctx.strokeStyle = "#fed7aa";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, 1340);
  ctx.lineTo(w * 0.7, 1340);
  ctx.stroke();

  // Footer
  ctx.fillStyle = "#713f12";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("谢谢惠顾 · Thank you for visiting", w / 2, 1400);
};

/**
 * 图片 URL 处理：直接返回原地址。
 * 之前对 /object/public/ 追加 `?width=...&quality=80` 是错误的缩略图端点（正确应是 /render/image/），
 * 且可能被 Supabase CDN/ImgProxy 拦截导致图片加载失败，故移除。
 * @param url 原始图片 URL
 * @returns 原样返回
 */
export function getOptimizedImageUrl(url: string, _width = 500): string {
  return url;
}
