import { chromium } from "@playwright/test";
import { readdir, readFile, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const inputDir =
    process.env.WORKFLOW_EXPORT_DIR || "outputs/workflow-evaluation",
  suffix = process.env.WORKFLOW_EXPORT_SUFFIX || ".docx",
  output =
    process.env.WORKFLOW_VERIFICATION_OUTPUT ||
    "docs/workflow-export-verification.json";
const expected = JSON.parse(
    await readFile("fixtures/workflow/expected.json", "utf8"),
  ),
  results = [];
try {
  await page.goto(process.env.DEMO_BASE_URL || "http://localhost:5173");
  await page
    .getByRole("button", { name: "Download Word", exact: true })
    .waitFor();
  for (const name of (await readdir(inputDir))
    .filter((x) => x.endsWith(suffix))
    .sort()) {
    const bytes = [...(await readFile(inputDir + "/" + name))];
    const result = await page.evaluate(
      async ({ bytes, expected }) => {
        const m = await import("/lib/workflow/browser.ts");
        const host = document.createElement("div");
        host.className = "workflow-runtime";
        document.body.appendChild(host);
        const sd = await m.openCopy(host, new Blob([new Uint8Array(bytes)]));
        try {
          const d = sd.activeEditor.doc;
          const module = await import("/lib/deal-desk/document.ts");
          const reading = await module.readDocument(d, {
              training: "consent",
              notice: 30,
            }),
            info = await d.info({}),
            comments = await d.comments.list({ limit: 1000 }),
            list = await d.lists.list({});
          return {
            tables: info.counts.tables,
            comments: info.counts.comments,
            markers: list.items.map((x) => x.marker),
            proposals: expected.proposals.map((p) => ({
              id: p.id,
              exact:
                reading.rows.find((r) => r.id === p.id)?.clause?.text ===
                p.after,
            })),
            counsel: reading.changes.filter(
              (c) => c.author === "Alex Chen · Meridian counsel",
            ).length,
            safeguardComment: comments.items.some(
              (c) =>
                c.text?.startsWith("Agreed terms · Numbered safeguard:") &&
                c.anchoredText ===
                  expected.proposals.find((p) => p.id === "safeguard").after,
            ),
            tracked: reading.changes.length,
          };
        } finally {
          sd.destroy();
          host.remove();
        }
      },
      { bytes, expected },
    );
    if (
      result.tables !== 3 ||
      result.counsel !== 2 ||
      result.markers.join(",") !== "1.,2.,3.,4." ||
      result.proposals.some((p) => !p.exact) ||
      !result.safeguardComment
    )
      throw new Error(name + " failed round trip");
    results.push({ file: name, ...result });
    console.log(name + " reopened and verified");
  }
  await writeFile(
    output,
    JSON.stringify(
      { browser: browser.version(), superdoc: "2.16.0", checks: results },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
