import { chromium } from "@playwright/test";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const report = JSON.parse(
  await readFile(
    process.env.AGENT_FORMAL_REPORT ?? "docs/agent-evaluation-v1.json",
    "utf8",
  ),
);
const browser = await chromium.launch(),
  page = await browser.newPage();
await page.addInitScript({ content: "window.__name=(fn)=>fn;" });
const outputDir = process.env.AGENT_EXPORT_DIR ?? "outputs/agent-evaluation";
const checks = [];
try {
  await page.goto("http://localhost:5173/agent");
  await page.waitForFunction(() => !!(window as any).__agent);
  for (const file of (await readdir(outputDir)).filter((f) =>
    f.endsWith(".docx"),
  )) {
    const bytes = await readFile(outputDir + "/" + file),
      original = file.replace("-word.docx", ".docx"),
      run = report.runs.find((r: any) => r.export?.endsWith("/" + original));
    if (!run) continue;
    const checked = await page.evaluate(
      async ({ bytes, run }) => {
        const browserModule = "/lib/agent/browser.ts",
          documentModule = "/lib/agent/document.ts",
          reviewModule = "/lib/review/document.ts";
        const { createEditor } = await import(/* @vite-ignore */ browserModule),
          { documentIndex } = await import(/* @vite-ignore */ documentModule),
          { listChanges } = await import(/* @vite-ignore */ reviewModule);
        const host = document.createElement("div");
        host.style.cssText = "position:absolute;left:-15000px;width:1000px";
        document.body.appendChild(host);
        const sd = await createEditor(
          host,
          new File([new Uint8Array(bytes)], "reopened.docx"),
        );
        try {
          const doc = sd.activeEditor.doc,
            s = await documentIndex(
              doc,
              "Inspect reopened output",
              "0".repeat(64),
            ),
            changes = await listChanges(doc),
            info = await doc.info({}),
            comments = await doc.comments.list({ limit: 1000 }),
            lists = await doc.lists.list({});
          return {
            tables: info.counts.tables,
            comments: comments.items.length,
            markers: lists.items.map((x: any) => x.marker),
            counsel: changes.filter(
              (c: any) => c.author === "Alex Chen · Meridian counsel",
            ).length,
            tracked: changes.length,
            exact: run.lane.executions
              .filter((e: any) => e.verified)
              .every((e: any) =>
                s.blocks
                  .find((b: any) => b.id === e.edit.blockId)
                  ?.text.includes(e.edit.replacement),
              ),
          };
        } finally {
          sd.destroy();
          host.remove();
        }
      },
      { bytes: [...bytes], run },
    );
    const pass =
      checked.tables === 3 &&
      checked.comments === 2 &&
      checked.counsel === 2 &&
      checked.markers.join(",") === "1.,2.,3." &&
      checked.exact;
    checks.push({
      file,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      ...checked,
      pass,
    });
    console.log(file + ": " + pass);
  }
  await writeFile(
    process.env.AGENT_VERIFICATION_OUT ?? "docs/agent-export-verification.json",
    JSON.stringify(
      {
        superdoc: "2.16.0",
        browser: browser.version(),
        nativeWord:
          "Not performed by this browser script. Supplied -word files may be reopened here; actual Word opening/saving requires separate recorded provenance.",
        checks,
      },
      null,
      2,
    ) + "\n",
  );
  if (checks.some((c) => !c.pass)) process.exitCode = 1;
} finally {
  await browser.close();
}
