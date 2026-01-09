import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import { PassThrough } from "stream";
import sharp from "sharp";
import { BadRequestError } from "../errors/BadRequestError";
import { RemoteFetchError } from "../errors/RemoteFetchError";
import { UnsupportedMediaError } from "../errors/UnsupportedMediaError";
import { buildCacheKey, buildThumbnailKey } from "../utils/cacheKey";
import { buildPublicUrl, getObjectIfExists, uploadObject } from "./storageService";

// Video downloads are capped to avoid excessive memory usage.
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 12000;

export interface ProcessVideoParams {
  url: string;
  time: number;
  width?: number;
  height?: number;
  format?: "jpeg" | "png" | "webp";
  quality?: number;
}

export interface ProcessedVideoResult {
  key: string;
  url: string;
  cached: boolean;
  width?: number;
  height?: number;
  format?: "jpeg" | "png" | "webp";
}

async function downloadVideo(url: string): Promise<Buffer> {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxContentLength: MAX_VIDEO_BYTES,
      maxBodyLength: MAX_VIDEO_BYTES,
      validateStatus: (status) => status >= 200 && status < 300
    });

    const contentType = response.headers["content-type"];
    if (!contentType || !contentType.startsWith("video/")) {
      throw new UnsupportedMediaError("Remote content is not a video");
    }

    const buffer = Buffer.from(response.data);
    if (buffer.length > MAX_VIDEO_BYTES) {
      throw new RemoteFetchError("Video exceeds maximum size limit", 413);
    }
    return buffer;
  } catch (error: any) {
    if (error instanceof UnsupportedMediaError) {
      throw error;
    }
    if (error?.response?.status) {
      throw new RemoteFetchError("Failed to download video", 502);
    }
    if (error?.code === "ECONNABORTED") {
      throw new RemoteFetchError("Remote video request timed out", 504);
    }
    throw new RemoteFetchError("Failed to download video", 502);
  }
}

export async function extractFrameBuffer(
  videoBuffer: Buffer,
  timeSeconds: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = new PassThrough();
    inputStream.end(videoBuffer);

    const outputStream = new PassThrough();
    const chunks: Buffer[] = [];

    outputStream.on("data", (chunk) => {
      chunks.push(chunk as Buffer);
    });
    outputStream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    outputStream.on("error", (error) => {
      reject(error);
    });

    ffmpeg(inputStream)
      .seekInput(timeSeconds)
      .outputOptions("-frames:v 1")
      .outputOptions("-vcodec mjpeg")
      .format("image2")
      .on("error", (error) => {
        reject(error);
      })
      .pipe(outputStream, { end: true });
  });
}

export async function processVideoThumbnail(
  params: ProcessVideoParams
): Promise<ProcessedVideoResult> {
  if (params.time < 0) {
    throw new BadRequestError("time must be >= 0");
  }

  const hash = buildCacheKey({
    url: params.url,
    width: params.width,
    height: params.height,
    format: params.format,
    quality: params.quality,
    time: params.time
  });

  const candidateExtensions: Array<"jpeg" | "png" | "webp"> = params.format
    ? [params.format]
    : ["jpeg", "png", "webp"];

  for (const extension of candidateExtensions) {
    const key = buildThumbnailKey(hash, extension);
    const cached = await getObjectIfExists(key);
    if (cached) {
      return { key, url: buildPublicUrl(key), cached: true };
    }
  }

  const videoBuffer = await downloadVideo(params.url);
  let frameBuffer: Buffer;
  try {
    frameBuffer = await extractFrameBuffer(videoBuffer, params.time);
  } catch {
    throw new BadRequestError("Requested time is outside video duration");
  }

  let pipeline = sharp(frameBuffer);
  if (params.width || params.height) {
    pipeline = pipeline.resize({
      width: params.width,
      height: params.height,
      fit: "cover",
      withoutEnlargement: true
    });
  }

  const outputFormat = params.format ?? "jpeg";
  if (params.quality || params.format) {
    pipeline = pipeline.toFormat(outputFormat, {
      quality: params.quality
    });
  }

  const output = await pipeline.toBuffer({ resolveWithObject: true });
  const finalKey = buildThumbnailKey(hash, outputFormat);
  const contentType = `image/${outputFormat === "jpeg" ? "jpeg" : outputFormat}`;
  const stored = await uploadObject(finalKey, output.data, contentType);

  return {
    key: stored.key,
    url: stored.url,
    cached: false,
    width: output.info.width,
    height: output.info.height,
    format: outputFormat
  };
}
