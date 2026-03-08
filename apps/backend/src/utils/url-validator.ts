import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { config } from '../config';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
  'instance-data',
]);

/**
 * Check if an IPv4 address falls in a private or reserved range.
 */
function isPrivateOrReservedIp(ip: string): boolean {
  // Handle IPv6-mapped IPv4 (::ffff:x.x.x.x)
  if (ip.startsWith('::ffff:')) {
    const mapped = ip.slice(7);
    if (isIP(mapped) === 4) {
      return isPrivateOrReservedIp(mapped);
    }
  }

  // IPv6 loopback and link-local
  if (ip === '::1') return true;
  const lowerIp = ip.toLowerCase();
  if (lowerIp.startsWith('fe80:')) return true; // fe80::/10 link-local
  if (lowerIp.startsWith('fc') || lowerIp.startsWith('fd')) return true; // fc00::/7 ULA

  // IPv4 checks
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) return false;

  const [a, b] = parts;

  // 0.0.0.0/8
  if (a === 0) return true;
  // 127.0.0.0/8 (full loopback range)
  if (a === 127) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;

  return false;
}

/**
 * Validate a webhook URL is safe to call (no SSRF).
 * Resolves DNS to check the actual IP address.
 */
export async function validateWebhookUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`URL must use HTTPS or HTTP: ${url}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Fast-path: block well-known internal hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  // Check allowlist if configured
  const allowedHosts = config.webhookAllowedHosts;
  if (allowedHosts) {
    const allowed = new Set(allowedHosts.split(',').map((h) => h.trim().toLowerCase()));
    if (!allowed.has(hostname)) {
      throw new Error(`Hostname not in allowlist: ${hostname}`);
    }
  }

  // Resolve hostname to IP and validate
  let resolvedIp: string;
  if (isIP(hostname)) {
    resolvedIp = hostname;
  } else {
    try {
      const result = await lookup(hostname);
      resolvedIp = result.address;
    } catch {
      throw new Error(`Could not resolve hostname: ${hostname}`);
    }
  }

  if (isPrivateOrReservedIp(resolvedIp)) {
    throw new Error(`URL resolves to private/reserved IP (${resolvedIp}): ${hostname}`);
  }
}
