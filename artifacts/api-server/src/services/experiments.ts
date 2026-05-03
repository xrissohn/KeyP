// Tiny deterministic A/B cohort assigner. Same (deviceId, experimentId) →
// same bucket forever. No DB, no remote config — pure function. Buckets are
// 0-99 so consumers can write `bucket < 50` for a 50/50 split, etc.
//
// Hash: FNV-1a 32-bit over UTF-8 bytes. Cheap, stable across Node versions,
// and good enough distribution for cohort splits at the scales we care about.

function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // 32-bit FNV prime multiply (avoid BigInt; force >>> 0 to stay unsigned).
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function getCohort(deviceId: string | undefined | null, experimentId: string): number {
  const key = `${experimentId}:${deviceId ?? "anon"}`;
  return fnv1a32(key) % 100;
}

export type Variant = "control" | "treatment";

/**
 * Default 50/50 split. `treatmentPercent` lets you skew (e.g. 10 = treatment
 * gets 10% of devices, control gets 90%).
 */
export function pickVariant(
  deviceId: string | undefined | null,
  experimentId: string,
  treatmentPercent = 50,
): Variant {
  const bucket = getCohort(deviceId, experimentId);
  return bucket < treatmentPercent ? "treatment" : "control";
}
