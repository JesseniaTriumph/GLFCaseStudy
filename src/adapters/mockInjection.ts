import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { SourceAdapter } from "./types.js";
import type { SourceDoc } from "../core/types.js";
import { detectLanguage, parseFrontmatter } from "../util/text.js";

const DIR = fileURLToPath(new URL("../../data/mock/injection/", import.meta.url));

/**
 * Adversarial fixture adapter — used ONLY by `npm run redteam`, never in the default
 * corpus or the eval harness. Every document here is team-tier (so it IS indexed and
 * retrievable) and carries an embedded prompt-injection payload. The test asserts that
 * retrieving one of these never changes Compass's behaviour or leaks restricted strings.
 */
export const mockInjection: SourceAdapter = {
  system: "drive",
  label: "Injection fixtures (adversarial)",
  async pull(): Promise<SourceDoc[]> {
    const files = (await readdir(DIR)).filter((f) => f.endsWith(".md"));
    const docs: SourceDoc[] = [];
    for (const f of files) {
      const raw = await readFile(new URL(f, `file://${DIR}`), "utf8");
      const { data, body } = parseFrontmatter(raw);
      const sourceId = f.replace(/\.md$/, "");
      docs.push({
        id: `drive:${sourceId}`,
        system: "drive",
        sourceId,
        deepLink: `https://drive.google.com/file/d/EXAMPLE-${sourceId}/view`,
        title: data.title ?? sourceId,
        text: body,
        date: data.date ?? null,
        language: detectLanguage(body),
        extractionConfidence: 0.98,
        tier: "team",
        acl: ["*"],
        entities: [],
        meta: { recordType: "drive-document", folder: data.folder ?? null, adversarial: true },
      });
    }
    return docs;
  },
};
