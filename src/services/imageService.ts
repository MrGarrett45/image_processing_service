import axios from "axios";
import sharp, { FitEnum, Metadata } from "sharp";
import { RemoteFetchError } from "../errors/RemoteFetchError";
import { UnsupportedMediaError } from "../errors/UnsupportedMediaError";
import { CropMode, ImageFormat, ProcessImageQuery } from "../types/media";
import { buildCacheKey, buildImageKey } from "../utils/cacheKey";
import {
  buildPublicUrl,
  getObjectIfExists,
  uploadObject,
} from "./storageService";

// Limit remote downloads to reduce memory pressure and abuse.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 8000;

const cropToFit: Record<CropMode, keyof FitEnum> = {
  fill: "cover",
  fit: "contain",
  inside: "inside",
  outside: "outside",
};

export interface ProcessedImageResult {
  key: string;
  url: string;
  cached: boolean;
  width?: number;
  height?: number;
  format?: ImageFormat;
}

async function downloadImage(url: string): Promise<Buffer> {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxContentLength: MAX_IMAGE_BYTES,
      maxBodyLength: MAX_IMAGE_BYTES,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const contentType = response.headers["content-type"];
    if (!contentType || !contentType.startsWith("image/")) {
      throw new UnsupportedMediaError("Remote content is not an image");
    }

    const buffer = Buffer.from(response.data);
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new RemoteFetchError("Image exceeds maximum size limit", 413);
    }
    return buffer;
  } catch (error: unknown) {
    if (error instanceof UnsupportedMediaError) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED") {
        throw new RemoteFetchError("Remote image request timed out", 504);
      }
      if (error.response?.status) {
        throw new RemoteFetchError("Failed to download image", 502);
      }
    }
    throw new RemoteFetchError("Failed to download image", 502);
  }
}

function resolveOutputFormat(
  requested: ImageFormat | undefined,
  metadata: Metadata
): ImageFormat {
  if (requested) return requested;
  const input = metadata.format;
  if (input === "jpeg" || input === "png" || input === "webp") {
    return input;
  }
  return "jpeg";
}

export async function processImage(
  params: ProcessImageQuery
): Promise<ProcessedImageResult> {
  const hash = buildCacheKey({
    url: params.url,
    width: params.width,
    height: params.height,
    format: params.format,
    quality: params.quality,
    crop: params.crop,
  });

  const candidateExtensions: Array<ImageFormat> = params.format
    ? [params.format]
    : ["jpeg", "png", "webp"];

  for (const extension of candidateExtensions) {
    const key = buildImageKey(hash, extension);
    const cached = await getObjectIfExists(key);
    if (cached) {
      return { key, url: buildPublicUrl(key), cached: true };
    }
  }

  const inputBuffer = await downloadImage(params.url);
  let pipeline = sharp(inputBuffer);
  if (params.width || params.height) {
    pipeline = pipeline.resize({
      width: params.width,
      height: params.height,
      fit: cropToFit[params.crop ?? "fill"],
      withoutEnlargement: true,
    });
  }

  const metadata = await pipeline.metadata();
  const outputFormat = resolveOutputFormat(params.format, metadata);

  if (params.quality || params.format || outputFormat !== metadata.format) {
    pipeline = pipeline.toFormat(outputFormat, {
      quality: params.quality,
    });
  }

  const output = await pipeline.toBuffer({ resolveWithObject: true });
  const outputMetadata = output.info;
  const extension = outputFormat;
  const finalKey = buildImageKey(hash, extension);

  const contentType = `image/${
    outputFormat === "jpeg" ? "jpeg" : outputFormat
  }`;
  const stored = await uploadObject(finalKey, output.data, contentType);

  return {
    key: stored.key,
    url: stored.url,
    cached: false,
    width: outputMetadata.width,
    height: outputMetadata.height,
    format: outputFormat,
  };
}
