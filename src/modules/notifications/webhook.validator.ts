import { promises as dns } from 'dns';
import { ValidationError } from '../../shared/errors';

const BLOCKED = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fe80:/i,
  /^0\.0\.0\.0$/,
  /^localhost$/i,
];

function isBlocked(host: string): boolean {
  return BLOCKED.some((r) => r.test(host));
}

export async function validateWebhookUrl(url: string): Promise<void> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new ValidationError('Invalid webhook URL'); }

  if (parsed.protocol !== 'https:') throw new ValidationError('Webhook URL must use HTTPS');

  // Node.js keeps brackets in hostname for IPv6 (e.g. "[::1]") — strip them before checking
  const host = parsed.hostname.replace(/^\[(.+)\]$/, '$1');
  if (isBlocked(host)) throw new ValidationError('Webhook URL points to a private or loopback address');

  const ips = [
    ...(await dns.resolve4(parsed.hostname).catch(() => [])),
    ...(await dns.resolve6(parsed.hostname).catch(() => [])),
  ];
  for (const ip of ips) {
    if (isBlocked(ip)) throw new ValidationError('Webhook URL resolves to a private or reserved IP');
  }
}
