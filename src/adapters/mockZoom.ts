import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SourceAdapter } from "./types.js";
import type { SourceDoc } from "../core/types.js";
import { detectLanguage } from "../util/text.js";

const GEN = fileURLToPath(new URL("../../data/generated/zoom.json", import.meta.url));

/**
 * Mock Zoom Team Chat adapter — only active with COMPASS_CORPUS=full, and only for the
 * generated public-channel threads. It exists to demonstrate the "a decision only
 * half-lives in chat" case: the thread shows the team reasoning toward a call, and the
 * useful test is whether Compass surfaces that reasoning while the real Zoom governance
 * questions (retention, consent, DMs) are still unresolved. Programs-only tier; DMs never
 * modelled. The real adapter is `src/adapters/zoom.ts`.
 */
export const mockZoom: SourceAdapter = {
  system: "zoom-chat",
  label: "Zoom Team Chat (generated public-channel threads)",
  async pull(): Promise<SourceDoc[]> {
    if (process.env.COMPASS_CORPUS !== "full" || !existsSync(GEN)) return [];
    const db = JSON.parse(await readFile(GEN, "utf8"));
    return (db.threads ?? []).map((t: any) => {
      const text = `# ${t.channel} — ${t.date}\n\n` + t.messages.map((m: any) => `${m.at.slice(11, 16)} ${m.sender}: ${m.text}`).join("\n");
      return {
        id: `zoom-chat:${t.id}`,
        system: "zoom-chat",
        sourceId: t.id,
        deepLink: `https://zoom.us/account/archivemsg/search?channel=${encodeURIComponent(t.channel)}`,
        title: `${t.channel} thread — ${t.date}`,
        text,
        date: t.date,
        language: detectLanguage(text),
        extractionConfidence: 1,
        tier: "programs-only",
        acl: ["group:programs", "group:impact"],
        entities: [],
        meta: { recordType: "zoom-chat-thread", channel: t.channel },
      } satisfies SourceDoc;
    });
  },
};
