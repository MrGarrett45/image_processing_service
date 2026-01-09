import { StorageError } from "../errors/StorageError";

interface AppConfig {
  bucketName: string;
  region: string;
  baseUrl?: string;
}

function getRequiredEnv(name: "IMAGE_BUCKET_NAME" | "AWS_REGION"): string {
  const value = process.env[name];
  if (!value) {
    throw new StorageError(`${name} is not set`);
  }
  return value;
}

export const appConfig: AppConfig = {
  bucketName: getRequiredEnv("IMAGE_BUCKET_NAME"),
  region: getRequiredEnv("AWS_REGION"),
  baseUrl: process.env.IMAGE_BUCKET_BASE_URL
};
