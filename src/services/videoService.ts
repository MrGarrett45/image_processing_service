import axios from "axios";
import crypto from "crypto";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { PassThrough } from "stream";
import sharp from "sharp";
import { BadRequestError } from "../errors/BadRequestError";
import { ProcessingError } from "../errors/ProcessingError";
import { RemoteFetchError } from "../errors/RemoteFetchError";
import { UnsupportedMediaError } from "../errors/UnsupportedMediaError";
import { ImageFormat, VideoThumbnailQuery } from "../types/media";
import { buildCacheKey, buildThumbnailKey } from "../utils/cacheKey";
import { buildPublicUrl, getObjectIfExists, uploadObject } from "./storageService";

// Video downloads are capped to avoid excessive memory usage.
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 12000;

export interface ProcessedVideoResult {
  key: string;
  url: string;
  cached: boolean;
  width?: number;
  height?: number;
  format?: ImageFormat;
}

async function writeTempVideoFile(buffer: Buffer): Promise<string> {
  const filename = `video-${crypto.randomUUID()}.bin`;
  const filePath = path.join(os.tmpdir(), filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function deleteTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Best-effort cleanup.
  }
}

export async function getVideoDurationSeconds(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        reject(error);
        return;
      }
      const duration = metadata.format?.duration;
      if (typeof duration !== "number" || Number.isNaN(duration)) {
        reject(new Error("Unable to determine video duration"));
        return;
      }
      resolve(duration);
    });
  });
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
  } catch (error: unknown) {
    if (error instanceof UnsupportedMediaError) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED") {
        throw new RemoteFetchError("Remote video request timed out", 504);
      }
      if (error.response?.status) {
        throw new RemoteFetchError("Failed to download video", 502);
      }
    }
    throw new RemoteFetchError("Failed to download video", 502);
  }
}

export async function extractFrameBuffer(
  filePath: string,
  timeSeconds: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const outputStream = new PassThrough();
    const chunks: Buffer[] = [];

    outputStream.on("data", (chunk) => {
      chunks.push(chunk as Buffer);
    });
    outputStream.on("end", () => {
      if (chunks.length === 0) {
        reject(new Error("No frame data produced"));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    outputStream.on("error", (error) => {
      reject(error);
    });

    const stderrLines: string[] = [];

    // Use a temp file so ffmpeg can seek reliably.
    ffmpeg(filePath)
      .seekInput(timeSeconds)
      .outputOptions("-frames:v 1")
      .outputOptions("-vcodec mjpeg")
      .format("image2")
      .on("stderr", (line) => {
        stderrLines.push(line);
      })
      .on("error", (error) => {
        const details = stderrLines.slice(-5).join("\n");
        const message = details
          ? `${error.message}. ffmpeg stderr:\n${details}`
          : error.message;
        reject(new Error(message));
      })
      .pipe(outputStream, { end: true });
  });
}

export async function processVideoThumbnail(
  params: VideoThumbnailQuery
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

  const candidateExtensions: Array<ImageFormat> = params.format
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
  const tempPath = await writeTempVideoFile(videoBuffer);
  let frameBuffer: Buffer;
  try {
    const duration = await getVideoDurationSeconds(tempPath);
    if (params.time > duration) {
      throw new BadRequestError("Requested time is outside video duration");
    }
    frameBuffer = await extractFrameBuffer(tempPath, params.time);
  } catch (error: unknown) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "";
    if (
      message.toLowerCase().includes("ffmpeg") &&
      message.toLowerCase().includes("not found")
    ) {
      throw new ProcessingError("ffmpeg is not available on the host");
    }
    throw new ProcessingError(`Failed to extract video frame: ${message || "unknown error"}`);
  } finally {
    await deleteTempFile(tempPath);
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
