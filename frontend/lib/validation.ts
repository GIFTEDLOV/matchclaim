import type { Condition } from "./types";

export const MAX_ID_LENGTH = 64;
export const MAX_HOST_COUNT = 16;
export const MAX_HOST_LENGTH = 253;
export const MAX_URL_LENGTH = 2048;

export function validateId(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required`;
  if (value.trim() !== value) return `${label} must not have surrounding spaces`;
  if (value.length > MAX_ID_LENGTH) return `${label} must be ${MAX_ID_LENGTH} characters or fewer`;
  if (/[\x00\r\n]/.test(value)) return `${label} contains a forbidden control character`;
  return null;
}

export function canonicalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

export function validateHostname(value: string): string | null {
  const host = canonicalizeHostname(value);
  if (!host) return "Enter at least one competitor hostname";
  if (host.length > MAX_HOST_LENGTH) return "Hostname is too long";
  if (host === "localhost" || host.endsWith(".localhost")) return "Localhost is not allowed";
  if (/^(?:0x|\d)/.test(host) || host.replace(/\./g, "").match(/^\d+$/)) {
    return "Literal IP and hexadecimal hosts are not allowed";
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/.test(host)) {
    return "Use a lowercase DNS hostname such as retailer.example";
  }
  return null;
}

export function parseHostnames(value: string): { hosts: string[]; error?: string } {
  const hosts = value
    .split(/[\n,]+/)
    .map(canonicalizeHostname)
    .filter(Boolean);
  if (hosts.length < 1) return { hosts, error: "Add at least one approved hostname" };
  if (hosts.length > MAX_HOST_COUNT) return { hosts, error: `Use no more than ${MAX_HOST_COUNT} hostnames` };
  const seen = new Set<string>();
  for (const host of hosts) {
    const error = validateHostname(host);
    if (error) return { hosts, error: `${host}: ${error}` };
    if (seen.has(host)) return { hosts, error: "Approved hostnames must be unique" };
    seen.add(host);
  }
  return { hosts };
}

export function validateHttpsCompetitorUrl(value: string, approvedHosts: string[]): string | null {
  if (!value.trim()) return "Competitor URL is required";
  if (value.length > MAX_URL_LENGTH) return "URL is too long";
  if (/\s/.test(value)) return "URL must not contain whitespace";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "Enter a complete HTTPS URL";
  }
  if (parsed.protocol !== "https:") return "Competitor URL must use HTTPS";
  if (parsed.hash) return "URL fragments are not allowed";
  if (parsed.username || parsed.password) return "URL userinfo is not allowed";
  if (parsed.port) return "URL ports are not allowed";
  const hostname = canonicalizeHostname(parsed.hostname);
  const hostnameError = validateHostname(hostname);
  if (hostnameError) return hostnameError;
  if (!approvedHosts.map(canonicalizeHostname).includes(hostname)) {
    return "This hostname is not approved by the merchant policy";
  }
  return null;
}

export function validateCondition(value: string): value is Condition {
  return value === "NEW" || value === "REFURBISHED";
}

export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function isExpectedMissing(error: unknown, entity: string): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return text.toLowerCase().includes(`${entity.toLowerCase()} does not exist`);
}
