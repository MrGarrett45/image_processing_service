import crypto from "crypto";

export function buildCacheKey(params: {
  url: string;
  width?: number;
  height?: number;
  format?: string;
  quality?: number;
  crop?: string;
  time?: number;
}): string {
  // Hash the inputs to build cache keys.
  const canonical = [
    `url=${params.url}`,
    `w=${params.width ?? ""}`,
    `h=${params.height ?? ""}`,
    `f=${params.format ?? ""}`,
    `q=${params.quality ?? ""}`,
    `c=${params.crop ?? ""}`,
    `t=${params.time ?? ""}`,
  ].join("|");

  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function buildImageKey(hash: string, extension: string): string {
  return `images/${hash}.${extension}`;
}

export function buildThumbnailKey(hash: string, extension: string): string {
  return `thumbnails/${hash}.${extension}`;
}
