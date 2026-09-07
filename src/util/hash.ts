import { createHash } from "node:crypto";

/** Node-only. Build-time content hashing for exact-duplicate detection. */
export function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}
