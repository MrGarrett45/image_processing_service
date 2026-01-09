import dns from "dns/promises";
import net from "net";
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

export function parseCrop(value: string | undefined): "fill" | "fit" | "inside" | "outside" {
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

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 4) return isPrivateIpv4(ip);
  if (net.isIP(ip) === 6) return isPrivateIpv6(ip);
  return false;
}

async function resolveHostToIps(hostname: string): Promise<string[]> {
  try {
    const [v4, v6] = await Promise.allSettled([
      dns.resolve4(hostname),
      dns.resolve6(hostname)
    ]);
    const ips: string[] = [];
    if (v4.status === "fulfilled") ips.push(...v4.value);
    if (v6.status === "fulfilled") ips.push(...v6.value);
    return ips;
  } catch {
    return [];
  }
}

export async function validateRemoteUrl(rawUrl: string | undefined): Promise<string> {
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

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new BadRequestError("url points to a disallowed host");
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new BadRequestError("url points to a private address");
    }
    return parsed.toString();
  }

  const resolvedIps = await resolveHostToIps(hostname);
  if (resolvedIps.length === 0) {
    throw new BadRequestError("url could not be resolved");
  }
  if (resolvedIps.some(isPrivateIp)) {
    throw new BadRequestError("url points to a private address");
  }

  return parsed.toString();
}
