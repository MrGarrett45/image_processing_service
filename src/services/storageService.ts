import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { StorageError } from "../errors/StorageError";

export interface StoredObjectInfo {
  key: string;
  url: string;
}

const bucketName = process.env.IMAGE_BUCKET_NAME;
const region = process.env.AWS_REGION;

if (!bucketName) {
  throw new StorageError("IMAGE_BUCKET_NAME is not set");
}
if (!region) {
  throw new StorageError("AWS_REGION is not set");
}

const s3Client = new S3Client({ region });

export function buildPublicUrl(key: string): string {
  const baseUrl = process.env.IMAGE_BUCKET_BASE_URL;
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, "")}/${key}`;
  }
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

export async function getObjectIfExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key
      })
    );
    return true;
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") {
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
        Bucket: bucketName,
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
