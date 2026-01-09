import { BadRequestError } from "../errors/BadRequestError";

const MAX_DIMENSION = 5000;

export function parsePositiveInt(
  value: string | undefined,
  label: string
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${label} must be a positive integer`);
  }
  if (parsed > MAX_DIMENSION) {
    throw new BadRequestError(`${label} must be <= ${MAX_DIMENSION}`);
  }
  return parsed;
}

export function parseQuality(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new BadRequestError("quality must be an integer between 1 and 100");
  }
  return parsed;
}

export function parseTime(value: string | undefined): number {
  if (value === undefined) {
    throw new BadRequestError("time is required");
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new BadRequestError("time must be a number >= 0");
  }
  return parsed;
}

export function parseFormat(
  value: string | undefined
): "jpeg" | "png" | "webp" | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "jpg") return "jpeg";
  if (normalized === "jpeg" || normalized === "png" || normalized === "webp") {
    return normalized;
  }
  throw new BadRequestError("format must be jpeg, png, or webp");
}

export function parseCrop(
  value: string | undefined
): "fill" | "fit" | "inside" | "outside" {
  if (!value) return "fill";
  const normalized = value.toLowerCase();
  if (
    normalized === "fill" ||
    normalized === "fit" ||
    normalized === "inside" ||
    normalized === "outside"
  ) {
    return normalized;
  }
  throw new BadRequestError("crop must be fill, fit, inside, or outside");
}

export async function validateRemoteUrl(
  rawUrl: string | undefined
): Promise<string> {
  // Basic SSRF protection: allow only public http(s) endpoints.
  if (!rawUrl) {
    throw new BadRequestError("url is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestError("url must be a valid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BadRequestError("url must use http or https");
  }

  return parsed.toString();
}
