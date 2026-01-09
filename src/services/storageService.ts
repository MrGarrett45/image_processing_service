import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { appConfig } from "../config/env";
import { StorageError } from "../errors/StorageError";

export interface StoredObjectInfo {
  key: string;
  url: string;
}

const s3Client = new S3Client({ region: appConfig.region });

export function buildPublicUrl(key: string): string {
  if (appConfig.baseUrl) {
    return `${appConfig.baseUrl.replace(/\/$/, "")}/${key}`;
  }
  return `https://${appConfig.bucketName}.s3.${appConfig.region}.amazonaws.com/${key}`;
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
  if (metadata?.httpStatusCode === 404) {
    return true;
  }
  const name = (error as { name?: string }).name;
  return name === "NotFound";
}

export async function getObjectIfExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: appConfig.bucketName,
        Key: key
      })
    );
    return true;
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw new StorageError("Failed to check object in S3");
  }
}

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl = "public,max-age=31536000,immutable"
): Promise<StoredObjectInfo> {
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: appConfig.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl
      })
    );
  } catch {
    throw new StorageError("Failed to upload object to S3");
  }

  return { key, url: buildPublicUrl(key) };
}
