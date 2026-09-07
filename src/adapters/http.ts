/**
 * Shared HTTP helper for the real connectors: JSON GET with bearer auth, automatic
 * retry on 429 / 5xx with backoff, and a simple client-side rate cap so we stay under
 * each API's published limit (Airtable ~5 req/s, Drive per-user quotas, etc.).
 */

export interface HttpOptions {
  headers?: Record<string, string>;
  /** minimum ms between requests through this caller (rate cap) */
  minIntervalMs?: number;
}

export class HttpClient {
  private last = 0;
  private minInterval: number;
  private headers: Record<string, string>;

  constructor(opts: HttpOptions = {}) {
    this.minInterval = opts.minIntervalMs ?? 0;
    this.headers = opts.headers ?? {};
  }

  private async pace() {
    if (!this.minInterval) return;
    const wait = this.minInterval - (Date.now() - this.last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.last = Date.now();
  }

  async getJson<T = unknown>(url: string, extraHeaders: Record<string, string> = {}): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.pace();
      const res = await fetch(url, { headers: { accept: "application/json", ...this.headers, ...extraHeaders } });
      if (res.ok) return (await res.json()) as T;
      const retriable = res.status === 429 || res.status >= 500;
      if (!retriable || attempt >= 4) {
        throw new Error(`GET ${url} → ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`);
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  async getText(url: string, extraHeaders: Record<string, string> = {}): Promise<string> {
    await this.pace();
    const res = await fetch(url, { headers: { ...this.headers, ...extraHeaders } });
    if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
    return res.text();
  }

  async getBuffer(url: string, extraHeaders: Record<string, string> = {}): Promise<Buffer> {
    await this.pace();
    const res = await fetch(url, { headers: { ...this.headers, ...extraHeaders } });
    if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
