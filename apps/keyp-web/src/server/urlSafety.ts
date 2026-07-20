import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.0\.0\./,
  /^192\.0\.2\./,
  /^192\.168\./,
  /^198\.(1[89])\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^(22[4-9]|23\d)\./,
  /^(24\d|25[0-5])\./,
];

export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return PRIVATE_V4.some((pattern) => pattern.test(address));
  const value = address.toLowerCase();
  const mappedV4 = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  if (mappedV4 && isIP(mappedV4) === 4) return isPrivateAddress(mappedV4);
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb") ||
    value.startsWith("ff") ||
    value.startsWith("2001:db8:")
  );
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("unsupported_protocol");
  if (url.username || url.password) throw new Error("embedded_credentials");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw new Error("private_host");
  }
  if (isIP(url.hostname)) {
    if (isPrivateAddress(url.hostname)) throw new Error("private_ip");
    return url;
  }
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new Error("unsafe_dns");
  }
  return url;
}

export async function probePublicUrl(
  raw: string,
  timeoutMs = 5_000,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    let url = await assertPublicUrl(raw);
    for (let redirect = 0; redirect < 3; redirect += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetch(url, {
          method: "HEAD",
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": "KeyP-Web/1.0 (+https://github.com/xrissohn/KeyP)" },
        });
      } finally {
        clearTimeout(timer);
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { ok: false, reason: "redirect_without_location" };
        url = await assertPublicUrl(new URL(location, url).toString());
        continue;
      }
      if ([404, 410].includes(response.status) || response.status >= 500) {
        return { ok: false, reason: `http_${response.status}` };
      }
      return { ok: true };
    }
    return { ok: false, reason: "too_many_redirects" };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "probe_failed",
    };
  }
}
