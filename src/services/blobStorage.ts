/**
 * Blob 对象存储 & 腾讯云 COS / EdgeOne Pages Blob / Supabase Storage 统一文件存储适配器
 * 负责将菜品图片、Logo、背景图片等文件上传并生成高效 CDN 访问 URL
 */

import { supabase } from "../supabase";

export interface BlobStorageConfig {
  endpoint?: string;
  bucketName?: string;
  publicUrlPrefix?: string;
  uploadToken?: string;
}

class BlobStorageManager {
  // 获取存储配置
  getConfig(): BlobStorageConfig {
    if (typeof window === "undefined") return {};
    return {
      endpoint:
        localStorage.getItem("custom_blob_endpoint") ||
        import.meta.env.VITE_BLOB_STORAGE_ENDPOINT ||
        "",
      bucketName:
        localStorage.getItem("custom_blob_bucket") ||
        import.meta.env.VITE_BLOB_STORAGE_BUCKET ||
        "menu-assets",
      publicUrlPrefix:
        localStorage.getItem("custom_blob_cdn_prefix") ||
        import.meta.env.VITE_BLOB_CDN_PREFIX ||
        "",
      uploadToken:
        localStorage.getItem("custom_blob_token") ||
        import.meta.env.VITE_BLOB_STORAGE_TOKEN ||
        "",
    };
  }

  // 保存存储配置
  saveConfig(config: BlobStorageConfig) {
    if (typeof window === "undefined") return;
    if (config.endpoint !== undefined)
      localStorage.setItem("custom_blob_endpoint", config.endpoint);
    if (config.bucketName !== undefined)
      localStorage.setItem("custom_blob_bucket", config.bucketName);
    if (config.publicUrlPrefix !== undefined)
      localStorage.setItem("custom_blob_cdn_prefix", config.publicUrlPrefix);
    if (config.uploadToken !== undefined)
      localStorage.setItem("custom_blob_token", config.uploadToken);
  }

  /**
   * EdgeOne Pages Blob / KV Store 直接访问封装
   */
  async setEdgeOneBlob(
    key: string,
    value: string | Blob | ArrayBuffer,
    storeName = "my-store",
  ): Promise<boolean> {
    try {
      const response = await fetch("/api/edgeone-blob/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, storeName }),
      });
      return response.ok;
    } catch (e) {
      console.warn("[EdgeOne Blob] set failed:", e);
      return false;
    }
  }

  async getEdgeOneBlob(
    key: string,
    consistency: "strong" | "eventual" = "eventual",
    storeName = "my-store",
  ): Promise<string | null> {
    try {
      const res = await fetch(
        `/api/edgeone-blob/get?key=${encodeURIComponent(key)}&storeName=${encodeURIComponent(storeName)}&consistency=${consistency}`,
      );
      if (res.ok) {
        const data = await res.json();
        return data.value;
      }
    } catch (e) {
      console.warn("[EdgeOne Blob] get failed:", e);
    }
    return null;
  }

  /**
   * 上传 Base64 或 File 图片
   * 首选 Supabase Storage Bucket（图片主要存储于此），其次独立 COS/EdgeOne Endpoint，最后降级返回安全 Base64
   */
  private inferExt(fileOrBase64: string | File): string {
    let mime = "";
    if (typeof fileOrBase64 === "string") {
      const m = fileOrBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);/);
      if (m?.[1]) mime = m[1];
    } else {
      mime = fileOrBase64.type || "";
    }
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
    };
    return extMap[mime] || "jpg";
  }

  async uploadImage(
    fileOrBase64: string | File,
    fileNameHint?: string,
  ): Promise<string> {
    const config = this.getConfig();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = this.inferExt(fileOrBase64);
    const fileName = `${fileNameHint || "img"}_${timestamp}_${randomStr}.${ext}`;

    // 1. 首选 Supabase Storage（图片主要存储于此）
    if (supabase) {
      try {
        const bucket = config.bucketName || "menu-assets";
        let blob: Blob;

        if (typeof fileOrBase64 === "string") {
          // Convert base64 to Blob
          const arr = fileOrBase64.split(",");
          const mimeMatch = arr[0]!.match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const bstr = atob(arr[1] || arr[0]!);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          blob = new Blob([u8arr], { type: mime });
        } else {
          blob = fileOrBase64;
        }

        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(fileName, blob, {
            cacheControl: "31536000, immutable",
            upsert: true,
          });

        if (!error && data) {
          const { data: publicData } = supabase.storage
            .from(bucket)
            .getPublicUrl(data.path);
          if (publicData?.publicUrl) {
            return publicData.publicUrl;
          }
        }
      } catch (err) {
        console.warn("[Supabase Storage] Storage upload error:", err);
      }
    }

    // 2. 独立 Blob / 腾讯云 COS / EdgeOne 上传 Endpoint（可选兜底）
    if (config.endpoint) {
      try {
        let body: any;
        const headers: Record<string, string> = {};

        if (config.uploadToken) {
          headers["Authorization"] = `Bearer ${config.uploadToken}`;
        }

        if (typeof fileOrBase64 === "string") {
          headers["Content-Type"] = "application/json";
          body = JSON.stringify({
            filename: fileName,
            base64Data: fileOrBase64,
            bucket: config.bucketName,
          });
        } else {
          const formData = new FormData();
          formData.append("file", fileOrBase64, fileName);
          formData.append("bucket", config.bucketName || "menu-assets");
          body = formData;
        }

        const res = await fetch(`${config.endpoint}/upload`, {
          method: "POST",
          headers,
          body,
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.url) {
            return data.url;
          }
        }
      } catch (e) {
        console.warn("[Blob Storage] Dedicated upload failed:", e);
      }
    }

    // 3. EdgeOne Blob 本地缓存（可选兜底，非公网 URL，不返回）
    if (typeof fileOrBase64 === "string") {
      try {
        await this.setEdgeOneBlob(
          fileName,
          fileOrBase64,
          config.bucketName || "my-store",
        );
      } catch {}
    }

    // 4. 兜底方案：如果是 Base64 字符串则直接返回，避免阻断上传
    if (typeof fileOrBase64 === "string") {
      return fileOrBase64;
    }

    // File 转换为 Base64 兜底
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(fileOrBase64 as File);
    });
  }
}

export const blobStorage = new BlobStorageManager();
