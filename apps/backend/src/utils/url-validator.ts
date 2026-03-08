import { config } from '../config';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  'metadata.google.internal',
  '169.254.169.254',
]);

const PRIVATE_IP_PREFIXES = ['10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.',
  '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.',
  '172.29.', '172.30.', '172.31.', '192.168.'];

export function validateWebhookUrl(url: string): void {
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

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  if (PRIVATE_IP_PREFIXES.some((prefix) => hostname.startsWith(prefix))) {
    throw new Error(`Private IP addresses are not allowed: ${hostname}`);
  }

  // Check allowlist if configured
  const allowedHosts = config.webhookAllowedHosts;
  if (allowedHosts) {
    const allowed = new Set(allowedHosts.split(',').map((h) => h.trim().toLowerCase()));
    if (!allowed.has(hostname)) {
      throw new Error(`Hostname not in allowlist: ${hostname}`);
    }
  }
}
