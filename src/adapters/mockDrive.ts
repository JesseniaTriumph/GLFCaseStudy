import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { SourceAdapter } from "./types.js";
import type { SourceDoc, Tier } from "../core/types.js";
import { detectLanguage, parseFrontmatter } from "../util/text.js";

const DIR = fileURLToPath(new URL("../../data/mock/drive/", import.meta.url));

/**
 * Mock Google Drive adapter.
 *
 * A real adapter would: use a scoped service account (domain-wide delegation) restricted
 * to an allowlist of Shared Drives, sync incrementally via the Drive changes feed, export
 * native Docs/Sheets/Slides to text, parse PDF/Word, OCR scanned documents (with a
 * confidence score), and carry each file's ACL + folder path. Here, markdown files with
 * frontmatter stand in for that.
 */
export const mockDrive: SourceAdapter = {
  system: "drive",
  label: "Google Drive (3 shared drives)",

  async pull(): Promise<SourceDoc[]> {
    const files = (await readdir(DIR)).filter((f) => f.endsWith(".md"));
    const docs: SourceDoc[] = [];
    for (const f of files) {
      const raw = await readFile(new URL(f, `file://${DIR}`), "utf8");
      const { data, body } = parseFrontmatter(raw);
      const tier = (data.tier as Tier) ?? "team";
      const sourceId = f.replace(/\.md$/, "");
      // Simulate OCR uncertainty for anything a filename marks as scanned.
      const extractionConfidence = /scan/i.test(f) ? 0.55 : 0.98;
      docs.push({
        id: `drive:${sourceId}`,
        system: "drive",
        sourceId,
        deepLink: `https://drive.google.com/file/d/EXAMPLE-${sourceId}/view`,
        title: data.title ?? sourceId,
        text: body,
        date: data.date ?? null,
        language: detectLanguage(body),
        extractionConfidence,
        tier,
        acl: tier === "programs-only" ? ["group:programs", "group:impact"] : ["*"], // team = any signed-in staff; programs-only = Programs + Impact
        entities: [],
        meta: {
          recordType: "drive-document",
          folder: data.folder ?? null,
          author: data.author ?? null,
          grantId: data.grant ?? null,
          duplicateOfPortal: data.duplicate_of_portal ?? null,
        },
      });
    }
    return docs;
  },
};
